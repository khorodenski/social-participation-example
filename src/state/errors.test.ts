import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { pl } from '../i18n/pl';
import { LocalizedError, polishMessage } from './errors';

/**
 * M6-2. Every screen in this app is projected in front of a room or held by an
 * attendee, and the UI is Polish (N-1). An error's `message` is the one string
 * that arrives from outside, so these tests are about what must *never* reach
 * it.
 */
describe('polishMessage', () => {
  const FALLBACK = 'zastępczy komunikat';

  it('shows the message of a LocalizedError, because it was built from pl', () => {
    expect(polishMessage(new LocalizedError('Coś poszło nie tak.'), FALLBACK)).toBe(
      'Coś poszło nie tak.',
    );
  });

  it('shows an ApiError message, which is the whole point of the class', () => {
    expect(polishMessage(new ApiError(pl.errors.notVoting, 409), FALLBACK)).toBe(
      pl.errors.notVoting,
    );
  });

  /** This is the one that matters: a lecture hall's wifi drops and fetch throws. */
  it('refuses "Failed to fetch"', () => {
    expect(polishMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
  });

  it('refuses a bare Error, however Polish-looking the code that threw it', () => {
    expect(polishMessage(new Error('brak kontekstu 2d'), FALLBACK)).toBe(FALLBACK);
  });

  it('refuses a zod-shaped blob', () => {
    expect(polishMessage(new Error('[{"code":"invalid_type","path":["id"]}]'), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it('refuses things that are not errors at all', () => {
    for (const junk of [undefined, null, 'Gateway Timeout', 500, {}, { message: 'nope' }]) {
      expect(polishMessage(junk, FALLBACK)).toBe(FALLBACK);
    }
  });

  it('falls back when a LocalizedError somehow carries no message', () => {
    expect(polishMessage(new LocalizedError(''), FALLBACK)).toBe(FALLBACK);
    expect(polishMessage(new LocalizedError('   '), FALLBACK)).toBe(FALLBACK);
  });
});

/**
 * Guards the invariant the UI relies on. If someone makes `ApiError` a plain
 * `Error` again, every screen silently goes back to rendering English.
 */
describe('the error classes stay localized', () => {
  it('ApiError is a LocalizedError', () => {
    expect(new ApiError('x', 500)).toBeInstanceOf(LocalizedError);
  });

  it('keeps its status and its cause', () => {
    const cause = new TypeError('Failed to fetch');
    const err = new ApiError(pl.errors.network, 0, { cause });

    expect(err.status).toBe(0);
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('ApiError');
  });
});
