// Pure iCalendar helpers (no imports) so scripts/sources.test.mjs can run them under plain node.

export type IcalEvent = { title: string; start: string; end: string; allDay: boolean; description: string };

function unescapeText(s: string) {
  return s.replace(/\\([nN,;\\])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
}

/**
 * "VALUE=DATE" → "2026-11-20"; "...Z" → "2026-11-20T09:30:00Z";
 * TZID → "2026-11-20T09:30:00 (Asia/Kolkata)"; floating → "2026-11-20T09:30:00".
 * shortcut: TZID times are labelled, not converted; fine for an LLM reading them.
 */
export function parseIcalDate(params: string, value: string): { iso: string; allDay: boolean } {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { iso: value.trim(), allDay: false };
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { iso: `${y}-${mo}-${d}`, allDay: true };
  const tz = params.match(/TZID=("?)([^;:"]+)\1/i)?.[2];
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : tz ? ` (${tz})` : ""}`, allDay: false };
}

/** Parses the VEVENTs in an iCal document (SUMMARY/DTSTART/DTEND/DESCRIPTION only). */
export function parseIcalEvents(ics: string): IcalEvent[] {
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); // unfold continuation lines
  const events: IcalEvent[] = [];
  let cur: IcalEvent | null = null;
  let depth = 0; // skip nested VALARM etc.
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = { title: "", start: "", end: "", allDay: false, description: "" }; depth = 0; continue; }
    if (!cur) continue;
    if (line === "END:VEVENT") { events.push(cur); cur = null; continue; }
    if (line.startsWith("BEGIN:")) depth++;
    else if (line.startsWith("END:")) depth--;
    if (depth > 0) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const semi = head.indexOf(";");
    const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
    const params = semi < 0 ? "" : head.slice(semi + 1);
    if (name === "SUMMARY") cur.title = unescapeText(value);
    else if (name === "DESCRIPTION") cur.description = unescapeText(value);
    else if (name === "DTSTART") { const p = parseIcalDate(params, value); cur.start = p.iso; cur.allDay = p.allDay; }
    else if (name === "DTEND") cur.end = parseIcalDate(params, value).iso;
  }
  return events;
}
