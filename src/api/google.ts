import type { ContentListUnion, GoogleGenAI } from '@google/genai';
import type { z } from 'zod';
import { pl } from '../i18n/pl';
import type { Group, Idea, Resource } from '../state/session';
import {
  EXPANSION_SYSTEM_PROMPT,
  GROUPING_SYSTEM_PROMPT,
  groupingResponseSchema,
  type GroupingResponse,
} from './prompts';

/**
 * Direct browser → Google Gen AI calls (A-1, A-2).
 *
 * The API key comes from the lecturer's localStorage and is passed in here
 * explicitly. It must never reach a Netlify Function, Blobs or a log line.
 *
 * Model ids live here and only here (plan: "Key technical decisions").
 */

/**
 * Text + vision model used for grouping and prompt expansion.
 *
 * Chosen over `gemma-4-31b-it` on measured latency: 15 s for 32 ideas and
 * 23 s for 100, against roughly two minutes either way. Cluster quality is
 * equal after the M3-1 prompt work. The one wrinkle is that this variant
 * answers with the bare array rather than the documented wrapper, which
 * `groupingResponseSchema` accepts.
 *
 * `gemma-4-31b-it` is the fallback if a session ever needs finer clusters and
 * the wait is acceptable.
 */
export const TEXT_MODEL = 'gemma-4-26b-a4b-it';

/**
 * Image generation model ("Nano Banana 2"). Generation only — never used to
 * describe images (that is the text model's job, A-2).
 * Id confirmed by the lecturer. `gemini-3-pro-image` is the slower, stronger
 * fallback if flash renders look weak at projector size.
 */
export const IMAGE_MODEL = 'gemini-3.1-flash-image';

/**
 * The SDK is loaded on demand, not at start-up.
 *
 * It is ~300 kB of the bundle and only the lecturer's screen ever calls it.
 * Attendees open the idea form on a phone, often on mobile data in a hall with
 * bad reception, and should not pay for a library they never touch.
 */
let sdk: Promise<typeof import('@google/genai')> | null = null;

export async function createGoogleClient(apiKey: string): Promise<GoogleGenAI> {
  sdk ??= import('@google/genai');
  const { GoogleGenAI } = await sdk;
  return new GoogleGenAI({ apiKey });
}

/** A model failure with Polish copy ready for the UI (N-7). */
export class ModelError extends Error {
  constructor(
    message: string,
    /** False when retrying cannot possibly help (e.g. nothing to group). */
    readonly retryable = true,
    /**
     * The underlying API error or schema failure. The UI shows `message`; this
     * is what you read when a model that should work does not.
     */
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ModelError';
  }
}

/** Maps the common API failures onto Polish copy. M6-2 extends this. */
function describeModelError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/\b(401|403)\b|API[_ ]?key|permission/i.test(raw)) return pl.model.badKey;
  if (/\b429\b|quota|rate limit|RESOURCE_EXHAUSTED/i.test(raw)) return pl.model.quota;
  if (/safety|blocked|PROHIBITED_CONTENT|RECITATION/i.test(raw)) return pl.model.blocked;
  if (/fetch|network|ENOTFOUND|ECONNRESET|timeout/i.test(raw)) return pl.model.network;

  return pl.model.invalidResponse;
}

/**
 * Pulls a JSON object out of a model reply.
 *
 * `responseMimeType: 'application/json'` already gives clean JSON on this
 * model, so the fence-stripping and brace-slicing below are the fallbacks the
 * plan asks for, not the normal path.
 */
function extractJson(raw: string): unknown {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    /* fall through to the brace slice */
  }

  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      /* give up below */
    }
  }

  return null;
}

/**
 * One text-model call that must come back as schema-valid JSON, with a single
 * automatic retry at a lower temperature (A-3, A-4).
 */
async function generateJson<S extends z.ZodTypeAny>(
  apiKey: string,
  systemInstruction: string,
  contents: ContentListUnion,
  schema: S,
  model: string = TEXT_MODEL,
): Promise<z.infer<S>> {
  const ai = await createGoogleClient(apiKey);
  // Annotated because `pl` is `as const`, which would otherwise pin this to the
  // literal type of the first message.
  let problem: string = pl.model.invalidResponse;
  let cause: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          // The retry asks for the most deterministic answer the model gives.
          temperature: attempt === 0 ? 0.4 : 0.1,
        },
      });

      if (!res.text) {
        problem = pl.model.emptyResponse;
        cause = 'the model returned no text';
        continue;
      }

      const parsed = schema.safeParse(extractJson(res.text));
      if (parsed.success) return parsed.data;

      problem = pl.model.invalidResponse;
      cause = {
        kind: 'schema',
        issues: parsed.error.issues.slice(0, 3),
        sample: res.text.slice(0, 400),
      };
    } catch (err) {
      problem = describeModelError(err);
      cause = err;
    }
  }

  throw new ModelError(problem, true, { cause });
}

/* -------------------------------------------------------------- grouping */

/** Keeps one idea on one line so the ids stay unambiguous in the listing. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Turns a raw grouping response into the persisted `Group[]` (F-5.2, F-5.3).
 *
 * Pure on purpose so the rules are unit-testable without an API key:
 *  - group ids are assigned by the app, `g1`..`gN`
 *  - ids the model invented are dropped
 *  - an idea claimed twice stays in the first group that claimed it
 *  - groups left with no ideas are dropped
 *  - whatever is still unassigned lands in a trailing "Inne" group
 */
export function normalizeGroups(response: GroupingResponse, ideas: Idea[]): Group[] {
  const known = new Set(ideas.map((idea) => idea.id));
  const claimed = new Set<string>();
  const groups: Group[] = [];

  for (const raw of response.groups) {
    const label = raw.label.replace(/\s+/g, ' ').trim();
    if (label.length === 0) continue;

    const ideaIds: string[] = [];
    for (const id of raw.ideaIds) {
      if (!known.has(id) || claimed.has(id)) continue;
      claimed.add(id);
      ideaIds.push(id);
    }

    if (ideaIds.length === 0) continue;

    groups.push({
      id: `g${groups.length + 1}`,
      label,
      synthesis: raw.synthesis.trim(),
      ideaIds,
    });
  }

  const leftovers = ideas.filter((idea) => !claimed.has(idea.id)).map((idea) => idea.id);
  if (leftovers.length > 0) {
    groups.push({
      id: `g${groups.length + 1}`,
      label: pl.common.other,
      synthesis: pl.groups.otherSynthesis,
      ideaIds: leftovers,
    });
  }

  return groups;
}

/** F-5.1 — one batch call that turns all ideas of a session into groups. */
export async function groupIdeas(
  apiKey: string,
  ideas: Idea[],
  /**
   * Overridable so the latency benchmark can compare the Gemma variants,
   * and so a slow model can be swapped on rehearsal day. The app always
   * uses the default.
   */
  model: string = TEXT_MODEL,
): Promise<Group[]> {
  if (ideas.length === 0) throw new ModelError(pl.model.noIdeas, false);

  const listing = ideas.map((idea) => `${idea.id}: ${collapse(idea.text)}`).join('\n');
  const contents = `Pomysły do pogrupowania (${ideas.length}):\n${listing}`;

  const response = await generateJson(
    apiKey,
    GROUPING_SYSTEM_PROMPT,
    contents,
    groupingResponseSchema,
    model,
  );

  return normalizeGroups(response, ideas);
}

/* -------------------------------------------------------------- the rest */

/** F-3.3 — a trivial call used by the "Testuj klucz" action. */
export async function testApiKey(apiKey: string): Promise<boolean> {
  const ai = await createGoogleClient(apiKey);
  const res = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: 'ping',
  });
  return typeof res.text === 'string' && res.text.length > 0;
}

/**
 * F-7.1 — multimodal call producing one image prompt for a group.
 *
 * M4-1 builds the multimodal user turn (label, synthesis, resource text and
 * resource images as inline data) and sends it through `generateJson` with
 * {@link EXPANSION_SYSTEM_PROMPT} and `expansionResponseSchema`.
 *
 * Image input is confirmed on TEXT_MODEL (`npm run verify:models`, section 5),
 * so the site photographs can go straight to this model. No fallback needed.
 */
export async function expandGroup(
  _apiKey: string,
  _group: Group,
  _resources: Resource[],
  /** Base64 JPEG/PNG payloads for the image resources, keyed by resource id. */
  _resourceImages: Record<string, string>,
): Promise<string> {
  void EXPANSION_SYSTEM_PROMPT;
  throw new Error('not implemented');
}

/**
 * F-8.1 — generates one image from a prompt plus reference images.
 *
 * M5-1: read the image from `candidates[0].content.parts` and take the part
 * with `inlineData`. Do NOT use `res.data` — this model sometimes returns a
 * `thoughtSignature` part alongside the image, and the getter concatenates
 * every data part. `scripts/verify-models.mjs` has the working pattern.
 *
 * The model returns JPEG, around 1 MB, not the PNG that D-3 names in the key
 * `sessions/<id>/images/<gid>.png`. Store the real `mimeType` as the blob's
 * content type (`_blobs.ts` already does) and derive the key's extension from
 * it rather than hardcoding `.png`.
 */
export async function generateImage(
  _apiKey: string,
  _prompt: string,
  /** Base64 payloads of the `useAsReference` images. */
  _referenceImages: string[],
): Promise<{ base64: string; mimeType: string }> {
  throw new Error('not implemented');
}
