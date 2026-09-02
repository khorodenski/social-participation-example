import { describe, expect, it } from 'vitest';
import { sessionSchema } from './session';

describe('sessionSchema', () => {
  it('fills in the collection defaults for a fresh session', () => {
    const session = sessionSchema.parse({
      id: 'k7x2p9',
      title: 'Plac przed dworcem',
      createdAt: 0,
      stage: 'draft',
    });

    expect(session.intro).toBe('');
    expect(session.resources).toEqual([]);
    expect(session.groups).toEqual([]);
    expect(session.selectedGroupIds).toEqual([]);
    expect(session.expansions).toEqual({});
    expect(session.images).toEqual({});
  });

  it('rejects an unknown stage', () => {
    const result = sessionSchema.safeParse({
      id: 'k7x2p9',
      title: 'Plac',
      createdAt: 0,
      stage: 'nope',
    });

    expect(result.success).toBe(false);
  });
});
