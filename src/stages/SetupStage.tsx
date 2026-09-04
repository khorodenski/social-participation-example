import { useEffect, useState } from 'react';
import ResourceEditor from '../components/ResourceEditor';
import { pl } from '../i18n/pl';
import { sameResources } from '../state/resources';
import { attendeeUrl } from '../state/useSession';
import type { Resource, Session, SessionPatch } from '../state/session';

/**
 * F-1.1/F-2.1 — the screen the lecturer works on before the room arrives.
 *
 * Unlike every other stage this one is not a projected hero: it is a form and a
 * list, so it opts out of the centring in `.page--session > section` the same
 * way the results screen does.
 *
 * **Everything is a draft until "Zapisz".** `draft === null` means "untouched",
 * and the session's own values show through — so a save landing from anywhere
 * else is never overwritten by a stale copy of a field nobody typed in. One
 * PATCH carries the title, the intro and the whole resource list, because a
 * PATCH replaces `resources` wholesale and three racing writes would drop each
 * other's work (the same rule `ExpansionStage` follows).
 *
 * The unsaved state is reported upwards, because "Rozpocznij głosowanie" lives
 * in the control bar: without that, a lecturer who typed and did not save would
 * start voting on the old title and there is no way back except a reset.
 */

interface Draft {
  title: string;
  intro: string;
  resources: Resource[];
}

interface SetupStageProps {
  session: Session;
  /** Resolves false when the write failed, so a draft is never dropped silently. */
  onSave: (patch: SessionPatch) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  busy?: boolean;
}

export default function SetupStage({ session, onSave, onDirtyChange, busy }: SetupStageProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saved: Draft = {
    title: session.title,
    intro: session.intro,
    resources: session.resources,
  };
  const current = draft ?? saved;

  const dirty =
    draft !== null &&
    (draft.title !== saved.title ||
      draft.intro !== saved.intro ||
      !sameResources(draft.resources, saved.resources));

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  /** Every edit seeds the draft from the session the first time it is touched. */
  function edit(change: Partial<Draft>) {
    setError(null);
    setDraft((previous) => ({ ...(previous ?? saved), ...change }));
  }

  function editResources(update: (resources: Resource[]) => Resource[]) {
    setError(null);
    setDraft((previous) => {
      const base = previous ?? saved;
      return { ...base, resources: update(base.resources) };
    });
  }

  async function save() {
    if (draft === null) return;

    // F-1.1 — the title is required, and it is also the session's name in the
    // list. An empty one would fail zod on the server as a bare 400.
    const title = draft.title.trim();
    if (title.length === 0) {
      setError(pl.admin.titleRequired);
      return;
    }

    const ok = await onSave({ title, intro: draft.intro.trim(), resources: draft.resources });
    // Only on success: a failed save keeps the draft so the typing is not lost,
    // and the control bar is already showing why it failed.
    if (ok) setDraft(null);
  }

  return (
    <section className="setup">
      <header className="setup__head">
        <div>
          {/* A title trimmed to nothing keeps the saved one here rather than
              leaving the heading blank while the field is being retyped. */}
          <h1 className="stage-title setup__title">{current.title.trim() || session.title}</h1>
          <p className="muted">
            {pl.stages.setup} · <code>{session.id}</code>
          </p>
        </div>

        <div className="setup__actions">
          {dirty ? <span className="setup__unsaved">{pl.setup.unsaved}</span> : null}
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
            disabled={!dirty || busy}
          >
            {pl.setup.discard}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void save()}
            disabled={!dirty || busy}
          >
            {pl.common.save}
          </button>
        </div>
      </header>

      {dirty ? <p className="muted setup__note">{pl.setup.saveFirst}</p> : null}

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      <div className="card setup__card">
        <h2 className="setup__section">{pl.setup.detailsTitle}</h2>
        <p className="muted">{pl.setup.detailsHint}</p>

        <div className="field">
          <label htmlFor="setup-title">{pl.admin.sessionTitleLabel}</label>
          <input
            id="setup-title"
            className="input"
            value={current.title}
            onChange={(event) => edit({ title: event.target.value })}
            placeholder={pl.admin.titlePlaceholder}
            disabled={busy}
          />
        </div>

        <div className="field">
          <label htmlFor="setup-intro">{pl.admin.introLabel}</label>
          <input
            id="setup-intro"
            className="input"
            value={current.intro}
            onChange={(event) => edit({ intro: event.target.value })}
            placeholder={pl.admin.introPlaceholder}
            disabled={busy}
          />
        </div>

        <p className="muted">
          {pl.setup.attendeeLink}: <code>{attendeeUrl(window.location.origin, session.id)}</code>
        </p>
      </div>

      <div className="card setup__card">
        <ResourceEditor
          sessionId={session.id}
          resources={current.resources}
          onChange={editResources}
          disabled={busy}
        />
      </div>
    </section>
  );
}
