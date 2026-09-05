import { useEffect, useRef, useState } from 'react';
import { ApiError, listIdeas } from '../api/client';
import { ideaCountLabel, pl } from '../i18n/pl';
import { rankGroups, requiredSelectionCount } from '../state/results';
import { getShowIdeasInGroups } from '../state/settings';
import type { Group, Idea } from '../state/session';

/**
 * F-6.1..F-6.4 — the podium.
 *
 * The top three themes are prominent, the rest is a compact list, and the
 * catch-all "Inne" sits apart at the bottom because it has no theme to
 * visualise. A card carries a label and a count and nothing else; clicking it
 * opens the synthesis.
 *
 * **Cards never show ideas. The popup shows them only if the lecturer asked.**
 * F-6.2 originally said raw ideas appear nowhere at all, and that was the
 * anonymity promise made to the room. It is now the lecturer's own call,
 * through "Pokazuj pomysły w grupach" behind the gear, and it is **off unless
 * they turn it on** — this screen is a projection and the ideas were typed by
 * the people looking at it. The setting is re-read every time the popup opens,
 * so a change made mid-stage takes effect without a reload.
 *
 * Selection lives in `SessionPage` because "Dalej" is a control-bar action,
 * next to "Grupuj ponownie" and "Resetuj sesję" where the lecturer looks for it.
 */

interface ResultsStageProps {
  sessionId: string;
  groups: Group[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

interface GroupCardProps {
  group: Group;
  rank?: number;
  selected: boolean;
  onOpen: () => void;
  onToggle?: () => void;
}

function GroupCard({ group, rank, selected, onOpen, onToggle }: GroupCardProps) {
  const classes = ['group-card'];
  if (rank !== undefined) classes.push('group-card--podium');
  if (selected) classes.push('is-selected');
  if (!onToggle) classes.push('group-card--muted');

  const count = group.ideaIds.length;

  return (
    <li className={classes.join(' ')}>
      {/* The body is the button, so the whole card opens the synthesis (F-6.2).
          The toggle is a sibling: a button inside a button is invalid HTML and
          swallows the click on whichever one the browser feels like. */}
      <button
        type="button"
        className="group-card__body"
        onClick={onOpen}
        title={pl.results.showSynthesis}
      >
        {rank !== undefined ? <span className="group-card__rank">{rank}</span> : null}
        <span className="group-card__label">{group.label}</span>
        <span className="group-card__count">
          <span className="group-card__number">{count}</span>
          <span className="group-card__unit">{ideaCountLabel(count)}</span>
        </span>
      </button>

      {onToggle ? (
        <button
          type="button"
          className="group-card__pick"
          aria-pressed={selected}
          onClick={onToggle}
        >
          {selected ? pl.results.selected : pl.results.select}
        </button>
      ) : (
        <span className="group-card__pick group-card__pick--off">{pl.results.otherHint}</span>
      )}
    </li>
  );
}

interface IdeaListProps {
  group: Group;
  /** `null` while the fetch is still out. */
  ideas: Record<string, Idea> | null;
  error: string | null;
}

/**
 * The ideas that fed one group, shown only when the lecturer switched it on.
 *
 * The list scrolls inside the popup rather than growing it: a big group would
 * otherwise push the close button off a projected screen. An id with no idea
 * behind it is dropped rather than rendered as a gap — the model writes those
 * ids, and F-5.3 already treats them as fallible.
 */
function IdeaList({ group, ideas, error }: IdeaListProps) {
  const count = group.ideaIds.length;

  const body = () => {
    if (error) return <p className="error-text">{error}</p>;
    if (ideas === null) return <p className="muted">{pl.results.ideasLoading}</p>;

    const found = group.ideaIds
      .map((id) => ideas[id])
      .filter((idea): idea is Idea => idea !== undefined);

    if (found.length === 0) return <p className="muted">{pl.results.ideasEmpty}</p>;

    return (
      <ul className="synthesis__list">
        {found.map((idea) => (
          <li key={idea.id} className="synthesis__idea">
            {idea.text}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="synthesis__ideas">
      <h3 className="synthesis__heading">
        {pl.results.ideasHeading} · {count} {ideaCountLabel(count)}
      </h3>
      {body()}
    </section>
  );
}

export default function ResultsStage({
  sessionId,
  groups,
  selectedIds,
  onToggle,
}: ResultsStageProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<Group | null>(null);

  const [showIdeas, setShowIdeas] = useState(getShowIdeasInGroups);
  const [ideas, setIdeas] = useState<Record<string, Idea> | null>(null);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const loadingIdeas = useRef(false);

  /**
   * Fetched once and kept, so opening a second group is instant in front of a
   * room. Key-less: the ideas endpoint needs no API key.
   *
   * The ref is the only guard, and there is deliberately **no cancelled flag**.
   * React StrictMode double-runs effects in dev, and a cleanup that cancels the
   * one call the guard allows leaves the list loading forever in dev while
   * working in production — the same trap `GroupingStage` documents.
   */
  async function loadIdeas() {
    if (ideas !== null || loadingIdeas.current) return;

    loadingIdeas.current = true;
    setIdeasError(null);

    try {
      const list = await listIdeas(sessionId);
      setIdeas(Object.fromEntries(list.map((idea) => [idea.id, idea])));
    } catch (err) {
      setIdeasError(err instanceof ApiError ? err.message : pl.results.ideasFailed);
      // Let the next open try again; a hall's network drops one request often
      // enough that a permanent failure would be the wrong answer.
      loadingIdeas.current = false;
    }
  }

  // Warm the list on arrival when the setting is already on, so the first click
  // does not wait on a request.
  useEffect(() => {
    if (getShowIdeasInGroups()) void loadIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes a native <dialog> without going through our close button, so the
  // shown group is cleared from the `close` event rather than from the handler.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onClose = () => setShown(null);
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, []);

  function openSynthesis(group: Group) {
    setShown(group);

    // Re-read rather than trusting the mount: the gear sits in the control bar
    // right below this screen, so it can be flipped between two clicks.
    const wanted = getShowIdeasInGroups();
    setShowIdeas(wanted);
    if (wanted) void loadIdeas();

    dialogRef.current?.showModal();
  }

  if (groups.length === 0) {
    return (
      <section className="page--stage">
        <h1 className="stage-title">{pl.stages.results}</h1>
        <p className="muted">{pl.results.noGroups}</p>
      </section>
    );
  }

  const { podium, rest, other } = rankGroups(groups);
  const required = requiredSelectionCount(groups);
  const complete = selectedIds.length === required;

  return (
    <section className="results">
      <header className="results__head">
        <h1 className="stage-title">{pl.stages.results}</h1>
        <p className={complete ? 'results__counter' : 'results__counter is-incomplete'}>
          {pl.results.selectionHint}
          <span className="results__tally">
            {selectedIds.length} / {required}
          </span>
        </p>
      </header>

      <ol className="results__podium">
        {podium.map((group, index) => (
          <GroupCard
            key={group.id}
            group={group}
            rank={index + 1}
            selected={selectedIds.includes(group.id)}
            onOpen={() => openSynthesis(group)}
            onToggle={() => onToggle(group.id)}
          />
        ))}
      </ol>

      {rest.length > 0 ? (
        <ul className="results__rest">
          {rest.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              selected={selectedIds.includes(group.id)}
              onOpen={() => openSynthesis(group)}
              onToggle={() => onToggle(group.id)}
            />
          ))}
        </ul>
      ) : null}

      {other ? (
        <ul className="results__rest">
          <GroupCard group={other} selected={false} onOpen={() => openSynthesis(other)} />
        </ul>
      ) : null}

      {/* The reset zeroes every margin, which also strips the UA stylesheet's
          `margin: auto` and drops a modal into the top-left corner. */}
      <dialog ref={dialogRef} className="synthesis" aria-label={pl.results.synthesisTitle}>
        <div className="synthesis__body">
          <h2 className="synthesis__title">{shown?.label}</h2>

          {/* The title and the close button are pinned; everything between them
              scrolls as one region. Giving the idea list its own scroller looked
              tidier and broke at 720p: the synthesis alone filled the popup, the
              list was squeezed to nothing and the close button was pushed off
              the bottom. */}
          <div className="synthesis__scroll">
            <p className="synthesis__text">{shown?.synthesis}</p>

            {showIdeas && shown ? (
              <IdeaList group={shown} ideas={ideas} error={ideasError} />
            ) : null}
          </div>

          <div className="synthesis__actions">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              {pl.common.close}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
