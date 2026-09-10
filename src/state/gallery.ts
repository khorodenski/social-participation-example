import { selectedGroups } from './expansion';
import type { GeneratedImage, Group, Session } from './session';

/**
 * F-9.1..F-9.3 — the rules behind the gallery, kept pure so navigation and
 * ordering are testable without a rendered component or a fullscreen API.
 */

export interface GalleryItem {
  group: Group;
  image: GeneratedImage;
}

/**
 * F-9.1 — the pictures to show, in the order the room has seen these three
 * groups since the podium.
 *
 * A chosen group with no picture is left out rather than shown as a gap: the
 * gallery is the last thing on the projector and an empty frame there reads as
 * a broken app.
 */
export function galleryItems(session: Session): GalleryItem[] {
  return selectedGroups(session)
    .map((group) => ({ group, image: session.images[group.id] }))
    .filter((item): item is GalleryItem => item.image !== undefined);
}

/**
 * F-9.3 — where an arrow key lands.
 *
 * Wraps, because on a projector the alternative is a dead arrow key and a
 * lecturer pressing it again harder.
 */
export function stepIndex(current: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}

/**
 * The file name a "Pobierz" link hands the browser.
 *
 * Built from the session title and the group label rather than the blob key,
 * so three downloads from one lecture do not all land as `g1.jpg`. Polish
 * letters are kept: every current browser and file system takes them, and
 * "Plac przed dworcem" is what the lecturer will look for afterwards. Only the
 * characters that are illegal in a file name on Windows are replaced.
 */
export function downloadFileName(title: string, label: string, imageKey: string): string {
  const extension = imageKey.includes('.') ? imageKey.slice(imageKey.lastIndexOf('.')) : '';
  const clean = (text: string) =>
    Array.from(text)
      .map((char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? ' ' : char))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  const stem = [clean(title), clean(label)].filter((part) => part.length > 0).join(' - ');
  return `${stem.length > 0 ? stem : 'obraz'}${extension}`;
}
