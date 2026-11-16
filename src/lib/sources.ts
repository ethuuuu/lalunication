import { DAVClient } from "tsdav";
import { googleToken } from "@/auth";
import { sql, type Contact, type EmailDraft } from "@/lib/db";
import { getIcloudCreds } from "@/lib/profile";
import { parseIcalEvents } from "@/lib/ical";
import { buildRawMessage, toBase64Url } from "@/lib/mime";

type Range = { timeMin: string; timeMax: string; query?: string };

const words = (s?: string) => (s ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** Every query word appears somewhere in the text. */
const matches = (text: string, query?: string) => words(query).every((w) => text.toLowerCase().includes(w));
const trunc = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n) + "…" : s ?? "");

async function gfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await googleToken()}`, "Content-Type": "application/json", ...init?.headers },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google API ${res.status}: ${j?.error?.message ?? res.statusText}`);
  return j as T;
}

type GDate = { date?: string; dateTime?: string };

export async function googleCalendarEvents({ timeMin, timeMax, query }: Range) {
  const list = await gfetch<{ items?: { id: string; summary: string }[] }>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
  );
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  if (query) params.set("q", query);
  const results = await Promise.allSettled(
    (list.items ?? []).map(async (cal) => {
      const r = await gfetch<{ items?: { summary?: string; description?: string; start: GDate; end: GDate }[] }>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
      );
      return (r.items ?? []).map((e) => ({
        calendar: cal.summary,
        title: e.summary ?? "(no title)",
        start: e.start.dateTime ?? e.start.date ?? "",
        end: e.end.dateTime ?? e.end.date ?? "",
        allDay: !e.start.dateTime,
        description: trunc(e.description, 300),
      }));
    }),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  if (!ok.length && results.length) throw (results[0] as PromiseRejectedResult).reason;
  return ok.flatMap((r) => r.value).sort((a, b) => a.start.localeCompare(b.start));
}

export async function appleCalendarEvents(user: string, { timeMin, timeMax, query }: Range) {
  const creds = await getIcloudCreds(user);
  if (!creds) throw new Error("Apple Calendar not configured in Settings");
  const client = new DAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: creds,
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();
  const calendars = (await client.fetchCalendars()).filter((c) => !c.components || c.components.includes("VEVENT"));
  // shortcut: recurring events aren't expanded (only the master's first occurrence is shown); add `expand: true` if iCloud handles it.
  const perCal = await Promise.all(
    calendars.map(async (cal) => {
      const objs = await client.fetchCalendarObjects({ calendar: cal, timeRange: { start: timeMin, end: timeMax } });
      const name = typeof cal.displayName === "string" ? cal.displayName : "iCloud";
      return objs.flatMap((o) =>
        parseIcalEvents(String(o.data ?? "")).map((e) => ({ calendar: name, ...e, description: trunc(e.description, 300) })),
      );
    }),
  );
  return perCal
    .flat()
    .filter((e) => matches(`${e.title} ${e.description}`, query))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function googleTasks({ query }: { query?: string }) {
  const lists = await gfetch<{ items?: { id: string; title: string }[] }>(
    "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100",
  );
  const perList = await Promise.all(
    (lists.items ?? []).map(async (l) => {
      const r = await gfetch<{ items?: { title?: string; notes?: string; due?: string }[] }>(
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(l.id)}/tasks?showCompleted=false&maxResults=100`,
      );
      return (r.items ?? []).map((t) => ({ list: l.title, title: t.title ?? "", notes: trunc(t.notes, 300), due: t.due ?? null }));
    }),
  );
  return perList.flat().filter((t) => matches(`${t.title} ${t.notes}`, query));
}

export async function appleReminders(user: string, { query }: { query?: string }) {
  return (await sql()`
    SELECT title, notes, due, list_name FROM reminders
    WHERE user_email = ${user} AND NOT completed
      AND (SELECT coalesce(bool_and((title || ' ' || notes) ILIKE '%' || w || '%'), true) FROM unnest(${words(query)}::text[]) w)
    ORDER BY due NULLS LAST LIMIT 50`) as { title: string; notes: string; due: string | null; list_name: string }[];
}

/** Word-wise, case-insensitive: "maths teacher" finds roles ["subject teacher: maths"]. */
export async function contacts(user: string, { role, name }: { role?: string; name?: string }) {
  return (await sql()`
    SELECT id, name, email, roles, notes FROM contacts
    WHERE user_email = ${user}
      AND (SELECT coalesce(bool_and(array_to_string(roles, ',') ILIKE '%' || w || '%'), true) FROM unnest(${words(role)}::text[]) w)
      AND (SELECT coalesce(bool_and(name ILIKE '%' || w || '%'), true) FROM unnest(${words(name)}::text[]) w)
    ORDER BY name LIMIT 50`) as Contact[];
}

export async function sendGmail(draft: Pick<EmailDraft, "to" | "cc" | "subject" | "body"> & { from?: string }) {
  const raw = toBase64Url(buildRawMessage(draft));
  const r = await gfetch<{ id: string }>("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
  return r.id;
}
