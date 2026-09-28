import { Link } from 'react-router-dom';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { TemplateStyle } from '../../../supplier/cabinetDesign';
import { Reveal } from '../../../ui/Reveal';
import { cn } from '../../../ui/cn';
import { FavoriteButton } from '../../favorites/FavoriteButton';
import { ItemThumb } from '../ItemThumb';
import { StockNote } from '../StockNote';
import { CartAction, ItemBadges, RatingBadge, useOpenCard } from '../itemParts';
import { TemplatePrice } from '../tiles/TemplatePrice';

/** Уже этой колонки лента встаёт в одну колонку: две по 150 точек — не лукбук. */
const TWO_FROM = 640;

/**
 * Лента — крупные снимки в две колонки, подпись под ними, как в лукбуке
 * («Ателье», «Нуар»). Вторая колонка смещена вниз: ряды не стоят строем,
 * и взгляд идёт по снимкам, а не по сетке. На телефоне — одна колонка.
 */
export function FeedView({
  items,
  taken,
  style,
  width,
}: {
  items: ShowcaseItemDto[];
  taken: Set<string>;
  style: TemplateStyle;
  width: number;
}) {
  const two = width >= TWO_FROM;
  return (
    <div
      data-testid="item-grid"
      data-view="feed"
      className={cn('grid content-start', two ? 'grid-cols-2 gap-x-[22px] gap-y-[34px]' : 'grid-cols-1 gap-7')}
    >
      {items.map((item, index) => (
        <Reveal key={item.id} index={index} className={two && index % 2 === 1 ? 'mt-12' : undefined}>
          <FeedCard item={item} taken={taken.has(item.id)} style={style} tall={width >= 900} />
        </Reveal>
      ))}
    </div>
  );
}

function FeedCard({ item, taken, style, tall }: {
  item: ShowcaseItemDto;
  taken: boolean;
  style: TemplateStyle;
  tall: boolean;
}) {
  const openCard = useOpenCard(item.id);
  // Лёгкие засечки «Ателье» и «Нуара» — курсивом, как подпись к снимку.
  const italic = style.headingWeight <= 400;
  return (
    <article data-testid="item-tile" data-tile="feed" onClick={openCard} className="group/tile flex cursor-pointer flex-col gap-3">
      <div className="relative overflow-hidden rounded-[var(--radius-template)]">
        <ItemThumb itemId={item.id} src={item.thumbnailUrl} className={cn('w-full', tall ? 'h-[26.25rem]' : 'h-[20rem]')} />
        <ItemBadges item={item} className="absolute left-3 top-3" />
        <FavoriteButton
          itemId={item.id}
          favorite={item.favorite}
          className="absolute right-3 top-3 size-9 rounded-full bg-surface/90 backdrop-blur-sm"
        />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <Link
          to={`/catalog/${item.id}`}
          className={cn('font-heading text-[1.1875rem] leading-[1.25] text-ink hover:text-accent', italic && 'italic')}
        >
          {item.name}
        </Link>
        <TemplatePrice item={item} look={style.price} size="sm" className="shrink-0 justify-end" />
      </div>
      <RatingBadge rating={item.rating} reviewCount={item.reviewCount} />
      <StockNote stock={item.stock} available={item.available} short className="mt-0 text-xs" />
      <CartAction item={item} taken={taken} roomy={false} look="feed" />
    </article>
  );
}
