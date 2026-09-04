import { selectedGroups } from './expansion';
import type { Group, Session } from './session';

/**
 * F-8.1..F-8.4 — the rules behind the visualization screen, kept pure so they
 * are unit-testable without an API key or a rendered component.
 *
 * The same shape as `expansion.ts`, one stage later: same three groups, same
 * "which are still missing", same "are we allowed to move on".
 */

/**
 * F-8.1 — which of the chosen groups still need a picture.
 *
 * A group with no prompt is skipped rather than attempted: `generateImage` has
 * nothing to send, and a card that fails for a reason the lecturer cannot fix
 * is worse than no card. In practice the stage is only reachable from
 * `expanded`, where every chosen group has one.
 */
export function missingImages(session: Session): Group[] {
  return selectedGroups(session).filter(
    (group) => session.expansions[group.id] && !session.images[group.id],
  );
}

/** F-9.1 — "Pokaż galerię" waits until every chosen group has a picture. */
export function allImagesReady(session: Session): boolean {
  const chosen = selectedGroups(session);
  return chosen.length > 0 && chosen.every((group) => Boolean(session.images[group.id]));
}

/**
 * F-8.3/F-8.4 — the URL an `<img>` should use for a stored image.
 *
 * `createdAt` rides along as a query parameter, and it is not decoration.
 * Regeneration overwrites the same blob key, so without it the browser would
 * keep showing the previous picture from an `<img>` whose `src` never changed —
 * on a projector, with nothing to explain why "Generuj ponownie" did nothing.
 * The assets function routes on the path and ignores the query.
 */
export function generatedImageSrc(assetPath: string, createdAt: number): string {
  return `${assetPath}?v=${createdAt}`;
}
