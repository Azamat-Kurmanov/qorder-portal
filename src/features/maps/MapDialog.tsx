import * as Dialog from '@radix-ui/react-dialog';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * Окно с картой: заголовок, кнопка «развернуть на весь экран» и место под карту.
 * Общее у выбора адреса и у просмотра — оба окна ведут себя одинаково.
 *
 * На Radix, как и лист кабинета: ловушка и возврат фокуса, Esc, блокировка
 * прокрутки под окном. `children` получает, развёрнуто ли окно, — чтобы карта
 * растянулась; `onResize` зовётся, когда размер рамки уже сменился.
 */
export function MapDialog({ title, onClose, onResize, children }: {
  title: string;
  onClose: () => void;
  onResize: () => void;
  children: (expanded: boolean) => ReactNode;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const resizeRef = useRef(onResize);
  resizeRef.current = onResize;
  // Карта узнаёт новый размер после перерисовки рамки, а не до неё.
  useEffect(() => {
    const frame = requestAnimationFrame(() => resizeRef.current());
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/40 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          // Нажатия внутри окна не доходят до блока, из которого его открыли:
          // React ведёт события через портал по дереву компонентов.
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'fixed z-50 flex flex-col gap-3 bg-surface p-4 shadow-[var(--shadow-float)] sm:p-6',
            expanded
              ? 'inset-0'
              : 'left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[760px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-gallery)]',
          )}
        >
          <div className="flex items-center gap-2">
            <Dialog.Title className="m-0 grow text-base font-semibold text-ink">
              {t('maps.dialogTitle', { title })}
            </Dialog.Title>
            <Button type="button" variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? t('maps.restore') : t('maps.expand')}
              title={expanded ? t('maps.restore') : t('maps.expand')}>
              {expanded ? <Minimize2 aria-hidden="true" className="size-5" /> : <Maximize2 aria-hidden="true" className="size-5" />}
            </Button>
          </div>
          {children(expanded)}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Класс рамки карты: обычная высота или вся свободная высота развёрнутого окна.
 * Рамка — внешняя: сам элемент карты внутри неё принадлежит Leaflet, и смена
 * его `className` из React стёрла бы классы, которые Leaflet на него повесил.
 */
export function mapBoxClass(expanded: boolean): string {
  return cn('w-full overflow-hidden rounded-[var(--radius-control)] border border-hairline',
    expanded ? 'min-h-0 flex-1' : 'h-[420px] max-h-[50dvh]');
}
