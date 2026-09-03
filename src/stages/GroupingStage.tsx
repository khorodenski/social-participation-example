import { useEffect, useRef, useState } from 'react';
import { getIdeaCount } from '../api/client';
import { groupSessionIdeas } from '../api/grouping';
import { ModelError } from '../api/google';
import { pl } from '../i18n/pl';
import type { Group, Session } from '../state/session';

/**
 * F-5.5 — what the hall looks at while grouping runs.
 *
 * Measured between five and fifteen seconds for the sizes a lecture produces,
 * so this screen is on the projector long enough to be read but not long
 * enough to need filling. It says how much is being worked on rather than
 * counting seconds down, which would only make the wait feel longer.
 */
interface GroupingStageProps {
  session: Session;
  onGrouped: (groups: Group[]) => Promise<void>;
}

export default function GroupingStage({ session, onGrouped }: GroupingStageProps) {
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // Guards two things at once: React StrictMode running effects twice in dev,
  // and any re-render re-firing a call that costs real money.
  const ranFor = useRef(-1);

  const [count, setCount] = useState<number | null>(null);

  // One call, not a poll: nothing new arrives once voting is closed, and every
  // function invocation costs free-tier credit.
  useEffect(() => {
    let cancelled = false;
    void getIdeaCount(session.id)
      .then((result) => {
        if (!cancelled) setCount(result.count);
      })
      .catch(() => {
        /* the count is decoration here; the grouping result is what matters */
      });
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  useEffect(() => {
    // No per-effect "cancelled" flag here, deliberately. StrictMode mounts,
    // unmounts and remounts in dev: the cleanup would cancel the only call the
    // ref guard allows, and the screen would sit on "Grupuję pomysły…" forever.
    // The guard alone is what stops a second, billable call.
    if (ranFor.current === attempt) return;
    ranFor.current = attempt;

    void (async () => {
      setError(null);
      try {
        const groups = await groupSessionIdeas(session.id);
        await onGrouped(groups);
      } catch (err) {
        setError(err instanceof Error ? err.message : pl.errors.network);
        setRetryable(err instanceof ModelError ? err.retryable : true);
      }
    })();
  }, [attempt, session.id, onGrouped]);

  if (error) {
    return (
      <section className="grouping">
        <h1 className="stage-title">{pl.stages.results}</h1>
        <p className="error-text grouping__error" role="alert">
          {error}
        </p>
        {retryable ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setAttempt(attempt + 1)}
          >
            {pl.common.retry}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="grouping">
      <h1 className="stage-title grouping__title">{pl.stages.grouping}</h1>
      {count !== null ? (
        <p className="stage-subtitle">
          {count} · {pl.voting.ideasCount}
        </p>
      ) : null}
      <div className="grouping__pulse" aria-hidden="true" />
      <p className="muted" role="status">
        {pl.stages.groupingHint}
      </p>
    </section>
  );
}
