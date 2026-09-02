import { pl } from '../../i18n/pl';

/** Milestone 1 replaces this with the real session list + create form. */
export default function SessionList() {
  return (
    <main className="page page--narrow">
      <h1 className="stage-title">{pl.admin.listTitle}</h1>
      <p className="muted">{pl.admin.placeholder}</p>
    </main>
  );
}
