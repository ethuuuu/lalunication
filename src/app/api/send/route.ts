import { currentUser } from "@/auth";
import { emailDraftSchema } from "@/lib/agent-prompt";
import { sendGmail } from "@/lib/sources";

export async function POST(req: Request) {
  if (!(await currentUser())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = emailDraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  }
  try {
    return Response.json({ id: await sendGmail(parsed.data) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: /expired|401/.test(msg) ? 401 : 502 });
  }
}
