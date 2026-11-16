"use client";

import { useChat } from "@ai-sdk/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { EmailDraft, Profile } from "@/lib/db";
import { DraftCard } from "./draft-card";
import { ArrowUpIcon, GearIcon, MicIcon, Spinner, StopIcon } from "./icons";
import { useDictation } from "./use-dictation";

type Part = UIMessage["parts"][number];
type ToolResult = { ok: true; items: unknown[] } | { ok: false; error: string };

const STORE = "lalunication:chat";
const TITLE = "Lalunication";

const SUGGESTIONS = [
  { text: "Email my class teacher that I'll be absent on the day of my dentist appointment", bg: "bg-block-lime" },
  { text: "Ask the HOD for permission to attend the hackathon next week", bg: "bg-block-lilac" },
  { text: "Tell my warden I'll be returning late on Friday", bg: "bg-block-cream" },
  { text: "Remind my project guide that our review is due this week", bg: "bg-block-mint" },
];

// tool name → [while running, when done, source name used in failure lines]
const TOOLS: Record<string, [string, string, string]> = {
  get_my_profile: ["Reading your profile", "Read your profile", "Profile"],
  find_contacts: ["Looking up contacts", "Found contacts", "Contacts"],
  search_google_calendar: ["Checking Google Calendar", "Checked Google Calendar", "Google Calendar"],
  search_apple_calendar: ["Checking Apple Calendar", "Checked Apple Calendar", "Apple Calendar"],
  search_google_tasks: ["Checking Google Tasks", "Checked Google Tasks", "Google Tasks"],
  search_apple_reminders: ["Checking Apple Reminders", "Checked Apple Reminders", "Apple Reminders"],
  draft_email: ["Drafting your email", "Drafted email", "Draft"],
};

function draftOf(part: Part): EmailDraft | null {
  return isToolUIPart(part) && getToolName(part) === "draft_email" && part.state === "output-available"
    ? (part.output as EmailDraft)
    : null;
}

function lastDraftId(messages: UIMessage[]): string | undefined {
  let id: string | undefined;
  for (const m of messages) for (const p of m.parts) if (isToolUIPart(p) && draftOf(p)) id = p.toolCallId;
  return id;
}

export function Chat() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const dictation = useDictation(setInput);
  const askedPermission = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop, regenerate, setMessages } = useChat({
    onFinish: ({ message }) => {
      const draft = message.parts.map(draftOf).findLast(Boolean);
      if (!draft || !document.hidden) return;
      document.title = `● Draft ready — ${TITLE}`;
      // shortcut: in-page Notification only fires while the tab is open; web push (service worker + VAPID keys) is the upgrade path for alerts after the tab is closed.
      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification(`Draft ready for ${draft.recipientNames.join(", ") || draft.to.join(", ")}`, {
          body: draft.subject,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const latestDraft = lastDraftId(messages);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => {});
  }, []);

  // Restore after mount (not in initial state) so SSR markup matches the first client render.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as { messages: UIMessage[]; sent: string[] } | null;
      if (saved?.messages?.length) {
        setMessages(saved.messages);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage after hydration
        setSent(saved.sent ?? []);
      }
    } catch {}
  }, [setMessages]);

  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ messages, sent }));
    } catch {}
  }, [messages, sent, busy]);

  useEffect(() => {
    const reset = () => {
      if (!document.hidden) document.title = TITLE;
    };
    document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    dictation.stop();
    if (!askedPermission.current && "Notification" in window && Notification.permission === "default") {
      askedPermission.current = true;
      Notification.requestPermission().catch(() => {});
    }
    sendMessage({ text: t });
    setInput("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(input);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <span className="flex items-center gap-2 text-lg font-medium tracking-tight">
            <span aria-hidden className="size-2 rounded-full bg-rosso" />
            Lalunication
          </span>
          {profile?.model && (
            <span className="truncate rounded-pill border border-hairline-strong px-3 py-1 text-xs text-body">
              {profile.model}
            </span>
          )}
          <Link
            href="/settings"
            aria-label="Settings"
            className="ml-auto grid size-10 pointer-coarse:size-11 shrink-0 place-items-center squircle border border-hairline-strong text-body press hover:border-ink hover:text-ink"
          >
            <GearIcon />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
        {profile && !profile.has_gemini_key && (
          <div className="animate-enter mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline-strong bg-elevated p-4">
            <p className="text-sm text-body">Add your Gemini API key to start drafting emails.</p>
            <Link href="/settings" className="btn-ghost h-9 px-4 text-xs">
              Open settings
            </Link>
          </div>
        )}

        {messages.length === 0 ? (
          <section className="flex flex-1 flex-col justify-center py-16">
            <p className="label mb-4">Your university email agent</p>
            <h1 className="animate-enter mb-10 text-4xl leading-[1.1] font-medium tracking-tight sm:text-6xl">
              Who are we writing to?
            </h1>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => (
                // Enter animation on a wrapper so its fill-mode never fights the button's hover/press transforms.
                <div key={s.text} className="animate-enter grid" style={{ "--stagger": i + 1 } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => submit(s.text)}
                    disabled={busy}
                    className={`${s.bg} lift press min-h-28 rounded-2xl p-5 text-left text-[15px] leading-snug text-black`}
                  >
                    {s.text}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div role="log" aria-live="polite" aria-busy={busy} className="flex flex-col gap-6 py-8">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="animate-enter flex justify-end">
                  <p className="max-w-[85%] rounded-2xl bg-card px-4 py-3 whitespace-pre-wrap">
                    {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="animate-fade flex flex-col gap-3">
                  {m.parts.map((p, i) => (
                    <AssistantPart
                      key={i}
                      part={p}
                      latestDraft={latestDraft}
                      sent={sent}
                      onSent={(id) => setSent((s) => [...s, id])}
                    />
                  ))}
                </div>
              ),
            )}
            {status === "submitted" && (
              <p className="flex items-center gap-2 text-sm text-body">
                <Spinner /> Thinking…
              </p>
            )}
            {error && (
              <div role="alert" className="animate-fade flex flex-wrap items-center gap-3 rounded-xl border border-hairline-strong p-4 text-sm">
                <span className="text-body">Something went wrong: {error.message}</span>
                <button type="button" className="btn-ghost h-9 px-4 text-xs" onClick={() => regenerate()}>
                  Retry
                </button>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-gradient-to-t from-canvas from-70% to-transparent pt-6 pb-4">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            submit(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2 px-4"
        >
          <div className="flex flex-1 items-end rounded-[28px] border border-hairline-strong bg-elevated py-1.5 pr-1.5 pl-5 focus-within:border-ink">
            <textarea
              aria-label="Message Lalunication"
              placeholder="Who should I email, and about what?"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-ink outline-none [field-sizing:content] placeholder:text-muted"
            />
            {dictation.supported && !busy && (
              <button
                type="button"
                onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))}
                aria-label={dictation.listening ? "Stop dictation" : "Dictate message"}
                aria-pressed={dictation.listening}
                className={`relative mr-1.5 grid size-10 pointer-coarse:size-11 shrink-0 place-items-center squircle press ${
                  dictation.listening
                    ? "bg-ink text-canvas"
                    : "text-body hover:text-ink"
                }`}
              >
                <MicIcon />
                {dictation.listening && (
                  <span
                    aria-hidden
                    className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rosso animate-pulse motion-reduce:animate-none"
                  />
                )}
              </button>
            )}
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                aria-label="Stop generating"
                className="grid size-10 pointer-coarse:size-11 shrink-0 place-items-center squircle border border-hairline-strong text-ink press hover:border-ink"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send message"
                disabled={!input.trim()}
                className="grid size-10 pointer-coarse:size-11 shrink-0 place-items-center squircle bg-rosso text-white press duration-150 hover:bg-rosso-hover disabled:opacity-40"
              >
                <ArrowUpIcon />
              </button>
            )}
          </div>
        </form>
        <p aria-live="polite" className="mx-auto max-w-3xl px-6 pt-2 text-xs text-body empty:hidden">
          {dictation.error ?? (dictation.listening ? "Listening… tap the mic or send when you're done." : "")}
        </p>
      </div>
    </div>
  );
}

function AssistantPart({
  part,
  latestDraft,
  sent,
  onSent,
}: {
  part: Part;
  latestDraft?: string;
  sent: string[];
  onSent: (id: string) => void;
}) {
  if (part.type === "text") return <p className="leading-relaxed whitespace-pre-wrap text-ink">{part.text}</p>;
  if (!isToolUIPart(part)) return null;

  const name = getToolName(part);
  const draft = draftOf(part);
  if (draft) {
    return (
      <DraftCard
        draft={draft}
        actionable={part.toolCallId === latestDraft}
        sent={sent.includes(part.toolCallId)}
        onSent={() => onSent(part.toolCallId)}
      />
    );
  }

  const [running, done, source] = TOOLS[name] ?? [`Running ${name}`, `Ran ${name}`, name];

  if (part.state === "output-error" || part.state === "output-denied") {
    return <ToolRow muted text={`${source} failed${part.errorText ? ` — ${part.errorText}` : ""}`} />;
  }
  if (part.state !== "output-available") {
    const q = (part.input as { query?: unknown; role?: unknown } | undefined) ?? {};
    const target = name === "find_contacts" && (typeof q.role === "string" ? q.role : typeof q.query === "string" ? q.query : "");
    return <ToolRow pending text={`${target ? `Looking up ${target}` : running}…`} />;
  }
  const out = part.output as ToolResult;
  if (out && out.ok === false) return <ToolRow muted text={`${source} unavailable — ${out.error}`} />;
  const n = out?.ok ? out.items.length : undefined;
  return <ToolRow text={n === undefined || name === "get_my_profile" ? done : `${done} · ${n} result${n === 1 ? "" : "s"}`} />;
}

const fade = "transition-opacity duration-150 ease-[ease] motion-reduce:transition-none";

function ToolRow({ text, pending, muted }: { text: string; pending?: boolean; muted?: boolean }) {
  return (
    <p className={`animate-fade flex items-center gap-2 text-sm ${muted ? "text-muted" : "text-body"}`}>
      {/* Spinner and mark share one cell and crossfade, so the row doesn't snap when the tool finishes. */}
      <span aria-hidden className="grid w-3.5 place-items-center *:col-start-1 *:row-start-1">
        <span className={`${fade} ${pending ? "opacity-100" : "opacity-0"}`}>
          <Spinner />
        </span>
        <span className={`${fade} ${pending ? "opacity-0" : "opacity-100"} ${muted ? "" : "text-success"}`}>{muted ? "–" : "✓"}</span>
      </span>
      {text}
    </p>
  );
}
