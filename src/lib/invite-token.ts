/**
 * Invite token helpers.
 *
 * The token is the only secret guarding an invite link — anyone who
 * has the URL can hit /invite/<token>. We therefore want enough
 * entropy that it can't be brute-forced but short enough that it
 * copies/pastes cleanly.
 *
 * 24 random bytes (192 bits) → ~32 base64url chars. Collision odds for
 * 10k active invites are ~10⁻⁵³ — negligible.
 */

const TOKEN_BYTES = 24;

/**
 * Generates a URL-safe random token.
 *
 * Uses `crypto.getRandomValues` which is available in every modern
 * browser and in Node 19+. Falls back to the `webcrypto` namespace
 * for environments where the global `crypto` accessor is incomplete.
 */
export function generateInviteToken(): string {
  const g = globalThis as unknown as {
    crypto?: Crypto & { webcrypto?: Crypto };
  };

  const c: Crypto | undefined =
    g.crypto && typeof g.crypto.getRandomValues === 'function'
      ? g.crypto
      : g.crypto?.webcrypto;

  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('No CSPRNG available — cannot generate invite token.');
  }

  const bytes = new Uint8Array(TOKEN_BYTES);
  c.getRandomValues(bytes);

  // base64url: replace +/ with -_, drop padding.
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Defensive shape check on tokens pulled from the URL — we never want
 * to round-trip arbitrary user input into a Supabase query without
 * narrowing first.
 *
 * Allowed alphabet: base64url (`A-Z a-z 0-9 - _`), length 32-64.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

export function isValidInviteTokenFormat(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

/**
 * Build the shareable URL the owner copies to send to a friend.
 * Uses `window.location.origin` so it works in dev, preview, and prod
 * without configuration.
 */
export function buildInviteUrl(token: string): string {
  if (typeof window === 'undefined') {
    // Server-side fallback — relative URL still works for display.
    return `/invite/${token}`;
  }
  return `${window.location.origin}/invite/${token}`;
}