import { pl } from '../i18n/pl';

/** Minimal loading indicator; styled properly in Milestone 6. */
export default function Spinner({ label = pl.app.loading }: { label?: string }) {
  return (
    <p className="muted" role="status" aria-live="polite">
      {label}
    </p>
  );
}
