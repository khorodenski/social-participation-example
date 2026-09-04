/**
 * D-3 — the binary half of the storage layout:
 *
 *   sessions/<sessionId>/resources/<resourceId>.<ext>   the lecturer's photos
 *   sessions/<sessionId>/images/<groupId>.<ext>         the generated images
 *
 * Shared by the browser, which builds these keys, and by `assets.ts`, which
 * validates them, for the same reason `ideaTextSchema` is shared: the two must
 * not be able to disagree about what a valid key is.
 *
 * The validation is not decoration. `PUT /api/assets/*` is public and key-less,
 * and the binary and JSON blobs live in one namespace, so an unchecked key
 * would let anyone overwrite `sessions/index.json` with a JPEG and take the
 * whole lecture down.
 */

export const ASSET_KINDS = ['resources', 'images'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/**
 * F-2.4 downscales to a longest edge of 1536 px at JPEG ~85%, which lands
 * around 200-500 kB. Netlify caps a synchronous function's payload at 6 MB, so
 * this leaves headroom and still refuses anything that could not be a
 * downscaled photo.
 */
export const ASSET_MAX_BYTES = 5 * 1024 * 1024;

/** Images only. This endpoint is not a general file host. */
export const ASSET_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/**
 * A content-type header may carry parameters (`image/jpeg; charset=binary`),
 * and the media type is case-insensitive.
 */
export function normalizeContentType(header: string | null): string | null {
  if (!header) return null;
  const type = header.split(';')[0]?.trim().toLowerCase() ?? '';
  return type in ASSET_CONTENT_TYPES ? type : null;
}

export function extensionForContentType(contentType: string): string | null {
  return ASSET_CONTENT_TYPES[contentType.toLowerCase()] ?? null;
}

/**
 * The reverse: what a stored key's bytes are. The store keeps the real content
 * type as metadata and `GET /api/assets` serves that, so this is only for
 * callers holding a key and a payload but no response headers — M4-1 sending a
 * photograph to the model as `inlineData`, which needs a mime type of its own.
 */
export function contentTypeForKey(key: string): string | null {
  const parts = parseAssetKey(key);
  if (!parts) return null;

  const wanted = parts.extension === 'jpeg' ? 'jpg' : parts.extension;
  const found = Object.entries(ASSET_CONTENT_TYPES).find(([, ext]) => ext === wanted);
  return found?.[0] ?? null;
}

export interface AssetKeyParts {
  sessionId: string;
  kind: AssetKind;
  name: string;
  extension: string;
}

/**
 * Session ids and group ids are generated from a lowercase alphabet, so the
 * shape is tight on purpose: anything outside it is a bug or an attack, never
 * a key this app produced.
 */
const KEY_PATTERN =
  /^sessions\/([a-z0-9]{1,32})\/(resources|images)\/([a-z0-9][a-z0-9-]{0,63})\.([a-z0-9]{1,5})$/;

export function parseAssetKey(key: string): AssetKeyParts | null {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;

  const [, sessionId, kind, name, extension] = match;
  if (!sessionId || !kind || !name || !extension) return null;
  if (!EXTENSIONS.has(extension)) return null;

  return { sessionId, kind: kind as AssetKind, name, extension };
}

export function isAssetKey(key: string): boolean {
  return parseAssetKey(key) !== null;
}

/**
 * The extension is decoration: `GET` serves the content type stored alongside
 * the bytes, never one guessed from the key. So these helpers exist to keep
 * callers from hand-rolling a key, not to make the two agree.
 */
export function resourceAssetKey(
  sessionId: string,
  resourceId: string,
  contentType: string,
): string | null {
  const extension = extensionForContentType(contentType);
  if (!extension) return null;

  const key = `sessions/${sessionId}/${'resources' satisfies AssetKind}/${resourceId}.${extension}`;
  return isAssetKey(key) ? key : null;
}

export function generatedImageKey(
  sessionId: string,
  groupId: string,
  contentType = 'image/png',
): string | null {
  const extension = extensionForContentType(contentType);
  if (!extension) return null;

  const key = `sessions/${sessionId}/${'images' satisfies AssetKind}/${groupId}.${extension}`;
  return isAssetKey(key) ? key : null;
}
