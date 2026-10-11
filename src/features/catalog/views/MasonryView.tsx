import type { ShowcaseItemDto } from '../../../api/generated';
import type { MotionStyle } from '../../../supplier/cabinetDesign';
import { cn } from '../../../ui/cn';
import { TemplateTile } from '../tiles/TemplateTile';
import { THREE_FROM } from './GridView';

/** С какой ширины колонки мозаика встаёт в четыре колонки — как в макете рядом с колонкой «разворота». */
const FOUR_FROM = 960;

/**
 * Высоты снимков мозаики по кругу — те же, что в макете (240, 180, 300,
 * 200, 260, 170 точек), в `rem`: при крупном шрифте карточки растут целиком.
 */
const TALL = [15, 11.25, 18.75, 12.5, 16.25, 10.625];
const SHORT = [10.5, 8, 12.5, 9, 11.25, 7.5];

/**
 * Мозаика — колонки карточек разной высоты, как доска вдохновения
 * («Крафт», «Стекло»). Колонками CSS, а не сеткой: сетка выровняла бы ряды
 * по самой высокой карточке и мозаики бы не вышло. Порядок при этом идёт
 * сверху вниз по колонке — для витрины без ранжирования это не помеха.
 */
export function MasonryView({
  items,
  taken,
  style,
  width,
}: {
  items: ShowcaseItemDto[];
  taken: Set<string>;
  style: MotionStyle;
  width: number;
}) {
  const columns = width >= FOUR_FROM ? 'columns-4 gap-[18px]' : width >= THREE_FROM ? 'columns-3 gap-[18px]' : 'columns-2 gap-3';
  const heights = width >= THREE_FROM ? TALL : SHORT;
  return (
    <div data-testid="item-grid" data-view="masonry" className={columns}>
      {items.map((item, index) => (
        <div key={item.id} className={cn('break-inside-avoid', width >= THREE_FROM ? 'mb-[18px]' : 'mb-3')}>
          <TemplateTile
            item={item}
            taken={taken}
            tile={style.tile}
            price={style.price}
            photo={heights[index % heights.length]}
          />
        </div>
      ))}
    </div>
  );
}
