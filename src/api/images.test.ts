import { describe, expect, it } from 'vitest';
import {
  JPEG_QUALITY,
  PREVIEW_MAX_EDGE,
  REFERENCE_MAX_EDGE,
  previewResourceId,
  targetSize,
} from './images';
import { isAssetKey, resourceAssetKey } from '../state/assets';

describe('targetSize', () => {
  it('scales a landscape photo by its longest edge', () => {
    expect(targetSize({ width: 4000, height: 3000 }, 2048)).toEqual({ width: 2048, height: 1536 });
  });

  it('scales a portrait photo by its longest edge', () => {
    expect(targetSize({ width: 3000, height: 4000 }, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it('handles a square', () => {
    expect(targetSize({ width: 3000, height: 3000 }, 768)).toEqual({ width: 768, height: 768 });
  });

  /** A small photograph blown up is just a soft photograph. */
  it('never upscales', () => {
    expect(targetSize({ width: 800, height: 600 }, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('leaves a photo that is exactly at the limit alone', () => {
    expect(targetSize({ width: 2048, height: 1000 }, 2048)).toEqual({ width: 2048, height: 1000 });
  });

  it('keeps the aspect ratio of an extreme panorama', () => {
    const size = targetSize({ width: 8000, height: 500 }, 2048);
    expect(size.width).toBe(2048);
    expect(size.height).toBe(128);
  });

  /** Rounding a very thin image down to zero would make an unusable canvas. */
  it('never returns a zero edge', () => {
    const size = targetSize({ width: 10000, height: 3 }, 768);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it('copes with a zero-sized image rather than dividing by it', () => {
    expect(targetSize({ width: 0, height: 0 }, 768)).toEqual({ width: 0, height: 0 });
  });

  it('produces a preview about a seventh of the reference by area', () => {
    const reference = targetSize({ width: 4000, height: 3000 }, REFERENCE_MAX_EDGE);
    const preview = targetSize({ width: 4000, height: 3000 }, PREVIEW_MAX_EDGE);

    const ratio = (preview.width * preview.height) / (reference.width * reference.height);
    expect(ratio).toBeGreaterThan(0.12);
    expect(ratio).toBeLessThan(0.16);
  });
});

describe('the stored pair', () => {
  it('builds two keys the assets endpoint accepts', () => {
    const imageKey = resourceAssetKey('k7x2p9', 'r1', 'image/jpeg');
    const previewKey = resourceAssetKey('k7x2p9', previewResourceId('r1'), 'image/jpeg');

    expect(imageKey).toBe('sessions/k7x2p9/resources/r1.jpg');
    expect(previewKey).toBe('sessions/k7x2p9/resources/r1-preview.jpg');
    expect(isAssetKey(imageKey!)).toBe(true);
    expect(isAssetKey(previewKey!)).toBe(true);
  });

  it('gives the two copies different keys, so one cannot overwrite the other', () => {
    const imageKey = resourceAssetKey('k7x2p9', 'r1', 'image/jpeg');
    const previewKey = resourceAssetKey('k7x2p9', previewResourceId('r1'), 'image/jpeg');
    expect(imageKey).not.toBe(previewKey);
  });
});

describe('the settled numbers', () => {
  /** These supersede F-2.4's stated 1536 px — see "Image sizes" in the handoff. */
  it('are the ones that were decided', () => {
    expect(REFERENCE_MAX_EDGE).toBe(2048);
    expect(PREVIEW_MAX_EDGE).toBe(768);
    expect(JPEG_QUALITY).toBe(0.85);
  });
});
