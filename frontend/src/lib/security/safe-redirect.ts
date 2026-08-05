/**
 * Where it is safe to send someone after signing in.
 *
 * The `next` parameter arrives in a URL, so it is attacker-controlled. Without
 * this, a crafted link would sign a visitor in and then bounce them to another
 * site — an open redirect, which is how a phishing page borrows the
 * credibility of a real domain.
 *
 * Only a path on this site is allowed. Note the second check: `//evil.example`
 * begins with a slash but browsers read it as protocol-relative and will
 * happily leave the site.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/account'): string {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  // A backslash is treated as a forward slash by some browsers when parsing
  // authority, so /\evil.example can escape too.
  if (value.startsWith('/\\')) return fallback
  return value
}
