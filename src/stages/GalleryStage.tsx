import { useCallback, useEffect, useRef, useState } from 'react';
import { assetUrl } from '../api/client';
import { pl } from '../i18n/pl';
import { galleryItems, stepIndex } from '../state/gallery';
import { generatedImageSrc } from '../state/visualize';
import type { Session } from '../state/session';

/**
 * F-9.1..F-9.3 — the last screen: three pictures side by side, each with its
 * group label, and any of them fullscreen on a click.
 *
 * Fullscreen is attempted through the real API and falls back to a fixed
 * overlay, so the viewer works the same either way and the keyboard handling
 * has one code path rather than two. On a projector the difference between the
 * two is whether the browser chrome is still visible.
 */

export default function GalleryStage({ session }: { session: Session }) {
  const items = galleryItems(session);

  const [openAt, setOpenAt] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpenAt(null);
    // Leaving the element fullscreen behind would keep a black screen after the
    // overlay unmounts.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const open = useCallback((index: number) => {
    setOpenAt(index);
  }, []);

  // Requesting fullscreen after the overlay exists, because the element has to
  // be in the document. A rejection is fine: the overlay is the fallback, and
  // it already covers the screen.
  useEffect(() => {
    if (openAt === null) return;
    const el = viewerRef.current;
    if (!el || document.fullscreenElement) return;
    void el.requestFullscreen?.().catch(() => {});
  }, [openAt]);

  // The browser handles Esc itself while natively fullscreen, so our keydown
  // may never fire. This is what actually closes the viewer in that case.
  useEffect(() => {
    // Fires on entering too, where `fullscreenElement` is set and this is a
    // no-op. Only leaving it closes the viewer.
    const onChange = () => {
      if (!document.fullscreenElement) setOpenAt(null);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // F-9.3 — arrows navigate, Esc closes.
  useEffect(() => {
    if (openAt === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (delta === 0) return;

      event.preventDefault();
      setOpenAt((current) => (current === null ? null : stepIndex(current, items.length, delta)));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAt, items.length, close]);

  if (items.length === 0) {
    return (
      <section className="page--stage">
        <h1 className="stage-title">{pl.stages.gallery}</h1>
        <p className="muted">{pl.gallery.noImages}</p>
      </section>
    );
  }

  const at = openAt;
  const shown = at === null ? undefined : items[at];

  return (
    <section className="gallery">
      <ul className="gallery__row">
        {items.map((item, index) => (
          <li key={item.group.id} className="gallery__cell">
            <button
              type="button"
              className="gallery__open"
              onClick={() => open(index)}
              title={pl.gallery.open}
            >
              <img
                className="gallery__img"
                src={generatedImageSrc(assetUrl(item.image.imageKey), item.image.createdAt)}
                alt={item.group.label}
              />
              <span className="gallery__label">{item.group.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="muted gallery__hint">{pl.gallery.hint}</p>

      {shown !== undefined && at !== null ? (
        <div
          className="viewer"
          ref={viewerRef}
          role="dialog"
          aria-modal="true"
          aria-label={shown.group.label}
        >
          <img
            className="viewer__img"
            src={generatedImageSrc(assetUrl(shown.image.imageKey), shown.image.createdAt)}
            alt={shown.group.label}
          />

          {/* F-9.2 — a small label overlay, bottom-centre. */}
          <p className="viewer__label">{shown.group.label}</p>

          {items.length > 1 ? (
            <>
              <button
                type="button"
                className="viewer__arrow viewer__arrow--prev"
                onClick={() => setOpenAt(stepIndex(at, items.length, -1))}
                aria-label={pl.gallery.previous}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                type="button"
                className="viewer__arrow viewer__arrow--next"
                onClick={() => setOpenAt(stepIndex(at, items.length, 1))}
                aria-label={pl.gallery.next}
              >
                <span aria-hidden="true">›</span>
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="viewer__close"
            onClick={close}
            aria-label={pl.common.close}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
