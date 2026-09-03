import { z } from 'zod';

/**
 * System prompts and response schemas for the two text-model calls (A-3).
 *
 * Milestone 3 starts with a spike that authors these against ~30 sample Polish
 * ideas and a reference photo until the output is stable, pure JSON.
 *
 * Confirmed against `gemma-4-31b-it` with the lecturer's key
 * (`npm run verify:models`):
 *  - `systemInstruction` IS accepted, so these prompts go in the system slot
 *    rather than being prepended to the user turn.
 *  - `responseMimeType: 'application/json'` IS accepted, so structured output
 *    is available and the model does not need to be talked out of code fences.
 *  - A strict Polish JSON prompt already returns clean, parseable JSON.
 *
 * Responses are still zod-validated before being persisted (A-4). Keep the
 * strip-fences fallback and the single automatic retry as cheap insurance —
 * they cost nothing when the model behaves.
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
