import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';

/**
 * Метка «4 цвета» на фото карточки в сетке — по макету «Каталог v2».
 *
 * Число приходит с сервера готовым (`colorCount`): варианты — это соседние
 * позиции с тем же названием, и считать их на странице значило бы тянуть
 * в сетку чужие строки. Сервер отдаёт число только при двух цветах и больше,
 * но проверка стоит и здесь: «1 цвет» на фото — не выбор, а шум.
 *
 * Только цвета, не размеры: кружок на метке обещает выбор цвета кружками
 * в карточке (VariantPicker), а размеры там выбирают плашками. Варианты,
 * различающиеся одним размером, метки не получают — о них скажет карточка.
 */
export function ColourCountBadge({ count, className }: { count: number | undefined; className?: string }) {
  const { t } = useTranslation();
  if (count === undefined || count < 2) return null;
  return (
    <span
      data-testid="colour-count"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-surface/90 py-1 pl-1.5 pr-2.5 text-caption font-semibold text-ink shadow-soft backdrop-blur-sm',
        className,
      )}
    >
      {/* Кружок радугой: цвета позиции сетка не знает, а выдумывать их нельзя. */}
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 rounded-full"
        style={{ background: 'conic-gradient(#C8423B, #E6C34A, #4E8A4B, #2F5DA8, #7E5AA6, #C8423B)' }}
      />
      {t('catalog.colours', { count })}
    </span>
  );
}
