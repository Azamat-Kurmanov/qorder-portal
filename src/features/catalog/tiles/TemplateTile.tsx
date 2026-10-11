import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { MotionStyle } from '../../../supplier/cabinetDesign';
import { FavoriteButton } from '../../favorites/FavoriteButton';
import { ColourCountBadge } from '../ColourCountBadge';
import { ItemThumb } from '../ItemThumb';
import { StockNote } from '../StockNote';
import { CartAction, ItemBadges, ItemFacts, RatingBadge, useOpenCard, type CartLook } from '../itemParts';
import { TemplatePrice } from './TemplatePrice';
import { useTileVariant } from '../TileVariants';
import { cn } from '../../../ui/cn';

/**
 * Карточка товара живой темы — восемь характеров, как в макетах
 * (`Motion*.dc.html` в канве):
 *
 * — `glass` — матовое стекло, мягкое свечение под курсором (Сияние, Призма);
 * — `tilt` — объёмная карточка, наклоняется за курсором (Глубина);
 * — `float` — та же карточка, слегка покачивается (Парение);
 * — `glow` — тонкая рамка, светится цветом магазина при наведении (Неон, Импульс);
 * — `jelly` — упругая: подпрыгивает при наведении, сжимается при нажатии (Капли, Леденец);
 * — `outline` — рамка цвета магазина прорисовывается по контуру (Студия, Вспышка);
 * — `swap` — снимок без подложки, медленное приближение, «В корзину» выезжает снизу (Лукбук, Сезон);
 * — `plain` — запасная: снимок, имя, цена и «Добавить» словом.
 *
 * Вид и движение — классы `qo-tile-*` в `index.css` под уровнем движения
 * оболочки. Данные и действия у всех одни: снимок, избранное, метки, цена
 * со старой, наличие, условия продажи и «В корзину», которая после нажатия
 * становится счётчиком. Нажимается карточка целиком (`useOpenCard`).
 */
/** Плитки с эффектом под курсором (`ui/motion/pointerFx.ts`): свечение или наклон. */
const WITH_FX = new Set<MotionStyle['tile']>(['glass', 'glow', 'tilt']);
/** Снимок лукбука выше обычного — в `rem` (300 точек в макете). */
const SWAP_MIN_PHOTO = 18.75;

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
  tile: MotionStyle['tile'];
  price: MotionStyle['price'];
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
      <ItemThumb itemId={item.id} src={item.thumbnailUrl} second={item.secondThumbnailUrl} flight className="size-full" />
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
    <div className="qo-badges absolute left-2 top-2 flex max-w-[calc(100%-3rem)] flex-wrap gap-1.5">
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
      data-fx={WITH_FX.has(tile) || undefined}
      onClick={openCard}
      className={cn('group/tile flex h-full min-w-0 cursor-pointer flex-col', `qo-tile-${tile}`, classes, className)}
    >
      {children}
    </article>
  );

  // Подпись под снимком — общая у карточек с подложкой: имя, оценка, условия, цена и действие.
  const body = (look: CartLook, pad = 'px-1 pb-1') => (
    <div className={cn('flex flex-1 flex-col gap-1.5', pad)}>
      {name()}
      {stars()}
      {facts()}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <TemplatePrice item={shown} look={price} />
        {inline(look)}
      </div>
      {counter}
    </div>
  );
  const photo3 = (classes = 'rounded-[var(--radius-small)]', height = photo) => (
    <div className="relative">
      {thumb(classes, height)}
      {badges()}
      {heart}
      {colours}
    </div>
  );

  switch (tile) {
    case 'tilt':
    case 'float':
      // Объём: белая карточка с длинной мягкой тенью; наклон (Глубина) или покачивание (Парение).
      return shell('gap-3 rounded-[var(--radius-template)] bg-surface p-3', (
        <>
          {photo3()}
          {body('solid')}
        </>
      ));
    case 'glow':
      // Неон: тонкая рамка цвета линий, свечение цветом магазина при наведении.
      return shell('gap-3 rounded-[var(--radius-template)] border border-hairline bg-surface p-3', (
        <>
          {photo3()}
          {body('glow')}
        </>
      ));
    case 'jelly':
      return shell('gap-3 rounded-[var(--radius-template)] bg-surface p-3', (
        <>
          {photo3()}
          {body('jelly')}
        </>
      ));
    case 'outline':
      // Студия: без тени; рамка 1,5 точки цвета магазина рисуется по контуру при наведении.
      return shell('gap-3 rounded-[var(--radius-template)] bg-surface p-3', (
        <>
          {photo3()}
          {body('pill')}
        </>
      ));
    case 'swap':
      // Лукбук: снимок на всю ширину без подложки; «В корзину» — маленькая, выезжает снизу на снимке.
      return shell('gap-2.5', (
        <>
          <div className="qo-swap-photo relative overflow-hidden">
            {thumb('', Math.max(photo + 6, SWAP_MIN_PHOTO))}
            {badges(true)}
            {heart}
            {colours}
            {taken ? null : <div className="qo-swap-add absolute bottom-2.5 right-2.5">{action('ghost')}</div>}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {name('font-normal [text-transform:var(--heading-case)] [letter-spacing:var(--heading-tracking)]')}
            {stars()}
            <TemplatePrice item={shown} look={price} size="sm" />
            {facts()}
            {counter}
          </div>
        </>
      ));
    case 'plain':
      return shell('gap-2.5', (
        <>
          {photo3('rounded-[var(--radius-template)]')}
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
      // Стекло: полупрозрачная панель с размытием; свечение под курсором; у Призмы — радужная рамка.
      return shell('gap-3 rounded-[var(--radius-template)] p-3', (
        <>
          {photo3()}
          {body('pill')}
        </>
      ));
  }
}
