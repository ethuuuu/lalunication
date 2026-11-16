// Usage: npm run db:migrate   (reads DATABASE_URL and ALLOWED_EMAIL from .env.local)
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const sql = neon(process.env.DATABASE_URL);
const owner = (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
const statements = readFileSync(new URL("./schema.sql", import.meta.url), "utf8")
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

const needsOwner = statements.some((s) => s.includes(":owner"));
const hasLegacyRows = (await sql.query(
  "SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'user_email'",
)).length === 0 && (await sql.query("SELECT to_regclass('contacts') IS NOT NULL AS t"))[0].t;
if (needsOwner && hasLegacyRows && !owner) throw new Error("Set ALLOWED_EMAIL: existing single-user rows need an owner.");

for (const s of statements) {
  await sql.query(s.replaceAll(":owner", "$1"), s.includes(":owner") ? [owner || null] : []);
}
console.log(`Applied ${statements.length} statements.`);
