import { useTranslation } from 'react-i18next';
import { Box } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PortalPromotionsDto } from '../../../api/generated';
import { cartOf, useCart } from '../../cart/useCart';
import { money } from '../../../shared/format';
import { useSupplierCurrency } from '../../../supplier/SupplierCurrency';
import { cn } from '../../../ui/cn';

/**
 * Подсказка «Ещё N тенге — и −P% на всю заявку» под баннером витрины шаблона,
 * как в предпросмотре продавца: полоса набранного и билет скидки на первую
 * заявку справа. Числа — из корзины (`goodsTotal`), пороги — из акций;
 * у магазина без скидки за объём остаётся один билет скидки на первую
 * заявку, а без неё — подсказки нет.
 *
 * Ближе порога, чем решил магазин (`volumeHintPercent`), подсказка не зовёт
 * добирать — она называет условие: «От 100 000 тенге — −5% на всю заявку».
 */
export function VolumeHint({ data, compact }: { data: PortalPromotionsDto | undefined; compact: boolean }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const tiers = data?.volumeTiers ?? [];
  if (!data) return null;
  const first = data.firstOrder?.status === 'ELIGIBLE' ? data.firstOrder : null;
  if (tiers.length === 0) {
    // Без порогов за объём полосе нечего мерить — остаётся билет скидки
    // на первую заявку, как справа в полной подсказке.
    if (!first) return null;
    return (
      <Link
        to="/promotions"
        data-testid="volume-hint"
        className={cn(
          'qo-tile flex items-center rounded-[var(--radius-template)] bg-surface transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          compact ? 'gap-3 px-3.5 py-3' : 'gap-[18px] px-5 py-4',
        )}
      >
        {compact ? null : (
          <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[var(--radius-small)] bg-accent-soft text-accent-ink">
            <Box aria-hidden="true" className="size-5" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <span className="flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-[var(--radius-chip)] bg-accent2 px-3 text-caption font-bold text-accent2-ink">
            {t('design.first', { percent: first.percent })}
          </span>
          <span className="text-ink-muted">
            {first.minTotal != null
              ? t('promotions.v2.first.fromPill', { sum: money(first.minTotal, currency) })
              : t('promotions.v2.first.appliesShort')}
          </span>
        </span>
      </Link>
    );
  }
  // Полоса считает только позиции, участвующие в скидке за объём:
  // исключённые продавцом товары не приближают к её порогу.
  const goods = cart?.volumeGoods ?? cart?.goodsTotal ?? 0;
  const next = tiers.find((tier) => goods < tier.from);
  const reached = [...tiers].reverse().find((tier) => goods >= tier.from);
  const target = next ?? tiers[tiers.length - 1];
  const progress = Math.min(100, Math.round((goods / target.from) * 100));
  const missing = next ? next.from - goods : 0;
  const near = next !== undefined && data.volumeHintPercent != null && missing * 100 <= next.from * data.volumeHintPercent;
  const title = !next && reached
    ? t('promotions.v2.volume.done', { percent: reached.percent })
    : near || reached
      ? t('design.volume', { left: money(missing, currency), percent: next!.percent })
      : t('promotions.v2.volume.from', { from: money(next!.from, currency), percent: next!.percent });
  return (
    <Link
      to="/promotions"
      data-testid="volume-hint"
      className={cn(
        'qo-tile flex items-center rounded-[var(--radius-template)] bg-surface transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        compact ? 'gap-3 px-3.5 py-3' : 'gap-[18px] px-5 py-4',
      )}
    >
      {compact ? null : (
        <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[var(--radius-small)] bg-accent-soft text-accent-ink">
          <Box aria-hidden="true" className="size-5" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <b className="font-bold text-ink">{title}</b>
          {compact ? null : (
            <span className="text-ink-muted">{t('design.volumeOf', { cart: money(goods, currency), from: money(target.from, currency) })}</span>
          )}
        </span>
        <span
          role="progressbar"
          aria-label={t('promotions.v2.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-shop)_12%,var(--color-surface))]"
        >
          <span
            className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-shop),color-mix(in_srgb,var(--color-shop)_40%,var(--color-accent2)))]"
            style={{ width: `${progress}%` }}
          />
        </span>
      </span>
      {first && !compact ? (
        <span className="flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-[var(--radius-chip)] bg-accent2 px-3 text-caption font-bold text-accent2-ink">
          {t('design.first', { percent: first.percent })}
        </span>
      ) : null}
    </Link>
  );
}
