import { describe, expect, it } from 'vitest';
import {
  buildExpansionContents,
  expansionResponseSchema,
  groupingResponseSchema,
  type ExpansionPart,
} from './prompts';
import type { Group, Resource } from '../state/session';

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

  /**
   * The shape that failed a real 32-idea run: the documented wrapper, itself
   * wrapped in an array. Content was correct; only the packaging was wrong.
   */
  it('accepts the wrapper wrapped in an array', () => {
    const parsed = groupingResponseSchema.safeParse([{ groups: [GROUP] }]);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.groups).toHaveLength(1);
    expect(parsed.success && parsed.data.groups[0]?.label).toBe('Zieleń i cień');
  });

  it('accepts a wrapper holding another wrapper', () => {
    const parsed = groupingResponseSchema.safeParse({ groups: [{ groups: [GROUP] }] });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.groups[0]?.ideaIds).toEqual(['i1', 'i3']);
  });

  it('does not mistake a two-group array for a wrapper', () => {
    const second = { ...GROUP, label: 'Rowery', ideaIds: ['i2'] };
    const parsed = groupingResponseSchema.safeParse([GROUP, second]);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.groups).toHaveLength(2);
  });

  it('still rejects a single-element array whose element is not a group', () => {
    expect(groupingResponseSchema.safeParse([{ notAGroup: true }]).success).toBe(false);
  });
});

/* ------------------------------------------------ F-7.1 the expansion turn */

const group: Group = {
  id: 'g1',
  label: 'Zieleń i cień',
  synthesis: 'Nasadzenia drzew wzdłuż pierzei. Plac przestałby być rozgrzanym asfaltem.',
  ideaIds: ['i1', 'i2'],
};

function resource(over: Partial<Resource> & Pick<Resource, 'id' | 'type'>): Resource {
  return { description: '', useAsReference: false, ...over };
}

/** Type guards, so the assertions below read as "the third part is a photo". */
const isImage = (part: ExpansionPart): part is { inlineData: { mimeType: string; data: string } } =>
  'inlineData' in part;
const text = (part: ExpansionPart) => ('text' in part ? part.text : '');

const B64 = 'iVBORw0KGgoAAAANSUhEUg==';

describe('buildExpansionContents', () => {
  it('leads with the theme, then the materials heading', () => {
    const parts = buildExpansionContents(group, [], {});

    expect(text(parts[0]!)).toContain('TEMAT');
    expect(text(parts[0]!)).toContain('Zieleń i cień');
    expect(text(parts[0]!)).toContain('SYNTEZA');
    expect(text(parts[1]!)).toContain('MATERIAŁY O MIEJSCU');
  });

  /**
   * The whole reason M4-1 does not wait on the resource editor: the system
   * prompt has a rule for having no photographs, so say so rather than send an
   * empty turn and hope.
   */
  it('says outright that there are no materials, rather than sending nothing', () => {
    const parts = buildExpansionContents(group, [], {});

    expect(parts).toHaveLength(2);
    expect(text(parts[1]!)).toContain('Brak materiałów');
    expect(parts.some(isImage)).toBe(false);
  });

  it('inlines a photograph after its own description', () => {
    const parts = buildExpansionContents(
      group,
      [
        resource({
          id: 'r1',
          type: 'image',
          description: 'Widok od strony ulicy',
          imageKey: 'sessions/k7x2p9/resources/r1.jpg',
        }),
      ],
      { r1: B64 },
    );

    const heading = parts.findIndex((p) => text(p).includes('ZDJĘCIE MIEJSCA'));
    expect(heading).toBeGreaterThan(-1);
    expect(text(parts[heading]!)).toContain('Widok od strony ulicy');
    expect(isImage(parts[heading + 1]!)).toBe(true);
  });

  it('takes the mime type from the stored key', () => {
    const parts = buildExpansionContents(
      group,
      [resource({ id: 'r1', type: 'image', imageKey: 'sessions/k7x2p9/resources/r1.png' })],
      { r1: B64 },
    );

    const image = parts.find(isImage);
    expect(image?.inlineData.mimeType).toBe('image/png');
    expect(image?.inlineData.data).toBe(B64);
  });

  it('prefers the mime type a data URL carries', () => {
    const parts = buildExpansionContents(
      group,
      [resource({ id: 'r1', type: 'image', imageKey: 'sessions/k7x2p9/resources/r1.png' })],
      { r1: `data:image/webp;base64,${B64}` },
    );

    const image = parts.find(isImage);
    expect(image?.inlineData.mimeType).toBe('image/webp');
    expect(image?.inlineData.data).toBe(B64);
  });

  it('falls back to JPEG when neither the payload nor the key says', () => {
    const parts = buildExpansionContents(group, [resource({ id: 'r1', type: 'image' })], {
      r1: B64,
    });

    expect(parts.find(isImage)?.inlineData.mimeType).toBe('image/jpeg');
  });

  it('includes a text resource as a note', () => {
    const parts = buildExpansionContents(
      group,
      [
        resource({
          id: 'r1',
          type: 'text',
          description: 'Wymiary',
          text: 'Plac ma 40 na 25 metrów.',
        }),
      ],
      {},
    );

    const note = parts.find((p) => text(p).includes('NOTATKA'));
    expect(text(note!)).toContain('Wymiary');
    expect(text(note!)).toContain('Plac ma 40 na 25 metrów.');
  });

  /**
   * A photo whose bytes never arrived is still a written note about the place.
   * Dropping it would throw away context the lecturer typed by hand.
   */
  it('keeps the description when a photograph is missing', () => {
    const parts = buildExpansionContents(
      group,
      [resource({ id: 'r1', type: 'image', description: 'Widok od strony ulicy' })],
      {},
    );

    expect(parts.some(isImage)).toBe(false);
    expect(text(parts[2]!)).toContain('Widok od strony ulicy');
  });

  it('skips a resource that carries nothing at all', () => {
    const parts = buildExpansionContents(
      group,
      [resource({ id: 'r1', type: 'text' }), resource({ id: 'r2', type: 'image' })],
      {},
    );

    expect(parts).toHaveLength(2);
    expect(text(parts[1]!)).toContain('Brak materiałów');
  });

  it('skips an empty payload rather than sending an empty image part', () => {
    const parts = buildExpansionContents(group, [resource({ id: 'r1', type: 'image' })], {
      r1: '   ',
    });

    expect(parts.some(isImage)).toBe(false);
  });

  it('keeps the resources in the order the lecturer arranged them (F-2.1)', () => {
    const parts = buildExpansionContents(
      group,
      [
        resource({ id: 'r1', type: 'text', description: 'Pierwsza', text: 'a' }),
        resource({ id: 'r2', type: 'image', description: 'Druga' }),
        resource({ id: 'r3', type: 'text', description: 'Trzecia', text: 'c' }),
      ],
      { r2: B64 },
    );

    const order = parts.map(text).join(' | ');
    expect(order.indexOf('Pierwsza')).toBeLessThan(order.indexOf('Druga'));
    expect(order.indexOf('Druga')).toBeLessThan(order.indexOf('Trzecia'));
  });

  it('collapses whitespace so the turn stays one line per field', () => {
    const parts = buildExpansionContents({ ...group, label: '  Zieleń   i \n cień ' }, [], {});

    expect(text(parts[0]!)).toContain('Zieleń i cień');
  });

  it('says so when the group has no synthesis', () => {
    const parts = buildExpansionContents({ ...group, synthesis: '  ' }, [], {});
    expect(text(parts[0]!)).toContain('Brak syntezy.');
  });
});

describe('expansionResponseSchema', () => {
  it('accepts a real prompt and trims it', () => {
    const parsed = expansionResponseSchema.parse({ prompt: '  A photorealistic view.  ' });
    expect(parsed.prompt).toBe('A photorealistic view.');
  });

  it('rejects a whitespace-only prompt, so the retry gets a second go', () => {
    expect(expansionResponseSchema.safeParse({ prompt: '   ' }).success).toBe(false);
  });

  it('rejects an empty prompt', () => {
    expect(expansionResponseSchema.safeParse({ prompt: '' }).success).toBe(false);
  });
});
