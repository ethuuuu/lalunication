import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
import { parseReminders } from "./parse";

const h = (s: string) => createHash("sha256").update(s).digest();

/** Called by the Apple Shortcut (no session). Bearer token must match profile.reminders_sync_token. */
export async function POST(req: Request) {
  const given = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const rows = (await sql()`SELECT reminders_sync_token FROM profile WHERE id = 1`) as {
    reminders_sync_token: string | null;
  }[];
  const expected = rows[0]?.reminders_sync_token;
  // Hash both sides so timingSafeEqual gets equal-length buffers.
  if (!expected || !given || !timingSafeEqual(h(given), h(expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body must be JSON: { reminders: [...] }" }, { status: 400 });
  const rs = parseReminders(body);
  const db = sql();
  await db.transaction([
    db`DELETE FROM reminders`,
    db`INSERT INTO reminders (title, notes, due, list_name, completed)
       SELECT * FROM unnest(
         ${rs.map((r) => r.title)}::text[], ${rs.map((r) => r.notes)}::text[],
         ${rs.map((r) => r.due)}::timestamptz[], ${rs.map((r) => r.list_name)}::text[],
         ${rs.map((r) => r.completed)}::boolean[])`,
  ]);
  return Response.json({ count: rs.length });
}
