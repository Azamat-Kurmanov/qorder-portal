import { cn } from './cn';

/** Тумблер «вкл/выкл» (`role="switch"`): подпись — снаружи, через `aria-labelledby` или `aria-label`. */
export function Switch({ on, onToggle, disabled, labelledBy, label }: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  labelledBy?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'relative h-[30px] w-[52px] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        on ? 'bg-in-stock' : 'bg-ink-faint',
      )}
    >
      <span className={cn('absolute top-[3px] size-6 rounded-full bg-white shadow-soft transition-[left]', on ? 'left-[25px]' : 'left-[3px]')} />
    </button>
  );
}
