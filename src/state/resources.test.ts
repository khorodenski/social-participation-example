import { describe, expect, it } from 'vitest';
import {
  RESOURCE_ID_LENGTH,
  addResource,
  moveResource,
  newImageResource,
  newResourceId,
  newTextResource,
  referenceCount,
  removeResource,
  sameResources,
  updateResource,
} from './resources';
import { isAssetKey, resourceAssetKey } from './assets';
import { resourceSchema } from './session';
import type { Resource } from './session';

function text(id: string, description: string): Resource {
  return { id, type: 'text', description, text: `Treść ${id}.`, useAsReference: false };
}

function image(id: string, useAsReference = false): Resource {
  return {
    id,
    type: 'image',
    description: `Zdjęcie ${id}`,
    imageKey: `sessions/s1/resources/${id}.jpg`,
    previewKey: `sessions/s1/resources/${id}-preview.jpg`,
    useAsReference,
  };
}

const resources: Resource[] = [text('r1', 'Notatka'), image('r2', true), image('r3')];

describe('newResourceId', () => {
  it('produces an id an asset key accepts, preview included', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = newResourceId();
      expect(id).toHaveLength(RESOURCE_ID_LENGTH);

      // Both keys must be buildable, or the upload fails after the canvas work.
      expect(resourceAssetKey('s1', id, 'image/jpeg')).not.toBeNull();
      expect(isAssetKey(`sessions/s1/resources/${id}-preview.jpg`)).toBe(true);
    }
  });

  it('avoids the characters that misread on a projector', () => {
    const ids = Array.from({ length: 50 }, () => newResourceId()).join('');
    expect(ids).not.toMatch(/[lo]/);
  });
});

describe('new resources', () => {
  it('makes a text resource the session schema accepts', () => {
    expect(resourceSchema.parse(newTextResource('r9'))).toEqual({
      id: 'r9',
      type: 'text',
      description: '',
      text: '',
      useAsReference: false,
    });
  });

  it('keeps the keys the uploader decided rather than rebuilding them', () => {
    const keys = { imageKey: 'sessions/s1/resources/r9.jpg', previewKey: 'x-preview.jpg' };
    expect(newImageResource(keys, 'r9')).toMatchObject(keys);
  });

  it('starts an image off the image model, so F-2.3 is a deliberate click', () => {
    const keys = { imageKey: 'a.jpg', previewKey: 'b.jpg' };
    expect(newImageResource(keys, 'r9').useAsReference).toBe(false);
  });
});

describe('addResource / updateResource / removeResource', () => {
  it('appends without mutating', () => {
    const added = addResource(resources, text('r4', 'Nowa'));
    expect(added.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(resources).toHaveLength(3);
  });

  it('patches only the named resource', () => {
    const edited = updateResource(resources, 'r2', { description: 'Inny opis' });
    expect(edited[1]?.description).toBe('Inny opis');
    expect(edited[0]).toBe(resources[0]);
    expect(resources[1]?.description).toBe('Zdjęcie r2');
  });

  it('ignores an id that is not there', () => {
    expect(updateResource(resources, 'nope', { description: 'x' })).toEqual(resources);
  });

  it('removes by id', () => {
    expect(removeResource(resources, 'r2').map((r) => r.id)).toEqual(['r1', 'r3']);
  });
});

describe('moveResource', () => {
  it('moves one place up', () => {
    expect(moveResource(resources, 'r3', -1).map((r) => r.id)).toEqual(['r1', 'r3', 'r2']);
  });

  it('moves one place down', () => {
    expect(moveResource(resources, 'r1', 1).map((r) => r.id)).toEqual(['r2', 'r1', 'r3']);
  });

  it('returns the same array when the move falls off an end', () => {
    expect(moveResource(resources, 'r1', -1)).toBe(resources);
    expect(moveResource(resources, 'r3', 1)).toBe(resources);
    expect(moveResource(resources, 'nope', 1)).toBe(resources);
    expect(moveResource(resources, 'r1', 0)).toBe(resources);
  });
});

describe('sameResources', () => {
  it('sees no change through a round trip that reorders the keys', () => {
    const reparsed = resources.map((resource) => resourceSchema.parse({ ...resource }));
    expect(sameResources(resources, reparsed)).toBe(true);
  });

  it('treats a missing optional and an empty string as the same', () => {
    const a: Resource = { id: 'r1', type: 'text', description: 'x', useAsReference: false };
    const b: Resource = { ...a, text: '' };
    expect(sameResources([a], [b])).toBe(true);
  });

  it('notices an edit, a reorder, and a different length', () => {
    expect(sameResources(resources, updateResource(resources, 'r1', { description: 'x' }))).toBe(
      false,
    );
    expect(sameResources(resources, moveResource(resources, 'r1', 1))).toBe(false);
    expect(sameResources(resources, removeResource(resources, 'r1'))).toBe(false);
  });

  it('notices the reference flag, which decides what the image model sees', () => {
    expect(
      sameResources(resources, updateResource(resources, 'r3', { useAsReference: true })),
    ).toBe(false);
  });
});

describe('referenceCount', () => {
  it('counts only images that are marked', () => {
    expect(referenceCount(resources)).toBe(1);
    expect(referenceCount([])).toBe(0);
  });

  it('never counts a text resource, whatever the flag says', () => {
    expect(referenceCount([{ ...text('r1', 'x'), useAsReference: true }])).toBe(0);
  });
});
