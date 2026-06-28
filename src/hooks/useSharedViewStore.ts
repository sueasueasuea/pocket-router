import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase/client';
import { useAuthStore } from './useAuthStore';
import {
  Bank,
  Pocket,
  Allocation,
  AppSettings,
  InvitePermission,
} from '@/types';

// ---- DB row mappers (mirror the shape in usePocketRouterStore) ----------

type DbBank = {
  id: string;
  name: string;
  interest_rate: string | number;
  logo_url?: string | null;
  theme_color: string;
  created_at: string;
  order?: number | null;
};

type DbPocket = {
  id: string;
  name: string;
  target_amount?: number | string | null;
  icon: string;
  created_at: string;
  order?: number | null;
};

type DbAllocation = {
  id: string;
  pocket_id: string;
  bank_id: string;
  amount: number | string;
  created_at: string;
};

function mapDbBank(b: DbBank): Bank {
  return {
    id: b.id,
    name: b.name,
    interestRate: parseFloat(b.interest_rate as string),
    logoUrl: b.logo_url || undefined,
    themeColor: b.theme_color,
    createdAt: b.created_at,
    order: typeof b.order === 'number' ? b.order : undefined,
  };
}

function mapDbPocket(p: DbPocket): Pocket {
  return {
    id: p.id,
    name: p.name,
    targetAmount: p.target_amount != null ? parseFloat(p.target_amount as string) : undefined,
    icon: p.icon,
    createdAt: p.created_at,
    order: typeof p.order === 'number' ? p.order : undefined,
  };
}

function mapDbAllocation(a: DbAllocation): Allocation {
  return {
    id: a.id,
    pocketId: a.pocket_id,
    bankId: a.bank_id,
    amount: parseFloat(a.amount as string),
    createdAt: a.created_at,
  };
}

// ---- State -------------------------------------------------------------

interface SharedViewState {
  /** Token of the invite currently being viewed. */
  token: string | null;
  /** Owner's user id — every row we mutate is filtered by this. */
  ownerId: string | null;
  /** Owner's display name (resolved from `profiles`). */
  ownerName: string | null;
  /** Effective permission the current viewer has on this owner's data. */
  permission: InvitePermission | null;

  banks: Bank[];
  pockets: Pocket[];
  allocations: Allocation[];
  settings: AppSettings;

  isLoading: boolean;
  lastError: string | null;

  // --- lifecycle ---
  /** Loads owner's data + permission for a given invite token. Returns
   *  true on success, false if access denied / token revoked. */
  loadSharedView: (token: string) => Promise<boolean>;
  /** Wipes everything — called on route exit. */
  reset: () => void;

  // --- realtime ---
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;

  // --- mutations (edit only; UI must gate on permission === 'edit') ---

  addBank: (bank: Bank) => Promise<boolean>;
  updateBank: (id: string, bank: Partial<Bank>) => Promise<boolean>;
  deleteBank: (id: string) => Promise<boolean>;
  reorderBanks: (orderedIds: string[]) => Promise<boolean>;

  addPocket: (pocket: Pocket) => Promise<boolean>;
  updatePocket: (id: string, pocket: Partial<Pocket>) => Promise<boolean>;
  deletePocket: (id: string) => Promise<boolean>;
  reorderPockets: (orderedIds: string[]) => Promise<boolean>;

  addAllocation: (allocation: Allocation) => Promise<boolean>;
  updateAllocation: (id: string, allocation: Partial<Allocation>) => Promise<boolean>;
  deleteAllocation: (id: string) => Promise<boolean>;
}

// ---- Module-level channel handles --------------------------------------

let banksChannel: RealtimeChannel | null = null;
let pocketsChannel: RealtimeChannel | null = null;
let allocationsChannel: RealtimeChannel | null = null;

// ---- Store -------------------------------------------------------------

export const useSharedViewStore = create<SharedViewState>()((set, get) => ({
  token: null,
  ownerId: null,
  ownerName: null,
  permission: null,
  banks: [],
  pockets: [],
  allocations: [],
  settings: { currency: 'THB', storageType: 'supabase' },
  isLoading: false,
  lastError: null,

  loadSharedView: async (token) => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ lastError: 'You must be signed in to view a shared wallet.' });
      return false;
    }

    set({ isLoading: true, lastError: null, token });

    try {
      // 1) Resolve invite + share_access in one round-trip. RLS lets
      //    us SELECT invites by token AND share_access rows where we
      //    are the owner OR the accepter. If we don't have a
      //    share_access row for this token, access is denied.
      const { data: inviteRows, error: inviteErr } = await supabase
        .from('invites')
        .select(
          `id, owner_id, token, permission, created_at, revoked,
           share_access (*)`,
        )
        .eq('token', token)
        .maybeSingle();

      if (inviteErr) throw inviteErr;
      if (!inviteRows) {
        set({
          isLoading: false,
          lastError: 'This invite link is invalid or has been revoked.',
          token: null,
        });
        return false;
      }

      if (inviteRows.revoked) {
        set({
          isLoading: false,
          lastError: 'This invite link has been revoked by the owner.',
          token: null,
        });
        return false;
      }

      // Pick OUR share_access row out of the join.
      const rawJoin = (inviteRows as unknown as {
        share_access: unknown;
      }).share_access;
      const joined: Array<{ accepted_by: string; permission: InvitePermission }> = Array.isArray(
        rawJoin,
      )
        ? (rawJoin as Array<{ accepted_by: string; permission: InvitePermission }>)
        : rawJoin
          ? [rawJoin as { accepted_by: string; permission: InvitePermission }]
          : [];

      const myAccess = joined.find((r) => r.accepted_by === user.id);
      if (!myAccess) {
        set({
          isLoading: false,
          lastError: "You haven't accepted this invite yet.",
          token: null,
        });
        return false;
      }

      const ownerId = inviteRows.owner_id as string;
      const permission = myAccess.permission;

      // 2) Resolve owner's display name.
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', ownerId)
        .maybeSingle();

      const ownerName =
        (profileRow?.display_name as string | undefined)?.trim() || 'Someone';

      // 3) Pull the owner's banks / pockets / allocations / settings.
      //    RLS already filters to (user_id = owner) OR share-with-view
      //    so we don't need to add explicit filters — but we DO add
      //    them for clarity and to leverage indexes.
      const [
        { data: dbBanks, error: banksErr },
        { data: dbPockets, error: pocketsErr },
        { data: dbAllocations, error: allocsErr },
        { data: dbSettings, error: settingsErr },
      ] = await Promise.all([
        supabase.from('banks').select('*').eq('user_id', ownerId),
        supabase.from('pockets').select('*').eq('user_id', ownerId),
        supabase.from('allocations').select('*').eq('user_id', ownerId),
        supabase.from('settings').select('*').eq('user_id', ownerId),
      ]);

      if (banksErr) throw banksErr;
      if (pocketsErr) throw pocketsErr;
      if (allocsErr) throw allocsErr;
      if (settingsErr) throw settingsErr;

      const settings: AppSettings =
        dbSettings && dbSettings.length > 0
          ? {
              user_id: ownerId,
              currency: (dbSettings[0].currency as string) || 'THB',
              storageType: 'supabase',
            }
          : { user_id: ownerId, currency: 'THB', storageType: 'supabase' };

      set({
        ownerId,
        ownerName,
        permission,
        banks: (dbBanks || []).map((b) => mapDbBank(b as DbBank)),
        pockets: (dbPockets || []).map((p) => mapDbPocket(p as DbPocket)),
        allocations: (dbAllocations || []).map((a) => mapDbAllocation(a as DbAllocation)),
        settings,
        isLoading: false,
        lastError: null,
      });

      return true;
    } catch (err) {
      const message = (err as Error)?.message || 'Failed to load shared view';
      set({ isLoading: false, lastError: message, token: null });
      return false;
    }
  },

  reset: () => {
    get().unsubscribeRealtime();
    set({
      token: null,
      ownerId: null,
      ownerName: null,
      permission: null,
      banks: [],
      pockets: [],
      allocations: [],
      settings: { currency: 'THB', storageType: 'supabase' },
      isLoading: false,
      lastError: null,
    });
  },

  // ---- realtime -------------------------------------------------------

  subscribeRealtime: () => {
    const { ownerId } = get();
    if (!ownerId) return;
    if (banksChannel || pocketsChannel || allocationsChannel) return;

    banksChannel = supabase
      .channel(`shared-banks-${ownerId}`)
      .on<DbBank>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banks', filter: `user_id=eq.${ownerId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const bank = mapDbBank(payload.new);
            set((s) =>
              s.banks.some((b) => b.id === bank.id) ? s : { banks: [...s.banks, bank] },
            );
          } else if (payload.eventType === 'UPDATE') {
            const bank = mapDbBank(payload.new);
            set((s) => ({ banks: s.banks.map((b) => (b.id === bank.id ? bank : b)) }));
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (!id) return;
            set((s) => ({
              banks: s.banks.filter((b) => b.id !== id),
              allocations: s.allocations.filter((a) => a.bankId !== id),
            }));
          }
        },
      )
      .subscribe();

    pocketsChannel = supabase
      .channel(`shared-pockets-${ownerId}`)
      .on<DbPocket>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pockets', filter: `user_id=eq.${ownerId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const pocket = mapDbPocket(payload.new);
            set((s) =>
              s.pockets.some((p) => p.id === pocket.id)
                ? s
                : { pockets: [...s.pockets, pocket] },
            );
          } else if (payload.eventType === 'UPDATE') {
            const pocket = mapDbPocket(payload.new);
            set((s) => ({ pockets: s.pockets.map((p) => (p.id === pocket.id ? pocket : p)) }));
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (!id) return;
            set((s) => ({
              pockets: s.pockets.filter((p) => p.id !== id),
              allocations: s.allocations.filter((a) => a.pocketId !== id),
            }));
          }
        },
      )
      .subscribe();

    allocationsChannel = supabase
      .channel(`shared-allocations-${ownerId}`)
      .on<DbAllocation>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'allocations', filter: `user_id=eq.${ownerId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const alloc = mapDbAllocation(payload.new);
            set((s) =>
              s.allocations.some((a) => a.id === alloc.id)
                ? s
                : { allocations: [...s.allocations, alloc] },
            );
          } else if (payload.eventType === 'UPDATE') {
            const alloc = mapDbAllocation(payload.new);
            set((s) => ({
              allocations: s.allocations.map((a) => (a.id === alloc.id ? alloc : a)),
            }));
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (!id) return;
            set((s) => ({ allocations: s.allocations.filter((a) => a.id !== id) }));
          }
        },
      )
      .subscribe();
  },

  unsubscribeRealtime: () => {
    if (banksChannel) {
      supabase.removeChannel(banksChannel);
      banksChannel = null;
    }
    if (pocketsChannel) {
      supabase.removeChannel(pocketsChannel);
      pocketsChannel = null;
    }
    if (allocationsChannel) {
      supabase.removeChannel(allocationsChannel);
      allocationsChannel = null;
    }
  },

  // ---- mutations (all gated on permission === 'edit') ------------------

  addBank: async (bank) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    set((s) => ({ banks: [...s.banks, bank] }));
    const { error } = await supabase.from('banks').insert({
      id: bank.id,
      user_id: ownerId,
      name: bank.name,
      interest_rate: bank.interestRate,
      logo_url: bank.logoUrl,
      theme_color: bank.themeColor,
      created_at: bank.createdAt,
      order: bank.order,
    });
    if (error) {
      set((s) => ({ banks: s.banks.filter((b) => b.id !== bank.id), lastError: error.message }));
      return false;
    }
    return true;
  },

  updateBank: async (id, updated) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previous = get().banks;
    set({ banks: previous.map((b) => (b.id === id ? { ...b, ...updated } : b)) });
    const { error } = await supabase
      .from('banks')
      .update({
        name: updated.name,
        interest_rate: updated.interestRate,
        logo_url: updated.logoUrl,
        theme_color: updated.themeColor,
      })
      .eq('id', id);
    if (error) {
      set({ banks: previous, lastError: error.message });
      return false;
    }
    return true;
  },

  deleteBank: async (id) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previousBanks = get().banks;
    const previousAllocs = get().allocations;
    set({
      banks: previousBanks.filter((b) => b.id !== id),
      allocations: previousAllocs.filter((a) => a.bankId !== id),
    });
    const { error } = await supabase.from('banks').delete().eq('id', id);
    if (error) {
      set({ banks: previousBanks, allocations: previousAllocs, lastError: error.message });
      return false;
    }
    return true;
  },

  reorderBanks: async (orderedIds) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previous = get().banks;
    const indexById = new Map<string, number>();
    orderedIds.forEach((id, idx) => indexById.set(id, idx + 1));
    const next = previous.map((b) => ({
      ...b,
      order: indexById.get(b.id) ?? b.order ?? previous.length,
    }));
    set({ banks: next });
    const results = await Promise.allSettled(
      next.map((b) => supabase.from('banks').update({ order: b.order }).eq('id', b.id)),
    );
    const failed = results.find(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error),
    );
    if (failed) {
      const message =
        failed.status === 'fulfilled' && failed.value.error
          ? failed.value.error.message
          : 'Network error';
      set({ banks: previous, lastError: message });
      return false;
    }
    return true;
  },

  addPocket: async (pocket) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    set((s) => ({ pockets: [...s.pockets, pocket] }));
    const { error } = await supabase.from('pockets').insert({
      id: pocket.id,
      user_id: ownerId,
      name: pocket.name,
      target_amount: pocket.targetAmount,
      icon: pocket.icon,
      created_at: pocket.createdAt,
      order: pocket.order,
    });
    if (error) {
      set((s) => ({
        pockets: s.pockets.filter((p) => p.id !== pocket.id),
        lastError: error.message,
      }));
      return false;
    }
    return true;
  },

  updatePocket: async (id, updated) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previous = get().pockets;
    set({
      pockets: previous.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    });
    const { error } = await supabase
      .from('pockets')
      .update({
        name: updated.name,
        target_amount: updated.targetAmount,
        icon: updated.icon,
      })
      .eq('id', id);
    if (error) {
      set({ pockets: previous, lastError: error.message });
      return false;
    }
    return true;
  },

  deletePocket: async (id) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previousPockets = get().pockets;
    const previousAllocs = get().allocations;
    set({
      pockets: previousPockets.filter((p) => p.id !== id),
      allocations: previousAllocs.filter((a) => a.pocketId !== id),
    });
    const { error } = await supabase.from('pockets').delete().eq('id', id);
    if (error) {
      set({ pockets: previousPockets, allocations: previousAllocs, lastError: error.message });
      return false;
    }
    return true;
  },

  reorderPockets: async (orderedIds) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previous = get().pockets;
    const indexById = new Map<string, number>();
    orderedIds.forEach((id, idx) => indexById.set(id, idx + 1));
    const next = previous.map((p) => ({
      ...p,
      order: indexById.get(p.id) ?? p.order ?? previous.length,
    }));
    set({ pockets: next });
    const results = await Promise.allSettled(
      next.map((p) => supabase.from('pockets').update({ order: p.order }).eq('id', p.id)),
    );
    const failed = results.find(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error),
    );
    if (failed) {
      const message =
        failed.status === 'fulfilled' && failed.value.error
          ? failed.value.error.message
          : 'Network error';
      set({ pockets: previous, lastError: message });
      return false;
    }
    return true;
  },

  addAllocation: async (allocation) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    set((s) => ({ allocations: [...s.allocations, allocation] }));
    const { error } = await supabase.from('allocations').insert({
      id: allocation.id,
      user_id: ownerId,
      pocket_id: allocation.pocketId,
      bank_id: allocation.bankId,
      amount: allocation.amount,
      created_at: allocation.createdAt,
    });
    if (error) {
      set((s) => ({
        allocations: s.allocations.filter((a) => a.id !== allocation.id),
        lastError: error.message,
      }));
      return false;
    }
    return true;
  },

  updateAllocation: async (id, updated) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previous = get().allocations;
    set({
      allocations: previous.map((a) => (a.id === id ? { ...a, ...updated } : a)),
    });
    const { error } = await supabase
      .from('allocations')
      .update({ amount: updated.amount })
      .eq('id', id);
    if (error) {
      set({ allocations: previous, lastError: error.message });
      return false;
    }
    return true;
  },

  deleteAllocation: async (id) => {
    const { ownerId, permission } = get();
    if (permission !== 'edit' || !ownerId) return false;
    const previous = get().allocations;
    set({ allocations: previous.filter((a) => a.id !== id) });
    const { error } = await supabase.from('allocations').delete().eq('id', id);
    if (error) {
      set({ allocations: previous, lastError: error.message });
      return false;
    }
    return true;
  },
}));