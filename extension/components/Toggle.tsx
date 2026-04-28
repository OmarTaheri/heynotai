interface Props {
  on: boolean;
  onChange: () => void;
  label?: string;
}

export function Toggle({ on, onChange, label }: Props) {
  return (
    <button
      type="button"
      className={`toggle${on ? ' on' : ''}`}
      onClick={onChange}
      aria-label={label ?? 'Toggle'}
      aria-pressed={on}
    >
      <span className="knob" />
    </button>
  );
}
