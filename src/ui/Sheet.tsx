import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';
import { X } from './icons';

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
type Side = 'bottom' | 'left' | 'right';

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
    // Колонкой: содержимое может занять остаток высоты под заголовком и прокручиваться само,
    // а кнопки внизу — остаться на месте (панель «Все фильтры» каталога).
    'inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col',
    'rounded-r-[var(--radius-gallery)] border-r',
    'px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]',
  ),
  // Справа — «Фильтры» каталога на мониторе (вариант В, решение владельца 2026-11-05).
  right: cn(
    'inset-y-0 right-0 flex w-[26rem] max-w-[90vw] flex-col',
    'rounded-l-[var(--radius-gallery)] border-l',
    'px-6 pb-6 pt-5',
  ),
};

export function Sheet({
  open,
  onOpenChange,
  title,
  side = 'bottom',
  returnFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Откуда выезжает. По умолчанию снизу — так открыты корзина и уведомления. */
  side?: Side;
  /** Куда вернуть фокус после закрытия, когда кнопки-триггера у листа нет. */
  returnFocus?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/40 dark:bg-black/60" />

        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={returnFocus ? (event) => { event.preventDefault(); returnFocus(); } : undefined}
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
          {/* Крестик — на мониторе: там закрывают мышью, а у листа телефона есть ручка и касание мимо. */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={t('sheet.close')}
              className="-mr-2 -mt-2 hidden size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:flex"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
