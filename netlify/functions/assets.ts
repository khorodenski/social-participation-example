import type { Config, Context } from '@netlify/functions';
import { getStore } from './_blobs';
import { jsonError, json } from './_http';
import { pl } from '../../src/i18n/pl';
import {
  ASSET_MAX_BYTES,
  isAssetKey,
  normalizeContentType,
  parseAssetKey,
} from '../../src/state/assets';

/**
 * M2-1 — the binary half of storage (D-3).
 *
 *   PUT /api/assets/<key>  binary body, content-type header  -> { key }
 *   GET /api/assets/<key>                                    -> binary
 *
 * Keys are the D-3 paths: `sessions/<id>/resources/<rid>.jpg` and
 * `sessions/<id>/images/<gid>.png`. Every key is validated against
 * `src/state/assets.ts` before it reaches the store — binary and JSON blobs
 * share one namespace, and this endpoint is public and key-less, so an
 * unchecked key would let anyone replace `sessions/index.json` with a JPEG.
 *
 * Like the other functions this one never sees the Google API key. It moves
 * bytes the browser already has.
 */

/**
 * F-8.3 — regenerating an image overwrites the same key. Anything cacheable
 * would then serve the previous image from the lecturer's own browser, on a
 * projector, with no way to tell why. Bytes are cheap here; the wrong picture
 * is not.
 */
const NO_CACHE = 'no-store, max-age=0';

export default async (req: Request, _context: Context): Promise<Response> => {
  const url = new URL(req.url);

  // Routed from the path rather than `context.params`, for the same reason as
  // sessions.ts: `netlify dev` retries a 404 against static-file candidates.
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/assets\//, ''));

  try {
    /* ------------------------------------------------------- GET — serving */

    if (req.method === 'GET') {
      // A key that cannot exist is simply not found; there is nothing at that
      // address to talk about.
      if (!isAssetKey(key)) return jsonError(pl.errors.assetNotFound, 404);

      const store = await getStore();
      const blob = await store.getBinary(key);
      if (!blob) return jsonError(pl.errors.assetNotFound, 404);

      // A Uint8Array is not a BodyInit under this lib target, because its
      // buffer may be a SharedArrayBuffer. Slicing gives a plain ArrayBuffer,
      // the same move _blobs.ts makes when writing.
      const body = blob.data.buffer.slice(
        blob.data.byteOffset,
        blob.data.byteOffset + blob.data.byteLength,
      ) as ArrayBuffer;

      return new Response(body, {
        status: 200,
        headers: {
          'content-type': blob.contentType,
          'content-length': String(blob.data.byteLength),
          'cache-control': NO_CACHE,
        },
      });
    }

    /* ------------------------------------------------------ PUT — storing */

    if (req.method === 'PUT') {
      if (!parseAssetKey(key)) return jsonError(pl.errors.assetKey, 400);

      const contentType = normalizeContentType(req.headers.get('content-type'));
      if (!contentType) return jsonError(pl.errors.assetType, 415);

      // Refuse on the declared length before reading the body, when the client
      // was honest enough to declare one.
      const declared = Number(req.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > ASSET_MAX_BYTES) {
        return jsonError(pl.errors.assetTooLarge, 413);
      }

      const data = new Uint8Array(await req.arrayBuffer());
      if (data.byteLength === 0) return jsonError(pl.errors.invalidBody, 400);
      if (data.byteLength > ASSET_MAX_BYTES) return jsonError(pl.errors.assetTooLarge, 413);

      const store = await getStore();
      await store.setBinary(key, data, contentType);

      return json({ key });
    }

    return jsonError(pl.errors.methodNotAllowed, 405);
  } catch (err) {
    console.error('[social-voting] assets error', err);
    return jsonError(pl.errors.serverError, 500);
  }
};

export const config: Config = {
  path: '/api/assets/*',
};
