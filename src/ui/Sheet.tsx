import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Выдвижной лист: снизу или слева.
 *
 * На Radix, а не на системном диалоге браузера: `alert`, `confirm` и модальные
 * окна браузера в кабинете запрещены — в WebView они выглядят чужеродно
 * и блокируют страницу. Radix даёт то, чего у самодельной обёртки
 * не бывает: возврат фокуса, ловушку фокуса, закрытие по Esc и блокировку
 * прокрутки под листом.
 *
 * Сторона — не украшение, а сообщение о том, что внутри. Снизу приходит то,
 * что относится к открытому экрану: корзина, уведомления, — и приходит
 * оттуда же, откуда его позвал большой палец с нижнего края. Слева приходит
 * то, что экран меняет: разделы кабинета. Слева же они стоят постоянной
 * колонкой на мониторе, и приезжающие снизу разделы означали бы, что на
 * телефоне и на мониторе навигация живёт в разных местах.
 *
 * Движение — ключевыми кадрами из `index.css`, а не библиотекой анимации.
 * Библиотека задавала положение инлайновым `transform`, и лист, у которого
 * анимация не началась, оставался на стартовом сдвиге — за краем экрана.
 * Положение покоя обязано задаваться разметкой, а сдвиг — жить только внутри
 * анимации: тогда несработавшее движение стоит зрелища, а не работы.
 */
type Side = 'bottom' | 'left';

/** Геометрия по стороне. Само движение подхватывается по `data-side`. */
const SIDES: Record<Side, string> = {
  bottom: cn(
    'inset-x-0 bottom-0 max-h-[85dvh]',
    'rounded-t-[var(--radius-gallery)] border-t',
    'px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3',
    // Во всю ширину — только на телефоне: на мониторе лист шириной в экран
    // растягивал короткие строки на метр, поэтому там он — окно по центру.
    'lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2',
    'lg:w-[min(32rem,calc(100vw-2rem))] lg:rounded-[calc(var(--radius-gallery)*7/6)] lg:border lg:p-6 lg:shadow-float',
  ),
  left: cn(
    // Ширина потолком, а не заданным размером: на 320px колонка в 288
    // не оставила бы видимой страницы под собой, и лист читался бы
    // полноэкранным окном, из которого не выйти касанием мимо.
    'inset-y-0 left-0 w-72 max-w-[85vw]',
    'rounded-r-[var(--radius-gallery)] border-r',
    'px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]',
  ),
};

export function Sheet({
  open,
  onOpenChange,
  title,
  side = 'bottom',
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Откуда выезжает. По умолчанию снизу — так открыты корзина и уведомления. */
  side?: Side;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/40 dark:bg-black/60" />

        <Dialog.Content
          aria-describedby={undefined}
          data-side={side}
          className={cn(
            'qo-sheet fixed z-50 overflow-y-auto border-hairline bg-surface',
            SIDES[side],
          )}
        >
          {/*
            Полоска-ручка подсказывает, что лист тянется вниз, и стоит
            только у нижнего: у бокового она обещала бы жест, которого
            там нет.
          */}
          {side === 'bottom' ? (
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline lg:hidden" />
          ) : null}
          <Dialog.Title className="mb-3 text-base font-semibold text-ink">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
