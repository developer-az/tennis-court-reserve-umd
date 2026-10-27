/** Turn a store failure into a message that is safe to show in the UI and in /api/health. */
export function describeStoreError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Storage request failed";
  if (isReadOnlyStoreError(err)) {
    return "Redis is not configured, so watches and check history cannot be saved on this host.";
  }
  return message;
}

export function isReadOnlyStoreError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  const message = err instanceof Error ? err.message : "";
  const unwritableCode = code === "ENOENT" || code === "EROFS" || code === "EACCES" || code === "EPERM";
  if (!unwritableCode) return false;
  return /mkdir|open |store\.json|[/\\]data\b/.test(message);
}
