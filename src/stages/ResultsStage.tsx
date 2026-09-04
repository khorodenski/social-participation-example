import { useEffect, useRef, useState } from 'react';
import { ideaCountLabel, pl } from '../i18n/pl';
import { rankGroups, requiredSelectionCount } from '../state/results';
import type { Group } from '../state/session';

/**
 * F-6.1..F-6.4 — the podium.
 *
 * The top three themes are prominent, the rest is a compact list, and the
 * catch-all "Inne" sits apart at the bottom because it has no theme to
 * visualise. A card carries a label and a count and nothing else: clicking it
 * opens the synthesis, and **raw ideas appear nowhere** (F-6.2). That is the
 * whole anonymity promise made to the room, so nothing here should ever be
 * given an idea to render.
 *
 * Selection lives in `SessionPage` because "Dalej" is a control-bar action,
 * next to "Grupuj ponownie" and "Resetuj sesję" where the lecturer looks for it.
 */

interface ResultsStageProps {
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

export default function ResultsStage({ groups, selectedIds, onToggle }: ResultsStageProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<Group | null>(null);

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
          <p className="synthesis__text">{shown?.synthesis}</p>
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
