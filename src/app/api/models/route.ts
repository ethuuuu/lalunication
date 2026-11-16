import { currentUser } from "@/auth";
import { getGeminiKey } from "@/lib/profile";

type ApiModel = { name: string; displayName?: string; supportedGenerationMethods?: string[]; thinking?: boolean };

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const key = await getGeminiKey(user);
  if (!key) return Response.json({ error: "No Gemini API key. Add one in Settings → AI." }, { status: 400 });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`,
    { cache: "no-store" },
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: j?.error?.message ?? `Gemini API error ${res.status}` }, { status: 502 });
  const models = ((j.models ?? []) as ApiModel[])
    .filter((m) => m.name.startsWith("models/gemini") && m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => {
      const id = m.name.replace(/^models\//, "");
      return { id, displayName: m.displayName ?? id, thinking: !!m.thinking };
    });
  return Response.json(models);
}
