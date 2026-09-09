import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

/** A drop-up of actions behind one button ("Cofnij do…"). */
interface Menu {
  label: string;
  items: Action[];
}

interface ControlBarProps {
  stageLabel: string;
  actions: Action[];
  /** Rendered after the actions; hidden when it has no items. */
  menu?: Menu;
  busy?: boolean;
  error?: string | null;
}

/** How long a pending confirmation stays armed before returning to normal. */
const CONFIRM_TIMEOUT_MS = 5000;

export default function ControlBar({ stageLabel, actions, menu, busy, error }: ControlBarProps) {
  const [pending, setPending] = useState<string | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (pending === null) return;
    const timer = window.setTimeout(() => setPending(null), CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  // The menu closes on a click anywhere else, the way a menu is expected to.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = menuRef.current;
      if (el?.open && event.target instanceof Node && !el.contains(event.target)) el.open = false;
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function activate(action: Action) {
    if (action.confirm && pending !== action.key) {
      setPending(action.key);
      return;
    }
    setPending(null);
    if (menuRef.current) menuRef.current.open = false;
    action.onSelect();
  }

  function button(action: Action) {
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
  }

  return (
    <div className="control-bar">
      {/* The way back to the session list from any stage. No confirmation:
          nothing is lost, the session stays in whatever stage it is in. */}
      <Link to="/admin" className="control-bar__home" title={pl.admin.backToList}>
        <Logo className="control-bar__logo" />
      </Link>
      <span className="control-bar__rule" aria-hidden="true" />
      <span className="control-bar__stage">{stageLabel}</span>

      <div className="control-bar__actions">
        {actions.map(button)}

        {menu && menu.items.length > 0 ? (
          <details className="control-bar__menu" ref={menuRef}>
            <summary className="btn control-bar__menu-button">{menu.label}</summary>
            <div className="control-bar__menu-list" role="menu">
              {menu.items.map(button)}
            </div>
          </details>
        ) : null}
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
