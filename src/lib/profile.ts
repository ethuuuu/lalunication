import { sql, type Profile } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { isOwner } from "@/lib/access";

type Row = Omit<Profile, "has_gemini_key" | "has_icloud_password"> & {
  gemini_api_key_enc: string | null;
  icloud_app_password_enc: string | null;
};

/** The user's profile row, created on first use (prefilled with their sign-in email). */
async function row(user: string): Promise<Row> {
  const rows = (await sql()`
    INSERT INTO profile (user_email, email) VALUES (${user}, ${user})
    ON CONFLICT (user_email) DO UPDATE SET user_email = EXCLUDED.user_email
    RETURNING *`) as Row[];
  return rows[0];
}

/** Profile safe to send to the browser (no secrets). */
export async function getProfile(user: string): Promise<Profile> {
  const { gemini_api_key_enc, icloud_app_password_enc, ...p } = await row(user);
  const owner = isOwner(user);
  return {
    ...p,
    has_gemini_key: !!gemini_api_key_enc || (owner && !!process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    has_icloud_password: !!icloud_app_password_enc || (owner && !!process.env.ICLOUD_APP_PASSWORD),
  };
}

/** User's saved key; the Vercel env key is a fallback for the owner only (others bring their own). */
export async function getGeminiKey(user: string): Promise<string | null> {
  const r = await row(user);
  if (r.gemini_api_key_enc) return decrypt(r.gemini_api_key_enc);
  return isOwner(user) ? (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null) : null;
}

export async function getIcloudCreds(user: string): Promise<{ username: string; password: string } | null> {
  const r = await row(user);
  const owner = isOwner(user);
  const username = r.icloud_username || (owner ? process.env.ICLOUD_USERNAME : "") || "";
  const password = r.icloud_app_password_enc
    ? decrypt(r.icloud_app_password_enc)
    : (owner ? process.env.ICLOUD_APP_PASSWORD : "") || "";
  return username && password ? { username, password } : null;
}
