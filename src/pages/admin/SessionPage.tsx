import { useParams } from 'react-router-dom';
import { pl } from '../../i18n/pl';

/** Milestone 1+ renders the current stage from the persisted session. */
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <main className="page page--stage">
      <h1 className="stage-title">{pl.admin.placeholder}</h1>
      <p className="stage-subtitle">
        {pl.admin.sessionTitleLabel}: <code>{id}</code>
      </p>
      <p className="muted">{pl.stages.setup}</p>
    </main>
  );
}
