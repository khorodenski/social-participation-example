import { describe, expect, it } from 'vitest';
import { attendeeUrl } from './useSession';

/**
 * F-4.1 — the QR code has to encode an absolute URL. A phone in the hall has
 * no idea what the lecturer's page thinks "relative" means.
 */
describe('attendeeUrl', () => {
  it('builds the absolute attendee URL', () => {
    expect(attendeeUrl('https://hejhus-workshops.netlify.app', 'k7x2p9')).toBe(
      'https://hejhus-workshops.netlify.app/s/k7x2p9',
    );
  });

  it('works against a local dev origin with a port', () => {
    expect(attendeeUrl('http://localhost:8888', 'abc123')).toBe('http://localhost:8888/s/abc123');
  });

  it('does not double the slash when the origin has a trailing one', () => {
    expect(attendeeUrl('https://example.test/', 'abc123')).toBe('https://example.test/s/abc123');
  });
});
