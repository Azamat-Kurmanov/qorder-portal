import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { MotionStyle } from '../../../supplier/cabinetDesign';
import { Reveal } from '../../../ui/Reveal';
import { cn } from '../../../ui/cn';
import { FavoriteButton } from '../../favorites/FavoriteButton';
import { ItemThumb } from '../ItemThumb';
import { CartAction, ItemBadges, RatingBadge, useOpenCard } from '../itemParts';
import { TemplatePrice } from '../tiles/TemplatePrice';
import { TemplateTile } from '../tiles/TemplateTile';
import { THREE_FROM } from './GridView';

/**
 * Бенто — первая карточка вдвое крупнее (2×2) с подписью на матовом стекле:
 * главный товар витрины, как в макете «Аврора» и «Пастель». Остальные —
 * плиткой шаблона четырьмя в ряд. На узкой колонке — две в ряд, а крупная
 * занимает всю ширину.
 */
export function BentoView({
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
  const wide = width >= THREE_FROM;
  const [first, ...rest] = items;
  return (
    <div
      data-testid="item-grid"
      data-view="bento"
      className={cn('grid content-start', wide ? 'grid-cols-4 gap-[18px]' : 'grid-cols-2 gap-3')}
    >
      {first ? (
        <Reveal index={0} className={cn('col-span-2', wide && 'row-span-2')}>
          <BentoFeature item={first} taken={taken.has(first.id)} price={style.price} wide={wide} />
        </Reveal>
      ) : null}
      {rest.map((item, index) => (
        <Reveal key={item.id} index={index + 1}>
          <TemplateTile
            item={item}
            taken={taken}
            tile={style.tile}
            price={style.price}
            photo={wide ? 9.375 : 8.5}
          />
        </Reveal>
      ))}
    </div>
  );
}

/** Крупная карточка бенто: снимок на всю площадь и подпись на стекле. */
function BentoFeature({ item, taken, price, wide }: {
  item: ShowcaseItemDto;
  taken: boolean;
  price: MotionStyle['price'];
  wide: boolean;
}) {
  const { t } = useTranslation();
  const openCard = useOpenCard(item.id);
  return (
    <article
      data-testid="item-tile"
      data-tile="bento"
      onClick={openCard}
      className={cn(
        'group/tile qo-tile relative flex h-full cursor-pointer overflow-hidden rounded-[var(--radius-template)]',
        wide ? 'min-h-[32.5rem]' : 'min-h-[22rem]',
      )}
    >
      <ItemThumb itemId={item.id} src={item.thumbnailUrl} className="absolute inset-0 size-full" />
      <ItemBadges item={item} className="absolute left-4 top-4" />
      <FavoriteButton
        itemId={item.id}
        favorite={item.favorite}
        className="absolute right-3 top-3 size-10 rounded-full bg-surface shadow-[0_4px_10px_-6px_rgb(22_23_26/0.8)]"
      />
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-3 rounded-[max(8px,var(--radius-small))] bg-surface p-[18px] text-ink">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-2xs font-extrabold uppercase tracking-[0.12em] text-accent">{t('design.pick')}</span>
            <Link
              to={`/catalog/${item.id}`}
              className="qo-heading line-clamp-2 text-[1.375rem] leading-[1.15] text-ink hover:text-accent"
            >
              {item.name}
            </Link>
            <RatingBadge rating={item.rating} reviewCount={item.reviewCount} />
            <TemplatePrice item={item} look={price} size="xl" />
          </div>
          {taken ? null : <CartAction item={item} taken={false} roomy={false} look="round" className="size-12" />}
        </div>
        {taken ? <CartAction item={item} taken roomy={false} look="round" /> : null}
      </div>
    </article>
  );
}
