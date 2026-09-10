import { unsubscribeEmail } from "@/lib/db";
import { verifyEmailToken } from "@/lib/tokens";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;
  let state: "ok" | "invalid" | "missing" | "error" = "missing";
  let email = "";
  let cancelled = 0;

  if (token) {
    const payload = verifyEmailToken(token, "unsubscribe");
    if (!payload) {
      state = "invalid";
    } else {
      try {
        email = payload.email;
        cancelled = await unsubscribeEmail(payload.email);
        state = "ok";
      } catch {
        state = "error";
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl max-w-md w-full p-8 space-y-4 text-center">
        <h1 className="font-display text-2xl text-terp-gold">Unsubscribe</h1>
        {state === "ok" && (
          <>
            <p className="text-white/80 text-sm">
              Unsubscribed <strong className="text-white">{email}</strong> and cancelled{" "}
              {cancelled} watch{cancelled === 1 ? "" : "es"}.
            </p>
            <p className="text-white/50 text-xs">
              To receive alerts again later, create a new watch and confirm the verification email.
            </p>
          </>
        )}
        {state === "invalid" && (
          <p className="text-red-300 text-sm">This unsubscribe link is invalid or expired.</p>
        )}
        {state === "missing" && (
          <p className="text-white/60 text-sm">Open the unsubscribe link from your alert email.</p>
        )}
        {state === "error" && (
          <p className="text-red-300 text-sm">Something went wrong. Try again later.</p>
        )}
        <a href="/" className="inline-block text-sm text-terp-gold hover:underline">
          ← Back to Tennis Alerts
        </a>
      </div>
    </main>
  );
}
