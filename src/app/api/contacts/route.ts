import { z } from "zod";
import { currentUser } from "@/auth";
import { sql, type Contact } from "@/lib/db";
import { ContactBody } from "./schema";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = (await sql()`SELECT id, name, email, roles, notes FROM contacts WHERE user_email = ${user} ORDER BY lower(name), id`) as Contact[];
  return Response.json(rows);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ContactBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { name, email, roles, notes } = parsed.data;
  const rows = (await sql()`
    INSERT INTO contacts (user_email, name, email, roles, notes) VALUES (${user}, ${name}, ${email}, ${roles}::text[], ${notes})
    RETURNING id, name, email, roles, notes`) as Contact[];
  return Response.json(rows[0], { status: 201 });
}
