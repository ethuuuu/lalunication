// Run: node --experimental-strip-types scripts/sources.test.mjs
import assert from "node:assert/strict";
import { parseIcalDate, parseIcalEvents } from "../src/lib/ical.ts";
import { buildRawMessage, encodeHeader, toBase64Url } from "../src/lib/mime.ts";

// iCal dates
assert.deepEqual(parseIcalDate("VALUE=DATE", "20261120"), { iso: "2026-11-20", allDay: true });
assert.deepEqual(parseIcalDate("", "20261120T093000Z"), { iso: "2026-11-20T09:30:00Z", allDay: false });
assert.deepEqual(parseIcalDate("TZID=Asia/Kolkata", "20261120T093000"), { iso: "2026-11-20T09:30:00 (Asia/Kolkata)", allDay: false });
assert.deepEqual(parseIcalDate('TZID="America/New_York"', "20261120T093000"), { iso: "2026-11-20T09:30:00 (America/New_York)", allDay: false });
assert.deepEqual(parseIcalDate("", "20261120T093000"), { iso: "2026-11-20T09:30:00", allDay: false });

const ics = [
  "BEGIN:VCALENDAR", "BEGIN:VEVENT",
  "DTSTART;TZID=Asia/Kolkata:20261120T160000", "DTEND;TZID=Asia/Kolkata:20261120T170000",
  "SUMMARY:Dentist\\, Dr. Rao", "DESCRIPTION:Line one\\nline two that is ",
  " folded", "BEGIN:VALARM", "DESCRIPTION:Reminder", "END:VALARM", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261125", "DTEND;VALUE=DATE:20261128", "SUMMARY:College trip", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");
assert.deepEqual(parseIcalEvents(ics), [
  { title: "Dentist, Dr. Rao", start: "2026-11-20T16:00:00 (Asia/Kolkata)", end: "2026-11-20T17:00:00 (Asia/Kolkata)", allDay: false, description: "Line one\nline two that is folded" },
  { title: "College trip", start: "2026-11-25", end: "2026-11-28", allDay: true, description: "" },
]);

// RFC 2047
assert.equal(encodeHeader("Leave application"), "Leave application");
assert.equal(encodeHeader("a\r\nBcc: x@evil.com"), "a Bcc: x@evil.com");
const subj = "Leave – 20 Nov ₹ नमस्ते ".repeat(4);
const enc = encodeHeader(subj);
const decoded = enc.split("\r\n ").map((w) => {
  assert.ok(w.length <= 75, `encoded-word too long: ${w.length}`);
  return Buffer.from(w.match(/^=\?UTF-8\?B\?(.*)\?=$/)[1], "base64").toString("utf8");
}).join("");
assert.equal(decoded, subj.replace(/[\r\n]+/g, " "));

// RFC 2822
const raw = buildRawMessage({ to: ["a@x.edu", "b@x.edu"], cc: ["c@x.edu"], subject: "Hi", body: "Respected Sir,\nThanks — Asha" });
const [head, body] = raw.split("\r\n\r\n");
assert.equal(head, [
  "To: a@x.edu, b@x.edu", "Cc: c@x.edu", "Subject: Hi", "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64",
].join("\r\n"));
assert.equal(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), "Respected Sir,\r\nThanks — Asha");
assert.ok(!buildRawMessage({ to: ["a@x.edu"], subject: "s", body: "b" }).includes("Cc:"));
assert.match(toBase64Url(raw), /^[A-Za-z0-9_-]+$/);
assert.equal(Buffer.from(toBase64Url(raw), "base64url").toString("utf8"), raw);

console.log("sources.test: all assertions passed");
