import { sql, type Profile } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

type Row = Omit<Profile, "has_gemini_key" | "has_icloud_password"> & {
  gemini_api_key_enc: string | null;
  icloud_app_password_enc: string | null;
};

async function row(): Promise<Row> {
  const rows = (await sql()`SELECT * FROM profile WHERE id = 1`) as Row[];
  return rows[0];
}

/** Profile safe to send to the browser (no secrets). */
export async function getProfile(): Promise<Profile> {
  const { gemini_api_key_enc, icloud_app_password_enc, ...p } = await row();
  return {
    ...p,
    has_gemini_key: !!gemini_api_key_enc || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    has_icloud_password: !!icloud_app_password_enc || !!process.env.ICLOUD_APP_PASSWORD,
  };
}

/** Settings-page key wins; falls back to the Vercel env var. */
export async function getGeminiKey(): Promise<string | null> {
  const r = await row();
  return r.gemini_api_key_enc ? decrypt(r.gemini_api_key_enc) : (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null);
}

export async function getIcloudCreds(): Promise<{ username: string; password: string } | null> {
  const r = await row();
  const username = r.icloud_username || process.env.ICLOUD_USERNAME || "";
  const password = r.icloud_app_password_enc ? decrypt(r.icloud_app_password_enc) : (process.env.ICLOUD_APP_PASSWORD ?? "");
  return username && password ? { username, password } : null;
}
