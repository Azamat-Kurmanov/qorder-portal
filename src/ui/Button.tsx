import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

/**
 * Кнопка кабинета.
 *
 * Высота 44 точки во всех размерах, кроме мелкого: кабинет открывают пальцем,
 * и цель меньше сорока четырёх точек промахивается. Задана она в `rem`
 * (`h-11`), а не числом, — при крупном шрифте кнопка растёт вместе с буквами,
 * иначе крупный текст оказался бы набит в прежнюю тесную рамку.
 *
 * Кнопка отвечает пальцу тремя способами, и все три — обратная связь,
 * а не украшение:
 *
 * — `active:scale-95`: нажатие видно раньше, чем придёт ответ сервера.
 *   На мобильной сети это единственное, что происходит в первые полсекунды;
 * — подъём с тенью при наведении: там, где есть мышь, кнопка приподнимается
 *   навстречу курсору — так видно, что цель захвачена, ещё до нажатия;
 * — блик (`qo-shine`): свет проходит по заливке один раз при наведении.
 *   Только у сплошных вариантов — по прозрачному блик проходить нечему,
 *   и на «призрачной» кнопке он выглядел бы засветкой.
 *
 * Всё движение гасится системной настройкой «меньше движения» — правилом
 * в `index.css`, одним на весь кабинет.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ' +
    'transition-all duration-300 ease-out active:scale-95 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 ' +
    // Отключённая кнопка не поднимается и не светится: движение обещало бы,
    // что нажатие сработает.
    'disabled:shadow-none disabled:hover:translate-y-0',
  {
    variants: {
      variant: {
        /* Чернила: главное действие экрана, у которого нет денежного веса, —
           «Оформить», «Сохранить», «Отправить». */
        primary:
          'qo-shine bg-ink text-white shadow-soft hover:bg-ink/90 hover:shadow-lift hover:-translate-y-0.5',
        /*
         * Терракота: действие, которым дело заканчивается, — «Оформить
         * заявку» и «В корзину» на карточке товара.
         *
         * Заливка градиентом, а не плоским цветом: плоская терракота на
         * кремовой бумаге выглядит наклейкой, а градиент от светлого к
         * тёмному сверху вниз читается как выпуклая клавиша. Тень под ней
         * своего цвета (`shadow-accent`): серая тень под тёплой заливкой —
         * это грязь, а не тень.
         *
         * Достаётся ОДНОМУ действию на экране, и это не вкусовое ограничение.
         * На витрине «В корзину» повторяется полсотни раз — залей их
         * терракотой, и главным окажется весь экран сразу, то есть ничто.
         * Там у той же кнопки мягкий вариант (`soft`): он из той же тёплой
         * семьи, но не спорит с ценой за первый взгляд.
         */
        accent:
          'qo-shine bg-[linear-gradient(180deg,#C05411_0%,#A8450A_100%)] text-white ' +
          'shadow-accent hover:-translate-y-0.5 hover:brightness-110',
        outline: 'border border-ink bg-transparent text-ink hover:bg-ink/5 hover:border-ink',
        soft: 'bg-accent-soft text-accent hover:bg-accent-soft/70 hover:shadow-soft',
        ghost: 'text-ink-muted hover:bg-ink/5',
      },
      size: {
        md: 'h-11 rounded-[var(--radius-control)] px-5 text-sm',
        lg: 'h-13 rounded-[var(--radius-card)] px-6 text-base',
        /*
         * Размер для действия, которое ищут глазами, а не читают: «В корзину»
         * на карточке товара, «Оформить заявку» в панели итога. Пятьдесят
         * шесть точек — это не «крупнее ради красоты», а цель, в которую
         * попадают не глядя, на ходу и одной рукой.
         */
        xl: 'h-14 rounded-[var(--radius-card)] px-7 text-[1.0625rem]',
        icon: 'size-11 rounded-[var(--radius-control)]',
        chip: 'h-9 rounded-full px-4 text-[0.8125rem]',
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
