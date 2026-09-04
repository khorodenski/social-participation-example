import { describe, expect, it } from 'vitest';
import { allExpansionsReady, missingExpansions, selectedGroups } from './expansion';
import { sessionSchema, type Group, type Session } from './session';

function group(id: string, label: string): Group {
  return { id, label, synthesis: `Synteza ${id}.`, ideaIds: [`${id}-i1`] };
}

function session(over: Partial<Session> = {}): Session {
  return sessionSchema.parse({
    id: 'k7x2p9',
    title: 'Plac przed dworcem',
    createdAt: 0,
    stage: 'expanding',
    groups: [group('g1', 'Zieleń'), group('g2', 'Ławki'), group('g3', 'Plac zabaw')],
    selectedGroupIds: ['g2', 'g1', 'g3'],
    ...over,
  });
}

const prompt = (text: string) => ({ prompt: text, createdAt: 1 });

describe('selectedGroups', () => {
  /** The results screen wrote these in podium order, which is what the room saw. */
  it('keeps the order the lecturer confirmed, not the group order', () => {
    expect(selectedGroups(session()).map((g) => g.id)).toEqual(['g2', 'g1', 'g3']);
  });

  it('drops an id that no longer matches a group rather than rendering a blank card', () => {
    const result = selectedGroups(session({ selectedGroupIds: ['g1', 'g99'] }));
    expect(result.map((g) => g.id)).toEqual(['g1']);
  });

  it('is empty when nothing was selected', () => {
    expect(selectedGroups(session({ selectedGroupIds: [] }))).toEqual([]);
  });
});

describe('missingExpansions', () => {
  it('is everything selected when nothing has run yet', () => {
    expect(missingExpansions(session()).map((g) => g.id)).toEqual(['g2', 'g1', 'g3']);
  });

  /**
   * Each of these costs about a minute and real money, so a screen coming back
   * after a partial write must not pay twice.
   */
  it('skips groups that already have a prompt', () => {
    const s = session({ expansions: { g2: prompt('A photorealistic view.') } });
    expect(missingExpansions(s).map((g) => g.id)).toEqual(['g1', 'g3']);
  });

  it('is empty once every chosen group has one', () => {
    const s = session({
      expansions: { g1: prompt('a'), g2: prompt('b'), g3: prompt('c') },
    });
    expect(missingExpansions(s)).toEqual([]);
  });

  it('ignores a prompt for a group that was not chosen', () => {
    const s = session({
      selectedGroupIds: ['g1'],
      expansions: { g2: prompt('b') },
    });
    expect(missingExpansions(s).map((g) => g.id)).toEqual(['g1']);
  });
});

describe('allExpansionsReady', () => {
  it('is false while any chosen group is still missing (F-7.5)', () => {
    const s = session({ expansions: { g1: prompt('a'), g2: prompt('b') } });
    expect(allExpansionsReady(s)).toBe(false);
  });

  it('is true once all three exist', () => {
    const s = session({
      expansions: { g1: prompt('a'), g2: prompt('b'), g3: prompt('c') },
    });
    expect(allExpansionsReady(s)).toBe(true);
  });

  /** Otherwise an empty selection would enable "Wizualizuj" with nothing to show. */
  it('is false when nothing was selected at all', () => {
    expect(allExpansionsReady(session({ selectedGroupIds: [] }))).toBe(false);
  });

  it('is not fooled by prompts belonging to unselected groups', () => {
    const s = session({
      selectedGroupIds: ['g1', 'g2'],
      expansions: { g1: prompt('a'), g3: prompt('c') },
    });
    expect(allExpansionsReady(s)).toBe(false);
  });
});
