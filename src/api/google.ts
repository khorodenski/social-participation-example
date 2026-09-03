import { GoogleGenAI } from '@google/genai';
import type { Group, Idea, Resource } from '../state/session';

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
 * Id confirmed against `ai.models.list()` with the lecturer's key.
 */
export const TEXT_MODEL = 'gemma-4-31b-it';

/**
 * Image generation model ("Nano Banana 2"). Generation only — never used to
 * describe images (that is the text model's job, A-2).
 * Id confirmed by the lecturer.
 */
export const IMAGE_MODEL = 'gemini-3.1-flash-image';

export function createGoogleClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

/** F-3.3 — a trivial call used by the "Testuj klucz" action. */
export async function testApiKey(apiKey: string): Promise<boolean> {
  const ai = createGoogleClient(apiKey);
  const res = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: 'ping',
  });
  return typeof res.text === 'string' && res.text.length > 0;
}

/** F-5.1 — one batch call that turns all ideas into groups. */
export async function groupIdeas(_apiKey: string, _ideas: Idea[]): Promise<Group[]> {
  throw new Error('not implemented');
}

/** F-7.1 — multimodal call producing one image prompt for a group. */
export async function expandGroup(
  _apiKey: string,
  _group: Group,
  _resources: Resource[],
  /** Base64 JPEG/PNG payloads for the image resources, keyed by resource id. */
  _resourceImages: Record<string, string>,
): Promise<string> {
  throw new Error('not implemented');
}

/** F-8.1 — generates one image from a prompt plus reference images. */
export async function generateImage(
  _apiKey: string,
  _prompt: string,
  /** Base64 payloads of the `useAsReference` images. */
  _referenceImages: string[],
): Promise<{ base64: string; mimeType: string }> {
  throw new Error('not implemented');
}
