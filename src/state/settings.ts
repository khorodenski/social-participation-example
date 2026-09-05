/**
 * Everything the lecturer sets on their own machine, in this browser only.
 *
 * Two things live here, both in `localStorage` and both behind the gear:
 *
 * - **The Google API key (F-3.1/F-3.2).** It is never sent to a Netlify
 *   Function, never written to Blobs and never logged. This module is the only
 *   place in the app that touches the key in storage.
 * - **The generated-image resolution.** Stored the same way so the choice
 *   survives a reload, and because it is a property of the lecturer's setup —
 *   their projector — rather than of any one session.
 * - **Whether a group's popup lists the ideas inside it.** Off unless the
 *   lecturer turns it on. See `getShowIdeasInGroups` for why that default is
 *   not just a preference.
 *
 * Every read is wrapped: private mode and blocked site data both make
 * `localStorage` throw on access, and a settings dialog that crashes the
 * projected screen mid-lecture is worse than one that forgets a preference.
 */
import { DEFAULT_IMAGE_SIZE, IMAGE_SIZES, type ImageSize } from '../api/google';

const API_KEY_STORAGE_KEY = 'social-voting.googleApiKey';
const IMAGE_SIZE_STORAGE_KEY = 'social-voting.imageSize';
const SHOW_IDEAS_STORAGE_KEY = 'social-voting.showIdeasInGroups';

export function getApiKey(): string | null {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch {
    /* storage unavailable (private mode) — nothing to do */
  }
}

export function clearApiKey(): void {
  try {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to do */
  }
}

export function hasApiKey(): boolean {
  const key = getApiKey();
  return key !== null && key.trim().length > 0;
}

/**
 * Storage is a string the user can edit, and this value goes straight into the
 * model's `imageConfig`. Anything unrecognised is treated as unset.
 */
function isImageSize(value: unknown): value is ImageSize {
  return IMAGE_SIZES.includes(value as ImageSize);
}

export function getImageSize(): ImageSize {
  try {
    const stored = window.localStorage.getItem(IMAGE_SIZE_STORAGE_KEY);
    return isImageSize(stored) ? stored : DEFAULT_IMAGE_SIZE;
  } catch {
    return DEFAULT_IMAGE_SIZE;
  }
}

export function setImageSize(size: ImageSize): void {
  if (!isImageSize(size)) return;

  try {
    window.localStorage.setItem(IMAGE_SIZE_STORAGE_KEY, size);
  } catch {
    /* storage unavailable — the pick still holds for this page view */
  }
}

/**
 * Whether a group's popup lists the ideas that went into it.
 *
 * **Off unless it is exactly 'true'.** F-6.2 used to say raw ideas are never
 * shown anywhere; this setting is the lecturer's own decision to override that
 * for their room, and it is opt-in rather than opt-out because the screen is a
 * projection and the ideas were typed by the people looking at it. Storage
 * failing, storage holding junk, and storage being empty all mean off, which is
 * the direction that keeps the promise.
 */
export function getShowIdeasInGroups(): boolean {
  try {
    return window.localStorage.getItem(SHOW_IDEAS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setShowIdeasInGroups(show: boolean): void {
  try {
    window.localStorage.setItem(SHOW_IDEAS_STORAGE_KEY, show ? 'true' : 'false');
  } catch {
    /* storage unavailable — the choice still holds for this page view */
  }
}
