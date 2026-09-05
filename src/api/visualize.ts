import { putAsset } from './client';
import { ModelError, generateImage } from './google';
import { loadResourceImages } from './expansion';
import { GENERATED_MAX_EDGE, OUTPUT_TYPE, recompress } from './images';
import { pl } from '../i18n/pl';
import { generatedImageKey } from '../state/assets';
import { getApiKey, getImageSize } from '../state/settings';
import type { GeneratedImage, Session } from '../state/session';

/**
 * F-8.1/F-8.4 — everything between "here is a prompt" and "the image is stored".
 *
 * The same shape as `grouping.ts` and `expansion.ts`: the key is read here, in
 * the browser, and handed straight to Google (F-3.2). The picture then goes to
 * Blobs through the key-less assets endpoint, so a reload does not lose it.
 */

/** Base64 to bytes, without a round trip through a data URL. */
function toBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * F-2.3 — only the photographs the lecturer marked as visual references reach
 * the image model. The rest were context for the prompt and their job is done.
 *
 * These are the full-size copies, not the previews: the image model is meant to
 * keep the site's geometry, which is exactly the detail the preview throws away.
 */
export async function loadReferenceImages(session: Session): Promise<string[]> {
  const references = session.resources.filter(
    (resource) => resource.type === 'image' && resource.useAsReference,
  );

  // Deliberately reuses the expansion loader with the preview key stripped, so
  // the two calls cannot disagree about how a stored photograph is fetched.
  const asReference = references.map((resource) => ({ ...resource, previewKey: undefined }));
  const byId = await loadResourceImages(asReference);

  return references
    .map((resource) => byId[resource.id])
    .filter((payload): payload is string => payload !== undefined);
}

/**
 * F-8.1/F-8.4 — generate one group's image and store it.
 *
 * The stored content type is whatever came back, and the key's extension is
 * derived from it. D-3 names the key `.png`; this model returns JPEG.
 */
export async function generateSessionImage(
  session: Session,
  groupId: string,
  options: { imageSize?: string } = {},
): Promise<GeneratedImage> {
  const apiKey = getApiKey()?.trim();
  if (!apiKey) throw new ModelError(pl.settings.keyMissing, false);

  const prompt = session.expansions[groupId]?.prompt;
  // Not retryable: the prompt comes from expansion, and no amount of pressing
  // "Ponów" here will write one.
  if (!prompt) throw new ModelError(pl.visualize.noPrompt, false);

  const references = await loadReferenceImages(session);

  // The lecturer's stored resolution, unless a caller names one — the spike
  // passes both sizes explicitly, and it should not have to touch storage.
  const image = await generateImage(apiKey, prompt, references, {
    ...options,
    imageSize: options.imageSize ?? getImageSize(),
  });

  /**
   * Re-encoded before storing, at full resolution.
   *
   * Measured: the model returns a 2K JPEG at about 4 MB, every time. That is
   * inside `ASSET_MAX_BYTES` with only about 15% to spare, so a slightly larger
   * render would be refused, and the gallery pulls all three at once over
   * whatever network a lecture hall has. Re-encoding keeps every pixel, so 12 MB
   * becomes 3 MB for nothing. See `recompress` for what was and was not a real
   * platform limit.
   */
  const stored = await recompress(toBlob(image.base64, image.mimeType), GENERATED_MAX_EDGE);

  // Always JPEG now, whatever the model returned, so the key never has to guess.
  const imageKey = generatedImageKey(session.id, groupId, OUTPUT_TYPE);
  if (!imageKey) throw new ModelError(pl.visualize.badImageType, false);

  await putAsset(imageKey, stored, OUTPUT_TYPE);

  return { imageKey, createdAt: Date.now() };
}
