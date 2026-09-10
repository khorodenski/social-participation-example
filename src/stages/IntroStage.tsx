import { assetUrl } from '../api/client';
import { pl } from '../i18n/pl';
import { firstImage } from '../state/resources';
import type { Session } from '../state/session';

/**
 * The opener. The lecturer starts the lecture on this screen: the place as it
 * is today, its description, and the notes — before a QR code asks the room
 * for ideas about it.
 *
 * Everything on it is the session's own material; nothing is fetched and no
 * model is involved, so it is instant and reload-safe.
 */
export default function IntroStage({ session }: { session: Session }) {
  const photo = firstImage(session.resources);
  const others = session.resources.filter(
    (resource) => resource.type === 'image' && resource.imageKey && resource !== photo,
  );
  const notes = session.resources.filter(
    (resource) =>
      resource.type === 'text' && ((resource.text ?? '').trim() || resource.description.trim()),
  );

  return (
    <section className="intro">
      <header className="intro__head">
        <h1 className="stage-title">{session.title}</h1>
        {session.intro ? <p className="stage-subtitle">{session.intro}</p> : null}
      </header>

      <div className="intro__body">
        {photo?.imageKey ? (
          <figure className="intro__photo">
            <img src={assetUrl(photo.imageKey)} alt={photo.description || session.title} />
            {photo.description ? <figcaption>{photo.description}</figcaption> : null}
          </figure>
        ) : (
          <p className="muted intro__empty">{pl.intro.noImage}</p>
        )}

        {notes.length > 0 || others.length > 0 ? (
          <aside className="intro__aside">
            {notes.length > 0 ? (
              <section className="intro__notes">
                <h2 className="intro__heading">{pl.intro.notesTitle}</h2>
                <ul>
                  {notes.map((note) => (
                    <li key={note.id}>
                      {note.description ? <strong>{note.description}</strong> : null}
                      {note.text ? <p>{note.text}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {others.length > 0 ? (
              <section className="intro__more">
                <h2 className="intro__heading">{pl.intro.morePhotos}</h2>
                <ul>
                  {others.map((image) => (
                    <li key={image.id}>
                      <img
                        src={assetUrl(image.previewKey ?? (image.imageKey as string))}
                        alt={image.description || session.title}
                        title={image.description}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
