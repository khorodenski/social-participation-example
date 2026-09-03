/**
 * F-4.4 — remembers, in this browser only, that the attendee already sent an
 * idea for a session, so a reload shows the thank-you screen again.
 *
 * Deliberately not enforcement. There is no server-side check and no attempt
 * at one: the audience is a lecture hall, not the internet, and the plan lists
 * anti-spam as out of scope. Clearing site data lets someone submit twice, and
 * that is fine.
 */
const PREFIX = 'social-voting.submitted.';

const key = (sessionId: string) => `${PREFIX}${sessionId}`;

export function hasSubmitted(sessionId: string): boolean {
  try {
    return window.localStorage.getItem(key(sessionId)) !== null;
  } catch {
    // Private mode, or storage disabled. Showing the form again is the safe
    // failure: worse to lock someone out than to accept a second idea.
    return false;
  }
}

export function markSubmitted(sessionId: string): void {
  try {
    window.localStorage.setItem(key(sessionId), String(Date.now()));
  } catch {
    /* nothing to do; the thank-you screen still shows for this page view */
  }
}

export function clearSubmitted(sessionId: string): void {
  try {
    window.localStorage.removeItem(key(sessionId));
  } catch {
    /* nothing to do */
  }
}
