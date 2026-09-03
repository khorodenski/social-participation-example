import { describe, expect, it } from 'vitest';
import { normalizeGroups } from './google';
import { pl } from '../i18n/pl';
import type { Idea } from '../state/session';
import type { GroupingResponse } from './prompts';

const ideas: Idea[] = ['i1', 'i2', 'i3', 'i4'].map((id, index) => ({
  id,
  text: `pomysł ${index + 1}`,
  createdAt: index,
}));

function response(groups: GroupingResponse['groups']): GroupingResponse {
  return { groups };
}

describe('normalizeGroups', () => {
  it('assigns app-side ids and keeps the model order', () => {
    const groups = normalizeGroups(
      response([
        { label: 'Zieleń', synthesis: 'Więcej drzew.', ideaIds: ['i1', 'i2'] },
        { label: 'Rowery', synthesis: 'Stojaki.', ideaIds: ['i3', 'i4'] },
      ]),
      ideas,
    );

    expect(groups.map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(groups.map((g) => g.label)).toEqual(['Zieleń', 'Rowery']);
  });

  it('puts every idea in exactly one group', () => {
    const groups = normalizeGroups(
      response([
        { label: 'Zieleń', synthesis: '', ideaIds: ['i1', 'i2'] },
        { label: 'Rowery', synthesis: '', ideaIds: ['i3', 'i4'] },
      ]),
      ideas,
    );

    const assigned = groups.flatMap((g) => g.ideaIds);
    expect(assigned).toHaveLength(ideas.length);
    expect(new Set(assigned).size).toBe(ideas.length);
  });

  it('drops ids the model invented', () => {
    const groups = normalizeGroups(
      response([{ label: 'Zieleń', synthesis: '', ideaIds: ['i1', 'i99', 'zmyślone'] }]),
      ideas,
    );

    expect(groups[0]?.ideaIds).toEqual(['i1']);
  });

  it('leaves a doubly-claimed idea in the first group that claimed it', () => {
    const groups = normalizeGroups(
      response([
        { label: 'Zieleń', synthesis: '', ideaIds: ['i1', 'i2'] },
        { label: 'Rowery', synthesis: '', ideaIds: ['i2', 'i3'] },
      ]),
      ideas,
    );

    expect(groups[0]?.ideaIds).toEqual(['i1', 'i2']);
    expect(groups[1]?.ideaIds).toEqual(['i3']);
  });

  it('adds a trailing "Inne" group for whatever is left over (F-5.3)', () => {
    const groups = normalizeGroups(
      response([{ label: 'Zieleń', synthesis: 'Drzewa.', ideaIds: ['i1'] }]),
      ideas,
    );

    const last = groups.at(-1);
    expect(last?.label).toBe(pl.common.other);
    expect(last?.synthesis).toBe(pl.groups.otherSynthesis);
    expect(last?.ideaIds).toEqual(['i2', 'i3', 'i4']);
  });

  it('adds no "Inne" group when the model placed everything', () => {
    const groups = normalizeGroups(
      response([
        { label: 'Zieleń', synthesis: '', ideaIds: ['i1', 'i2'] },
        { label: 'Rowery', synthesis: '', ideaIds: ['i3', 'i4'] },
      ]),
      ideas,
    );

    expect(groups.map((g) => g.label)).not.toContain(pl.common.other);
  });

  it('drops groups left with no ideas rather than showing an empty card', () => {
    const groups = normalizeGroups(
      response([
        { label: 'Zieleń', synthesis: '', ideaIds: ['i1', 'i2', 'i3', 'i4'] },
        { label: 'Puste', synthesis: '', ideaIds: [] },
        { label: 'Też puste', synthesis: '', ideaIds: ['i1'] },
      ]),
      ideas,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe('g1');
  });

  it('drops a group with a blank label', () => {
    const groups = normalizeGroups(
      response([
        { label: '   ', synthesis: '', ideaIds: ['i1'] },
        { label: 'Rowery', synthesis: '', ideaIds: ['i2'] },
      ]),
      ideas,
    );

    expect(groups[0]?.label).toBe('Rowery');
    expect(groups[0]?.id).toBe('g1');
  });

  it('collapses whitespace in labels and trims syntheses', () => {
    const groups = normalizeGroups(
      response([{ label: '  Zieleń   i  woda ', synthesis: '  Więcej drzew.\n', ideaIds: ['i1'] }]),
      ideas,
    );

    expect(groups[0]?.label).toBe('Zieleń i woda');
    expect(groups[0]?.synthesis).toBe('Więcej drzew.');
  });

  it('puts everything in "Inne" when the model returns nothing usable', () => {
    const groups = normalizeGroups(response([{ label: 'x', synthesis: '', ideaIds: [] }]), ideas);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe(pl.common.other);
    expect(groups[0]?.ideaIds).toHaveLength(ideas.length);
  });
});
