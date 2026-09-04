import { describe, expect, it } from 'vitest';
import {
  initialSelection,
  isOtherGroup,
  orderSelection,
  rankGroups,
  requiredSelectionCount,
  selectableGroups,
  toggleSelection,
} from './results';
import type { Group } from './session';

function group(id: string, label: string, count: number): Group {
  return {
    id,
    label,
    synthesis: `Synteza ${id}.`,
    ideaIds: Array.from({ length: count }, (_, i) => `${id}-i${i}`),
  };
}

/** What a lecture-sized run looks like: five themes plus the app's catch-all. */
const groups: Group[] = [
  group('g1', 'Zieleń i cień', 4),
  group('g2', 'Miejsca do siedzenia', 7),
  group('g3', 'Plac zabaw', 2),
  group('g4', 'Gastronomia', 5),
  group('g5', 'Oświetlenie', 5),
  group('g6', 'Inne', 9),
];

describe('isOtherGroup', () => {
  it('recognises the catch-all the app appends', () => {
    expect(isOtherGroup(group('g6', 'Inne', 9))).toBe(true);
  });

  it('ignores case and stray whitespace', () => {
    expect(isOtherGroup(group('g6', '  inne ', 1))).toBe(true);
  });

  it('leaves a real theme alone', () => {
    expect(isOtherGroup(group('g1', 'Zieleń i cień', 4))).toBe(false);
  });
});

describe('rankGroups', () => {
  it('puts the three biggest themes on the podium, count descending (F-6.1)', () => {
    const { podium } = rankGroups(groups);
    expect(podium.map((g) => g.id)).toEqual(['g2', 'g4', 'g5']);
  });

  it('leaves the smaller themes in the compact list', () => {
    const { rest } = rankGroups(groups);
    expect(rest.map((g) => g.id)).toEqual(['g1', 'g3']);
  });

  it('holds the catch-all apart however big it is', () => {
    const { podium, rest, other } = rankGroups(groups);
    expect(other?.id).toBe('g6');
    expect([...podium, ...rest].map((g) => g.id)).not.toContain('g6');
  });

  it('keeps the model order when counts tie', () => {
    const { podium } = rankGroups([
      group('g1', 'Pierwsza', 5),
      group('g2', 'Druga', 5),
      group('g3', 'Trzecia', 5),
    ]);
    expect(podium.map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
  });

  it('does not reorder the array it was given', () => {
    const input = [...groups];
    rankGroups(input);
    expect(input.map((g) => g.id)).toEqual(['g1', 'g2', 'g3', 'g4', 'g5', 'g6']);
  });

  it('copes with no groups at all', () => {
    expect(rankGroups([])).toEqual({ podium: [], rest: [], other: null });
  });
});

describe('selectableGroups', () => {
  it('excludes the catch-all', () => {
    expect(selectableGroups(groups).map((g) => g.id)).toEqual(['g1', 'g2', 'g3', 'g4', 'g5']);
  });
});

describe('requiredSelectionCount', () => {
  it('is three for a normal run (F-6.3)', () => {
    expect(requiredSelectionCount(groups)).toBe(3);
  });

  it('drops to what exists when the model returned fewer themes', () => {
    expect(requiredSelectionCount([group('g1', 'Jedyna', 3), group('g2', 'Inne', 1)])).toBe(1);
  });

  it('is zero when there is nothing to choose', () => {
    expect(requiredSelectionCount([])).toBe(0);
  });
});

describe('initialSelection', () => {
  it('pre-selects the top three (F-6.3)', () => {
    expect(initialSelection(groups)).toEqual(['g2', 'g4', 'g5']);
  });

  it('never pre-selects the catch-all, even as the biggest group', () => {
    expect(initialSelection(groups)).not.toContain('g6');
  });

  it('keeps a choice the lecturer already made, across a reload', () => {
    expect(initialSelection(groups, ['g1', 'g3', 'g4'])).toEqual(['g1', 'g3', 'g4']);
  });

  it('drops saved ids that no longer exist after re-grouping', () => {
    expect(initialSelection(groups, ['g1', 'g99'])).toEqual(['g1']);
  });

  it('falls back to the podium when nothing usable was saved', () => {
    expect(initialSelection(groups, ['g99', 'g6'])).toEqual(['g2', 'g4', 'g5']);
  });
});

describe('toggleSelection', () => {
  it('adds an unselected group', () => {
    expect(toggleSelection(['g2', 'g4'], 'g1')).toEqual(['g2', 'g4', 'g1']);
  });

  it('removes a selected one', () => {
    expect(toggleSelection(['g2', 'g4', 'g1'], 'g4')).toEqual(['g2', 'g1']);
  });

  it('allows a fourth, so the counter can say so instead of the click doing nothing', () => {
    expect(toggleSelection(['g2', 'g4', 'g5'], 'g1')).toHaveLength(4);
  });
});

describe('orderSelection', () => {
  it('writes the selection in podium order, whatever order it was clicked (F-6.4)', () => {
    expect(orderSelection(groups, ['g3', 'g2', 'g1'])).toEqual(['g2', 'g1', 'g3']);
  });

  it('ignores ids that are not real groups', () => {
    expect(orderSelection(groups, ['g2', 'g99'])).toEqual(['g2']);
  });
});
