import { z } from "zod";
import { currentUser } from "@/auth";
import { sql, type Contact } from "@/lib/db";
import { ContactBody } from "../schema";

const Id = z.coerce.number().int().positive();

export async function PUT(req: Request, ctx: RouteContext<"/api/contacts/[id]">) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "Invalid id" }, { status: 400 });
  const parsed = ContactBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { name, email, roles, notes } = parsed.data;
  const rows = (await sql()`
    UPDATE contacts SET name = ${name}, email = ${email}, roles = ${roles}::text[], notes = ${notes}
    WHERE id = ${id.data} AND user_email = ${user} RETURNING id, name, email, roles, notes`) as Contact[];
  if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(rows[0]);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/contacts/[id]">) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "Invalid id" }, { status: 400 });
  const rows = (await sql()`DELETE FROM contacts WHERE id = ${id.data} AND user_email = ${user} RETURNING id`) as { id: number }[];
  if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
