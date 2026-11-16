// Optimistic gate only; every API route also checks auth() itself.
export { auth as proxy } from "@/auth";

export const config = {
  // Public: login, Auth.js endpoints, the Apple Shortcut sync endpoint (uses its own token), static assets.
  matcher: ["/((?!login|api/auth|api/reminders/sync|_next/static|_next/image|favicon.ico).*)"],
};
