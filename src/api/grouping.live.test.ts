import { describe, expect, it } from 'vitest';
import { groupIdeas } from './google';
import { NAME_IN_IDEAS, SAMPLE_IDEAS } from './__fixtures__/sampleIdeas';
import { pl } from '../i18n/pl';

/**
 * M3-1 prompt spike — the only test in the suite that calls the real model.
 *
 * It is skipped unless GOOGLE_API_KEY is set, so `npm test` stays green and
 * offline. To run it:
 *
 *   PowerShell:  $env:GOOGLE_API_KEY="..."; npm run spike:grouping
 *   Git Bash:    GOOGLE_API_KEY=... npm run spike:grouping
 *
 * Clear the variable afterwards. The key belongs in the lecturer's browser,
 * not in a shell that stays open.
 *
 * The assertions are the requirements (F-5.2, F-5.3, F-6.3). The console output
 * is for judging quality by eye — that is the part a test cannot do.
 */
const apiKey = process.env.GOOGLE_API_KEY?.trim();

/** Set SPIKE_MODEL to quality-check a candidate before swapping TEXT_MODEL. */
const model = process.env.SPIKE_MODEL?.trim();

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const countSentences = (text: string) =>
  text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim()).length;

describe.skipIf(!apiKey)('groupIdeas against the real model', () => {
  it('groups ~30 Polish ideas into selectable, anonymised groups', async () => {
    const groups = await groupIdeas(apiKey as string, SAMPLE_IDEAS, model);

    /* ------------------------------------------------ eyeball the output */

    const lines = groups.map((group) => {
      const head = `[${group.id}] ${group.label}  (${group.ideaIds.length})`;
      return `${head}\n    ${group.synthesis}`;
    });
    console.log(
      `\n${groups.length} groups for ${SAMPLE_IDEAS.length} ideas:\n\n${lines.join('\n\n')}\n`,
    );

    /* ------------------------------------------------------- F-6.3 gates */

    // The lecturer has to select exactly three, so fewer than three is unusable.
    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(groups.length).toBeLessThanOrEqual(10);

    // A group holding a quarter of the room is a weak podium card and a muddy
    // image prompt. "Inne" is exempt; it is a bucket by definition.
    for (const group of groups) {
      if (group.label === pl.common.other) continue;
      expect(
        group.ideaIds.length,
        `group too broad to visualise: ${group.label} holds ${group.ideaIds.length}`,
      ).toBeLessThanOrEqual(Math.ceil(SAMPLE_IDEAS.length / 4));
    }

    /* --------------------------------------------------- F-5.3 coverage */

    const assigned = groups.flatMap((group) => group.ideaIds);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(assigned.sort()).toEqual(SAMPLE_IDEAS.map((idea) => idea.id).sort());

    /* --------------------------------------------- F-5.2 shape and voice */

    for (const group of groups) {
      expect(countWords(group.label), `label too long: ${group.label}`).toBeLessThanOrEqual(6);
      expect(group.label).not.toMatch(/["'„”]/);
      expect(group.label).not.toMatch(/[.!?]$/);

      // The app writes the "Inne" bucket itself; it is exempt from the voice rules.
      if (group.label === pl.common.other) continue;

      expect(group.synthesis.length, `empty synthesis in ${group.label}`).toBeGreaterThan(0);
      expect(
        countSentences(group.synthesis),
        `synthesis should be 2-3 sentences: ${group.synthesis}`,
      ).toBeLessThanOrEqual(4);

      // Anonymity: no quoting, no talking about the people who wrote in.
      expect(group.synthesis, 'synthesis quotes an idea').not.toMatch(/["„”]/);
      expect(group.synthesis, 'synthesis refers to authors').not.toMatch(
        /uczestni|mieszkan\w*\s+(napisa|zaproponowa|wspomnia)|jedna osoba|ktoś (napisa|zaproponowa)|autor/i,
      );

      // The name planted in the fixture must not survive.
      expect(group.synthesis, 'a personal name leaked through').not.toContain(NAME_IN_IDEAS);
    }

    /* ------------------------------------------------ Polish, not English */

    const allText = groups.map((g) => `${g.label} ${g.synthesis}`).join(' ');
    expect(allText, 'output does not look Polish').toMatch(/[ąćęłńóśźż]/i);
  }, 120_000);
});
