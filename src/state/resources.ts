import type { Resource } from './session';

/**
 * F-2.1/F-2.2 — the rules behind the resource editor, kept pure so they are
 * unit-testable without rendering anything or touching a canvas.
 *
 * Every helper returns a new array and never mutates its input, because the
 * editor holds the list in React state and compares it against the persisted
 * one to decide whether there is anything to save.
 */

/**
 * The same alphabet as session ids: lowercase, no `l`/`o`, so nothing here can
 * be misread off a screen.
 *
 * Six characters keeps `<id>-preview` far inside the 64-character name
 * `parseAssetKey` allows, and every character is in the `[a-z0-9]` class that
 * pattern demands — a resource id that cannot become an asset key would fail
 * only at upload time, which is too late.
 */
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export const RESOURCE_ID_LENGTH = 6;

export function newResourceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RESOURCE_ID_LENGTH));
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
}

/** F-2.2 — a pasted note. `useAsReference` is an image flag (F-2.3), so it stays off. */
export function newTextResource(id: string = newResourceId()): Resource {
  return { id, type: 'text', description: '', text: '', useAsReference: false };
}

/**
 * F-2.2 — a photograph that has already been uploaded in both sizes.
 *
 * The keys come from `uploadResourceImage`, which is what decides them, so this
 * takes them rather than rebuilding them and risking a disagreement.
 */
export function newImageResource(
  keys: { imageKey: string; previewKey: string },
  id: string = newResourceId(),
): Resource {
  return {
    id,
    type: 'image',
    description: '',
    imageKey: keys.imageKey,
    previewKey: keys.previewKey,
    useAsReference: false,
  };
}

export function addResource(resources: readonly Resource[], resource: Resource): Resource[] {
  return [...resources, resource];
}

export function updateResource(
  resources: readonly Resource[],
  id: string,
  patch: Partial<Omit<Resource, 'id' | 'type'>>,
): Resource[] {
  return resources.map((resource) => (resource.id === id ? { ...resource, ...patch } : resource));
}

/**
 * The image blobs are left behind: the assets endpoint has no `DELETE` and the
 * plan's API table never had one. An orphan JPEG in a short-lived showcase is
 * cheaper than an endpoint that can delete things.
 */
export function removeResource(resources: readonly Resource[], id: string): Resource[] {
  return resources.filter((resource) => resource.id !== id);
}

/**
 * F-2.1 — move one resource by `delta` places.
 *
 * Order is not decoration: `buildExpansionContents` sends the materials to the
 * model in exactly this order, and the system prompt reads them that way.
 *
 * Returns the input array itself when the move would fall off either end, so a
 * caller can tell "nothing happened" without comparing contents.
 */
export function moveResource(
  resources: readonly Resource[],
  id: string,
  delta: number,
): Resource[] {
  const from = resources.findIndex((resource) => resource.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= resources.length || delta === 0)
    return resources as Resource[];

  const moved = [...resources];
  const [resource] = moved.splice(from, 1);
  if (!resource) return resources as Resource[];

  moved.splice(to, 0, resource);
  return moved;
}

/**
 * Field by field rather than `JSON.stringify`, because one side of this
 * comparison comes back through zod and the other is built by spreading, and
 * the two need not agree about key order. An absent optional and an empty
 * string mean the same thing here.
 */
function sameResource(a: Resource, b: Resource): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.description === b.description &&
    (a.text ?? '') === (b.text ?? '') &&
    (a.imageKey ?? '') === (b.imageKey ?? '') &&
    (a.previewKey ?? '') === (b.previewKey ?? '') &&
    a.useAsReference === b.useAsReference
  );
}

/** What the editor's "anything to save?" check runs on. Order counts (F-2.1). */
export function sameResources(a: readonly Resource[], b: readonly Resource[]): boolean {
  return a.length === b.length && a.every((resource, index) => sameResource(resource, b[index]!));
}

/** F-2.3 — how many photographs the image model will be given. */
export function referenceCount(resources: readonly Resource[]): number {
  return resources.filter((resource) => resource.type === 'image' && resource.useAsReference)
    .length;
}
