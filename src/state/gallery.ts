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
