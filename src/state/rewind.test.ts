import { describe, expect, it } from 'vitest';
import { applyReset, availableTargets, blobsToClear, previousStage } from './rewind';
import { STAGES, sessionSchema, type Session } from './session';

function session(over: Partial<Session> = {}): Session {
  return sessionSchema.parse({
    id: 'k7x2p9',
    title: 'Plac',
    createdAt: 0,
    stage: 'gallery',
    groups: [
      { id: 'g1', label: 'A', synthesis: '', ideaIds: ['i1'] },
      { id: 'g2', label: 'B', synthesis: '', ideaIds: ['i2'] },
    ],
    selectedGroupIds: ['g1', 'g2'],
    expansions: {
      g1: { prompt: 'p1', createdAt: 1 },
      g2: { prompt: 'p2', createdAt: 1, editedAt: 2 },
    },
    images: { g1: { imageKey: 'k1', createdAt: 3 }, g2: { imageKey: 'k2', createdAt: 3 } },
    ...over,
  });
}

describe('previousStage', () => {
  it('steps one screen back and never skips one', () => {
    expect(previousStage('gallery')).toBe('visualizing');
    expect(previousStage('visualizing')).toBe('expanded');
    expect(previousStage('expanded')).toBe('results');
    expect(previousStage('expanding')).toBe('results');
    expect(previousStage('results')).toBe('voting');
    expect(previousStage('voting')).toBe('intro');
    expect(previousStage('intro')).toBe('draft');
  });

  it('has nowhere to go from setup or from a grouping in flight', () => {
    expect(previousStage('draft')).toBeNull();
    expect(previousStage('grouping')).toBeNull();
  });

  it('answers for every stage', () => {
    for (const stage of STAGES) expect(() => previousStage(stage)).not.toThrow();
  });
});

describe('availableTargets', () => {
  it('offers only checkpoints before the current screen', () => {
    expect(availableTargets('draft')).toEqual([]);
    expect(availableTargets('voting')).toEqual(['draft']);
    expect(availableTargets('results')).toEqual(['draft']);
    expect(availableTargets('expanding')).toEqual(['draft', 'results']);
    expect(availableTargets('expanded')).toEqual(['draft', 'results']);
    expect(availableTargets('visualizing')).toEqual(['draft', 'results', 'expanded']);
    expect(availableTargets('gallery')).toEqual(['draft', 'results', 'expanded', 'visualizing']);
  });
});

describe('applyReset', () => {
  it('to draft clears everything the lecture produced and keeps the setup', () => {
    const reset = applyReset(session(), 'draft');
    expect(reset.stage).toBe('draft');
    expect(reset.groups).toEqual([]);
    expect(reset.selectedGroupIds).toEqual([]);
    expect(reset.expansions).toEqual({});
    expect(reset.images).toEqual({});
    expect(reset.title).toBe('Plac');
  });

  it('to results keeps the groups and the selection, drops prompts and pictures', () => {
    const reset = applyReset(session(), 'results');
    expect(reset.stage).toBe('results');
    expect(reset.groups).toHaveLength(2);
    expect(reset.selectedGroupIds).toEqual(['g1', 'g2']);
    expect(reset.expansions).toEqual({});
    expect(reset.images).toEqual({});
  });

  it('to expanded keeps the prompts, including hand edits, and drops the pictures', () => {
    const reset = applyReset(session(), 'expanded');
    expect(reset.stage).toBe('expanded');
    expect(reset.expansions.g2?.editedAt).toBe(2);
    expect(reset.images).toEqual({});
  });

  it('to expanded lands on expanding when a chosen group has no prompt', () => {
    const reset = applyReset(
      session({ expansions: { g1: { prompt: 'p1', createdAt: 1 } } }),
      'expanded',
    );
    expect(reset.stage).toBe('expanding');
  });

  it('to visualizing changes only the stage', () => {
    const before = session();
    const reset = applyReset(before, 'visualizing');
    expect(reset).toEqual({ ...before, stage: 'visualizing' });
  });

  it('does not mutate its input', () => {
    const before = session();
    applyReset(before, 'draft');
    expect(before.stage).toBe('gallery');
    expect(Object.keys(before.images)).toHaveLength(2);
  });
});

describe('blobsToClear', () => {
  it('deletes ideas only for a full reset and pictures for every target but the last', () => {
    expect(blobsToClear('draft')).toEqual({ ideas: true, images: true });
    expect(blobsToClear('results')).toEqual({ ideas: false, images: true });
    expect(blobsToClear('expanded')).toEqual({ ideas: false, images: true });
    expect(blobsToClear('visualizing')).toEqual({ ideas: false, images: false });
  });
});
