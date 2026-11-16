import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser, signOut } from "@/auth";
import { sql, type Contact } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { SettingsForm } from "./settings-form";

// Data lives behind Suspense so the shell prerenders (Cache Components).
async function SettingsData() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const [profile, contacts] = await Promise.all([
    getProfile(user),
    sql()`SELECT id, name, email, roles, notes FROM contacts WHERE user_email = ${user} ORDER BY lower(name), id`.then((r) => r as Contact[]),
  ]);
  return <SettingsForm initialProfile={profile} initialContacts={contacts} />;
}

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-4 md:px-8">
        <span className="label text-ink">Lalunication</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="btn-ghost h-9 px-4">Sign out</button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10 md:px-8 md:pt-16">
        <Link href="/" className="label hover:text-ink">
          ← Back to agent
        </Link>
        <h1 className="mt-6 text-5xl font-medium tracking-tight md:text-6xl">Settings</h1>
        <p className="mt-4 max-w-xl text-body">
          Who you are, which model drafts your mail, and the people you write to.
        </p>
        <Suspense fallback={<p className="label mt-16" aria-live="polite">Loading…</p>}>
          <SettingsData />
        </Suspense>
      </main>
    </div>
  );
}
