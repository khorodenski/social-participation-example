import { describe, expect, it } from 'vitest';
import { IDEA_MAX_LENGTH, IDEA_MIN_LENGTH, ideaTextSchema } from './session';

/**
 * F-4.3. The same schema guards the attendee form and the function that
 * accepts the submission, so these rules only need proving once.
 */
describe('ideaTextSchema', () => {
  it('accepts an ordinary submission', () => {
    const parsed = ideaTextSchema.safeParse('Więcej drzew i ławek na tym placu');

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toBe('Więcej drzew i ławek na tym placu');
  });

  it('trims before measuring, so padding cannot fake the minimum', () => {
    const parsed = ideaTextSchema.safeParse(`   ${'x'.repeat(IDEA_MIN_LENGTH - 1)}   `);

    expect(parsed.success).toBe(false);
  });

  it('trims the stored text', () => {
    const parsed = ideaTextSchema.safeParse('  Fontanna na środku placu  ');

    expect(parsed.success && parsed.data).toBe('Fontanna na środku placu');
  });

  it('rejects anything shorter than the minimum', () => {
    expect(ideaTextSchema.safeParse('krótkie').success).toBe(false);
    expect(ideaTextSchema.safeParse('').success).toBe(false);
  });

  it('accepts exactly the minimum and the maximum', () => {
    expect(ideaTextSchema.safeParse('x'.repeat(IDEA_MIN_LENGTH)).success).toBe(true);
    expect(ideaTextSchema.safeParse('x'.repeat(IDEA_MAX_LENGTH)).success).toBe(true);
  });

  it('rejects one character past the maximum', () => {
    expect(ideaTextSchema.safeParse('x'.repeat(IDEA_MAX_LENGTH + 1)).success).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(ideaTextSchema.safeParse(undefined).success).toBe(false);
    expect(ideaTextSchema.safeParse(42).success).toBe(false);
  });
});
