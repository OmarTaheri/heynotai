import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Option<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

interface Props<V extends string> {
  value: V;
  options: Option<V>[];
  onChange: (v: V) => void;
  buttonLabel?: (opt: Option<V>) => ReactNode;
  ariaLabel?: string;
}

export function Dropdown<V extends string>({
  value,
  options,
  onChange,
  buttonLabel,
  ariaLabel,
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0]!;

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className="dropdown-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dropdown-label">
          {buttonLabel ? buttonLabel(current) : current.label}
        </span>
        <Icon name="chevron-right" size={12} style={{ transform: 'rotate(90deg)' }} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              className={`dropdown-item${opt.value === value ? ' active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.icon}
              <span>{opt.label}</span>
              {opt.value === value && <Icon name="check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
