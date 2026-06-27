import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Bank, Pocket, Allocation, AppSettings } from '@/types';
import { supabase } from '@/utils/supabase/client';
import { useAuthStore } from './useAuthStore';

interface AppError {
  message: string;
  /** Optional human-friendly context, e.g. "Reordering banks". */
  context?: string;
}

interface PocketRouterState {
  banks: Bank[];
  pockets: Pocket[];
  allocations: Allocation[];
  settings: AppSettings;
  isLoading: boolean;
  lastError: AppError | null;

  // Actions
  fetchData: () => Promise<void>;
  setError: (error: AppError | null) => void;
  clearError: () => void;
  /**
   * Wipe all domain data (banks / pockets / allocations / settings) and stop
   * any realtime channels. Used on logout so the next user on the same
   * device never sees the previous user's persisted state.
   */
  clearLocalData: () => void;

  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;

  addBank: (bank: Bank) => Promise<void>;
  updateBank: (id: string, bank: Partial<Bank>) => Promise<void>;
  deleteBank: (id: string) => Promise<void>;
  reorderBanks: (orderedIds: string[]) => Promise<void>;

  addPocket: (pocket: Pocket) => Promise<void>;
  updatePocket: (id: string, pocket: Partial<Pocket>) => Promise<void>;
  deletePocket: (id: string) => Promise<void>;
  reorderPockets: (orderedIds: string[]) => Promise<void>;

  addAllocation: (allocation: Allocation) => Promise<void>;
  updateAllocation: (id: string, allocation: Partial<Allocation>) => Promise<void>;
  deleteAllocation: (id: string) => Promise<void>;

  transferBetweenBanks: (
    pocketId: string,
    fromBankId: string,
    toBankId: string,
    amount: number
  ) => Promise<boolean>;

  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

// --- Realtime channel state (module-level so it survives store re-mounts) ---
let banksChannel: RealtimeChannel | null = null;
let pocketsChannel: RealtimeChannel | null = null;
let allocationsChannel: RealtimeChannel | null = null;

// --- DB row → app entity mappers ---
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

export const usePocketRouterStore = create<PocketRouterState>()(
  persist(
    (set, get) => ({
      banks: [],
      pockets: [],
      allocations: [],
      settings: {
        currency: 'THB',
        storageType: 'local',
      },
      isLoading: false,
      lastError: null,

      setError: (error) => set({ lastError: error }),
      clearError: () => set({ lastError: null }),

      clearLocalData: () => {
        // Defensive: drop realtime channels before wiping state so callbacks
        // don't fire on the old (now-cleared) data. unsubscribeRealtime is
        // idempotent — safe to call even when no channel is active.
        get().unsubscribeRealtime();
        set({
          banks: [],
          pockets: [],
          allocations: [],
          settings: { currency: 'THB', storageType: 'local' },
          lastError: null,
        });
        // The zustand `persist` middleware auto-writes on state changes, so
        // the empty arrays + default settings above will land in localStorage
        // on the next tick. No explicit clearStorage() needed.
      },

      fetchData: async () => {
        const state = get();
        if (state.settings.storageType !== 'supabase') return;

        const user = useAuthStore.getState().user;
        if (!user) return;

        set({ isLoading: true });
        try {
          const [
            { data: dbBanks, error: banksErr },
            { data: dbPockets, error: pocketsErr },
            { data: dbAllocations, error: allocsErr },
            { data: dbSettings, error: settingsErr },
          ] = await Promise.all([
            supabase.from('banks').select('*'),
            supabase.from('pockets').select('*'),
            supabase.from('allocations').select('*'),
            supabase.from('settings').select('*'),
          ]);

          if (banksErr) throw banksErr;
          if (pocketsErr) throw pocketsErr;
          if (allocsErr) throw allocsErr;
          if (settingsErr) throw settingsErr;

          // Preserve any locally-known order (from zustand persist) — only the
          // order of rows we haven't seen before stays undefined.
          const localBanks = new Map(state.banks.map((b) => [b.id, b.order]));
          const localPockets = new Map(state.pockets.map((p) => [p.id, p.order]));

          const banks: Bank[] = (dbBanks || []).map((b) => {
            const mapped = mapDbBank(b as DbBank);
            if (mapped.order == null && localBanks.has(mapped.id)) {
              mapped.order = localBanks.get(mapped.id);
            }
            return mapped;
          });
          const pockets: Pocket[] = (dbPockets || []).map((p) => {
            const mapped = mapDbPocket(p as DbPocket);
            if (mapped.order == null && localPockets.has(mapped.id)) {
              mapped.order = localPockets.get(mapped.id);
            }
            return mapped;
          });
          const allocations: Allocation[] = (dbAllocations || []).map((a) =>
            mapDbAllocation(a as DbAllocation)
          );

          const currency =
            dbSettings && dbSettings.length > 0
              ? dbSettings[0].currency
              : state.settings.currency || 'THB';

          set({
            banks,
            pockets,
            allocations,
            settings: { currency, storageType: 'supabase' },
            isLoading: false,
          });
        } catch (error) {
          console.error('Error fetching data from Supabase:', error);
          set({
            isLoading: false,
            lastError: {
              message: (error as Error)?.message || 'Failed to load data',
              context: 'Loading your data',
            },
          });
        }
      },

      // --- Realtime subscription ---
      subscribeRealtime: () => {
        // Already subscribed → no-op
        if (banksChannel || pocketsChannel || allocationsChannel) return;

        banksChannel = supabase
          .channel('banks-changes')
          .on<DbBank>(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'banks' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const bank = mapDbBank(payload.new);
                set((s) =>
                  s.banks.some((b) => b.id === bank.id) ? s : { banks: [...s.banks, bank] }
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
            }
          )
          .subscribe();

        pocketsChannel = supabase
          .channel('pockets-changes')
          .on<DbPocket>(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'pockets' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const pocket = mapDbPocket(payload.new);
                set((s) =>
                  s.pockets.some((p) => p.id === pocket.id)
                    ? s
                    : { pockets: [...s.pockets, pocket] }
                );
              } else if (payload.eventType === 'UPDATE') {
                const pocket = mapDbPocket(payload.new);
                set((s) => ({
                  pockets: s.pockets.map((p) => (p.id === pocket.id ? pocket : p)),
                }));
              } else if (payload.eventType === 'DELETE') {
                const id = payload.old?.id;
                if (!id) return;
                set((s) => ({
                  pockets: s.pockets.filter((p) => p.id !== id),
                  allocations: s.allocations.filter((a) => a.pocketId !== id),
                }));
              }
            }
          )
          .subscribe();

        allocationsChannel = supabase
          .channel('allocations-changes')
          .on<DbAllocation>(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'allocations' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const alloc = mapDbAllocation(payload.new);
                set((s) =>
                  s.allocations.some((a) => a.id === alloc.id)
                    ? s
                    : { allocations: [...s.allocations, alloc] }
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
            }
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

      // --- Banks ---
      addBank: async (bank) => {
        const state = get();
        const user = useAuthStore.getState().user;

        if (!user && state.banks.length >= 3) {
          alert('Offline mode allows a maximum of 3 banks. Please log in to add more.');
          return;
        }

        const fullBank: Bank = { ...bank, order: bank.order ?? state.banks.length + 1 };
        const previousBanks = state.banks;
        const useCloud = state.settings.storageType === 'supabase';

        // Optimistic
        set({ banks: [...previousBanks, fullBank] });

        if (!useCloud) return;

        const { error } = await supabase.from('banks').insert({
          id: fullBank.id,
          user_id: user?.id,
          name: fullBank.name,
          interest_rate: fullBank.interestRate,
          logo_url: fullBank.logoUrl,
          theme_color: fullBank.themeColor,
          created_at: fullBank.createdAt,
          order: fullBank.order,
        });

        if (error) {
          // Rollback
          set({ banks: previousBanks, lastError: { message: error.message, context: 'Adding bank' } });
        }
      },

      updateBank: async (id, updatedBank) => {
        const state = get();
        const previousBanks = state.banks;
        const useCloud = state.settings.storageType === 'supabase';

        // Optimistic
        set({
          banks: previousBanks.map((b) => (b.id === id ? { ...b, ...updatedBank } : b)),
        });

        if (!useCloud) return;

        const { error } = await supabase
          .from('banks')
          .update({
            name: updatedBank.name,
            interest_rate: updatedBank.interestRate,
            logo_url: updatedBank.logoUrl,
            theme_color: updatedBank.themeColor,
          })
          .eq('id', id);

        if (error) {
          set({
            banks: previousBanks,
            lastError: { message: error.message, context: 'Updating bank' },
          });
        }
      },

      deleteBank: async (id) => {
        const state = get();
        const previousBanks = state.banks;
        const previousAllocations = state.allocations;
        const useCloud = state.settings.storageType === 'supabase';

        // Optimistic
        set({
          banks: previousBanks.filter((b) => b.id !== id),
          allocations: previousAllocations.filter((a) => a.bankId !== id),
        });

        if (!useCloud) return;

        const { error } = await supabase.from('banks').delete().eq('id', id);

        if (error) {
          set({
            banks: previousBanks,
            allocations: previousAllocations,
            lastError: { message: error.message, context: 'Deleting bank' },
          });
        }
      },

      reorderBanks: async (orderedIds) => {
        const state = get();
        const previousBanks = state.banks;
        const useCloud = state.settings.storageType === 'supabase';

        // Compute new order map
        const indexById = new Map<string, number>();
        orderedIds.forEach((id, idx) => indexById.set(id, idx + 1));

        const nextBanks = previousBanks.map((b) => ({
          ...b,
          order: indexById.get(b.id) ?? b.order ?? previousBanks.length,
        }));

        // Optimistic
        set({ banks: nextBanks });

        if (!useCloud) return;

        // Batch-update all rows
        const results = await Promise.allSettled(
          nextBanks.map((b) =>
            supabase.from('banks').update({ order: b.order }).eq('id', b.id)
          )
        );

        const failed = results.find(
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error)
        );
        if (failed) {
          const message =
            failed.status === 'fulfilled' && failed.value.error
              ? failed.value.error.message
              : 'Network error';
          set({
            banks: previousBanks,
            lastError: { message, context: 'Reordering banks' },
          });
        }
      },

      // --- Pockets ---
      addPocket: async (pocket) => {
        const state = get();
        const user = useAuthStore.getState().user;

        if (!user && state.pockets.length >= 5) {
          alert('Offline mode allows a maximum of 5 pockets. Please log in to add more.');
          return;
        }

        const fullPocket: Pocket = {
          ...pocket,
          order: pocket.order ?? state.pockets.length + 1,
        };
        const previousPockets = state.pockets;
        const useCloud = state.settings.storageType === 'supabase';

        set({ pockets: [...previousPockets, fullPocket] });

        if (!useCloud) return;

        const { error } = await supabase.from('pockets').insert({
          id: fullPocket.id,
          user_id: user?.id,
          name: fullPocket.name,
          target_amount: fullPocket.targetAmount,
          icon: fullPocket.icon,
          created_at: fullPocket.createdAt,
          order: fullPocket.order,
        });

        if (error) {
          set({
            pockets: previousPockets,
            lastError: { message: error.message, context: 'Adding pocket' },
          });
        }
      },

      updatePocket: async (id, updatedPocket) => {
        const state = get();
        const previousPockets = state.pockets;
        const useCloud = state.settings.storageType === 'supabase';

        set({
          pockets: previousPockets.map((p) =>
            p.id === id ? { ...p, ...updatedPocket } : p
          ),
        });

        if (!useCloud) return;

        const { error } = await supabase
          .from('pockets')
          .update({
            name: updatedPocket.name,
            target_amount: updatedPocket.targetAmount,
            icon: updatedPocket.icon,
          })
          .eq('id', id);

        if (error) {
          set({
            pockets: previousPockets,
            lastError: { message: error.message, context: 'Updating pocket' },
          });
        }
      },

      deletePocket: async (id) => {
        const state = get();
        const previousPockets = state.pockets;
        const previousAllocations = state.allocations;
        const useCloud = state.settings.storageType === 'supabase';

        set({
          pockets: previousPockets.filter((p) => p.id !== id),
          allocations: previousAllocations.filter((a) => a.pocketId !== id),
        });

        if (!useCloud) return;

        const { error } = await supabase.from('pockets').delete().eq('id', id);

        if (error) {
          set({
            pockets: previousPockets,
            allocations: previousAllocations,
            lastError: { message: error.message, context: 'Deleting pocket' },
          });
        }
      },

      reorderPockets: async (orderedIds) => {
        const state = get();
        const previousPockets = state.pockets;
        const useCloud = state.settings.storageType === 'supabase';

        const indexById = new Map<string, number>();
        orderedIds.forEach((id, idx) => indexById.set(id, idx + 1));

        const nextPockets = previousPockets.map((p) => ({
          ...p,
          order: indexById.get(p.id) ?? p.order ?? previousPockets.length,
        }));

        set({ pockets: nextPockets });

        if (!useCloud) return;

        const results = await Promise.allSettled(
          nextPockets.map((p) =>
            supabase.from('pockets').update({ order: p.order }).eq('id', p.id)
          )
        );

        const failed = results.find(
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error)
        );
        if (failed) {
          const message =
            failed.status === 'fulfilled' && failed.value.error
              ? failed.value.error.message
              : 'Network error';
          set({
            pockets: previousPockets,
            lastError: { message, context: 'Reordering pockets' },
          });
        }
      },

      // --- Allocations ---
      addAllocation: async (allocation) => {
        const state = get();
        const user = useAuthStore.getState().user;
        const previousAllocations = state.allocations;
        const useCloud = state.settings.storageType === 'supabase';

        set({ allocations: [...previousAllocations, allocation] });

        if (!useCloud) return;

        const { error } = await supabase.from('allocations').insert({
          id: allocation.id,
          user_id: user?.id,
          pocket_id: allocation.pocketId,
          bank_id: allocation.bankId,
          amount: allocation.amount,
          created_at: allocation.createdAt,
        });

        if (error) {
          set({
            allocations: previousAllocations,
            lastError: { message: error.message, context: 'Adding allocation' },
          });
        }
      },

      updateAllocation: async (id, updatedAllocation) => {
        const state = get();
        const previousAllocations = state.allocations;
        const useCloud = state.settings.storageType === 'supabase';

        set({
          allocations: previousAllocations.map((a) =>
            a.id === id ? { ...a, ...updatedAllocation } : a
          ),
        });

        if (!useCloud) return;

        const { error } = await supabase
          .from('allocations')
          .update({ amount: updatedAllocation.amount })
          .eq('id', id);

        if (error) {
          set({
            allocations: previousAllocations,
            lastError: { message: error.message, context: 'Updating allocation' },
          });
        }
      },

      deleteAllocation: async (id) => {
        const state = get();
        const previousAllocations = state.allocations;
        const useCloud = state.settings.storageType === 'supabase';

        set({ allocations: previousAllocations.filter((a) => a.id !== id) });

        if (!useCloud) return;

        const { error } = await supabase.from('allocations').delete().eq('id', id);

        if (error) {
          set({
            allocations: previousAllocations,
            lastError: { message: error.message, context: 'Deleting allocation' },
          });
        }
      },

      transferBetweenBanks: async (pocketId, fromBankId, toBankId, amount) => {
        const state = get();
        const user = useAuthStore.getState().user;
        const previousAllocations = state.allocations;
        const useCloud = state.settings.storageType === 'supabase';

        const sourceAlloc = previousAllocations.find(
          (a) => a.pocketId === pocketId && a.bankId === fromBankId
        );
        if (!sourceAlloc || sourceAlloc.amount < amount || amount <= 0) {
          return false;
        }

        const targetAlloc = previousAllocations.find(
          (a) => a.pocketId === pocketId && a.bankId === toBankId
        );

        const newSourceAmount = sourceAlloc.amount - amount;

        // Optimistic local update
        const optimisticAllocations = (() => {
          let next = [...previousAllocations];
          if (newSourceAmount <= 0) {
            next = next.filter((a) => a.id !== sourceAlloc.id);
          } else {
            next = next.map((a) =>
              a.id === sourceAlloc.id ? { ...a, amount: newSourceAmount } : a
            );
          }
          if (targetAlloc) {
            next = next.map((a) =>
              a.id === targetAlloc.id ? { ...a, amount: targetAlloc.amount + amount } : a
            );
          } else {
            next.push({
              id: crypto.randomUUID(),
              pocketId,
              bankId: toBankId,
              amount,
              createdAt: new Date().toISOString(),
            });
          }
          return next;
        })();

        set({ allocations: optimisticAllocations });

        if (!useCloud) return true;

        // Persist to DB
        try {
          if (newSourceAmount <= 0) {
            const { error } = await supabase
              .from('allocations')
              .delete()
              .eq('id', sourceAlloc.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('allocations')
              .update({ amount: newSourceAmount })
              .eq('id', sourceAlloc.id);
            if (error) throw error;
          }

          if (targetAlloc) {
            const { error } = await supabase
              .from('allocations')
              .update({ amount: targetAlloc.amount + amount })
              .eq('id', targetAlloc.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('allocations').insert({
              id: optimisticAllocations.find(
                (a) => a.pocketId === pocketId && a.bankId === toBankId
              )!.id,
              user_id: user?.id,
              pocket_id: pocketId,
              bank_id: toBankId,
              amount,
              created_at: new Date().toISOString(),
            });
            if (error) throw error;
          }
          return true;
        } catch (err) {
          const message = (err as Error)?.message || 'Transfer failed';
          set({
            allocations: previousAllocations,
            lastError: { message, context: 'Transferring between banks' },
          });
          return false;
        }
      },

      // --- Settings ---
      updateSettings: async (newSettings) => {
        const state = get();
        const user = useAuthStore.getState().user;
        const updated = { ...state.settings, ...newSettings };
        const previousSettings = state.settings;

        // Optimistic
        set({ settings: updated });

        // If we just toggled to supabase, fetch from DB
        if (newSettings.storageType === 'supabase' && previousSettings.storageType !== 'supabase') {
          await get().fetchData();
          return;
        }

        if (newSettings.storageType === 'local' && previousSettings.storageType !== 'local') {
          // Toggled to local — unsubscribe realtime
          get().unsubscribeRealtime();
          return;
        }

        // Persist currency change to cloud
        if (updated.storageType === 'supabase' && user && newSettings.currency !== undefined) {
          try {
            const { data: existing } = await supabase.from('settings').select('id');
            if (existing && existing.length > 0) {
              await supabase.from('settings').update({ currency: updated.currency }).eq('id', existing[0].id);
            } else {
              await supabase.from('settings').insert({
                user_id: user.id,
                currency: updated.currency,
              });
            }
          } catch (e) {
            const message = (e as Error)?.message || 'Failed to save settings';
            set({
              settings: previousSettings,
              lastError: { message, context: 'Updating settings' },
            });
          }
        }
      },
    }),
    {
      name: 'pocket-router-storage',
      // Only persist domain data + settings. Transient fields (isLoading,
      // lastError, realtime channel refs) live outside this store so they
      // never accidentally land in localStorage and survive a refresh.
      partialize: (state) => ({
        banks: state.banks,
        pockets: state.pockets,
        allocations: state.allocations,
        settings: state.settings,
      }),
    }
  )
);