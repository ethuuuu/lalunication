"use client";

import { useState, type KeyboardEvent } from "react";
import type { EmailDraft } from "@/lib/db";
import { Spinner } from "./icons";

type Props = {
  draft: EmailDraft;
  /** Only the most recent draft can be sent; older ones are superseded. */
  actionable: boolean;
  sent: boolean;
  onSent: () => void;
};

export function DraftCard({ draft, actionable, sent, onSent }: Props) {
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [state, setState] = useState<"idle" | "sending" | "error" | "discarded">("idle");
  const [error, setError] = useState("");

  const names = (draft.recipientNames ?? []).join(", ");

  if (sent) {
    return (
      <p className="flex items-center gap-2 text-sm text-body" role="status">
        <span aria-hidden className="text-success">✓</span>
        Sent to {names || draft.to.join(", ")}
      </p>
    );
  }
  if (state === "discarded") {
    return <p className="text-sm text-muted">Draft discarded.</p>;
  }

  async function send() {
    setState("sending");
    setError("");
    try {
      const payload: EmailDraft = { ...draft, to, cc, subject, body };
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Send failed (${res.status})`);
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setState("error");
    }
  }

  const locked = !actionable || state === "sending";

  return (
    <article
      aria-label={`Email draft: ${subject}`}
      className={`rounded-xl border border-hairline-strong bg-elevated p-4 sm:p-6 ${actionable ? "" : "opacity-60"}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="label">Draft · {draft.tone}</span>
        {!actionable && <span className="label text-muted">Superseded</span>}
      </div>

      <div className="flex flex-col gap-3">
        <Recipients label="To" emails={to} nameOf={(e) => draft.recipientNames?.[draft.to.indexOf(e)]} onChange={setTo} disabled={locked} />
        <Recipients label="Cc" emails={cc} nameOf={() => undefined} onChange={setCc} disabled={locked} />

        <label className="flex flex-col gap-1.5">
          <span className="label">Subject</span>
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={locked} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label">Body</span>
          <textarea
            className="field h-auto min-h-40 py-3 leading-relaxed [field-sizing:content]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={locked}
          />
        </label>

        {draft.context && <p className="text-xs text-muted">Date from {draft.context}</p>}
      </div>

      {actionable && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={send} disabled={state === "sending" || to.length === 0}>
            {state === "sending" ? (
              <>
                <Spinner /> Sending
              </>
            ) : state === "error" ? (
              "Retry send"
            ) : (
              "Send"
            )}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setState("discarded")} disabled={state === "sending"}>
            Discard
          </button>
          {state === "error" && (
            <p role="alert" className="w-full text-sm text-rosso">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Recipients({
  label,
  emails,
  nameOf,
  onChange,
  disabled,
}: {
  label: string;
  emails: string[];
  nameOf: (email: string) => string | undefined;
  onChange: (emails: string[]) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const email = draft.trim().replace(/,$/, "");
    if (email && !emails.includes(email)) onChange([...emails, email]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && emails.length) {
      onChange(emails.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label w-8 shrink-0">{label}</span>
      {emails.map((email) => (
        <span key={email} className="inline-flex max-w-full items-center gap-1 rounded-pill bg-card py-1 pr-1 pl-3 text-sm">
          <span className="truncate">
            {nameOf(email) ? (
              <>
                {nameOf(email)} <span className="text-body">&lt;{email}&gt;</span>
              </>
            ) : (
              email
            )}
          </span>
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={() => onChange(emails.filter((x) => x !== email))}
              className="grid size-6 place-items-center rounded-full text-body hover:bg-hairline-strong hover:text-ink"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="email"
          aria-label={`Add ${label} recipient`}
          placeholder="Add email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className="min-w-32 flex-1 bg-transparent py-1 text-sm text-ink outline-none placeholder:text-muted"
        />
      )}
    </div>
  );
}
