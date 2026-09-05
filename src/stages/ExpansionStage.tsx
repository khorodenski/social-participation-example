import { useCallback, useEffect, useRef, useState } from 'react';
import { expandSessionGroup } from '../api/expansion';
import { ModelError } from '../api/google';
import { pl } from '../i18n/pl';
import { polishMessage } from '../state/errors';
import { missingExpansions, selectedGroups } from '../state/expansion';
import type { Expansion, Group, Session } from '../state/session';

/**
 * F-7.2..F-7.4 — one card per chosen group: label, synthesis, prompt.
 *
 * The three calls go out together and nothing waits for its neighbour. That is
 * not a nicety: one expansion was measured at 47 s with no resources and 100 s
 * with a photograph, so three in sequence is about five minutes of dead
 * projector against roughly a hundred seconds done in parallel.
 *
 * `Promise.allSettled`, never `Promise.all`, for the same reason F-8.2 gives
 * about images: one group failing must not take the other two with it.
 */

interface ExpansionStageProps {
  session: Session;
  /** Persists whatever arrived; SessionPage moves the stage on when all exist. */
  onExpanded: (expansions: Record<string, Expansion>) => Promise<void>;
}

interface Failure {
  message: string;
  retryable: boolean;
}

/**
 * A `done` card can carry a failure: that is a re-run (F-7.4) that did not
 * work. The prompt it already had is still good and stays on screen, with the
 * error beside it, because throwing away a working prompt because the redo
 * failed is the worse of the two outcomes on a projector.
 */
type CardState =
  | { status: 'working' }
  | { status: 'done'; prompt: string; failure?: Failure }
  | ({ status: 'failed' } & Failure);

interface PromptCardProps {
  group: Group;
  state: CardState;
  onRetry: () => void;
}

function PromptCard({ group, state, onRetry }: PromptCardProps) {
  return (
    <li className={`prompt-card is-${state.status}`}>
      <h2 className="prompt-card__label">{group.label}</h2>
      <p className="prompt-card__synthesis">{group.synthesis}</p>

      {state.status === 'working' ? (
        <div className="prompt-card__body">
          <div className="prompt-card__pulse" aria-hidden="true" />
          <p className="muted" role="status">
            {pl.expansion.working}
          </p>
        </div>
      ) : null}

      {state.status === 'failed' ? (
        <div className="prompt-card__body">
          <p className="error-text" role="alert">
            {state.message}
          </p>
          {state.retryable ? (
            <button type="button" className="btn" onClick={onRetry}>
              {pl.common.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      {state.status === 'done' ? (
        <div className="prompt-card__body">
          {/* A-3 — the heading stays Polish even though the prompt is English. */}
          <h3 className="prompt-card__heading">{pl.expansion.promptLabel}</h3>
          {/* F-7.3 — read-only. Nothing here is an input. */}
          <p className="prompt-card__prompt" lang="en">
            {state.prompt}
          </p>

          {state.failure ? (
            <p className="error-text prompt-card__note" role="alert">
              {state.failure.message}
            </p>
          ) : null}

          {/* F-7.4 — per card, never "regenerate all". */}
          <button type="button" className="btn prompt-card__again" onClick={onRetry}>
            {pl.common.reExpand}
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default function ExpansionStage({ session, onExpanded }: ExpansionStageProps) {
  const groups = selectedGroups(session);

  // Prompts that arrived in this mount, before the write comes back. The
  // persisted ones in `session.expansions` take over once it does.
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const [failures, setFailures] = useState<Record<string, Failure>>({});

  /**
   * Which groups have a call in flight right now.
   *
   * Without this a re-run of a card that already has a prompt shows nothing at
   * all: the stored prompt wins, so the button looks dead for the minute the
   * call takes and stays dead if it fails.
   */
  const [running, setRunning] = useState<string[]>([]);

  // Guards StrictMode's double effect in dev and any re-render, both of which
  // would otherwise fire a second billable call. Same shape as GroupingStage,
  // and for the same reason there is no per-effect `cancelled` flag beside it:
  // the cleanup would cancel the only call the guard allows.
  const ranFor = useRef('');

  const runFor = useCallback(
    async (targets: Group[]) => {
      if (targets.length === 0) return;

      const ids = targets.map((group) => group.id);

      setFailures((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        return next;
      });
      setRunning((current) => [...current, ...ids]);

      /**
       * The batch's own clock, because `generateJson` only times each call
       * separately and three sequential calls log the same per-call numbers as
       * three parallel ones. This line is the only thing that tells the two
       * apart: with three groups it should read close to the slowest call, not
       * close to their sum.
       */
      const startedAt = Date.now();

      // F-7.2 — all of them at once, and one failure keeps its neighbours.
      const settled = await Promise.allSettled(
        targets.map(async (group) => [group.id, await expandSessionGroup(session, group)] as const),
      );

      console.debug(
        `[social-voting] expansion: ${ids.length} group(s) in ${((Date.now() - startedAt) / 1000).toFixed(1)}s wall clock`,
      );

      const arrived: Record<string, string> = {};
      const failed: Record<string, Failure> = {};

      settled.forEach((result, index) => {
        const group = targets[index] as Group;
        if (result.status === 'fulfilled') {
          arrived[result.value[0]] = result.value[1];
          return;
        }
        const err: unknown = result.reason;
        failed[group.id] = {
          message: polishMessage(err, pl.expansion.failed),
          retryable: err instanceof ModelError ? err.retryable : true,
        };
      });

      setFresh((current) => ({ ...current, ...arrived }));
      setFailures((current) => ({ ...current, ...failed }));
      setRunning((current) => current.filter((id) => !ids.includes(id)));

      // One write per batch rather than one per prompt: a PATCH replaces
      // `expansions` wholesale, so three racing writes would drop each other's
      // work. A partial batch is persisted too, so a retry never re-runs a
      // prompt that already landed.
      if (Object.keys(arrived).length > 0) {
        const now = Date.now();
        await onExpanded(
          Object.fromEntries(
            Object.entries(arrived).map(([id, prompt]) => [id, { prompt, createdAt: now }]),
          ),
        );
      }
    },
    [session, onExpanded],
  );

  const pending = missingExpansions(session);
  const signature = pending.map((group) => group.id).join('|');

  useEffect(() => {
    // Keyed on which groups are still missing, not on the session object, so
    // persisting one batch does not start another.
    if (signature.length === 0 || ranFor.current === signature) return;
    ranFor.current = signature;
    void runFor(pending);
    // `pending` and `runFor` both change identity on every session write, and
    // depending on them would re-fire the very calls the guard exists to stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const retry = useCallback(
    (group: Group) => {
      // A retry is deliberate, so it moves the guard rather than fighting it.
      ranFor.current = `retry:${group.id}:${Date.now()}`;
      setFresh((current) => {
        const next = { ...current };
        delete next[group.id];
        return next;
      });
      void runFor([group]);
    },
    [runFor],
  );

  if (groups.length === 0) {
    return (
      <section className="page--stage">
        <h1 className="stage-title">{pl.stages.expanding}</h1>
        <p className="muted">{pl.expansion.noSelection}</p>
      </section>
    );
  }

  const stateFor = (group: Group): CardState => {
    // A call in flight outranks a stored prompt, so a re-run shows that
    // something is happening instead of leaving the old prompt sitting there.
    if (running.includes(group.id)) return { status: 'working' };

    const prompt = session.expansions[group.id]?.prompt ?? fresh[group.id];
    const failure = failures[group.id];

    if (prompt !== undefined)
      return failure ? { status: 'done', prompt, failure } : { status: 'done', prompt };
    if (failure) return { status: 'failed', ...failure };

    return { status: 'working' };
  };

  const done = groups.filter((group) => stateFor(group).status === 'done').length;

  return (
    <section className="expansion">
      <header className="expansion__head">
        <h1 className="stage-title">
          {done === groups.length ? pl.stages.expanded : pl.stages.expanding}
        </h1>
        <p className="expansion__tally">
          {done} / {groups.length}
        </p>
      </header>

      {done < groups.length ? (
        <p className="muted" role="status">
          {pl.expansion.hint}
        </p>
      ) : null}

      <ul className="expansion__cards">
        {groups.map((group) => (
          <PromptCard
            key={group.id}
            group={group}
            state={stateFor(group)}
            onRetry={() => retry(group)}
          />
        ))}
      </ul>
    </section>
  );
}
