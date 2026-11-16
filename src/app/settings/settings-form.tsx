"use client";

import { useEffect, useState } from "react";
import type { Contact, Profile } from "@/lib/db";

type Status = { ok: boolean; msg: string } | undefined;
type SecretPatch = { gemini_api_key?: string | null; icloud_app_password?: string | null };
type Model = { id: string; displayName: string; thinking: boolean };

const THINKING = ["off", "low", "medium", "high"] as const;
const PRESET_ROLES = ["class teacher", "hod", "subject teacher", "warden", "mentor", "principal"];
const BLOCKS = ["bg-block-lime", "bg-block-lilac", "bg-block-cream", "bg-block-pink", "bg-block-mint", "bg-block-coral"];

function roleBlock(role: string) {
  let h = 0;
  for (const c of role) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BLOCKS[h % BLOCKS.length];
}

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status})`);
  return j as T;
}

function StatusLine({ status }: { status: Status }) {
  return (
    <p aria-live="polite" className={`text-sm ${status?.ok ? "text-success" : "text-rosso"}`}>
      {/* Callers clear status before each request, so the span remounts and the fade re-runs per result. */}
      {status && <span className="animate-fade">{status.msg}</span>}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/\W+/g, "-");
  return (
    <section aria-labelledby={id} className="border-t border-hairline py-12">
      <h2 id={id} className="label mb-8">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-body">{props.label}</span>
      <input
        className="field"
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function RoleChip({ role, onRemove }: { role: string; onRemove?: () => void }) {
  return (
    <span className={`${roleBlock(role)} inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium text-black`}>
      {role}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove role ${role}`} className="ml-1 leading-none">
          ×
        </button>
      )}
    </span>
  );
}

export function SettingsForm({ initialProfile, initialContacts }: { initialProfile: Profile; initialContacts: Contact[] }) {
  const [p, setP] = useState(initialProfile);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const set = (k: keyof Profile) => (v: string) => setP((x) => ({ ...x, [k]: v }));

  async function save(section: string, secrets: SecretPatch = {}) {
    setBusy(section);
    setStatus((s) => ({ ...s, [section]: undefined }));
    try {
      const { full_name, email, reg_no, class_name, model, thinking_level, icloud_username } = p;
      const next = await api<Profile>("/api/settings", "PUT", {
        full_name, email, reg_no, class_name, model, thinking_level, icloud_username, ...secrets,
      });
      setP(next);
      setStatus((s) => ({ ...s, [section]: { ok: true, msg: "Saved ✓" } }));
      return true;
    } catch (e) {
      setStatus((s) => ({ ...s, [section]: { ok: false, msg: (e as Error).message } }));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-12">
      <Section title="Profile">
        <form
          className="grid gap-6 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save("profile");
          }}
        >
          <Field label="Full name" value={p.full_name} onChange={set("full_name")} autoComplete="name" />
          <Field label="University email" type="email" value={p.email} onChange={set("email")} autoComplete="email" />
          <Field label="Registration number" value={p.reg_no} onChange={set("reg_no")} />
          <Field label="Class" value={p.class_name} onChange={set("class_name")} placeholder="e.g. CSE-B, 3rd year" />
          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
            <button className="btn-primary" disabled={busy === "profile"}>Save profile</button>
            <StatusLine status={status.profile} />
          </div>
        </form>
      </Section>

      <Section title="AI">
        <AiSettings p={p} setP={setP} save={save} busy={busy === "ai"} status={status.ai} />
      </Section>

      <Section title="Contacts">
        <Contacts initial={initialContacts} />
      </Section>

      <Section title="Apple Calendar (iCloud)">
        <IcloudSettings p={p} set={set} save={save} busy={busy === "icloud"} status={status.icloud} />
      </Section>

      <Section title="Apple Reminders sync">
        <RemindersSync />
      </Section>

      <Section title="Google Tasks, Calendar & Gmail">
        <p className="max-w-xl text-body">
          These come from your Google sign-in — nothing to set up here. If they stop working, sign out and sign in again.
        </p>
      </Section>
    </div>
  );
}

type SaveFn = (section: string, secrets?: SecretPatch) => Promise<boolean>;

function SecretField({ label, saved, savedText, section, secretKey, save, autoComplete }: {
  label: string; saved: boolean; savedText: string; section: string; secretKey: keyof SecretPatch; save: SaveFn; autoComplete?: string;
}) {
  const [replacing, setReplacing] = useState(!saved);
  const [value, setValue] = useState("");
  if (saved && !replacing) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm text-body">{label}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-block-mint rounded-pill px-3 py-1 text-xs font-medium text-black">{savedText}</span>
          <button type="button" className="btn-ghost h-9 px-4" onClick={() => setReplacing(true)}>Replace</button>
          <button type="button" className="btn-ghost h-9 px-4" onClick={() => save(section, { [secretKey]: null })}>Remove</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className="text-sm text-body">{label}</span>
        <input className="field" type="password" value={value} autoComplete={autoComplete ?? "off"} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary h-9 px-4"
          disabled={!value.trim()}
          onClick={async () => {
            if (await save(section, { [secretKey]: value })) {
              setValue("");
              setReplacing(false);
            }
          }}
        >
          Save
        </button>
        {saved && (
          <button type="button" className="btn-ghost h-9 px-4" onClick={() => { setValue(""); setReplacing(false); }}>Cancel</button>
        )}
      </div>
    </div>
  );
}

function AiSettings({ p, setP, save, busy, status }: {
  p: Profile; setP: React.Dispatch<React.SetStateAction<Profile>>; save: SaveFn; busy: boolean; status: Status;
}) {
  const [models, setModels] = useState<Model[] | null>(null);
  const [modelErr, setModelErr] = useState("");

  useEffect(() => {
    if (!p.has_gemini_key) return;
    api<Model[]>("/api/models", "GET")
      .then((m) => { setModels(m); setModelErr(""); })
      .catch((e: Error) => { setModels(null); setModelErr(e.message); });
  }, [p.has_gemini_key]);

  const level = THINKING.indexOf(p.thinking_level as (typeof THINKING)[number]);
  const options = models && !models.some((m) => m.id === p.model) ? [{ id: p.model, displayName: p.model, thinking: false }, ...models] : models;

  return (
    <div className="flex flex-col gap-8">
      <SecretField
        key={String(p.has_gemini_key)}
        label="Gemini API key"
        saved={p.has_gemini_key}
        savedText="Saved ✓ (or using env var)"
        section="ai"
        secretKey="gemini_api_key"
        save={save}
      />

      <div className="flex flex-col gap-2">
        {options ? (
          <label className="flex flex-col gap-2">
            <span className="text-sm text-body">Model</span>
            <select className="field" value={p.model} onChange={(e) => setP((x) => ({ ...x, model: e.target.value }))}>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}{m.thinking ? " · thinking" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Field label="Model" value={p.model} onChange={(v) => setP((x) => ({ ...x, model: v }))} placeholder="gemini-2.5-flash" />
        )}
        {modelErr && <p className="text-sm text-muted">Couldn’t load models ({modelErr}). Type a model id instead.</p>}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm text-body">Thinking level</legend>
        <div className="relative grid w-full max-w-md grid-cols-4 rounded-pill border border-hairline-strong p-1">
          {level >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-pill bg-ink transition-transform duration-200 ease-(--ease-in-out-cubic) motion-reduce:transition-none"
              style={{ transform: `translateX(${level * 100}%)` }}
            />
          )}
          {THINKING.map((t) => (
            <label key={t} className="relative">
              <input
                type="radio"
                name="thinking_level"
                value={t}
                checked={p.thinking_level === t}
                onChange={() => setP((x) => ({ ...x, thinking_level: t }))}
                className="peer sr-only"
              />
              <span className="block cursor-pointer rounded-pill py-2 text-center text-sm capitalize text-body transition-colors duration-200 motion-reduce:transition-none peer-checked:text-canvas peer-focus-visible:outline-2 peer-focus-visible:outline-giallo">
                {t}
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">Higher is slower, but reasons better about tricky requests.</p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => save("ai")}>Save AI settings</button>
        <StatusLine status={status} />
      </div>
    </div>
  );
}

function IcloudSettings({ p, set, save, busy, status }: {
  p: Profile; set: (k: keyof Profile) => (v: string) => void; save: SaveFn; busy: boolean; status: Status;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-xl text-body">
        Lets the agent read your Apple Calendar. Create an app-specific password at{" "}
        <a href="https://account.apple.com" target="_blank" rel="noreferrer" className="text-ink underline">account.apple.com</a>{" "}
        → Sign-In &amp; Security → App-Specific Passwords.
      </p>
      <Field label="Apple ID email" type="email" value={p.icloud_username} onChange={set("icloud_username")} autoComplete="off" />
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => save("icloud")}>Save Apple ID</button>
        <StatusLine status={status} />
      </div>
      <SecretField
        key={String(p.has_icloud_password)}
        label="App-specific password"
        saved={p.has_icloud_password}
        savedText="Saved ✓ (or using env var)"
        section="icloud"
        secretKey="icloud_app_password"
        save={save}
        autoComplete="new-password"
      />
    </div>
  );
}

function RemindersSync() {
  const [token, setToken] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [status, setStatus] = useState<Status>();

  async function generate() {
    setStatus(undefined);
    try {
      const { token } = await api<{ token: string }>("/api/reminders/token", "POST");
      setToken(token);
      setEndpoint(`${window.location.origin}/api/reminders/sync`);
      setStatus({ ok: true, msg: "New token generated. Any older token no longer works." });
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-xl text-body">
        Apple Reminders has no web API, so an Apple Shortcut on your iPhone or Mac pushes them here.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary" onClick={generate}>Generate sync token</button>
        <StatusLine status={status} />
      </div>
      {token && (
        <div className="flex flex-col gap-6 rounded-lg bg-elevated p-6">
          <div className="flex flex-col gap-2">
            <span className="label">Token — shown once, copy it now</span>
            <code className="break-all font-mono text-sm text-ink select-all">{token}</code>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label">Endpoint</span>
            <code className="break-all font-mono text-sm text-ink select-all">{endpoint}</code>
          </div>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-body">
            <li><b className="text-ink">Find Reminders</b> where <i>Is Not Completed</i> (all lists).</li>
            <li><b className="text-ink">Repeat with Each</b> reminder.</li>
            <li>Inside: <b className="text-ink">Dictionary</b> with <code>title</code> (Title), <code>notes</code> (Notes), <code>due</code> (Due Date → <b className="text-ink">Format Date</b> ISO 8601), <code>list</code> (List).</li>
            <li>Inside: <b className="text-ink">Add to Variable</b> <code>list</code> with that Dictionary.</li>
            <li>After the loop: <b className="text-ink">Get Contents of URL</b> → the endpoint above, Method POST, Request Body JSON with key <code>reminders</code> = the <code>list</code> variable, Header <code>Authorization</code> = <code>Bearer {token}</code>.</li>
            <li>Automation tab → <b className="text-ink">Personal Automation</b> (e.g. daily, or when opening Mail) → run this Shortcut, turn off <i>Ask Before Running</i>.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function ContactEditor({ initial, onSave, onCancel }: {
  initial: Omit<Contact, "id">; onSave: (c: Omit<Contact, "id">) => Promise<void>; onCancel: () => void;
}) {
  const [c, setC] = useState(initial);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const toggle = (r: string) => setC((x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }));
  const addCustom = () => {
    const r = custom.trim().toLowerCase();
    if (r && !c.roles.includes(r)) setC((x) => ({ ...x, roles: [...x.roles, r] }));
    setCustom("");
  };

  return (
    <form
      className="animate-enter flex flex-col gap-6 rounded-lg bg-elevated p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        try { await onSave(c); } catch (e) { setErr((e as Error).message); }
      }}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Name" value={c.name} onChange={(v) => setC((x) => ({ ...x, name: v }))} />
        <Field label="Email" type="email" value={c.email} onChange={(v) => setC((x) => ({ ...x, email: v }))} />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm text-body">Roles</legend>
        <div className="flex flex-wrap gap-2">
          {PRESET_ROLES.map((r) => {
            const on = c.roles.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(r)}
                className={`press rounded-pill px-3 py-1 text-xs font-medium ${on ? `${roleBlock(r)} text-black` : "border border-hairline-strong text-body hover:text-ink"}`}
              >
                {r}
              </button>
            );
          })}
        </div>
        {c.roles.filter((r) => !PRESET_ROLES.includes(r)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.roles.filter((r) => !PRESET_ROLES.includes(r)).map((r) => (
              <RoleChip key={r} role={r} onRemove={() => toggle(r)} />
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Custom role</span>
            <input
              className="field"
              value={custom}
              placeholder="Custom role, e.g. subject teacher: maths"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            />
          </label>
          <button type="button" className="btn-ghost" onClick={addCustom}>Add</button>
        </div>
      </fieldset>
      <Field label="Notes (optional)" value={c.notes} onChange={(v) => setC((x) => ({ ...x, notes: v }))} placeholder="e.g. prefers formal tone, cc the HOD" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary">Save contact</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <p aria-live="polite" className="text-sm text-rosso">{err}</p>
      </div>
    </form>
  );
}

function Contacts({ initial }: { initial: Contact[] }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const sorted = (l: Contact[]) => [...l].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      {list.length === 0 && editing !== "new" && (
        <p className="text-body">No contacts yet. Add your class teacher, HOD and others so the agent knows who to write to.</p>
      )}
      <ul className="flex flex-col">
        {list.map((c) =>
          editing === c.id ? (
            <li key={c.id} className="py-4">
              <ContactEditor
                initial={c}
                onCancel={() => setEditing(null)}
                onSave={async (body) => {
                  const saved = await api<Contact>(`/api/contacts/${c.id}`, "PUT", body);
                  setList((l) => sorted(l.map((x) => (x.id === c.id ? saved : x))));
                  setEditing(null);
                }}
              />
            </li>
          ) : (
            <li key={c.id} className={`${c.id === added ? "animate-enter " : ""}flex flex-wrap items-start justify-between gap-4 border-b border-hairline py-5`}>
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-lg font-medium">{c.name}</span>
                <span className="break-all text-sm text-body">{c.email}</span>
                {c.roles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {c.roles.map((r) => <RoleChip key={r} role={r} />)}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost h-9 px-4" onClick={() => setEditing(c.id)} aria-label={`Edit ${c.name}`}>Edit</button>
                <button
                  type="button"
                  className="btn-ghost h-9 px-4"
                  aria-label={`Delete ${c.name}`}
                  onClick={async () => {
                    if (!confirm(`Delete ${c.name}?`)) return;
                    try {
                      await api(`/api/contacts/${c.id}`, "DELETE");
                      setList((l) => l.filter((x) => x.id !== c.id));
                    } catch (e) {
                      alert((e as Error).message);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <ContactEditor
          initial={{ name: "", email: "", roles: [], notes: "" }}
          onCancel={() => setEditing(null)}
          onSave={async (body) => {
            const saved = await api<Contact>("/api/contacts", "POST", body);
            setList((l) => sorted([...l, saved]));
            setAdded(saved.id);
            setEditing(null);
          }}
        />
      ) : (
        <div>
          <button type="button" className="btn-ghost" onClick={() => setEditing("new")}>+ Add contact</button>
        </div>
      )}
    </div>
  );
}
