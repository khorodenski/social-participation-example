import { describe, expect, it } from 'vitest';
import { galleryItems, stepIndex } from './gallery';
import { sessionSchema, type Group, type Session } from './session';

function group(id: string, label: string): Group {
  return { id, label, synthesis: `Synteza ${id}.`, ideaIds: [`${id}-i1`] };
}

const image = (key: string) => ({ imageKey: key, createdAt: 2 });

function session(over: Partial<Session> = {}): Session {
  return sessionSchema.parse({
    id: 'k7x2p9',
    title: 'Plac przed dworcem',
    createdAt: 0,
    stage: 'gallery',
    groups: [group('g1', 'Zieleń'), group('g2', 'Ławki'), group('g3', 'Plac zabaw')],
    selectedGroupIds: ['g2', 'g1', 'g3'],
    images: {
      g1: image('sessions/k7x2p9/images/g1.jpg'),
      g2: image('sessions/k7x2p9/images/g2.jpg'),
      g3: image('sessions/k7x2p9/images/g3.jpg'),
    },
    ...over,
  });
}

describe('galleryItems', () => {
  it('keeps the order the room has seen since the podium (F-9.1)', () => {
    expect(galleryItems(session()).map((item) => item.group.id)).toEqual(['g2', 'g1', 'g3']);
  });

  it('pairs each picture with its own label', () => {
    const items = galleryItems(session());
    expect(items[0]?.group.label).toBe('Ławki');
    expect(items[0]?.image.imageKey).toBe('sessions/k7x2p9/images/g2.jpg');
  });

  /** An empty frame on the last screen of a lecture reads as a broken app. */
  it('leaves out a chosen group whose picture never arrived', () => {
    const s = session({
      images: {
        g1: image('sessions/k7x2p9/images/g1.jpg'),
        g3: image('sessions/k7x2p9/images/g3.jpg'),
      },
    });
    expect(galleryItems(s).map((item) => item.group.id)).toEqual(['g1', 'g3']);
  });

  it('ignores a picture belonging to a group that was not chosen', () => {
    const s = session({ selectedGroupIds: ['g1'] });
    expect(galleryItems(s).map((item) => item.group.id)).toEqual(['g1']);
  });

  it('is empty when nothing was rendered', () => {
    expect(galleryItems(session({ images: {} }))).toEqual([]);
  });
});

describe('stepIndex', () => {
  it('moves forward', () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
  });

  it('moves back', () => {
    expect(stepIndex(2, 3, -1)).toBe(1);
  });

  /** A dead arrow key on a projector just gets pressed again, harder. */
  it('wraps past the end', () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
  });

  it('wraps before the start', () => {
    expect(stepIndex(0, 3, -1)).toBe(2);
  });

  it('stays put with a single image', () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(stepIndex(0, 1, -1)).toBe(0);
  });

  it('does not divide by zero when there is nothing to show', () => {
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});
