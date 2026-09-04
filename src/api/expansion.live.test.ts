import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandGroup } from './google';
import type { Group, Resource } from '../state/session';

/**
 * M4-1 prompt spike — the expansion half of what `grouping.live.test.ts` does
 * for M3-1. Skipped unless GOOGLE_API_KEY is set, so `npm test` stays green and
 * offline. To run it:
 *
 *   PowerShell:  $env:GOOGLE_API_KEY="..."; npm run spike:expansion
 *   Git Bash:    GOOGLE_API_KEY=... npm run spike:expansion
 *
 * Clear the variable afterwards. The key belongs in the lecturer's browser, not
 * in a shell that stays open.
 *
 * This exists because of what M3-1 taught: unit tests caught neither the
 * latency behaviour nor the response-shape failure. Only a real call does. Run
 * it after any edit to EXPANSION_SYSTEM_PROMPT.
 *
 * The assertions are F-7.1. The console output is for judging the prompt by
 * eye, which is the part a test cannot do.
 */
const apiKey = process.env.GOOGLE_API_KEY?.trim();
const model = process.env.SPIKE_MODEL?.trim();

const GROUP: Group = {
  id: 'g1',
  label: 'Zieleń i miejsca do siedzenia',
  synthesis:
    'Nasadzenia drzew wzdłuż całej pierzei dałyby ciąg cienia, a ławki ustawione pod nimi ' +
    'pozwoliłyby zatrzymać się dłużej. Plac przestałby być korytarzem do przejścia i stałby ' +
    'się miejscem spotkania.',
  ideaIds: ['i1', 'i2', 'i3', 'i4', 'i5'],
};

/** A real 2x2 PNG. It says nothing about a place; it proves the part is accepted. */
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

/**
 * The 2x2 PNG proves the plumbing, not the cost. This model charges for an
 * image by its resolution, so a real 1536 px site photograph is worth hundreds
 * of times more than that pixel and the measured 69 s is a floor, not a number
 * to plan the lecture around.
 *
 * Point SPIKE_PHOTO at a real downscaled photo to find out what it actually
 * costs, before M4-2 decides how long the projector waits:
 *
 *   PowerShell:  $env:SPIKE_PHOTO="C:\zdjecia\plac.jpg"; npm run spike:expansion
 *   Git Bash:    SPIKE_PHOTO=/c/zdjecia/plac.jpg npm run spike:expansion
 */
const photoPath = process.env.SPIKE_PHOTO?.trim();

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function loadPhoto(): { data: string; mimeType: string; kb: number } {
  if (!photoPath) return { data: TINY_PNG, mimeType: 'image/png', kb: 0 };

  const bytes = readFileSync(photoPath);
  const mimeType = MIME_BY_EXTENSION[path.extname(photoPath).toLowerCase()] ?? 'image/jpeg';
  return {
    data: bytes.toString('base64'),
    mimeType,
    kb: Math.round(bytes.byteLength / 1024),
  };
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * The rules F-7.1 states outright. Checked on every run, because each one is a
 * thing the model does by default unless the prompt talks it out of it.
 */
function assertFollowsTheBrief(prompt: string) {
  // English, even though everything it received was Polish.
  expect(prompt, 'prompt is not English').not.toMatch(/[ąćęłńóśźż]/i);

  // "70 to 130 words" is the instruction; the band here is wider because a
  // language model is not a word counter. It catches a paragraph that collapsed
  // to a caption or ran away into an essay, which is what actually goes wrong.
  const words = countWords(prompt);
  expect(words, `prompt is ${words} words`).toBeGreaterThanOrEqual(55);
  expect(words, `prompt is ${words} words`).toBeLessThanOrEqual(170);

  // No quality boilerplate.
  expect(prompt, 'quality boilerplate').not.toMatch(
    /\b(4k|8k|masterpiece|highly detailed|ultra[-\s]detailed|award[-\s]winning|trending on artstation|hyperrealistic)\b/i,
  );
  expect(prompt, 'negative prompt').not.toMatch(/negative prompt|(^|\s)--no\s/i);
  expect(prompt, 'camera brand name').not.toMatch(
    /\b(canon|nikon|sony|leica|hasselblad|fujifilm|zeiss)\b/i,
  );

  // It describes a place, never the process that produced it.
  expect(prompt, 'mentions the consultation').not.toMatch(
    /\b(consultation|workshop|voting|vote|survey|participants?|respondents?|proposals?|submissions?|stakeholders?)\b/i,
  );

  // It is the kind of picture F-7.1 asks for.
  expect(prompt.toLowerCase(), 'not a photorealistic visualisation').toMatch(
    /photorealistic|photo-realistic/,
  );
}

describe.skipIf(!apiKey)('expandGroup against the real model', () => {
  /**
   * The case that makes M4-1 startable before the resource editor exists: the
   * system prompt has a rule for having no photographs, and the builder says so
   * outright rather than sending an empty turn.
   */
  it('writes an image prompt from the group alone, with no resources', async () => {
    const prompt = await expandGroup(apiKey as string, GROUP, [], {}, model);

    console.log(`\nNo resources (${countWords(prompt)} words):\n\n${prompt}\n`);

    assertFollowsTheBrief(prompt);

    // With no photographs it must not invent a real, named location.
    expect(prompt, 'invented a named place').not.toMatch(
      /\b(Warsaw|Krak[oó]w|Gda[nń]sk|Wroc[lł]aw|Pozna[nń]|Berlin|Paris|London|Copenhagen)\b/i,
    );
  }, 180_000);

  it('accepts a written note and a photograph in the same turn', async () => {
    const resources: Resource[] = [
      {
        id: 'r1',
        type: 'text',
        description: 'Wymiary i kontekst',
        text: 'Plac ma około 40 na 25 metrów. Z trzech stron otaczają go czteropiętrowe kamienice, z czwartej przystanek tramwajowy. Nawierzchnia to szary asfalt.',
        useAsReference: false,
      },
      {
        id: 'r2',
        type: 'image',
        description: 'Widok z okna kamienicy na pusty plac',
        imageKey: 'sessions/spike01/resources/r2.png',
        useAsReference: true,
      },
    ];

    const photo = loadPhoto();
    const startedAt = Date.now();

    const prompt = await expandGroup(
      apiKey as string,
      GROUP,
      resources,
      { r2: `data:${photo.mimeType};base64,${photo.data}` },
      model,
    );

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const which = photo.kb > 0 ? `a real ${photo.kb} KB photo` : 'the 2x2 placeholder';
    console.log(
      `\nWith a note and ${which} — ${seconds}s, ${countWords(prompt)} words:\n\n${prompt}\n`,
    );
    if (photo.kb === 0) {
      console.log(
        'Set SPIKE_PHOTO to a real downscaled photo to measure what a lecture actually costs.\n',
      );
    }

    assertFollowsTheBrief(prompt);

    // The written note is the only real context in this run, so the prompt
    // should show some sign of having read it.
    expect(
      /tram|tenement|apartment|building|four[-\s]stor|facade|fa\u00e7ade|asphalt|square/i.test(
        prompt,
      ),
      'the prompt ignored the written note entirely',
    ).toBe(true);
  }, 180_000);
});
