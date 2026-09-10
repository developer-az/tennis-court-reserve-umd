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
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="surface w-full max-w-md rounded-2xl p-8 text-center shadow-lift animate-rise">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mute">UMD Tennis Alerts</p>
        <h1 className="font-display mt-2 text-3xl text-ink">Unsubscribe</h1>

        {state === "ok" && (
          <>
            <p className="mt-4 text-sm leading-relaxed text-mute">
              Removed <span className="text-ink">{email}</span> and cancelled {cancelled} watch
              {cancelled === 1 ? "" : "es"}.
            </p>
            <p className="mt-2 text-xs text-mute">
              To opt back in later, create a watch and confirm the verification email.
            </p>
          </>
        )}
        {state === "invalid" && (
          <p className="mt-4 text-sm text-full">This unsubscribe link is invalid or expired.</p>
        )}
        {state === "missing" && (
          <p className="mt-4 text-sm text-mute">Open the unsubscribe link from your alert email.</p>
        )}
        {state === "error" && (
          <p className="mt-4 text-sm text-full">Something went wrong. Try again later.</p>
        )}

        <a href="/" className="btn-secondary mt-8 inline-flex">
          Back to alerts
        </a>
      </div>
    </main>
  );
}
