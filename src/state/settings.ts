/**
 * The lecturer's Google API key (F-3.1/F-3.2).
 *
 * It lives ONLY in this browser's localStorage. It is never sent to a
 * Netlify Function, never written to Blobs and never logged. This module is
 * the only place in the app that touches the key in storage.
 */
const API_KEY_STORAGE_KEY = 'social-voting.googleApiKey';

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
