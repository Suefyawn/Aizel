// Detects the Next.js "stale tab Server Action" failure: a page loaded
// before a deploy submits a form whose action ID was rehashed by the new
// build, so the server doesn't recognise it. Pre-deploy customers with an
// open tab hit this on their next submit. It's not a real bug — a reload
// fixes it instantly — so the error boundary treats it specially instead
// of rendering "Critical error" and emitting Sentry noise.
//
// Match on both name and message because Next.js wraps the underlying
// `UnrecognizedActionError` once the error reaches the client boundary
// and only the message survives in some build modes.
export function isStaleServerActionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    name === 'UnrecognizedActionError' ||
    /server action .* was not found on the server/i.test(message) ||
    /failed to find server action/i.test(message)
  );
}
