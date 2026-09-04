import { describe, expect, it } from 'vitest';
import { allImagesReady, generatedImageSrc, missingImages } from './visualize';
import { sessionSchema, type Group, type Session } from './session';

function group(id: string, label: string): Group {
  return { id, label, synthesis: `Synteza ${id}.`, ideaIds: [`${id}-i1`] };
}

const prompt = (text: string) => ({ prompt: text, createdAt: 1 });
const image = (key: string) => ({ imageKey: key, createdAt: 2 });

function session(over: Partial<Session> = {}): Session {
  return sessionSchema.parse({
    id: 'k7x2p9',
    title: 'Plac przed dworcem',
    createdAt: 0,
    stage: 'visualizing',
    groups: [group('g1', 'Zieleń'), group('g2', 'Ławki'), group('g3', 'Plac zabaw')],
    selectedGroupIds: ['g2', 'g1', 'g3'],
    expansions: { g1: prompt('a'), g2: prompt('b'), g3: prompt('c') },
    ...over,
  });
}

describe('missingImages', () => {
  it('is everything selected when nothing has been rendered', () => {
    expect(missingImages(session()).map((g) => g.id)).toEqual(['g2', 'g1', 'g3']);
  });

  it('keeps the order the lecturer confirmed', () => {
    const s = session({ images: { g1: image('sessions/k7x2p9/images/g1.jpg') } });
    expect(missingImages(s).map((g) => g.id)).toEqual(['g2', 'g3']);
  });

  it('is empty once every chosen group has one', () => {
    const s = session({
      images: {
        g1: image('sessions/k7x2p9/images/g1.jpg'),
        g2: image('sessions/k7x2p9/images/g2.jpg'),
        g3: image('sessions/k7x2p9/images/g3.jpg'),
      },
    });
    expect(missingImages(s)).toEqual([]);
  });

  /**
   * Nothing to send means a card that fails for a reason the lecturer cannot
   * fix, which is worse than no card at all.
   */
  it('skips a group whose prompt never arrived', () => {
    const s = session({ expansions: { g1: prompt('a'), g3: prompt('c') } });
    expect(missingImages(s).map((g) => g.id)).toEqual(['g1', 'g3']);
  });

  it('ignores an image belonging to a group that was not chosen', () => {
    const s = session({
      selectedGroupIds: ['g1'],
      images: { g2: image('sessions/k7x2p9/images/g2.jpg') },
    });
    expect(missingImages(s).map((g) => g.id)).toEqual(['g1']);
  });
});

describe('allImagesReady', () => {
  it('is false while any chosen group is still missing (F-9.1)', () => {
    const s = session({
      images: {
        g1: image('sessions/k7x2p9/images/g1.jpg'),
        g2: image('sessions/k7x2p9/images/g2.jpg'),
      },
    });
    expect(allImagesReady(s)).toBe(false);
  });

  it('is true once all three exist', () => {
    const s = session({
      images: {
        g1: image('sessions/k7x2p9/images/g1.jpg'),
        g2: image('sessions/k7x2p9/images/g2.jpg'),
        g3: image('sessions/k7x2p9/images/g3.jpg'),
      },
    });
    expect(allImagesReady(s)).toBe(true);
  });

  it('is false when nothing was selected at all', () => {
    expect(allImagesReady(session({ selectedGroupIds: [] }))).toBe(false);
  });
});

describe('generatedImageSrc', () => {
  /**
   * F-8.3 overwrites the same blob key, so an `<img>` whose src never changes
   * would keep showing the previous picture.
   */
  it('busts the cache with the timestamp', () => {
    expect(generatedImageSrc('/api/assets/sessions/k7x2p9/images/g1.jpg', 1788516000000)).toBe(
      '/api/assets/sessions/k7x2p9/images/g1.jpg?v=1788516000000',
    );
  });

  it('gives a regenerated image a different src from the one it replaced', () => {
    const path = '/api/assets/sessions/k7x2p9/images/g1.jpg';
    expect(generatedImageSrc(path, 1)).not.toBe(generatedImageSrc(path, 2));
  });
});
