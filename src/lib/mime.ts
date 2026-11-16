// Pure RFC 2822 / RFC 2047 message building (no imports) so scripts/sources.test.mjs can run it under plain node.

/** Strips CR/LF (header injection) and B-encodes non-ASCII per RFC 2047. */
export function encodeHeader(value: string): string {
  const v = value.replace(/[\r\n]+/g, " ");
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  // Encode per code point so no UTF-8 sequence is split across encoded-words (each ≤ 75 chars).
  const words: string[] = [];
  let chunk = "";
  for (const ch of v) {
    if (Buffer.byteLength(chunk + ch, "utf8") > 45) { words.push(chunk); chunk = ""; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, "utf8").toString("base64")}?=`).join("\r\n ");
}

export type MailInput = { from?: string; to: string[]; cc?: string[]; subject: string; body: string };

export function buildRawMessage(m: MailInput): string {
  const clean = (a: string) => a.replace(/[\r\n,]+/g, "").trim();
  const headers = [
    m.from ? `From: ${encodeHeader(m.from)}` : "",
    `To: ${m.to.map(clean).join(", ")}`,
    m.cc?.length ? `Cc: ${m.cc.map(clean).join(", ")}` : "",
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);
  const body = (Buffer.from(m.body.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

/** Gmail API `raw` field: base64url of the full message. */
export function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8").toString("base64url");
}
