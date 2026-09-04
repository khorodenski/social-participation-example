import type { Group, Session } from './session';

/**
 * F-7.2..F-7.5 — the rules behind the expansion screen, kept pure so they are
 * unit-testable without an API key or a rendered component.
 */

/**
 * F-7.3 — the groups the lecturer chose, in the order they were chosen.
 *
 * `selectedGroupIds` was written in podium order by the results screen, so this
 * is also the order the room last saw. Ids that no longer match a group are
 * dropped rather than rendered as an empty card.
 */
export function selectedGroups(session: Session): Group[] {
  const byId = new Map(session.groups.map((group) => [group.id, group]));
  return session.selectedGroupIds
    .map((id) => byId.get(id))
    .filter((group): group is Group => group !== undefined);
}

/**
 * F-7.2 — which of them still need a call.
 *
 * Everything already in `expansions` is skipped, so a screen that comes back
 * after a partial write does not pay for prompts it already has. Each of these
 * costs about a minute and real money.
 */
export function missingExpansions(session: Session): Group[] {
  return selectedGroups(session).filter((group) => !session.expansions[group.id]);
}

/** F-7.5 — "Wizualizuj" waits until every chosen group has a prompt. */
export function allExpansionsReady(session: Session): boolean {
  const chosen = selectedGroups(session);
  return chosen.length > 0 && chosen.every((group) => Boolean(session.expansions[group.id]));
}
