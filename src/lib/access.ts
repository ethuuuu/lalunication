// Pure (no Next/Auth imports) so scripts/access.test.mjs can run it directly.

/** ALLOWED_DOMAIN (e.g. "christuniversity.in", also matches sub-domains) or, by default, the owner's email domain. */
export function allowedDomain() {
  return (process.env.ALLOWED_DOMAIN || process.env.ALLOWED_EMAIL?.split("@")[1] || "").trim().toLowerCase();
}

/** Owner = ALLOWED_EMAIL; only the owner gets the env-var fallbacks (shared Gemini key, iCloud creds). */
export function isOwner(email: string) {
  return !!process.env.ALLOWED_EMAIL && email === process.env.ALLOWED_EMAIL.trim().toLowerCase();
}

type GoogleProfile = { email?: string | null; email_verified?: boolean | null; hd?: unknown };

/** Verified university (Workspace) account in the allowed domain. Requiring `hd` blocks consumer
 *  Google accounts registered with a university address. */
export function isAllowed(p: GoogleProfile | undefined): boolean {
  const email = p?.email?.trim().toLowerCase();
  const d = allowedDomain();
  if (!email || !d || !p?.email_verified || !p.hd) return false;
  const host = email.split("@")[1] ?? "";
  return host === d || host.endsWith("." + d);
}
