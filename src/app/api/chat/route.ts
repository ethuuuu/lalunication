import { createGoogle } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { currentUser } from "@/auth";
import { getGeminiKey, getProfile } from "@/lib/profile";
import { agentPrompt, emailDraftSchema } from "@/lib/agent-prompt";
import * as src from "@/lib/sources";

export const maxDuration = 60;

/** Tools never throw: the agent sees {ok:false} and falls back to the next source. */
const safe =
  <I, T>(fn: (input: I) => Promise<T[]>) =>
  async (input: I) => {
    try {
      return { ok: true as const, items: await fn(input) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  };

const range = z.object({
  timeMin: z.string().describe("RFC 3339 start, e.g. 2026-11-20T00:00:00+05:30"),
  timeMax: z.string().describe("RFC 3339 end"),
  query: z.string().optional().describe("Keyword(s) to match in the title/description"),
});
const q = z.object({ query: z.string().optional().describe("Keyword(s) to match") });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getGeminiKey(user);
  if (!apiKey) return Response.json({ error: "Gemini API key missing. Add it in Settings." }, { status: 400 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  const profile = await getProfile(user);

  const tools = {
    get_my_profile: tool({
      description: "The student's name, registration number, class and email.",
      inputSchema: z.object({}),
      execute: safe(async () => [
        { full_name: profile.full_name, reg_no: profile.reg_no, class_name: profile.class_name, email: profile.email },
      ]),
    }),
    find_contacts: tool({
      description: 'Find university contacts by role (e.g. "class teacher", "HOD", "maths teacher") and/or name.',
      inputSchema: z.object({ role: z.string().optional(), name: z.string().optional() }),
      execute: safe((i: { role?: string; name?: string }) => src.contacts(user, i)),
    }),
    search_google_calendar: tool({
      description: "Search events across all of the student's Google Calendars in a time range.",
      inputSchema: range,
      execute: safe(src.googleCalendarEvents),
    }),
    search_apple_calendar: tool({
      description: "Search events in the student's iCloud (Apple) Calendar in a time range.",
      inputSchema: range,
      execute: safe((i: z.infer<typeof range>) => src.appleCalendarEvents(user, i)),
    }),
    search_google_tasks: tool({
      description: "Search the student's open Google Tasks.",
      inputSchema: q,
      execute: safe(src.googleTasks),
    }),
    search_apple_reminders: tool({
      description: "Search the student's open Apple Reminders.",
      inputSchema: q,
      execute: safe((i: z.infer<typeof q>) => src.appleReminders(user, i)),
    }),
    draft_email: tool({
      description: "Show the email draft to the user as a card with a Send button. Does NOT send. Call again to revise.",
      inputSchema: emailDraftSchema,
      execute: async (draft) => draft,
    }),
  };

  const result = streamText({
    model: createGoogle({ apiKey })(profile.model),
    // Provider maps this per model: thinkingLevel for Gemini 3+, thinkingBudget for 2.5.
    reasoning: profile.thinking_level === "off" ? "none" : profile.thinking_level,
    instructions: agentPrompt(profile),
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: isStepCount(8),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      onError: (e) => (e instanceof Error ? e.message : String(e)),
    }),
  });
}
