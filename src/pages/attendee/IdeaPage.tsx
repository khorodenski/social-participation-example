import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../../components/Logo';
import Spinner from '../../components/Spinner';
import { submitIdea } from '../../api/client';
import { pl } from '../../i18n/pl';
import { polishMessage } from '../../state/errors';
import { IDEA_MAX_LENGTH, IDEA_MIN_LENGTH } from '../../state/session';
import { hasSubmitted, markSubmitted } from '../../state/submitted';
import { usePublicSession } from '../../state/useSession';

/**
 * F-4.3/F-4.4 — the attendee's whole experience: one textarea, one button, a
 * thank-you screen that survives a reload. Mobile-first (N-6); this is the
 * only screen in the app that is not projected.
 */
export default function IdeaPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading, error } = usePublicSession(id);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(() => (id ? hasSubmitted(id) : false));

  const trimmed = text.trim();
  const missing = IDEA_MIN_LENGTH - trimmed.length;
  const remaining = IDEA_MAX_LENGTH - trimmed.length;
  const canSend = missing <= 0 && remaining >= 0 && !sending;

  async function send() {
    if (!id || !canSend) return;

    setSending(true);
    setProblem(null);

    try {
      await submitIdea(id, trimmed);
      markSubmitted(id);
      setDone(true);
    } catch (err) {
      // The function already answers in Polish, including the 409 for a vote
      // that closed while this phone had the form open.
      setProblem(polishMessage(err, pl.errors.network));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="page page--narrow">
        <Spinner />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page page--narrow attendee">
        <Logo className="page-logo attendee__logo" />
        <h1 className="stage-title">{error ?? pl.errors.notFound}</h1>
      </main>
    );
  }

  if (done) {
    return (
      <main className="page page--narrow attendee attendee--done">
        <Logo className="page-logo attendee__logo" />
        <h1 className="stage-title">{pl.attendee.thankYou}</h1>
        <p className="stage-subtitle">{pl.attendee.thankYouHint}</p>
        <p className="muted">{session.title}</p>
      </main>
    );
  }

  if (session.stage !== 'voting') {
    const message = session.stage === 'draft' ? pl.attendee.notOpenYet : pl.attendee.votingClosed;

    return (
      <main className="page page--narrow attendee">
        <Logo className="page-logo attendee__logo" />
        <h1 className="stage-title">{session.title}</h1>
        <p className="stage-subtitle">{message}</p>
      </main>
    );
  }

  return (
    <main className="page page--narrow attendee">
      {/* The one screen an attendee holds, so the mark goes at the top of it. */}
      <Logo className="page-logo attendee__logo" />

      <header className="attendee__head">
        <h1 className="attendee__title">{session.title}</h1>
        {session.intro ? <p className="muted">{session.intro}</p> : null}
      </header>

      <form
        className="field"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="idea">{pl.attendee.ideaLabel}</label>

        <textarea
          id="idea"
          className="textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={pl.attendee.inputPlaceholder}
          maxLength={IDEA_MAX_LENGTH}
          rows={6}
          autoFocus
          disabled={sending}
        />

        <p className="muted attendee__counter">
          {missing > 0
            ? `${pl.attendee.charsNeeded}: ${missing}`
            : `${pl.attendee.charsLeft}: ${remaining}`}
        </p>

        {problem ? (
          <p className="error-text" role="alert">
            {problem}
          </p>
        ) : null}

        <button type="submit" className="btn btn--primary attendee__submit" disabled={!canSend}>
          {sending ? pl.attendee.sending : pl.attendee.submit}
        </button>
      </form>
    </main>
  );
}
