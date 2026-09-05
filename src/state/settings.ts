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
 *
 * Every read is wrapped: private mode and blocked site data both make
 * `localStorage` throw on access, and a settings dialog that crashes the
 * projected screen mid-lecture is worse than one that forgets a preference.
 */
import { DEFAULT_IMAGE_SIZE, IMAGE_SIZES, type ImageSize } from '../api/google';

const API_KEY_STORAGE_KEY = 'social-voting.googleApiKey';
const IMAGE_SIZE_STORAGE_KEY = 'social-voting.imageSize';

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
