import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL, generateImage } from './google';

/**
 * M5-1 image spike — the last model nobody had run.
 *
 * Skipped unless GOOGLE_API_KEY is set, so `npm test` stays green and offline:
 *
 *   PowerShell:  $env:GOOGLE_API_KEY="..."; npm run spike:image
 *   Git Bash:    GOOGLE_API_KEY=... npm run spike:image
 *
 * Clear the variable afterwards. The key belongs in the lecturer's browser, not
 * in a shell that stays open.
 *
 * It answers three things nobody knows yet:
 *   1. what the model actually returns (type, size, how many parts)
 *   2. how long one image takes, which decides what F-8.1's three-up wait feels like
 *   3. **1K against 2K**, which is still unsettled with the lecturer
 *
 * Set SPIKE_IMAGE_SIZE to run just one size.
 */
const apiKey = process.env.GOOGLE_API_KEY?.trim();
const onlySize = process.env.SPIKE_IMAGE_SIZE?.trim();

const SIZES = onlySize ? [onlySize] : ['1K', '2K'];

/**
 * The kind of prompt M4-1 actually produces: one paragraph, English,
 * photorealistic, no boilerplate. Taken from a real expansion run.
 */
const PROMPT =
  'A wide urban square viewed from street level, looking along a continuous row of ' +
  'leafy deciduous trees planted the full length of the building edge. The canopy forms ' +
  'a dense shaded promenade over grey stone paving, with low shrubs and ground cover at ' +
  'the base of each trunk. Wooden benches sit beneath the branches, turned toward the ' +
  'open square. In the middle distance, anonymous figures rest in the shade and walk ' +
  'through the dappled light. Bright late afternoon, sunlight filtering through the ' +
  'leaves. Eye-level view, wide-angle lens, photorealistic architectural visualization.';

const kb = (base64: string) => Math.round((base64.length * 3) / 4 / 1024);

describe.skipIf(!apiKey)('generateImage against the real model', () => {
  it.each(SIZES)(
    'renders the prompt at %s',
    async (size) => {
      const startedAt = Date.now();
      const image = await generateImage(apiKey as string, PROMPT, [], { imageSize: size });
      const seconds = (Date.now() - startedAt) / 1000;

      console.log(
        `\n${IMAGE_MODEL} at ${size}: ${seconds.toFixed(1)}s, ${kb(image.base64)} KB, ${image.mimeType}\n`,
      );

      expect(image.base64.length, 'no image data came back').toBeGreaterThan(1000);
      expect(image.mimeType).toMatch(/^image\//);

      // F-8.4 stores whatever comes back and derives the key's extension from it,
      // so an unexpected type is a finding, not a failure.
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) {
        console.warn(
          `  the assets endpoint accepts jpeg, png and webp — this returned ${image.mimeType}`,
        );
      }

      // Netlify caps a synchronous function payload at 6 MB and PUT /api/assets
      // refuses anything over 5 MB, so an image bigger than that cannot be stored.
      expect(kb(image.base64), 'too large for the assets endpoint').toBeLessThan(5 * 1024);
    },
    300_000,
  );
});
