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
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-16">
      <div className="panel w-full max-w-md p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Unsubscribe</h1>

        {state === "ok" && (
          <>
            <p className="mt-3 text-sm text-neutral-600">
              Removed <strong>{email}</strong> and cancelled {cancelled} watch
              {cancelled === 1 ? "" : "es"}.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              To opt back in later, create a watch and confirm the verification email.
            </p>
          </>
        )}
        {state === "invalid" && (
          <p className="mt-3 text-sm text-red-600">This unsubscribe link is invalid or expired.</p>
        )}
        {state === "missing" && (
          <p className="mt-3 text-sm text-neutral-600">Open the unsubscribe link from your alert email.</p>
        )}
        {state === "error" && (
          <p className="mt-3 text-sm text-red-600">Something went wrong. Try again later.</p>
        )}

        <a href="/" className="btn-secondary mt-6 inline-flex">
          Back to alerts
        </a>
      </div>
    </main>
  );
}
