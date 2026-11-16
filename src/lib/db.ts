import "server-only"; // build fails if client code value-imports this; `import type` is still fine
import { neon } from "@neondatabase/serverless";

// Lazy so `next build` doesn't crash before DATABASE_URL exists.
let _sql: ReturnType<typeof neon> | null = null;
export function sql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql;
}

export type Profile = {
  full_name: string;
  email: string;
  reg_no: string;
  class_name: string;
  model: string;
  thinking_level: "off" | "low" | "medium" | "high";
  icloud_username: string;
  has_gemini_key: boolean;
  has_icloud_password: boolean;
};

export type Contact = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  notes: string;
};

/** Output of the agent's `draft_email` tool; rendered as a card, sent via POST /api/send. */
export type EmailDraft = {
  to: string[];
  cc: string[];
  recipientNames: string[];
  subject: string;
  body: string;
  /** e.g. "Formal request", "Apology", "Information" */
  tone: string;
  /** Where any date came from, e.g. "Google Calendar: 'Dentist' on 2026-11-20" */
  context?: string;
};

export type Reminder = {
  id: number;
  source: "apple";
  title: string;
  notes: string;
  due: string | null;
  list_name: string;
  completed: boolean;
};
