import { useCallback, useEffect, useRef, useState } from 'react';
import { getIdeaCount, getSession, patchSession, resetSession } from '../api/client';
import { pl } from '../i18n/pl';
import type { Session, SessionPatch } from './session';

/**
 * Session loading and stage transitions for the lecturer's screen.
 *
 * Lives apart from `session.ts` on purpose: that module is imported by the
 * Netlify Functions, and pulling React into a function bundle would be silly.
 */

interface UseSession {
  session: Session | null;
  loading: boolean;
  /** Polish copy, ready to show (N-7). */
  error: string | null;
  /** Set while a transition is in flight, so controls can disable themselves. */
  busy: boolean;
  reload: () => Promise<void>;
  update: (patch: SessionPatch) => Promise<void>;
  reset: () => Promise<void>;
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : pl.errors.network;
}

export function useSession(id: string | undefined): UseSession {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setSession(await getSession(id));
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Wraps a transition so every caller gets the same busy/error handling. */
  const run = useCallback(async (action: () => Promise<Session>) => {
    setBusy(true);
    try {
      setSession(await action());
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const update = useCallback(
    async (patch: SessionPatch) => {
      if (!id) return;
      await run(() => patchSession(id, patch));
    },
    [id, run],
  );

  const reset = useCallback(async () => {
    if (!id) return;
    await run(() => resetSession(id));
  }, [id, run]);

  return { session, loading, error, busy, reload, update, reset };
}

/**
 * F-4.2 — the live counter on the voting stage, polled every few seconds.
 * Blobs is eventually consistent and the count is informational, so a failed
 * poll keeps the last known number rather than flashing an error on stage.
 */
const POLL_INTERVAL_MS = 3000;

export function useIdeaCount(id: string | undefined, active: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!id || !active) return;

    cancelled.current = false;

    const tick = async () => {
      try {
        const result = await getIdeaCount(id);
        if (!cancelled.current) setCount(result.count);
      } catch {
        /* keep the last known count; the projector should not flicker */
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      cancelled.current = true;
      window.clearInterval(timer);
    };
  }, [id, active]);

  return count;
}

/** F-4.1 — the absolute URL the QR code encodes. */
export function attendeeUrl(origin: string, sessionId: string): string {
  return `${origin.replace(/\/+$/, '')}/s/${sessionId}`;
}
