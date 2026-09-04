import { useCallback, useEffect, useRef, useState } from 'react';
import { assetUrl } from '../api/client';
import { ModelError } from '../api/google';
import { generateSessionImage } from '../api/visualize';
import { pl } from '../i18n/pl';
import { selectedGroups } from '../state/expansion';
import { generatedImageSrc, missingImages } from '../state/visualize';
import type { GeneratedImage, Group, Session } from '../state/session';

/**
 * F-8.1..F-8.4 — one card per chosen group, each holding its own picture.
 *
 * Structurally `ExpansionStage` one stage later, and for the same reasons: all
 * three calls go out together through `Promise.allSettled`, one failure leaves
 * its neighbours alone (F-8.2), and the batch is persisted in a single write
 * because a PATCH replaces `images` wholesale.
 *
 * The wait is much shorter here. One image measured 10.8 s at 1K and 19.5 s at
 * 2K, against 47-100 s for one expansion, so this screen is on the projector
 * for about twenty seconds rather than a minute and a half.
 */

interface VisualizeStageProps {
  session: Session;
  /** Persists whatever arrived; SessionPage moves the stage on when all exist. */
  onRendered: (images: Record<string, GeneratedImage>) => Promise<void>;
}

interface Failure {
  message: string;
  retryable: boolean;
}

/**
 * A `done` card can carry a failure: that is a "Generuj ponownie" (F-8.3) that
 * did not work. The picture it already had stays on screen with the error
 * beside it, because losing a good image because the redo failed is the worse
 * outcome in front of a room.
 */
type CardState =
  | { status: 'working' }
  | { status: 'done'; image: GeneratedImage; failure?: Failure }
  | ({ status: 'failed' } & Failure);

interface ImageCardProps {
  group: Group;
  state: CardState;
  onRetry: () => void;
}

function ImageCard({ group, state, onRetry }: ImageCardProps) {
  return (
    <li className={`image-card is-${state.status}`}>
      <div className="image-card__frame">
        {state.status === 'done' ? (
          <img
            className="image-card__img"
            src={generatedImageSrc(assetUrl(state.image.imageKey), state.image.createdAt)}
            alt={group.label}
          />
        ) : null}

        {state.status === 'working' ? (
          <div className="image-card__pending">
            <div className="image-card__pulse" aria-hidden="true" />
            <p className="muted" role="status">
              {pl.visualize.working}
            </p>
          </div>
        ) : null}

        {state.status === 'failed' ? (
          <div className="image-card__pending">
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
      </div>

      <div className="image-card__foot">
        <h2 className="image-card__label">{group.label}</h2>

        {state.status === 'done' ? (
          <>
            {state.failure ? (
              <p className="error-text image-card__note" role="alert">
                {state.failure.message}
              </p>
            ) : null}
            {/* F-8.3 — per card. There is deliberately no "regenerate all". */}
            <button type="button" className="btn image-card__again" onClick={onRetry}>
              {pl.common.regenerate}
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

export default function VisualizeStage({ session, onRendered }: VisualizeStageProps) {
  const groups = selectedGroups(session);

  const [fresh, setFresh] = useState<Record<string, GeneratedImage>>({});
  const [failures, setFailures] = useState<Record<string, Failure>>({});
  /** A call in flight outranks a stored picture, so a redo visibly does something. */
  const [running, setRunning] = useState<string[]>([]);

  // Guards StrictMode's double effect in dev and any re-render, both of which
  // would otherwise fire a second billable call. No per-effect `cancelled` flag
  // beside it: the cleanup would cancel the only call the guard allows.
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

      const startedAt = Date.now();

      // F-8.1/F-8.2 — all at once, and one failure keeps its neighbours.
      const settled = await Promise.allSettled(
        targets.map(
          async (group) => [group.id, await generateSessionImage(session, group.id)] as const,
        ),
      );

      console.debug(
        `[social-voting] visualize: ${ids.length} image(s) in ${((Date.now() - startedAt) / 1000).toFixed(1)}s wall clock`,
      );

      const arrived: Record<string, GeneratedImage> = {};
      const failed: Record<string, Failure> = {};

      settled.forEach((result, index) => {
        const group = targets[index] as Group;
        if (result.status === 'fulfilled') {
          arrived[result.value[0]] = result.value[1];
          return;
        }
        const err: unknown = result.reason;
        failed[group.id] = {
          message: err instanceof Error && err.message ? err.message : pl.visualize.failed,
          retryable: err instanceof ModelError ? err.retryable : true,
        };
      });

      setFresh((current) => ({ ...current, ...arrived }));
      setFailures((current) => ({ ...current, ...failed }));
      setRunning((current) => current.filter((id) => !ids.includes(id)));

      // One write per batch: a PATCH replaces `images` wholesale, so parallel
      // writes would drop each other's work.
      if (Object.keys(arrived).length > 0) await onRendered(arrived);
    },
    [session, onRendered],
  );

  const pending = missingImages(session);
  const signature = pending.map((group) => group.id).join('|');

  useEffect(() => {
    if (signature.length === 0 || ranFor.current === signature) return;
    ranFor.current = signature;
    void runFor(pending);
    // `pending` and `runFor` change identity on every session write, and
    // depending on them would re-fire the calls the guard exists to stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const retry = useCallback(
    (group: Group) => {
      // Deliberate, so it moves the guard rather than fighting it.
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
        <h1 className="stage-title">{pl.stages.visualizing}</h1>
        <p className="muted">{pl.expansion.noSelection}</p>
      </section>
    );
  }

  const stateFor = (group: Group): CardState => {
    if (running.includes(group.id)) return { status: 'working' };

    const image = session.images[group.id] ?? fresh[group.id];
    const failure = failures[group.id];

    if (image) return failure ? { status: 'done', image, failure } : { status: 'done', image };
    if (failure) return { status: 'failed', ...failure };

    return { status: 'working' };
  };

  const done = groups.filter((group) => stateFor(group).status === 'done').length;

  return (
    <section className="visualize">
      <header className="visualize__head">
        <h1 className="stage-title">{pl.stages.visualizing}</h1>
        <p className="visualize__tally">
          {done} / {groups.length}
        </p>
      </header>

      {done < groups.length ? (
        <p className="muted" role="status">
          {pl.visualize.hint}
        </p>
      ) : null}

      <ul className="visualize__cards">
        {groups.map((group) => (
          <ImageCard
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
