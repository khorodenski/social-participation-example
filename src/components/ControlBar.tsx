import { useEffect, useState } from 'react';
import GearSettingsDialog from './GearSettingsDialog';
import Logo from './Logo';
import { pl } from '../i18n/pl';

/**
 * The lecturer's controls. Deliberately small and low-contrast: this bar is
 * projected alongside the stage content and should not compete with it (N-2).
 *
 * It is also where the brand mark lives on the projection. Putting it here
 * rather than on the stage means every stage carries it for free and none of
 * them can ever collide with a podium card or a gallery picture.
 */

interface Action {
  key: string;
  label: string;
  onSelect: () => void;
  /** F-4.5, F-1.3 — destructive steps ask "Czy na pewno?" once. */
  confirm?: boolean;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface ControlBarProps {
  stageLabel: string;
  actions: Action[];
  busy?: boolean;
  error?: string | null;
}

/** How long a pending confirmation stays armed before returning to normal. */
const CONFIRM_TIMEOUT_MS = 5000;

export default function ControlBar({ stageLabel, actions, busy, error }: ControlBarProps) {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (pending === null) return;
    const timer = window.setTimeout(() => setPending(null), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  function activate(action: Action) {
    if (action.confirm && pending !== action.key) {
      setPending(action.key);
      return;
    }
    setPending(null);
    action.onSelect();
  }

  return (
    <div className="control-bar">
      <Logo className="control-bar__logo" />
      <span className="control-bar__rule" aria-hidden="true" />
      <span className="control-bar__stage">{stageLabel}</span>

      <div className="control-bar__actions">
        {actions.map((action) => {
          const arming = pending === action.key;
          const classes = ['btn'];
          if (action.primary && !arming) classes.push('btn--primary');
          if (action.danger || arming) classes.push('btn--danger');

          return (
            <button
              key={action.key}
              type="button"
              className={classes.join(' ')}
              disabled={action.disabled || busy}
              onClick={() => activate(action)}
            >
              {arming ? pl.common.confirm : action.label}
            </button>
          );
        })}
      </div>

      {busy ? (
        <span className="control-bar__status" role="status">
          {pl.app.loading}
        </span>
      ) : null}

      {error ? (
        <span className="control-bar__status error-text" role="alert">
          {error}
        </span>
      ) : null}

      <GearSettingsDialog />
    </div>
  );
}
