import { describe, expect, it } from 'vitest';
import { groupingResponseSchema } from './prompts';

/**
 * The two Gemma variants disagree about the top level of the response.
 * `gemma-4-31b-it` returns the wrapper the prompt asks for; `gemma-4-26b-a4b-it`
 * returns the bare array. Both carry identical content, so both are accepted.
 */
const GROUP = {
  label: 'Zieleń i cień',
  synthesis: 'Więcej drzew obniży temperaturę. Cień poprawi komfort w upalne dni.',
  ideaIds: ['i1', 'i3'],
};

describe('groupingResponseSchema', () => {
  it('accepts the wrapped object', () => {
    const parsed = groupingResponseSchema.safeParse({ groups: [GROUP] });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.groups[0]?.label).toBe('Zieleń i cień');
  });

  it('accepts a bare array and wraps it', () => {
    const parsed = groupingResponseSchema.safeParse([GROUP]);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.groups).toHaveLength(1);
    expect(parsed.success && parsed.data.groups[0]?.ideaIds).toEqual(['i1', 'i3']);
  });

  it('rejects an empty result either way', () => {
    expect(groupingResponseSchema.safeParse([]).success).toBe(false);
    expect(groupingResponseSchema.safeParse({ groups: [] }).success).toBe(false);
  });

  it('rejects a group with no label', () => {
    const parsed = groupingResponseSchema.safeParse([{ ...GROUP, label: '' }]);

    expect(parsed.success).toBe(false);
  });

  it('rejects prose that happens to parse as JSON', () => {
    expect(groupingResponseSchema.safeParse('Oto grupy:').success).toBe(false);
    expect(groupingResponseSchema.safeParse(null).success).toBe(false);
  });
});
