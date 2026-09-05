import { useEffect, useRef, useState } from 'react';
import { ModelError, testApiKey, type ImageSize } from '../api/google';
import { pl } from '../i18n/pl';
import { clearApiKey, getApiKey, getImageSize, setApiKey, setImageSize } from '../state/settings';

/**
 * F-3.1/F-3.2/F-3.3 — the lecturer's API key, and the resolution their images
 * are generated at.
 *
 * The key is read from and written to `localStorage` through `settings.ts` and
 * goes nowhere else. "Testuj klucz" sends it to Google and nowhere else. It is
 * never put in a URL, never logged, and never reaches a Netlify Function.
 *
 * **The resolution saves on change; the key needs "Zapisz".** They are not
 * inconsistent for the sake of it: the key is typed, long and easy to get half
 * right, so it wants a deliberate save. The resolution is one of two values
 * picked from a list, with nothing to mistype and nothing to half-finish.
 *
 * A native <dialog> carries its own modality: Esc closes it, focus stays inside
 * and the rest of the page is inert, with no library and no focus-trap of ours
 * to get subtly wrong.
 */

type Status = { tone: 'ok' | 'error' | 'info'; text: string } | null;

export default function GearSettingsDialog() {
  const ref = useRef<HTMLDialogElement>(null);

  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [size, setSize] = useState<ImageSize>(getImageSize);

  // Whether what is typed differs from what is stored (F-3.1).
  const stored = getApiKey() ?? '';
  const dirty = value.trim() !== stored.trim();

  function open() {
    setValue(getApiKey() ?? '');
    // Re-read rather than trusting the last render: another tab on the same
    // laptop may have changed it.
    setSize(getImageSize());
    setRevealed(false);
    setStatus(null);
    ref.current?.showModal();
  }

  function close() {
    ref.current?.close();
  }

  // Reset the visible key when the dialog closes, so it is not sitting in the
  // DOM of a projected screen between uses.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const onClose = () => {
      setValue('');
      setRevealed(false);
    };

    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, []);

  function save() {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setStatus({ tone: 'error', text: pl.settings.keyMissing });
      return;
    }
    setApiKey(trimmed);
    setStatus({ tone: 'ok', text: pl.settings.saved });
  }

  function forget() {
    clearApiKey();
    setValue('');
    setStatus({ tone: 'info', text: pl.settings.cleared });
  }

  function chooseSize(next: ImageSize) {
    setSize(next);
    setImageSize(next);
    setStatus({ tone: 'ok', text: pl.settings.imageSizeSaved });
  }

  async function test() {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setStatus({ tone: 'error', text: pl.settings.keyMissing });
      return;
    }

    setTesting(true);
    setStatus({ tone: 'info', text: pl.settings.testing });

    try {
      await testApiKey(trimmed);
      setStatus({
        tone: 'ok',
        text: dirty ? `${pl.settings.keyOk} ${pl.settings.unsaved}` : pl.settings.keyOk,
      });
    } catch (err) {
      const reason = err instanceof ModelError ? err.message : pl.errors.network;
      setStatus({ tone: 'error', text: `${pl.settings.keyFailed} ${reason}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <button type="button" className="gear" onClick={open} title={pl.settings.open}>
        <span className="visually-hidden">{pl.settings.open}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Zm7.43-2.53a7.6 7.6 0 0 0 0-1.94l2-1.55a.5.5 0 0 0 .12-.62l-1.9-3.28a.5.5 0 0 0-.6-.22l-2.35.94a7.3 7.3 0 0 0-1.68-.97l-.36-2.5a.5.5 0 0 0-.49-.43h-3.8a.5.5 0 0 0-.49.43l-.36 2.5a7.3 7.3 0 0 0-1.68.97l-2.35-.94a.5.5 0 0 0-.6.22L2.7 8.86a.5.5 0 0 0 .12.62l2 1.55a7.6 7.6 0 0 0 0 1.94l-2 1.55a.5.5 0 0 0-.12.62l1.9 3.28a.5.5 0 0 0 .6.22l2.35-.94a7.3 7.3 0 0 0 1.68.97l.36 2.5a.5.5 0 0 0 .49.43h3.8a.5.5 0 0 0 .49-.43l.36-2.5a7.3 7.3 0 0 0 1.68-.97l2.35.94a.5.5 0 0 0 .6-.22l1.9-3.28a.5.5 0 0 0-.12-.62Z"
          />
        </svg>
      </button>

      <dialog ref={ref} className="settings" aria-label={pl.settings.title}>
        <form
          method="dialog"
          className="settings__body"
          onSubmit={(event) => {
            // Enter in the field should save, not silently dismiss the dialog.
            event.preventDefault();
            save();
          }}
        >
          <h2 className="settings__title">{pl.settings.title}</h2>

          <div className="field">
            <label htmlFor="api-key">{pl.settings.apiKeyLabel}</label>

            <div className="settings__key">
              <input
                id="api-key"
                className="input"
                type={revealed ? 'text' : 'password'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={pl.settings.placeholder}
                autoComplete="off"
                spellCheck={false}
                disabled={testing}
              />
              <button
                type="button"
                className="btn"
                onClick={() => setRevealed(!revealed)}
                disabled={value.length === 0}
              >
                {revealed ? pl.settings.hide : pl.settings.reveal}
              </button>
            </div>

            <p className="muted">{pl.settings.apiKeyHint}</p>
          </div>

          <div className="field">
            <label htmlFor="image-size">{pl.settings.imageSizeLabel}</label>

            <select
              id="image-size"
              className="input"
              value={size}
              onChange={(event) => chooseSize(event.target.value as ImageSize)}
              disabled={testing}
            >
              <option value="1K">{pl.settings.imageSize1K}</option>
              <option value="2K">{pl.settings.imageSize2K}</option>
            </select>

            <p className="muted">{pl.settings.imageSizeHint}</p>
          </div>

          {status ? (
            <p
              className={status.tone === 'error' ? 'error-text' : 'muted'}
              role={status.tone === 'error' ? 'alert' : 'status'}
            >
              {status.text}
            </p>
          ) : null}

          <p className="settings__privacy">{pl.settings.privacy}</p>

          <div className="settings__actions">
            <button type="submit" className="btn btn--primary" disabled={testing}>
              {pl.common.save}
            </button>
            <button type="button" className="btn" onClick={() => void test()} disabled={testing}>
              {pl.settings.testKey}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={forget}
              disabled={testing || stored.length === 0}
            >
              {pl.settings.clearKey}
            </button>
            <button type="button" className="btn settings__close" onClick={close}>
              {pl.common.close}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
