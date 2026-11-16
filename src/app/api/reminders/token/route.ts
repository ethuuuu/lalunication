import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

/** Rotates the Apple Shortcut sync token. Returned once; the old token stops working immediately. */
export async function POST() {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = randomBytes(24).toString("base64url");
  await sql()`UPDATE profile SET reminders_sync_token = ${token} WHERE id = 1`;
  return Response.json({ token });
}
