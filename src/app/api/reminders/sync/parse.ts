export type ParsedReminder = { title: string; notes: string; due: string | null; list_name: string; completed: boolean };

const str = (v: unknown) => (v == null ? "" : typeof v === "string" ? v.trim() : String(v).trim());

/** Accepts ISO 8601 or "YYYY-MM-DD HH:mm"; anything unparseable → null. */
export function parseDue(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  // shortcut: "YYYY-MM-DD HH:mm" has no zone, so it's read in the server's TZ (UTC on Vercel); the Shortcut steps ask for ISO 8601.
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}/.test(s) ? s.replace(" ", "T") : s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const truthy = (v: unknown) => v === true || v === 1 || ["true", "yes", "1"].includes(str(v).toLowerCase());

/** Apple Shortcuts sends loose JSON: a single object instead of a list, strings for booleans, missing fields. */
export function parseReminders(body: unknown): ParsedReminder[] {
  let list = (body as { reminders?: unknown } | null)?.reminders;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  const arr: unknown[] = Array.isArray(list) ? list : list && typeof list === "object" ? [list] : [];
  return arr
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      title: str(r.title),
      notes: str(r.notes),
      due: parseDue(r.due),
      list_name: str(r.list ?? r.list_name),
      completed: truthy(r.completed),
    }))
    .filter((r) => r.title);
}
