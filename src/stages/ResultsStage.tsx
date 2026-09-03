import { pl } from '../i18n/pl';
import type { Group } from '../state/session';

/**
 * F-6.1 — groups sorted by member count, largest first.
 *
 * M3-3 turns this into the podium: the top three prominent, the rest a compact
 * list, a synthesis behind a click, and selection of exactly three. For now it
 * proves the grouping ran and shows what came back. Raw ideas are never shown
 * here or anywhere else (F-6.2).
 */
export default function ResultsStage({ groups }: { groups: Group[] }) {
  const sorted = [...groups].sort((a, b) => b.ideaIds.length - a.ideaIds.length);

  if (sorted.length === 0) {
    return (
      <section className="page--stage">
        <h1 className="stage-title">{pl.stages.results}</h1>
        <p className="muted">{pl.results.noGroups}</p>
      </section>
    );
  }

  return (
    <section className="results">
      <h1 className="stage-title">{pl.stages.results}</h1>

      <ul className="results__list">
        {sorted.map((group) => (
          <li key={group.id} className="results__group">
            <span className="results__label">{group.label}</span>
            <span className="results__count">{group.ideaIds.length}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
