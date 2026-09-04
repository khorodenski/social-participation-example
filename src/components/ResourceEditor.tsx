import { useRef, useState } from 'react';
import { assetUrl } from '../api/client';
import { uploadResourceImage } from '../api/images';
import { pl } from '../i18n/pl';
import {
  addResource,
  moveResource,
  newImageResource,
  newResourceId,
  newTextResource,
  referenceCount,
  removeResource,
  updateResource,
} from '../state/resources';
import type { Resource } from '../state/session';

/**
 * F-2.1..F-2.4 — the lecturer's materials about the place.
 *
 * This is a draft editor, not an auto-saver: every change here goes into the
 * caller's draft and is persisted by the setup screen's single "Zapisz". The
 * one exception is a photograph, whose two JPEGs are uploaded the moment it is
 * chosen — a canvas resize and two `PUT`s cannot wait behind a text field, and
 * the resource that carries the resulting keys is what stays a draft.
 *
 * That leaves one loose end by design: a photograph uploaded and then never
 * saved is an orphan blob. The assets endpoint has no `DELETE` (see M2-1), and
 * for a short-lived showcase an orphan JPEG is cheaper than an endpoint that
 * can delete things.
 *
 * The list's order is not decoration: `buildExpansionContents` sends the
 * materials to the model in exactly this order.
 */

interface ResourceEditorProps {
  sessionId: string;
  resources: Resource[];
  /**
   * Takes an updater rather than an array, so the upload — which finishes
   * whenever it finishes — merges into whatever the draft holds by then
   * instead of overwriting edits made while it ran.
   */
  onChange: (update: (current: Resource[]) => Resource[]) => void;
  disabled?: boolean;
}

interface ResourceRowProps {
  resource: Resource;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onPatch: (patch: Partial<Omit<Resource, 'id' | 'type'>>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

function ResourceRow({
  resource,
  first,
  last,
  disabled,
  onPatch,
  onMove,
  onRemove,
}: ResourceRowProps) {
  // Deleting a material is one click and there is no undo, so it arms first —
  // the same two-step the control bar's destructive actions use.
  const [confirming, setConfirming] = useState(false);

  const isImage = resource.type === 'image';
  const thumbKey = resource.previewKey ?? resource.imageKey ?? null;

  return (
    <li className="resource">
      <div className="resource__preview">
        {isImage && thumbKey ? (
          <img className="resource__thumb" src={assetUrl(thumbKey)} alt={resource.description} />
        ) : (
          <span className="resource__badge">
            {isImage ? pl.resources.imageMissing : pl.resources.typeText}
          </span>
        )}
      </div>

      <div className="resource__body">
        <div className="field">
          <label htmlFor={`desc-${resource.id}`}>{pl.resources.description}</label>
          <input
            id={`desc-${resource.id}`}
            className="input"
            value={resource.description}
            onChange={(event) => onPatch({ description: event.target.value })}
            placeholder={pl.resources.descriptionPlaceholder}
            disabled={disabled}
          />
        </div>

        {resource.type === 'text' ? (
          <div className="field">
            <label htmlFor={`text-${resource.id}`}>{pl.resources.text}</label>
            <textarea
              id={`text-${resource.id}`}
              className="textarea resource__text"
              value={resource.text ?? ''}
              onChange={(event) => onPatch({ text: event.target.value })}
              placeholder={pl.resources.textPlaceholder}
              disabled={disabled}
            />
          </div>
        ) : (
          // F-2.3 — only a marked photograph reaches the image model. Every
          // image is read during expansion regardless, so this is not "use it"
          // but "let the picture itself be copied from".
          <label className="resource__reference">
            <input
              type="checkbox"
              checked={resource.useAsReference}
              onChange={(event) => onPatch({ useAsReference: event.target.checked })}
              disabled={disabled}
            />
            {pl.resources.useAsReference}
          </label>
        )}
      </div>

      <div className="resource__side">
        <button
          type="button"
          className="btn resource__nudge"
          onClick={() => onMove(-1)}
          disabled={disabled || first}
          title={pl.resources.moveUp}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn resource__nudge"
          onClick={() => onMove(1)}
          disabled={disabled || last}
          title={pl.resources.moveDown}
        >
          ↓
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => (confirming ? onRemove() : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          disabled={disabled}
        >
          {confirming ? pl.common.confirm : pl.resources.remove}
        </button>
      </div>
    </li>
  );
}

export default function ResourceEditor({
  sessionId,
  resources,
  onChange,
  disabled = false,
}: ResourceEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);

    try {
      // The id is chosen here so the same one names both blob keys and the
      // resource that points at them.
      const id = newResourceId();
      const stored = await uploadResourceImage(sessionId, id, file);
      onChange((current) => addResource(current, newImageResource(stored, id)));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : pl.resources.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  const references = referenceCount(resources);
  const busy = disabled || uploading;

  return (
    <section className="resources">
      <header className="resources__head">
        <h2 className="resources__title">{pl.resources.title}</h2>
        <p className="muted">{pl.resources.hint}</p>
      </header>

      {resources.length === 0 ? (
        <p className="muted">{pl.resources.empty}</p>
      ) : (
        <ul className="resources__list">
          {resources.map((resource, index) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              first={index === 0}
              last={index === resources.length - 1}
              disabled={busy}
              onPatch={(patch) =>
                onChange((current) => updateResource(current, resource.id, patch))
              }
              onMove={(delta) => onChange((current) => moveResource(current, resource.id, delta))}
              onRemove={() => onChange((current) => removeResource(current, resource.id))}
            />
          ))}
        </ul>
      )}

      <div className="resources__add">
        <button
          type="button"
          className="btn"
          onClick={() => onChange((current) => addResource(current, newTextResource()))}
          disabled={busy}
        >
          {pl.resources.addText}
        </button>

        {/* A styled button in front of the file input: the native control
            cannot be restyled, and this bar is on a projected screen. */}
        <button
          type="button"
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {pl.resources.addImage}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="resources__file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file twice fires `change` again.
            event.target.value = '';
            if (file) void upload(file);
          }}
        />

        {uploading ? <span className="muted">{pl.resources.uploading}</span> : null}

        {references > 0 ? (
          <span className="resources__references">
            {pl.resources.referenceCount}: {references}
          </span>
        ) : null}
      </div>

      {uploadError ? (
        <p className="error-text" role="alert">
          {uploadError}
        </p>
      ) : null}
    </section>
  );
}
