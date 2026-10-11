import type { ShowcaseItemDto } from '../../../api/generated';
import type { CatalogView, MotionStyle } from '../../../supplier/cabinetDesign';
import { Reveal } from '../../../ui/Reveal';
import { cn } from '../../../ui/cn';
import { TemplateTile } from '../tiles/TemplateTile';

/** С каких ширин колонки витрина шаблона встаёт в три, четыре и пять карточек. */
export const THREE_FROM = 780;
const FOUR_FROM = 1040;
const FIVE_FROM = 1240;

/** Классы колонок литералами: Tailwind находит классы по тексту исходника. */
const TEMPLATE_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1 gap-4',
  2: 'grid-cols-2 gap-3',
  3: 'grid-cols-3 gap-[18px]',
  4: 'grid-cols-4 gap-[18px]',
  5: 'grid-cols-5 gap-[18px]',
};

/**
 * Сколько карточек в ряд у плитки шаблона — как в макете: обычная плитка
 * пятью в ряд там, где меню не отнимает ширину, и четырьмя рядом с колонкой;
 * мелкая — пятью; крупные фото — тремя. Меряется колонка витрины, а не окно:
 * у раскладки с колонкой разделов места меньше, и число выходит само.
 */
function templateColumns(view: CatalogView, width: number): number {
  if (width < THREE_FROM) return 2;
  if (view === 'big') return width >= FOUR_FROM ? 3 : 2;
  if (view === 'grid4') return width >= FIVE_FROM - 140 ? 5 : width >= FOUR_FROM - 120 ? 4 : 3;
  return width >= FIVE_FROM ? 5 : width >= FOUR_FROM ? 4 : 3;
}

/**
 * Высота снимка плитки в `rem` по виду витрины — 190, 280 и 150 точек, как
 * в макете; на узкой колонке снимки ниже.
 */
function templatePhoto(view: CatalogView, width: number): number {
  const narrow = width < THREE_FROM;
  if (view === 'big') return narrow ? 12 : 17.5;
  if (view === 'grid4') return narrow ? 8.5 : 9.375;
  return narrow ? 8.5 : 11.875;
}

/** Плитка шаблона сеткой — виды «карточки», «крупные фото» и «мелкая сетка». */
export function GridView({
  items,
  taken,
  style,
  view,
  width,
}: {
  items: ShowcaseItemDto[];
  taken: Set<string>;
  style: MotionStyle;
  view: CatalogView;
  width: number;
}) {
  const columns = templateColumns(view, width);
  const photo = templatePhoto(view, width);
  return (
    <div data-testid="item-grid" data-view={view} className={cn('grid content-start', TEMPLATE_COLUMNS[columns])}>
      {items.map((item, index) => (
        <Reveal key={item.id} index={index}>
          <TemplateTile item={item} taken={taken} tile={style.tile} price={style.price} photo={photo} />
        </Reveal>
      ))}
    </div>
  );
}
