import { describe, expect, it } from 'vitest';
import {
  ASSET_MAX_BYTES,
  contentTypeForKey,
  extensionForContentType,
  generatedImageKey,
  isAssetKey,
  normalizeContentType,
  parseAssetKey,
  resourceAssetKey,
} from './assets';

describe('parseAssetKey', () => {
  it('accepts a resource key', () => {
    expect(parseAssetKey('sessions/k7x2p9/resources/r1.jpg')).toEqual({
      sessionId: 'k7x2p9',
      kind: 'resources',
      name: 'r1',
      extension: 'jpg',
    });
  });

  it('accepts a generated image key', () => {
    expect(parseAssetKey('sessions/k7x2p9/images/g1.png')).toEqual({
      sessionId: 'k7x2p9',
      kind: 'images',
      name: 'g1',
      extension: 'png',
    });
  });

  /**
   * The reason this validation exists: binary and JSON share one key space, so
   * an unchecked key could overwrite the session index or a session document.
   */
  it('refuses the session index', () => {
    expect(parseAssetKey('sessions/index.json')).toBeNull();
  });

  it('refuses a session document', () => {
    expect(parseAssetKey('sessions/k7x2p9.json')).toBeNull();
  });

  it('refuses an idea blob', () => {
    expect(parseAssetKey('sessions/k7x2p9/ideas/abc123.json')).toBeNull();
  });

  it.each([
    ['../../etc/passwd', 'traversal'],
    ['sessions/../index.json', 'traversal through a valid prefix'],
    ['sessions/k7x2p9/resources/../../index.json', 'traversal in the name'],
    ['sessions//resources/r1.jpg', 'empty session id'],
    ['sessions/k7x2p9/resources/.jpg', 'empty name'],
    ['sessions/k7x2p9/resources/r1', 'no extension'],
    ['sessions/k7x2p9/resources/r1.exe', 'extension not an image'],
    ['sessions/k7x2p9/resources/r1.jpg/x', 'trailing segment'],
    ['sessions/K7X2P9/resources/r1.jpg', 'uppercase session id'],
    ['sessions/k7x2p9/other/r1.jpg', 'unknown kind'],
    ['', 'empty key'],
  ])('refuses %s (%s)', (key) => {
    expect(parseAssetKey(key)).toBeNull();
  });

  it('accepts jpeg as well as jpg', () => {
    expect(isAssetKey('sessions/k7x2p9/resources/r1.jpeg')).toBe(true);
  });
});

describe('normalizeContentType', () => {
  it('strips parameters', () => {
    expect(normalizeContentType('image/jpeg; charset=binary')).toBe('image/jpeg');
  });

  it('lowercases the media type', () => {
    expect(normalizeContentType('IMAGE/PNG')).toBe('image/png');
  });

  it('refuses a type that is not an allowed image', () => {
    expect(normalizeContentType('application/json')).toBeNull();
    expect(normalizeContentType('image/svg+xml')).toBeNull();
    expect(normalizeContentType('text/html')).toBeNull();
  });

  it('refuses a missing header', () => {
    expect(normalizeContentType(null)).toBeNull();
  });
});

describe('extensionForContentType', () => {
  it('maps every allowed type', () => {
    expect(extensionForContentType('image/jpeg')).toBe('jpg');
    expect(extensionForContentType('image/png')).toBe('png');
    expect(extensionForContentType('image/webp')).toBe('webp');
  });

  it('returns null for anything else', () => {
    expect(extensionForContentType('application/pdf')).toBeNull();
  });
});

describe('contentTypeForKey', () => {
  it('reads the type back out of a key', () => {
    expect(contentTypeForKey('sessions/k7x2p9/resources/r1.png')).toBe('image/png');
    expect(contentTypeForKey('sessions/k7x2p9/resources/r1.webp')).toBe('image/webp');
  });

  it('treats .jpg and .jpeg the same', () => {
    expect(contentTypeForKey('sessions/k7x2p9/resources/r1.jpg')).toBe('image/jpeg');
    expect(contentTypeForKey('sessions/k7x2p9/images/g1.jpeg')).toBe('image/jpeg');
  });

  it('returns null for a key the endpoint would refuse', () => {
    expect(contentTypeForKey('sessions/index.json')).toBeNull();
  });

  it('round-trips whatever the builders produce', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const key = resourceAssetKey('k7x2p9', 'r1', type);
      expect(contentTypeForKey(key!), type).toBe(type);
    }
  });
});

describe('key builders', () => {
  it('builds a resource key the validator accepts', () => {
    const key = resourceAssetKey('k7x2p9', 'r1', 'image/jpeg');
    expect(key).toBe('sessions/k7x2p9/resources/r1.jpg');
    expect(isAssetKey(key!)).toBe(true);
  });

  it('builds a generated image key, png by default', () => {
    expect(generatedImageKey('k7x2p9', 'g1')).toBe('sessions/k7x2p9/images/g1.png');
  });

  it('follows the content type when the image model returns jpeg', () => {
    expect(generatedImageKey('k7x2p9', 'g1', 'image/jpeg')).toBe('sessions/k7x2p9/images/g1.jpg');
  });

  it('refuses to build a key for a type the endpoint would reject', () => {
    expect(resourceAssetKey('k7x2p9', 'r1', 'application/pdf')).toBeNull();
  });

  it('refuses to build a key an id would make invalid', () => {
    expect(resourceAssetKey('k7x2p9', '../index', 'image/png')).toBeNull();
  });
});

describe('ASSET_MAX_BYTES', () => {
  it('stays under the 6 MB Netlify function payload cap', () => {
    expect(ASSET_MAX_BYTES).toBeLessThan(6 * 1024 * 1024);
  });
});
