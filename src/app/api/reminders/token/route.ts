import { createHash, randomBytes } from "node:crypto";
import { currentUser } from "@/auth";
import { getProfile } from "@/lib/profile";
import { sql } from "@/lib/db";

/** Rotates the Apple Shortcut sync token. Returned once; the old token stops working immediately. */
export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = randomBytes(24).toString("base64url");
  await getProfile(user); // ensure row exists
  const hash = createHash("sha256").update(token).digest("hex");
  await sql()`UPDATE profile SET reminders_sync_token_hash = ${hash} WHERE user_email = ${user}`;
  return Response.json({ token });
}
