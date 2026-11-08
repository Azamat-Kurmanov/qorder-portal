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
        'relative h-[1.75rem] w-[3.25rem] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        on ? 'bg-in-stock' : 'bg-ink-faint',
      )}
    >
      {/* Все размеры в rem: кружок в rem внутри дорожки в px вылезал за край при крупном шрифте корня. */}
      <span className={cn('absolute top-[0.1875rem] size-[1.375rem] rounded-full bg-white shadow-soft transition-[left]', on ? 'left-[1.6875rem]' : 'left-[0.1875rem]')} />
    </button>
  );
}
