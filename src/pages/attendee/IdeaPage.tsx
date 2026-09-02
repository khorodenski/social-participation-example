import { useParams } from 'react-router-dom';
import { pl } from '../../i18n/pl';

/** Milestone 1 replaces this with the real form + thank-you screen. */
export default function IdeaPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <main className="page page--narrow">
      <h1 className="stage-title">{pl.attendee.ideaLabel}</h1>
      <p className="muted">
        {pl.attendee.placeholder} — <code>{id}</code>
      </p>
    </main>
  );
}
