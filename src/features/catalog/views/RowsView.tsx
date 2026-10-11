import { Link } from 'react-router-dom';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { MotionStyle } from '../../../supplier/cabinetDesign';
import { Reveal } from '../../../ui/Reveal';
import { cn } from '../../../ui/cn';
import { FavoriteButton } from '../../favorites/FavoriteButton';
import { ItemThumb } from '../ItemThumb';
import { StockNote } from '../StockNote';
import { CartAction, ItemBadges, ItemFacts, RatingBadge, useOpenCard } from '../itemParts';
import { TemplatePrice } from '../tiles/TemplatePrice';
import { THREE_FROM } from './GridView';

/**
 * Карточки-строки в две колонки: снимок слева, артикул, имя, наличие
 * и покупка справа («Лофт», «Моно»). Строка читается как позиция прайса,
 * но со снимком. На узкой колонке — одна строка в ряд, снимок меньше.
 */
export function RowsView({
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
  const two = width >= THREE_FROM;
  return (
    <div data-testid="item-grid" data-view="rows" className={cn('grid content-start gap-[18px]', two ? 'grid-cols-2' : 'grid-cols-1')}>
      {items.map((item, index) => (
        <Reveal key={item.id} index={index}>
          <RowCard item={item} taken={taken.has(item.id)} style={style} roomy={two} />
        </Reveal>
      ))}
    </div>
  );
}

function RowCard({ item, taken, style, roomy }: {
  item: ShowcaseItemDto;
  taken: boolean;
  style: MotionStyle;
  roomy: boolean;
}) {
  const openCard = useOpenCard(item.id);
  return (
    <article
      data-testid="item-tile"
      data-tile="row"
      onClick={openCard}
      className={cn(
        'group/tile grid h-full min-w-0 cursor-pointer gap-4 rounded-[var(--radius-template)] bg-surface p-3',
        roomy ? 'grid-cols-[9.375rem_minmax(0,1fr)]' : 'grid-cols-[6.875rem_minmax(0,1fr)]',
        'border border-hairline shadow-[var(--card-shadow)]',
      )}
    >
      <div className="relative self-start overflow-hidden rounded-[max(0px,calc(var(--radius-template)-4px))]">
        <ItemThumb itemId={item.id} src={item.thumbnailUrl} width={320} className={cn('w-full', roomy ? 'h-[9.375rem]' : 'h-[6.875rem]')} />
        <ItemBadges item={item} className="absolute left-2 top-2 [&>span]:h-6 [&>span]:px-2 [&>span]:text-xs" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="min-h-4 font-mono text-2xs uppercase tracking-[0.12em] text-ink-muted">{item.sku ?? ''}</span>
          <FavoriteButton itemId={item.id} favorite={item.favorite} className="-mr-2 -mt-2 size-9" />
        </div>
        <Link
          to={`/catalog/${item.id}`}
          className="line-clamp-2 text-base font-bold leading-[1.3] text-ink [text-transform:var(--heading-case)] hover:text-accent"
        >
          {item.name}
        </Link>
        <RatingBadge rating={item.rating} reviewCount={item.reviewCount} />
        <StockNote stock={item.stock} available={item.available} short className="mt-0 text-caption" />
        <ItemFacts item={item} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5">
          <TemplatePrice item={item} look={style.price} size="lg" />
          {taken ? null : (
            <CartAction item={item} taken={false} roomy={false} look="solid" className="h-10 w-auto px-4 [text-transform:none]" />
          )}
        </div>
        {taken ? <CartAction item={item} taken roomy={false} look="solid" /> : null}
      </div>
    </article>
  );
}
