/**
 * Invite & sharing domain types.
 *
 * The flow:
 *   1. Owner (logged in) creates an Invite via the settings page →
 *      a row in `invites` with a random `token` and a `permission`.
 *   2. Owner shares the URL `/invite/<token>` with a friend.
 *   3. Friend opens the link. If not logged in they're prompted to sign
 *      up. If logged in they hit "Accept" → a row in `share_access`
 *      records them as the accepter, inheriting the invite's permission.
 *   4. Friend visits `/share/<token>` to see (and, if `edit`, modify)
 *      the owner's banks / pockets / allocations.
 *
 * The owner can change permission or revoke access at any time from the
 * settings page — that just UPDATEs / DELETEs `share_access` rows.
 */

export type InvitePermission = 'view' | 'edit';

/** Raw row shape from `invites` (snake_case from Supabase). */
export interface DbInvite {
  id: string;
  owner_id: string;
  token: string;
  permission: InvitePermission;
  created_at: string;
  revoked: boolean;
}

/** App-side view of an invite (camelCase, with computed fields). */
export interface Invite {
  id: string;
  ownerId: string;
  /** Public token used in the share URL. */
  token: string;
  permission: InvitePermission;
  createdAt: string;
  revoked: boolean;
}

/** Raw row shape from `share_access`. */
export interface DbShareAccess {
  id: string;
  invite_id: string;
  owner_id: string;
  accepted_by: string;
  permission: InvitePermission;
  accepted_at: string;
}

/** App-side view of a granted share. */
export interface ShareAccess {
  id: string;
  inviteId: string;
  ownerId: string;
  /** User id of the friend who accepted. */
  acceptedBy: string;
  /** Friend's display name (resolved from `profiles`). */
  acceptedByName?: string;
  /** Friend's email if we can resolve it (from auth.users via profiles
   * join or simply not shown — we keep it optional). */
  acceptedByEmail?: string;
  permission: InvitePermission;
  acceptedAt: string;
}

/**
 * The combined view the settings page renders: one card per
 * outstanding share (an invite that has been accepted by at least one
 * person, OR an invite that is still pending).
 */
export interface ShareEntry {
  invite: Invite;
  /** Null if no one has accepted this invite yet. */
  shareAccess: ShareAccess | null;
}

/** Public landing-page payload for `/invite/[token]`. */
export interface InvitePreview {
  invite: Invite;
  owner: {
    id: string;
    displayName: string;
  };
}

export interface AcceptedShareEntry {
  id: string; // share_access.id
  inviteId: string;
  ownerId: string;
  ownerName: string;
  permission: InvitePermission;
  acceptedAt: string;
  token: string; // invite.token
}