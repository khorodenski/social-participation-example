import { putAsset } from './client';
import { resourceAssetKey } from '../state/assets';
import { LocalizedError } from '../state/errors';
import { pl } from '../i18n/pl';

/**
 * F-2.4 — browser-side downscaling, before anything is uploaded.
 *
 * A photograph is stored twice, because the two models want different things
 * from it (see "Image sizes" in the handoff):
 *
 *   reference  2048 px  the image model, for `useAsReference` (F-2.3)
 *   preview     768 px  the text model, during expansion (F-7.1)
 *
 * The preview is not an optimisation for its own sake. Image cost scales with
 * area, so 768 px against 2048 px is about a seventh of the tokens, and a
 * photograph was measured to add roughly 35 s to an expansion that already
 * takes over a minute.
 */

/** Supersedes F-2.4's stated 1536 px. */
export const REFERENCE_MAX_EDGE = 2048;
export const PREVIEW_MAX_EDGE = 768;

/** F-2.4 — JPEG at ~85%. */
export const JPEG_QUALITY = 0.85;
export const OUTPUT_TYPE = 'image/jpeg';

export interface Size {
  width: number;
  height: number;
}

/**
 * The size a photograph should be drawn at, preserving its aspect ratio.
 *
 * Never upscales: a small photograph stays its own size rather than being
 * blown up into a soft one. Pure, so the arithmetic is testable without a
 * canvas.
 */
export function targetSize(size: Size, maxEdge: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge || longest === 0) return { width: size.width, height: size.height };

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Decodes through an `<img>` rather than `createImageBitmap`, so anything the
 * browser can display can be uploaded — which is the actual requirement when a
 * lecturer drops in whatever their phone produced.
 */
function decode(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new LocalizedError(pl.resources.decodeFailed));
    };

    img.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new LocalizedError(pl.resources.encodeFailed))),
      OUTPUT_TYPE,
      JPEG_QUALITY,
    );
  });
}

/**
 * One decoded image to one JPEG at most `maxEdge` on its longest side.
 *
 * Takes an already-decoded image so a photograph is decoded once and drawn
 * twice, rather than decoded once per size.
 */
export async function encodeAt(img: HTMLImageElement, maxEdge: number): Promise<Blob> {
  const size = targetSize({ width: img.naturalWidth, height: img.naturalHeight }, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext('2d');
  // LocalizedError, not Error: the resource editor renders whatever it
  // catches, and pl.ts owns every string the user can see.
  if (!ctx) throw new LocalizedError(pl.resources.noCanvas);

  // The default is 'low', which on a 4000 px phone photo scaled to 768 px
  // produces visible aliasing on every railing and window frame — exactly the
  // geometry the expansion prompt is supposed to read.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, size.width, size.height);

  return toJpeg(canvas);
}

/**
 * F-8.4 — the longest edge a generated image is stored at.
 *
 * Matches the 2K the image model is asked for, so this re-encodes rather than
 * shrinks: see `recompress`.
 */
export const GENERATED_MAX_EDGE = 2048;

/**
 * Decode and re-encode at {@link JPEG_QUALITY}, keeping the resolution.
 *
 * The image model returns 2K JPEGs at about 4 MB — roughly 1.9 bytes per pixel,
 * which is near-lossless and far more than a projector can show.
 *
 * Two reasons to shrink it, neither of them a platform limit: measured against
 * the deployed site, a 4.3 MB PUT and GET both work byte-for-byte. First, 4 MB
 * sits inside `ASSET_MAX_BYTES` with only about 15% to spare, so a slightly
 * larger render would be refused outright. Second, the gallery pulls all three
 * at once over whatever network a lecture hall has, and 12 MB against 3 MB is
 * the difference between a wait and none.
 *
 * Re-encoding keeps every pixel, so the saving costs nothing.
 */
export async function recompress(file: Blob, maxEdge: number): Promise<Blob> {
  const img = await decode(file);
  return encodeAt(img, maxEdge);
}

export interface StoredResourceImage {
  /** D-3 key of the 2048 px copy. */
  imageKey: string;
  /** D-3 key of the small copy expansion reads. */
  previewKey: string;
  /** Both sizes, for showing the lecturer what the upload cost. */
  bytes: { reference: number; preview: number };
}

/**
 * The preview lives beside its reference under a `-preview` suffix, which
 * `parseAssetKey` already accepts. The two keys are still stored separately on
 * the resource rather than derived, so a missing preview shows up in the data
 * instead of as a 404 nobody notices mid-lecture.
 */
export function previewResourceId(resourceId: string): string {
  return `${resourceId}-preview`;
}

/**
 * F-2.4 — downscale a chosen photograph to both sizes and upload both.
 *
 * The caller (`M2-3`, the resource editor) writes the two returned keys onto
 * the resource. Sequential on purpose: two uploads of a few hundred kB each,
 * done once before a lecture, are not worth the concurrency.
 */
export async function uploadResourceImage(
  sessionId: string,
  resourceId: string,
  file: Blob,
): Promise<StoredResourceImage> {
  const imageKey = resourceAssetKey(sessionId, resourceId, OUTPUT_TYPE);
  const previewKey = resourceAssetKey(sessionId, previewResourceId(resourceId), OUTPUT_TYPE);

  // Both keys are checked before anything is decoded, so a bad resource id
  // fails immediately instead of after two canvas passes.
  if (!imageKey || !previewKey) throw new LocalizedError(pl.resources.badResourceId);

  const img = await decode(file);
  const reference = await encodeAt(img, REFERENCE_MAX_EDGE);
  const preview = await encodeAt(img, PREVIEW_MAX_EDGE);

  await putAsset(imageKey, reference, OUTPUT_TYPE);
  await putAsset(previewKey, preview, OUTPUT_TYPE);

  return {
    imageKey,
    previewKey,
    bytes: { reference: reference.size, preview: preview.size },
  };
}
