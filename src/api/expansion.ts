import { assetUrl } from './client';
import { ModelError, expandGroup } from './google';
import { pl } from '../i18n/pl';
import { getApiKey } from '../state/settings';
import type { Group, Resource, Session } from '../state/session';

/**
 * F-7.1 — everything between "these three groups" and "here are three prompts".
 *
 * The same shape as `grouping.ts`: the key is read here, in the browser, and
 * handed straight to the Google call (F-3.2). It never travels through a
 * Netlify Function. The photographs come back from Blobs through the key-less
 * assets endpoint and go to the model as base64.
 */

/**
 * Expansion reads the small copy, never the 2048 px reference (see `previewKey`
 * in `session.ts`). The fallback matters only until `M2-4` writes previews:
 * a reference-sized photograph is correct input, just an expensive one.
 */
function photoKey(resource: Resource): string | null {
  return resource.previewKey ?? resource.imageKey ?? null;
}

/** Blob → base64, without the `data:` prefix the reader puts in front. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches every image resource's payload, keyed by resource id.
 *
 * A photograph that will not load is skipped rather than thrown: its
 * description still reaches the model as a written note (see
 * `buildExpansionContents`), and losing one picture is a worse prompt, while
 * losing the whole expansion is a blank card on a projector.
 */
export async function loadResourceImages(resources: Resource[]): Promise<Record<string, string>> {
  const images = resources.filter((resource) => resource.type === 'image' && photoKey(resource));

  const loaded = await Promise.all(
    images.map(async (resource) => {
      const key = photoKey(resource) as string;
      try {
        const res = await fetch(assetUrl(key));
        if (!res.ok) return null;
        return [resource.id, await toBase64(await res.blob())] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(loaded.filter((entry): entry is [string, string] => entry !== null));
}

/** F-7.1 — one group in, one English image prompt out. */
export async function expandSessionGroup(session: Session, group: Group): Promise<string> {
  const apiKey = getApiKey()?.trim();

  // Not retryable: no amount of pressing "Ponów" conjures a key.
  if (!apiKey) throw new ModelError(pl.settings.keyMissing, false);

  const resourceImages = await loadResourceImages(session.resources);
  return expandGroup(apiKey, group, session.resources, resourceImages);
}
