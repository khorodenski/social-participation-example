import { pl } from '../i18n/pl';
import type { Group } from './session';

/**
 * F-6.1..F-6.4 — the rules behind the results screen, kept pure so they are
 * unit-testable without rendering anything.
 *
 * Raw ideas never appear here. A group is only ever a label, a count and a
 * synthesis, which is the whole of the anonymity promise (F-6.2).
 */

/** F-6.3 — how many groups the lecturer takes forward. */
export const SELECTION_SIZE = 3;

/**
 * The catch-all that `normalizeGroups` appends for ideas which say nothing
 * about the space. It is ours, not the model's — the grouping prompt forbids
 * the model from making one — so matching the label we give it is reliable.
 * If a model disobeyed and produced its own "Inne" anyway, keeping that out of
 * the podium would still be the right answer.
 *
 * It is excluded because it has no theme: its synthesis is a fixed sentence,
 * and expanding it into an image prompt would produce nonsense on a projector.
 */
export function isOtherGroup(group: Group): boolean {
  return group.label.trim().toLocaleLowerCase('pl') === pl.common.other.toLocaleLowerCase('pl');
}

/** Everything the lecturer is allowed to choose from. */
export function selectableGroups(groups: Group[]): Group[] {
  return groups.filter((group) => !isOtherGroup(group));
}

export interface RankedGroups {
  /** F-6.1 — the prominent ones. Fewer than three if the model returned fewer. */
  podium: Group[];
  /** F-6.1 — the compact remainder, still selectable. */
  rest: Group[];
  /** Always last, never selectable. */
  other: Group | null;
}

/**
 * F-6.1 — count descending. Ties keep the model's own order, because
 * `Array.prototype.sort` is stable and any tie-break we invented would be
 * arbitrary anyway.
 */
export function rankGroups(groups: Group[]): RankedGroups {
  const other = groups.find(isOtherGroup) ?? null;
  const ranked = groups
    .filter((group) => group !== other)
    .sort((a, b) => b.ideaIds.length - a.ideaIds.length);

  return {
    podium: ranked.slice(0, SELECTION_SIZE),
    rest: ranked.slice(SELECTION_SIZE),
    other,
  };
}

/**
 * F-6.3 — exactly three, unless the model produced fewer themes than that. A
 * two-group rehearsal run must not be a dead end with a permanently disabled
 * "Dalej".
 */
export function requiredSelectionCount(groups: Group[]): number {
  return Math.min(SELECTION_SIZE, selectableGroups(groups).length);
}

/**
 * F-6.3 — the top three arrive pre-selected. A screen reloaded mid-lecture
 * keeps whatever the lecturer had already chosen instead of silently undoing
 * it, so `selectedGroupIds` from the session wins when it holds anything usable.
 */
export function initialSelection(groups: Group[], saved: readonly string[] = []): string[] {
  const selectable = new Set(selectableGroups(groups).map((group) => group.id));
  const kept = saved.filter((id) => selectable.has(id));
  if (kept.length > 0) return kept;

  return rankGroups(groups).podium.map((group) => group.id);
}

/**
 * Toggling past three is allowed on purpose: the counter turns red and "Dalej"
 * stays disabled, which reads better than a click that does nothing.
 */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((each) => each !== id) : [...selected, id];
}

/**
 * F-6.4 — persist the choice in podium order, so expansion later works through
 * the groups in the order the room just saw them.
 */
export function orderSelection(groups: Group[], selected: readonly string[]): string[] {
  const { podium, rest } = rankGroups(groups);
  return [...podium, ...rest].filter((group) => selected.includes(group.id)).map((g) => g.id);
}
