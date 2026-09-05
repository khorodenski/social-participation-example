import type { ContentListUnion, GoogleGenAI } from '@google/genai';
import type { z } from 'zod';
import { pl } from '../i18n/pl';
import { asInlineImage } from '../state/assets';
import type { Group, Idea, Resource } from '../state/session';
import {
  EXPANSION_SYSTEM_PROMPT,
  GROUPING_SYSTEM_PROMPT,
  buildExpansionContents,
  expansionResponseSchema,
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
 * Chosen over `gemma-4-31b-it` on measured latency: five to fifteen seconds
 * across the sizes a lecture produces, against 21 s to 104 s for the same
 * inputs. Cluster quality is equal after the M3-1 prompt work. The wrinkle is
 * that it varies the top level of its JSON between three shapes, all handled
 * by `unwrapGroupingResponse`.
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
 * The two sizes the lecturer chooses between, in the gear dialog.
 *
 * Measured by `npm run spike:image`: 1K renders in 10.8 s at about 1.2 MB, 2K
 * in 19.5 s at about 4 MB. 2K is the default because F-9.2 puts one image
 * fullscreen on a 1080p projector, where 1K is visibly soft; three side by side
 * in the gallery would be fine either way. 1K is here because it is nine
 * seconds a group faster, and the three run in parallel, so it takes roughly
 * nine seconds off the whole wait rather than twenty-seven.
 *
 * The choice is stored in this browser beside the API key — see
 * `state/settings.ts`. Anything else found in storage falls back to the
 * default, because this string goes straight into the model's `imageConfig`.
 */
export const IMAGE_SIZES = ['1K', '2K'] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];

export const DEFAULT_IMAGE_SIZE: ImageSize = '2K';

/** Matches the projector and the three-up gallery (F-9.1). */
export const IMAGE_ASPECT_RATIO = '16:9';

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

  // Timing, not content: how long the call took and whether it needed the
  // retry. Console-only and console.debug, so it is out of the way until
  // someone goes looking, which is exactly what a slow rehearsal needs.
  const startedAt = Date.now();
  const elapsed = () => ((Date.now() - startedAt) / 1000).toFixed(1);

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
      if (parsed.success) {
        console.debug(`[social-voting] ${model}: ok on attempt ${attempt + 1} after ${elapsed()}s`);
        return parsed.data;
      }

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

  console.debug(`[social-voting] ${model}: gave up after ${elapsed()}s`);
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

/**
 * F-3.3 — the "Testuj klucz" action: the smallest call that proves a key works.
 *
 * Resolves on success and throws a {@link ModelError} carrying Polish copy
 * otherwise, so the dialog can show the reason rather than a bare failure.
 */
export async function testApiKey(apiKey: string): Promise<void> {
  try {
    const ai = await createGoogleClient(apiKey);
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: 'ping',
    });

    if (!res.text) throw new ModelError(pl.model.emptyResponse);
  } catch (err) {
    if (err instanceof ModelError) throw err;
    throw new ModelError(describeModelError(err), true, { cause: err });
  }
}

/**
 * F-7.1 — one multimodal call turning a chosen group into an image prompt.
 *
 * The user turn is built by `buildExpansionContents`: the theme first, then
 * every resource, with each photograph inlined as base64 next to its own
 * description. Image input on this model is confirmed (`npm run verify:models`,
 * section 5), so the site photographs go straight to it with no fallback.
 *
 * Resources are optional. The system prompt has a rule for having none, and the
 * builder says so explicitly rather than sending an empty turn, which is what
 * makes this callable before the resource editor (M2-3) exists.
 *
 * The prompt it returns is English on purpose (A-3): it is fed to the image
 * model, never shown to the room. Only the heading above it stays Polish.
 */
export async function expandGroup(
  apiKey: string,
  group: Group,
  resources: Resource[],
  /** Base64 JPEG/PNG payloads for the image resources, keyed by resource id. */
  resourceImages: Record<string, string>,
  /** Overridable for the same reason as `groupIdeas`: benchmarks and rehearsal day. */
  model: string = TEXT_MODEL,
): Promise<string> {
  const contents = [
    { role: 'user', parts: buildExpansionContents(group, resources, resourceImages) },
  ];

  const response = await generateJson(
    apiKey,
    EXPANSION_SYSTEM_PROMPT,
    contents,
    expansionResponseSchema,
    model,
  );

  return response.prompt;
}

/**
 * F-8.1 — one image from one prompt plus the `useAsReference` photographs.
 *
 * Two traps here, both found in M3-1's `verify:models` run and both cheap to
 * fall into again:
 *
 *  - **Never read `res.data`.** This model returns a `thoughtSignature` part
 *    alongside the picture, and that getter silently concatenates every data
 *    part and warns. The image is the part with `inlineData`.
 *  - **It returns JPEG, around 1 MB, not the PNG D-3 names in the key.** The
 *    real `mimeType` comes back with the bytes and the caller stores it, so the
 *    key's extension is derived rather than assumed.
 *
 * No automatic retry, unlike `generateJson`. A JSON shape failure is worth an
 * instant second attempt; an image failure is usually a safety block or quota,
 * where retrying burns another minute for the same answer. F-8.2 gives the
 * lecturer a per-card "Ponów" instead, which is the retry that knows whether it
 * is worth it.
 */
export async function generateImage(
  apiKey: string,
  prompt: string,
  /** Base64 payloads, or `data:` URLs, of the `useAsReference` images (F-2.3). */
  referenceImages: string[],
  options: { imageSize?: string; aspectRatio?: string; model?: string } = {},
): Promise<{ base64: string; mimeType: string }> {
  const model = options.model ?? IMAGE_MODEL;
  const startedAt = Date.now();

  const references = referenceImages
    .map((payload) => asInlineImage(payload, 'image/jpeg'))
    .filter((image): image is NonNullable<typeof image> => image !== null)
    .map((inlineData) => ({ inlineData }));

  try {
    const res = await createGoogleClient(apiKey).then((ai) =>
      ai.models.generateContent({
        model,
        // References first, then the instruction, the same order image input
        // was confirmed in for the text model.
        contents: [{ role: 'user', parts: [...references, { text: prompt }] }],
        config: {
          imageConfig: {
            imageSize: options.imageSize ?? DEFAULT_IMAGE_SIZE,
            aspectRatio: options.aspectRatio ?? IMAGE_ASPECT_RATIO,
          },
        },
      }),
    );

    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const image = parts.find((part) => part.inlineData?.data)?.inlineData;

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    if (!image?.data) {
      // A refusal comes back as text where the picture should have been, and
      // that text is the only clue about why.
      console.debug(`[social-voting] ${model}: no image after ${seconds}s`);
      throw new ModelError(res.text ? pl.model.blocked : pl.model.emptyResponse, true, {
        cause: { kind: 'no-image', parts: parts.length, text: res.text?.slice(0, 300) },
      });
    }

    const mimeType = image.mimeType ?? 'image/jpeg';
    console.debug(
      `[social-voting] ${model}: image in ${seconds}s, ${Math.round((image.data.length * 3) / 4 / 1024)} KB, ${mimeType}`,
    );

    return { base64: image.data, mimeType };
  } catch (err) {
    if (err instanceof ModelError) throw err;
    throw new ModelError(describeModelError(err), true, { cause: err });
  }
}
