import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GearSettingsDialog from '../../components/GearSettingsDialog';
import Logo from '../../components/Logo';
import Spinner from '../../components/Spinner';
import { createSession, listSessions } from '../../api/client';
import { pl } from '../../i18n/pl';
import { polishMessage } from '../../state/errors';
import type { SessionSummary } from '../../state/session';

/**
 * F-1.3 — the lecturer's way in. Several sessions exist so a rehearsal and the
 * real run never collide, so this lists them and creates new ones. No deletion:
 * "reset to draft" from the session screen is enough.
 */
export default function SessionList() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listSessions();
        if (!cancelled) setSessions(result);
      } catch (err) {
        if (!cancelled) setError(polishMessage(err, pl.errors.network));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError(pl.admin.titleRequired);
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const session = await createSession({ title: trimmed, intro: intro.trim() });
      void navigate(`/admin/${session.id}`);
    } catch (err) {
      setError(polishMessage(err, pl.errors.network));
      setCreating(false);
    }
  }

  return (
    <main className="page page--narrow">
      {/* This page has no control bar, so it carries the mark itself. */}
      <Logo className="page-logo" />

      <header className="list-head">
        <h1 className="stage-title">{pl.admin.listTitle}</h1>
        {/* Reachable before any session exists, so a fresh laptop is not a
            dead end on rehearsal morning. */}
        <GearSettingsDialog />
      </header>

      <form
        className="card session-form"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <h2 className="session-form__heading">{pl.admin.newSession}</h2>

        <div className="field">
          <label htmlFor="title">{pl.admin.sessionTitleLabel}</label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={pl.admin.titlePlaceholder}
            disabled={creating}
          />
        </div>

        <div className="field">
          <label htmlFor="intro">{pl.admin.introLabel}</label>
          <input
            id="intro"
            className="input"
            value={intro}
            onChange={(event) => setIntro(event.target.value)}
            placeholder={pl.admin.introPlaceholder}
            disabled={creating}
          />
        </div>

        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={creating || title.trim().length === 0}
        >
          {creating ? pl.app.loading : pl.admin.create}
        </button>
      </form>

      {loading ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <p className="muted">{pl.admin.noSessions}</p>
      ) : (
        <ul className="session-list">
          {sessions.map((session) => (
            <li key={session.id} className="session-list__item">
              <div className="session-list__meta">
                <span className="session-list__title">{session.title}</span>
                <span className="muted">
                  <code>{session.id}</code> · {pl.admin.createdAt}{' '}
                  {new Date(session.createdAt).toLocaleString('pl-PL')}
                </span>
              </div>
              <Link className="btn" to={`/admin/${session.id}`}>
                {pl.admin.open}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
