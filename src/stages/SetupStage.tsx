import { pl } from '../i18n/pl';
import type { Session } from '../state/session';

/**
 * Milestone 1/2 fills this in: editing the title and intro, then the context
 * resources. For now it shows what the session already holds, so the lecturer
 * can confirm they opened the right one before starting voting.
 */
export default function SetupStage({ session }: { session: Session }) {
  return (
    <section className="page--stage">
      <h1 className="stage-title">{session.title}</h1>
      {session.intro ? <p className="stage-subtitle">{session.intro}</p> : null}
      <p className="muted">
        {pl.stages.setup} · <code>{session.id}</code>
      </p>
    </section>
  );
}
