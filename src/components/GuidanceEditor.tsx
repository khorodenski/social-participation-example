import { useEffect, useState } from 'react';
import { pl } from '../i18n/pl';

/**
 * The lecturer's hard constraints for the prompt-writing model, editable on
 * the results screen (before "Dalej") and on the prompts screen (before
 * "Rozwiń ponownie"). Collapsed by default: both screens are projected, and
 * the room does not need to read it.
 *
 * Local until "Zapisz", so a half-typed rule is never what the next expansion
 * runs with.
 */

interface GuidanceEditorProps {
  value: string;
  onSave: (guidance: string) => Promise<unknown>;
  busy?: boolean;
}

const FEEDBACK_MS = 2500;

export default function GuidanceEditor({ value, onSave, busy }: GuidanceEditorProps) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // A write from elsewhere (a reset, another tab) wins over an untouched draft.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (note === null) return;
    const timer = window.setTimeout(() => setNote(null), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [note]);

  const dirty = draft.trim() !== value.trim();

  async function save() {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setNote(pl.guidance.saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="guidance">
      <summary className="guidance__summary">
        {pl.guidance.title}
        <span className="guidance__state muted">
          {value.trim().length === 0 ? pl.guidance.empty : value.trim().split('\n')[0]}
        </span>
      </summary>

      <div className="guidance__body">
        <p className="muted guidance__hint">{pl.guidance.hint}</p>
        <textarea
          className="textarea guidance__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={pl.guidance.placeholder}
          rows={4}
          disabled={saving || busy}
        />
        <div className="guidance__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void save()}
            disabled={!dirty || saving || busy}
          >
            {saving ? pl.app.loading : pl.common.save}
          </button>
          {note ? (
            <span className="muted" role="status">
              {note}
            </span>
          ) : null}
        </div>
      </div>
    </details>
  );
}
