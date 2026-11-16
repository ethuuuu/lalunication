import { signIn } from "@/auth";

export default function Login() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <span className="label">Lalunication</span>
      <h1 className="text-5xl font-medium tracking-tight md:text-7xl">
        Mail, <span className="text-rosso">handled.</span>
      </h1>
      <p className="max-w-sm text-body">
        Sign in with the Google account you send university mail from.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button className="btn-primary">Continue with Google</button>
      </form>
    </main>
  );
}
