import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

/**
 * Кнопка кабинета.
 *
 * Высота 44px во всех размерах, кроме мелкого: кабинет открывают пальцем,
 * и цель меньше сорока четырёх точек промахивается.
 *
 * `active:scale-95` — нажатие видно раньше, чем придёт ответ сервера: на
 * мобильной сети это единственная обратная связь в первые полсекунды.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ' +
    'transition-all duration-300 active:scale-95 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:bg-ink/90',
        outline: 'border border-ink bg-transparent text-ink hover:bg-ink/5',
        soft: 'bg-accent-soft text-accent hover:bg-accent-soft/70',
        ghost: 'text-ink-muted hover:bg-ink/5',
      },
      size: {
        md: 'h-11 rounded-[var(--radius-control)] px-5 text-sm',
        lg: 'h-13 rounded-[var(--radius-card)] px-6 text-base',
        icon: 'size-11 rounded-[var(--radius-control)]',
        chip: 'h-9 rounded-full px-4 text-[13px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof button> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(button({ variant, size }), className)} {...props} />;
}
