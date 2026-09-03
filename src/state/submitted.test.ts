import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSubmitted, hasSubmitted, markSubmitted } from './submitted';

/**
 * F-4.4. Vitest runs in node here, so `window` is stubbed rather than pulling
 * in a whole DOM environment for four calls.
 */
function fakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    size: () => store.size,
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

describe('submitted', () => {
  it('starts out not submitted', () => {
    expect(hasSubmitted('k7x2p9')).toBe(false);
  });

  it('remembers a submission', () => {
    markSubmitted('k7x2p9');

    expect(hasSubmitted('k7x2p9')).toBe(true);
  });

  it('keeps sessions apart, so a rehearsal does not silence the real run', () => {
    markSubmitted('rehearsal');

    expect(hasSubmitted('rehearsal')).toBe(true);
    expect(hasSubmitted('real-run')).toBe(false);
  });

  it('forgets on demand', () => {
    markSubmitted('k7x2p9');
    clearSubmitted('k7x2p9');

    expect(hasSubmitted('k7x2p9')).toBe(false);
  });

  it('reports not-submitted when storage throws, rather than locking someone out', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('storage disabled');
      },
    });

    expect(hasSubmitted('k7x2p9')).toBe(false);
    expect(() => markSubmitted('k7x2p9')).not.toThrow();
  });
});
