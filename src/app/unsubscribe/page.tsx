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
      <div className="panel w-full max-w-md p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terp-red">Eppley · UMD</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Unsubscribe</h1>

        {state === "ok" && (
          <>
            <p className="mt-3 text-sm text-ink/75">
              Removed <strong>{email}</strong> and cancelled {cancelled} watch
              {cancelled === 1 ? "" : "es"}.
            </p>
            <p className="mt-2 text-xs text-ink/55">
              To opt back in later, create a watch and confirm the verification email.
            </p>
          </>
        )}
        {state === "invalid" && (
          <p className="mt-3 text-sm text-[#9f1d2a]">This unsubscribe link is invalid or expired.</p>
        )}
        {state === "missing" && (
          <p className="mt-3 text-sm text-ink/75">Open the unsubscribe link from your alert email.</p>
        )}
        {state === "error" && (
          <p className="mt-3 text-sm text-[#9f1d2a]">Something went wrong. Try the link again in a minute.</p>
        )}

        <a href="/" className="btn-secondary mt-6 inline-flex">
          Back to alerts
        </a>
      </div>
    </main>
  );
}
