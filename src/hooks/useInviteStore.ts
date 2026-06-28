import { create } from 'zustand';
import { supabase } from '@/utils/supabase/client';
import { useAuthStore } from './useAuthStore';
import { usePocketRouterStore } from './usePocketRouterStore';
import {
  DbInvite,
  DbShareAccess,
  Invite,
  InvitePermission,
  ShareAccess,
  ShareEntry,
} from '@/types';
import { generateInviteToken } from '@/lib/invite-token';

// ---- DB → app mappers --------------------------------------------------

function mapInvite(row: DbInvite): Invite {
  return {
    id: row.id,
    ownerId: row.owner_id,
    token: row.token,
    permission: row.permission,
    createdAt: row.created_at,
    revoked: row.revoked,
  };
}

function mapShareAccess(row: DbShareAccess): ShareAccess {
  return {
    id: row.id,
    inviteId: row.invite_id,
    ownerId: row.owner_id,
    acceptedBy: row.accepted_by,
    permission: row.permission,
    acceptedAt: row.accepted_at,
  };
}

// ---- State shape -------------------------------------------------------

interface InviteState {
  /** Combined invite + share_access rows for the current owner. */
  entries: ShareEntry[];
  isLoading: boolean;
  lastError: string | null;

  // --- queries ---
  fetchEntries: () => Promise<void>;

  // --- mutations ---
  /**
   * Create a new invite token. Returns the persisted Invite so the
   * settings page can immediately show the shareable URL.
   */
  createInvite: (permission: InvitePermission) => Promise<Invite | null>;
  /** Mark an invite revoked — anyone holding the link can no longer
   *  accept it, and existing share_access rows are kept (owner can
   *  delete them separately if they want to immediately cut access). */
  revokeInvite: (inviteId: string) => Promise<void>;
  /** Change permission on a granted share (or pending invite — owner
   *  might want to bump permission before anyone accepts). */
  updatePermission: (
    inviteId: string,
    permission: InvitePermission,
  ) => Promise<void>;
  /** Delete a granted share — immediately cuts off the friend's access. */
  deleteShareAccess: (shareAccessId: string) => Promise<void>;
}

// ---- Helpers -----------------------------------------------------------

interface JoinedShareRow {
  invite: DbInvite;
  share_access: DbShareAccess | DbShareAccess[] | null;
}

function pickFirst<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Supabase foreign-key joins can return the related row either as a
 * single object (single-row join) or as an array (one-to-many). This
 * helper normalizes both into a single object-or-null.
 */
function normalizeJoined(row: JoinedShareRow): {
  invite: Invite;
  shareAccess: ShareAccess | null;
} {
  const sa = pickFirst(row.share_access);
  return { invite: mapInvite(row.invite), shareAccess: sa ? mapShareAccess(sa) : null };
}

// ---- Store -------------------------------------------------------------

export const useInviteStore = create<InviteState>()((set, get) => ({
  entries: [],
  isLoading: false,
  lastError: null,

  fetchEntries: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ entries: [], isLoading: false });
      return;
    }

    set({ isLoading: true, lastError: null });
    try {
      // Pull invites with any matching share_access rows. The relation
      // name `share_access` matches the table — Supabase will
      // automatically embed related rows.
      const { data, error } = await supabase
        .from('invites')
        .select(
          `*,
          share_access (*)`,
        )
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Resolve display names / emails for accepted users.
      const acceptedByIds = Array.from(
        new Set(
          (data ?? [])
            .flatMap((row) =>
              pickFirst((row as unknown as JoinedShareRow).share_access)
                ? [pickFirst((row as unknown as JoinedShareRow).share_access)!.accepted_by]
                : [],
            ),
        ),
      );

      let profilesById = new Map<string, { display_name: string }>();
      if (acceptedByIds.length > 0) {
        const { data: profileRows, error: profileErr } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', acceptedByIds);
        if (profileErr) throw profileErr;
        profilesById = new Map(
          (profileRows ?? []).map((p) => [p.id as string, { display_name: p.display_name as string }]),
        );
      }

      const entries: ShareEntry[] = (data ?? []).map((row) => {
        const normalized = normalizeJoined(row as unknown as JoinedShareRow);
        const sa = normalized.shareAccess;
        if (sa && profilesById.has(sa.acceptedBy)) {
          sa.acceptedByName = profilesById.get(sa.acceptedBy)!.display_name;
        }
        return { invite: normalized.invite, shareAccess: sa };
      });

      set({ entries, isLoading: false });
    } catch (err) {
      const message = (err as Error)?.message || 'Failed to load sharing settings';
      set({ isLoading: false, lastError: message });
    }
  },

  createInvite: async (permission) => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ lastError: 'You must be logged in to create an invite.' });
      return null;
    }

    // Defensive cap: don't let one owner create thousands of invites
    // in a tight loop. The UI hides the button once at the cap.
    const state = get();
    if (state.entries.length >= 50) {
      set({ lastError: 'You already have the maximum number of active invites (50).' });
      return null;
    }

    const token = generateInviteToken();
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('invites')
        .insert({
          owner_id: user.id,
          token,
          permission,
          created_at: now,
          revoked: false,
        })
        .select('*')
        .single();

      if (error) throw error;

      const invite = mapInvite(data as DbInvite);
      // Optimistic prepend so the new link appears immediately.
      set({
        entries: [{ invite, shareAccess: null }, ...state.entries],
        lastError: null,
      });
      return invite;
    } catch (err) {
      const message = (err as Error)?.message || 'Failed to create invite';
      set({ lastError: message });
      return null;
    }
  },

  revokeInvite: async (inviteId) => {
    const state = get();
    const previous = state.entries;
    // Optimistic: mark revoked + filter out any related share_access
    // visually (we don't actually delete it — that's the owner's call).
    set({
      entries: previous.map((e) =>
        e.invite.id === inviteId ? { ...e, invite: { ...e.invite, revoked: true } } : e,
      ),
    });

    const { error } = await supabase
      .from('invites')
      .update({ revoked: true })
      .eq('id', inviteId);

    if (error) {
      set({ entries: previous, lastError: error.message });
    }
  },

  updatePermission: async (inviteId, permission) => {
    const state = get();
    const previous = state.entries;

    // Optimistic — flip in-place.
    set({
      entries: previous.map((e) => {
        if (e.invite.id !== inviteId) return e;
        return {
          invite: { ...e.invite, permission },
          shareAccess: e.shareAccess ? { ...e.shareAccess, permission } : null,
        };
      }),
    });

    // Update both the invite row (default for future acceptances) and
    // any existing share_access rows tied to it (so current access
    // immediately reflects the new permission).
    const [{ error: inviteErr }, { error: accessErr }] = await Promise.all([
      supabase.from('invites').update({ permission }).eq('id', inviteId),
      supabase
        .from('share_access')
        .update({ permission })
        .eq('invite_id', inviteId),
    ]);

    if (inviteErr || accessErr) {
      set({
        entries: previous,
        lastError:
          (inviteErr || accessErr)!.message || 'Failed to update permission',
      });
    }
  },

  deleteShareAccess: async (shareAccessId) => {
    const state = get();
    const previous = state.entries;
    // Optimistic: keep the invite row (it's still valid for re-sharing),
    // drop the share_access row from view.
    set({
      entries: previous.map((e) =>
        e.shareAccess?.id === shareAccessId ? { ...e, shareAccess: null } : e,
      ),
    });

    const { error } = await supabase
      .from('share_access')
      .delete()
      .eq('id', shareAccessId);

    if (error) {
      set({ entries: previous, lastError: error.message });
    }
  },
}));

// Re-export the picker for the settings UI which sometimes wants to
// query a single entry without subscribing to the whole list.
export function pickShareAccess(entries: ShareEntry[], inviteId: string): ShareAccess | null {
  return entries.find((e) => e.invite.id === inviteId)?.shareAccess ?? null;
}

// Cross-store cleanup hook for signOut — called from useAuthStore.
export function clearInviteState() {
  useInviteStore.setState({ entries: [], lastError: null, isLoading: false });
}

// Indirection so `useAuthStore` can call clearInviteState without
// creating a circular import. The auth store's signOut handler should
// invoke this alongside `clearLocalData`.
void usePocketRouterStore; // keep tree-shaker honest about the cross-store wiring