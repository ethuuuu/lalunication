import { z } from "zod";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { encrypt } from "@/lib/crypto";

const secret = z.string().trim().nullable().optional();

const Body = z.object({
  full_name: z.string().trim(),
  email: z.string().trim(),
  reg_no: z.string().trim(),
  class_name: z.string().trim(),
  model: z.string().trim().min(1),
  thinking_level: z.enum(["off", "low", "medium", "high"]),
  icloud_username: z.string().trim(),
  gemini_api_key: secret,
  icloud_app_password: secret,
});

/** non-empty → encrypted value; null → clear; omitted/empty → keep (set=false). */
function secretUpdate(v: string | null | undefined) {
  if (v === null) return { set: true, val: null };
  if (v) return { set: true, val: encrypt(v) };
  return { set: false, val: null };
}

export async function GET() {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getProfile());
}

export async function PUT(req: Request) {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const b = parsed.data;
  const g = secretUpdate(b.gemini_api_key);
  const i = secretUpdate(b.icloud_app_password);
  await sql()`
    UPDATE profile SET
      full_name = ${b.full_name}, email = ${b.email}, reg_no = ${b.reg_no}, class_name = ${b.class_name},
      model = ${b.model}, thinking_level = ${b.thinking_level}, icloud_username = ${b.icloud_username},
      gemini_api_key_enc = CASE WHEN ${g.set}::boolean THEN ${g.val}::text ELSE gemini_api_key_enc END,
      icloud_app_password_enc = CASE WHEN ${i.set}::boolean THEN ${i.val}::text ELSE icloud_app_password_enc END
    WHERE id = 1`;
  return Response.json(await getProfile());
}
