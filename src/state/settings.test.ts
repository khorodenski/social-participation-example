import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_IMAGE_SIZE } from '../api/google';
import {
  clearApiKey,
  getApiKey,
  getImageSize,
  hasApiKey,
  setApiKey,
  setImageSize,
} from './settings';

/**
 * F-3.1/F-3.2. Vitest runs in node here, so `window` is stubbed rather than
 * pulling in a whole DOM environment — the same pattern `submitted.test.ts`
 * uses.
 */
function fakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    keys: () => [...store.keys()],
  };
}

let storage: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the API key', () => {
  it('starts absent', () => {
    expect(getApiKey()).toBeNull();
    expect(hasApiKey()).toBe(false);
  });

  it('round-trips', () => {
    setApiKey('AIza-not-a-real-key');

    expect(getApiKey()).toBe('AIza-not-a-real-key');
    expect(hasApiKey()).toBe(true);
  });

  it('does not count whitespace as a key', () => {
    setApiKey('   ');

    expect(hasApiKey()).toBe(false);
  });

  it('forgets on demand', () => {
    setApiKey('AIza-not-a-real-key');
    clearApiKey();

    expect(getApiKey()).toBeNull();
  });

  it('reports no key when storage throws, rather than crashing the dialog', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('storage disabled');
      },
    });

    expect(getApiKey()).toBeNull();
    expect(() => setApiKey('x')).not.toThrow();
    expect(() => clearApiKey()).not.toThrow();
  });
});

describe('the image resolution', () => {
  it('falls back to the default when nothing is stored', () => {
    expect(getImageSize()).toBe(DEFAULT_IMAGE_SIZE);
  });

  it('round-trips both sizes', () => {
    setImageSize('1K');
    expect(getImageSize()).toBe('1K');

    setImageSize('2K');
    expect(getImageSize()).toBe('2K');
  });

  /**
   * This value goes straight into the model's `imageConfig`, and storage is a
   * string anyone can edit in devtools. A junk value must not reach Google.
   */
  it('ignores a value it does not recognise', () => {
    storage.setItem('social-voting.imageSize', '8K');

    expect(getImageSize()).toBe(DEFAULT_IMAGE_SIZE);
  });

  it('refuses to store a value it does not recognise', () => {
    setImageSize('4K' as never);

    expect(storage.keys()).not.toContain('social-voting.imageSize');
    expect(getImageSize()).toBe(DEFAULT_IMAGE_SIZE);
  });

  it('is kept apart from the key, so clearing the key keeps the resolution', () => {
    setApiKey('AIza-not-a-real-key');
    setImageSize('1K');

    clearApiKey();

    expect(getImageSize()).toBe('1K');
  });

  it('falls back to the default when storage throws', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('storage disabled');
      },
    });

    expect(getImageSize()).toBe(DEFAULT_IMAGE_SIZE);
    expect(() => setImageSize('1K')).not.toThrow();
  });
});
