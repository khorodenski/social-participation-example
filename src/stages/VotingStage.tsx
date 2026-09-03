import { QRCodeSVG } from 'qrcode.react';
import { pl } from '../i18n/pl';
import { attendeeUrl, useIdeaCount } from '../state/useSession';
import type { Session } from '../state/session';

/**
 * F-4.1 — the full-screen voting stage: title, intro, a QR code big enough to
 * scan from the back of the hall, the URL in text for anyone whose camera
 * fails, and a live count of what has arrived.
 */
export default function VotingStage({ session }: { session: Session }) {
  const url = attendeeUrl(window.location.origin, session.id);
  const count = useIdeaCount(session.id, true);

  return (
    <section className="voting">
      <header className="voting__head">
        <h1 className="stage-title">{session.title}</h1>
        {session.intro ? <p className="stage-subtitle">{session.intro}</p> : null}
      </header>

      <div className="voting__body">
        <div className="voting__qr">
          {/* White quiet zone: projectors wash out a code drawn on dark ground. */}
          <QRCodeSVG value={url} size={420} level="M" marginSize={2} />
          <p className="voting__url">{url}</p>
          <p className="muted">{pl.voting.scanQr}</p>
        </div>

        <div className="voting__count" aria-live="polite">
          <span className="voting__count-number">{count ?? '—'}</span>
          <span className="voting__count-label">{pl.voting.ideasCount}</span>
        </div>
      </div>
    </section>
  );
}
