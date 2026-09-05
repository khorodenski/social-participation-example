/**
 * M6-2 — the rule that keeps English off a projected screen.
 *
 * Every screen in this app is either projected in front of a room or held by an
 * attendee, and the UI is Polish (N-1). But an error's `message` is the one
 * string that arrives from outside: `fetch` throws "Failed to fetch", zod throws
 * a JSON blob, and an HTTP response carries `statusText` like "Gateway Timeout".
 * A catch that renders `err.message` will put any of those on the wall.
 *
 * So "this message is Polish and safe to show" is a **type**, not a hope.
 * `ApiError` and `ModelError` both extend `LocalizedError`, both are built only
 * from `pl.*`, and `polishMessage` refuses to read the message off anything
 * else.
 *
 * **Adding a new error type that reaches the UI? Extend `LocalizedError` and
 * build its message from `pl.*`.** Throwing a bare `Error` is fine for
 * programmer mistakes that should never surface; it will show the fallback.
 */
export class LocalizedError extends Error {}

/**
 * The message to show a user for `err`.
 *
 * Anything that is not a `LocalizedError` — a network `TypeError`, a zod
 * failure, a bare `Error` thrown by our own code — gets `fallback`, because its
 * own message cannot be trusted to be Polish.
 */
export function polishMessage(err: unknown, fallback: string): string {
  if (err instanceof LocalizedError && err.message.trim().length > 0) return err.message;
  return fallback;
}
