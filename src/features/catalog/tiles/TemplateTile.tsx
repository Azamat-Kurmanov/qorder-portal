import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { TemplateStyle } from '../../../supplier/cabinetDesign';
import { FavoriteButton } from '../../favorites/FavoriteButton';
import { ColourCountBadge } from '../ColourCountBadge';
import { ItemThumb } from '../ItemThumb';
import { StockNote } from '../StockNote';
import { CartAction, ItemBadges, ItemFacts, RatingBadge, useOpenCard, type CartLook } from '../itemParts';
import { TemplatePrice } from './TemplatePrice';
import { useTileVariant } from '../TileVariants';
import { cn } from '../../../ui/cn';

/**
 * Карточка товара шаблона — семь характеров, как в предпросмотре продавца
 * (`Tile` в `front/src/features/cabinetDesign/CabinetPreview.tsx`):
 *
 * — `soft` — фото внутри карточки с отступом, круглый «+» рядом с ценой;
 * — `overlay` — снимок на всю карточку, имя и цена поверх затемнения;
 * — `frame` — карточка в рамке, подпись по центру, кнопка-рамка;
 * — `sticker` — наклейка скидки вторым цветом, кнопка во всю ширину;
 * — `brutal` — толстая рамка цвета текста и жёсткая тень без размытия;
 * — `glass` — матовое стекло поверх подсвеченного фона;
 * — `plain` — без подложки: снимок, имя, цена и «Добавить» словом.
 *
 * Данные и действия у всех одни и те же, что у прежней плитки: снимок,
 * избранное, метки продавца, цена со старой, наличие, условия продажи
 * и «В корзину», которая после нажатия становится счётчиком. Нажимается
 * карточка целиком (`useOpenCard`), имя остаётся настоящей ссылкой.
 */
export function TemplateTile({
  item,
  taken: takenIds,
  tile,
  price,
  photo = 11.875,
  className,
}: {
  item: ShowcaseItemDto;
  /** Взятые позиции: плитка сама смотрит, взят ли выбранный на ней вариант. */
  taken: ReadonlySet<string>;
  tile: TemplateStyle['tile'];
  price: TemplateStyle['price'];
  /** Высота снимка в `rem` — от вида витрины и ширины колонки. */
  photo?: number;
  className?: string;
}) {
  // Выбранный на плитке вариант — её цена, наличие, корзина и карточка
  // (`useTileVariant`); снимок, сердечко и название остаются от позиции.
  const { shown, choice, colour } = useTileVariant(item);
  const taken = takenIds.has(shown.id);
  const openCard = useOpenCard(shown.id);
  const sale = !!shown.discountPercent;
  const name = (extra?: string) => (
    <Link
      to={`/catalog/${shown.id}`}
      className={cn('line-clamp-2 text-sm font-semibold leading-[1.3] text-ink transition-colors duration-300 hover:text-accent', extra)}
    >
      {item.name}
    </Link>
  );
  // Оценка — у позиции, а не у варианта: отзывы пишут о товаре целиком.
  const stars = (tone?: string) => <RatingBadge rating={item.rating} reviewCount={item.reviewCount} className={tone} />;
  // Высота — числом в `rem` у обёртки: у мозаики она своя у каждой карточки,
  // и классом её не задать — Tailwind находит классы по тексту исходника.
  const thumb = (classes: string, height = photo) => (
    <div className={cn('w-full shrink-0 overflow-hidden', classes)} style={{ height: `${height}rem` }}>
      <ItemThumb itemId={item.id} src={item.thumbnailUrl} className="size-full" />
    </div>
  );
  const heart = (
    <FavoriteButton
      itemId={item.id}
      favorite={item.favorite}
      className="absolute right-2 top-2 size-[30px] rounded-full bg-surface shadow-[0_4px_10px_-6px_rgb(22_23_26/0.8)] [&_svg]:size-4"
    />
  );
  const badges = (square = false, framed = false) => (
    <div className="absolute left-2 top-2 flex max-w-[calc(100%-3rem)] flex-wrap gap-1.5">
      {sale && (
        <span
          className={cn(
            'flex h-6 items-center px-2.5 text-xs font-extrabold [letter-spacing:var(--heading-tracking)] shadow-[0_4px_10px_-6px_rgb(22_23_26/0.8)]',
            square ? 'rounded-[min(4px,var(--radius-small))]' : 'rounded-full',
            framed ? 'bg-surface text-sale' : 'bg-sale text-white',
          )}
        >
          −{shown.discountPercent}%
        </span>
      )}
      <ItemBadges item={shown} hideDiscount className="contents" />
    </div>
  );
  const colours = <ColourCountBadge count={colour ? undefined : item.colorCount} className="absolute bottom-2 left-2" />;
  const facts = (tone?: string) => (
    <>
      {choice}
      <StockNote stock={shown.stock} available={shown.available} short className={cn('mt-0 text-xs', tone)} />
      <ItemFacts item={item} />
    </>
  );
  /** Действие: пока не взято — кнопка шаблона, взято — счётчик во всю ширину. */
  const action = (look: CartLook, extra?: string) => (
    <CartAction item={shown} taken={taken} roomy={false} look={look} className={extra} />
  );
  // Кнопка, что стоит в строке рядом с ценой: после нажатия счётчику там
  // тесно, и он встаёт отдельной строкой под ценой.
  const inline = (look: CartLook) => (taken ? null : action(look));
  const counter = taken ? action('round') : null;
  const shell = (classes: string, children: ReactNode) => (
    <article
      data-testid="item-tile"
      data-tile={tile}
      onClick={openCard}
      className={cn('group/tile flex h-full min-w-0 cursor-pointer flex-col', classes, className)}
    >
      {children}
    </article>
  );

  switch (tile) {
    case 'overlay':
      return shell('qo-tile relative overflow-hidden rounded-[var(--radius-template)]', (
        <>
          {/* Снимок выше, чем у соседей, на высоту подписи, которая ляжет поверх (как в макете, +90). */}
          {thumb('', photo + 5.625)}
          {badges()}
          {heart}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-[linear-gradient(transparent,rgb(22_23_26/0.88))] px-3.5 pb-3.5 pt-11">
            <div className="flex items-end gap-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {name('text-white hover:text-white/85')}
                {stars('text-white/85')}
                <TemplatePrice item={shown} look={price} onImage />
                <StockNote stock={shown.stock} available={shown.available} short className="mt-0 text-xs text-white/85" />
              </div>
              {inline('roundLight')}
            </div>
            {counter}
          </div>
        </>
      ));
    case 'frame':
      return shell('gap-2.5 rounded-[var(--radius-template)] border border-hairline bg-surface p-2.5', (
        <>
          <div className="relative">
            {thumb('rounded-[var(--radius-small)]')}
            {badges(true, true)}
            {heart}
            {colours}
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 px-1 text-center">
            {shown.sku ? (
              <span className="text-2xs uppercase tracking-[0.14em] text-ink-muted">{shown.sku}</span>
            ) : null}
            {name('font-heading text-[0.9375rem] leading-[1.3] [font-weight:var(--heading-weight)]')}
            {stars()}
            <TemplatePrice item={shown} look={price} size="sm" className="justify-center" />
            {facts()}
          </div>
          {action('outline')}
        </>
      ));
    case 'sticker':
      return shell('qo-tile overflow-hidden rounded-[var(--radius-template)] bg-surface', (
        <>
          <div className="relative">
            {thumb('')}
            <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
              <ItemBadges item={shown} hideDiscount className="contents" />
            </div>
            {heart}
            {colours}
            {sale && (
              // Наклейка скидки — вторым цветом и чуть набок, как ценник на рынке.
              <span className="absolute -bottom-[18px] right-2.5 z-[1] flex size-[62px] -rotate-10 items-center justify-center rounded-full bg-accent2 text-[1.1875rem] font-black text-accent2-ink shadow-[0_8px_16px_-8px_rgb(22_23_26/0.8)]">
                −{shown.discountPercent}%
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 pt-3.5">
            {name(sale ? 'pr-14' : undefined)}
            {stars()}
            <TemplatePrice item={shown} look={price} />
            {facts()}
            <div className="mt-auto pt-1">{action('solid')}</div>
          </div>
        </>
      ));
    case 'brutal':
      return shell('overflow-hidden rounded-[var(--radius-template)] border-2 border-ink bg-surface shadow-[6px_6px_0_var(--color-ink)]', (
        <>
          <div className="relative border-b-2 border-ink">
            {thumb('')}
            <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
              {sale && (
                <span className="border-2 border-[#16171A] bg-accent2 px-2 py-0.5 font-mono text-caption font-extrabold text-[#16171A]">
                  −{shown.discountPercent}%
                </span>
              )}
              <ItemBadges item={shown} hideDiscount className="contents" />
            </div>
            {heart}
            {colours}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            {name('font-extrabold [text-transform:var(--heading-case)]')}
            {stars()}
            <TemplatePrice item={shown} look={price} />
            {facts()}
            <div className="mt-auto pt-1">{action('brutal')}</div>
          </div>
        </>
      ));
    case 'glass':
      return shell('qo-glass qo-glass-still gap-2.5 rounded-[var(--radius-template)] p-2 shadow-[var(--card-shadow)]', (
        <>
          <div className="relative">
            {thumb('rounded-[max(0px,calc(var(--radius-template)-6px))]')}
            {badges()}
            {heart}
            {colours}
          </div>
          <div className="flex flex-1 flex-col gap-2 px-1.5 pb-1.5">
            {name()}
            {stars()}
            {facts()}
            <div className="mt-auto flex items-center justify-between gap-2">
              <TemplatePrice item={shown} look={price} />
              {inline('gradient')}
            </div>
            {counter}
          </div>
        </>
      ));
    case 'plain':
      return shell('gap-2.5', (
        <>
          <div className="relative">
            {thumb('rounded-[var(--radius-template)]')}
            {badges(true)}
            {heart}
            {colours}
          </div>
          {name()}
          {stars()}
          {facts()}
          <div className="mt-auto flex items-center justify-between gap-2">
            <TemplatePrice item={shown} look={price} size="sm" />
            {inline('link')}
          </div>
          {counter}
        </>
      ));
    default:
      return shell('qo-tile gap-2.5 rounded-[var(--radius-template)] bg-surface p-2', (
        <>
          <div className="relative">
            {thumb('rounded-[max(0px,calc(var(--radius-template)-6px))]')}
            {badges()}
            {heart}
            {colours}
          </div>
          <div className="flex flex-1 flex-col gap-2 px-1.5 pb-1.5">
            {name()}
            {stars()}
            {facts()}
            <div className="mt-auto flex items-center justify-between gap-2">
              <TemplatePrice item={shown} look={price} />
              {inline('round')}
            </div>
            {counter}
          </div>
        </>
      ));
  }
}
