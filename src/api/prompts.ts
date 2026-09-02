import { z } from 'zod';

/**
 * System prompts and response schemas for the two text-model calls (A-3).
 *
 * Milestone 3 starts with a spike that authors these against ~30 sample Polish
 * ideas and a reference photo until the output is stable, pure JSON.
 *
 * Two constraints to design around (verify during the spike):
 *  - Gemma models on the Gemini API have no `system` role, so the "system"
 *    text must be prepended to the first user turn.
 *  - Structured-output config (`responseMimeType` / `responseSchema`) may not
 *    be available for Gemma, so the prompt itself must forbid prose and code
 *    fences, and the response is still zod-validated with a strip-fences
 *    fallback plus one automatic retry.
 */

/** TODO(M3): grouping system prompt — strict JSON, Polish, anonymised. */
export const GROUPING_SYSTEM_PROMPT = '';

/** TODO(M3): expansion system prompt — one image prompt, keep site geometry. */
export const EXPANSION_SYSTEM_PROMPT = '';

/** TODO(M3): shape returned by the grouping call (F-5.2). */
export const groupingResponseSchema = z.object({
  groups: z.array(
    z.object({
      label: z.string(),
      synthesis: z.string(),
      ideaIds: z.array(z.string()),
    }),
  ),
});
export type GroupingResponse = z.infer<typeof groupingResponseSchema>;

/** TODO(M3): shape returned by the expansion call (F-7.1). */
export const expansionResponseSchema = z.object({
  prompt: z.string(),
});
export type ExpansionResponse = z.infer<typeof expansionResponseSchema>;
