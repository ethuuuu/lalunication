import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { parseReminders } from "./parse";

/** Called by a user's Apple Shortcut (no session). The bearer token identifies the user via its sha256. */
export async function POST(req: Request) {
  const given = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  // Lookup by sha256 of a 192-bit random token: no plaintext at rest, and lookup timing reveals nothing usable.
  const hash = given ? createHash("sha256").update(given).digest("hex") : "";
  const rows = hash
    ? ((await sql()`SELECT user_email FROM profile WHERE reminders_sync_token_hash = ${hash}`) as { user_email: string }[])
    : [];
  const user = rows[0]?.user_email;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body must be JSON: { reminders: [...] }" }, { status: 400 });
  const rs = parseReminders(body);
  const db = sql();
  await db.transaction([
    db`DELETE FROM reminders WHERE user_email = ${user}`,
    db`INSERT INTO reminders (user_email, title, notes, due, list_name, completed)
       SELECT ${user}, * FROM unnest(
         ${rs.map((r) => r.title)}::text[], ${rs.map((r) => r.notes)}::text[],
         ${rs.map((r) => r.due)}::timestamptz[], ${rs.map((r) => r.list_name)}::text[],
         ${rs.map((r) => r.completed)}::boolean[])`,
  ]);
  return Response.json({ count: rs.length });
}
