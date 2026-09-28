import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import type { ItemCategoryDto, ShowcaseItemDto } from '../../../api/generated';
import type { TemplateStyle } from '../../../supplier/cabinetDesign';
import { cn } from '../../../ui/cn';
import { TemplateTile } from '../tiles/TemplateTile';
import { THREE_FROM } from './GridView';

interface Shelf {
  /** Рубрика; пусто — полка товаров без рубрики. */
  id?: string;
  title: string;
  items: ShowcaseItemDto[];
}

/**
 * Полки по рубрикам: заголовок, «Все →» и ряд карточек, который листается
 * вбок («Орбита», «Свежесть», «Уют»). Порядок полок — порядок рубрик
 * продавца; товары без рубрики — последней полкой «Другое».
 *
 * Полка — это обзор витрины. Когда человек уже выбрал рубрику, отбор или
 * ищет слово, полки ни к чему: витрина покажет найденное сеткой
 * (см. `CatalogPage`).
 */
export function ShelvesView({
  items,
  taken,
  style,
  width,
  categories,
  onOpenCategory,
}: {
  items: ShowcaseItemDto[];
  taken: Set<string>;
  style: TemplateStyle;
  width: number;
  categories: Pick<ItemCategoryDto, 'id' | 'name'>[];
  onOpenCategory: (id: string) => void;
}) {
  const { t } = useTranslation();
  const shelves = shelvesOf(items, categories, t('design.other'), t('design.allCategories'));
  return (
    <div data-testid="item-grid" data-view="shelves" className="flex flex-col gap-[30px]">
      {shelves.map((shelf) => (
        <ShelfRow
          key={shelf.id ?? 'other'}
          shelf={shelf}
          taken={taken}
          style={style}
          wide={width >= THREE_FROM}
          onAll={shelf.id ? () => onOpenCategory(shelf.id!) : undefined}
        />
      ))}
    </div>
  );
}

/** Товары по полкам — в порядке рубрик, пустые полки не рисуются. */
function shelvesOf(
  items: ShowcaseItemDto[],
  categories: Pick<ItemCategoryDto, 'id' | 'name'>[],
  otherTitle: string,
  allTitle: string,
): Shelf[] {
  const known = new Set(categories.map((category) => category.id));
  const shelves: Shelf[] = categories
    .map((category) => ({ id: category.id, title: category.name, items: items.filter((item) => item.categoryId === category.id) }))
    .filter((shelf) => shelf.items.length > 0);
  const rest = items.filter((item) => !item.categoryId || !known.has(item.categoryId));
  // Рубрик нет вовсе — одна полка «Все товары», а не «Другое»: другого нет.
  if (rest.length > 0) shelves.push({ title: shelves.length === 0 ? allTitle : otherTitle, items: rest });
  return shelves;
}

function ShelfRow({ shelf, taken, style, wide, onAll }: {
  shelf: Shelf;
  taken: Set<string>;
  style: TemplateStyle;
  wide: boolean;
  onAll?: () => void;
}) {
  const { t } = useTranslation();
  const row = useRef<HTMLDivElement>(null);
  // Стрелка листает полку на её ширину — как в макете, только настоящая.
  const scroll = () => row.current?.scrollBy?.({ left: row.current.clientWidth, behavior: 'smooth' });
  return (
    <section aria-label={t('design.shelf', { name: shelf.title })} className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="qo-heading text-xl text-ink">{shelf.title}</h2>
        {onAll ? (
          <button
            type="button"
            onClick={onAll}
            className="shrink-0 cursor-pointer text-caption font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('design.all')}
          </button>
        ) : null}
      </div>
      <div className="relative">
        <div
          ref={row}
          data-testid="shelf-row"
          className={cn(
            'flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            // Поля снизу и сбоку — под тень карточек: прокрутка обрезала бы её.
            wide ? '-mx-2 gap-4 px-2 pb-3' : '-mx-4 gap-3 px-4 pb-2',
          )}
        >
          {shelf.items.map((item) => (
            <div
              key={item.id}
              className={cn('shrink-0 snap-start', wide ? 'w-[calc((100%-4rem)/5)]' : 'w-[44%]')}
            >
              <TemplateTile item={item} taken={taken} tile={style.tile} price={style.price} photo={wide ? 9.375 : 8.5} />
            </div>
          ))}
        </div>
        {wide && shelf.items.length > 5 ? (
          <button
            type="button"
            onClick={scroll}
            aria-label={t('design.scrollShelf')}
            className="absolute -right-3.5 top-[4.375rem] flex size-10 cursor-pointer items-center justify-center rounded-full border border-hairline bg-surface text-ink shadow-[0_20px_50px_-30px_rgb(0_0_0/0.5)] hover:border-ink"
          >
            <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.4} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
