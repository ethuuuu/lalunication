import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowed } from "@/lib/access";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/tasks.readonly",
].join(" ");

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshFailed";
  }
}

type Tok = { access_token?: string; refresh_token?: string; expires_at?: number; error?: string };

async function refresh(t: Tok): Promise<Tok> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: t.refresh_token!,
    }),
  });
  const j = await res.json();
  if (!res.ok) return { ...t, error: "RefreshFailed" };
  return {
    ...t,
    access_token: j.access_token,
    expires_at: Math.floor(Date.now() / 1000) + j.expires_in,
    refresh_token: j.refresh_token ?? t.refresh_token,
    error: undefined,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: { params: { scope: SCOPES, access_type: "offline", prompt: "consent" } },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    signIn: ({ profile }) => isAllowed(profile ?? undefined),
    async jwt({ token, account }) {
      const t = token as typeof token & Tok;
      if (account) {
        return { ...t, access_token: account.access_token, refresh_token: account.refresh_token, expires_at: account.expires_at };
      }
      if (t.expires_at && Date.now() / 1000 < t.expires_at - 60) return t;
      return t.refresh_token ? { ...t, ...(await refresh(t)) } : t;
    },
    session({ session, token }) {
      const t = token as Tok;
      session.accessToken = t.access_token;
      if (t.error) session.error = "RefreshFailed";
      return session;
    },
    authorized: ({ auth }) => !!auth,
  },
});

/** Google access token for the signed-in user, for use in server routes/tools. */
export async function googleToken(): Promise<string> {
  const s = await auth();
  if (!s?.accessToken || s.error) throw new Error("Google session expired. Sign out and sign in again.");
  return s.accessToken;
}

/** Lowercased email of the signed-in user, or null. Every DB query is scoped by this. */
export async function currentUser(): Promise<string | null> {
  const s = await auth();
  return s?.user?.email?.toLowerCase() ?? null;
}
