import { lineOf } from '../cart/cartPart';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShowcaseCardDto, ShowcaseVariantDto } from '../../api/generated';
import { cartOf, useCart, useSetCartLine } from '../cart/useCart';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { money } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { cn } from '../../ui/cn';
import { StockNote } from './StockNote';
import { axesOf, valuesOf } from './VariantPicker';
import type { SaleMode } from '../cart/ModeSwitch';

const SIZE = /размер|өлшем|size/i;

/** Размеры того же цвета (и прочих полей), что у открытой позиции, — в порядке оси размера. */
export function sizeRowsOf(variants: ShowcaseVariantDto[], current: ShowcaseVariantDto): { size: string; variant: ShowcaseVariantDto }[] {
  const axes = axesOf(variants);
  const size = axes.find((axis) => SIZE.test(axis.name) || SIZE.test(axis.code));
  if (!size) return [];
  const mine = valuesOf(current);
  const others = axes.filter((axis) => axis.code !== size.code);
  return size.options.flatMap((option) => {
    const variant = variants.find((candidate) => {
      const values = valuesOf(candidate);
      return values.get(size.code)?.text === option
        && others.every((axis) => values.get(axis.code)?.text === mine.get(axis.code)?.text);
    });
    return variant ? [{ size: option, variant }] : [];
  });
}

/**
 * Заказ линейки размеров одним действием: количество на каждый размер в одной таблице
 * и «По 1 каждого размера». Каждый размер — своя позиция и своя строка корзины;
 * опт, минимум и кратность считает корзина у каждого размера, как при обычном заказе.
 * Поле показывает то, что уже лежит в корзине: «В корзину» задаёт количества, а не прибавляет.
 */
export function SizeGrid({ item, mode }: { item: ShowcaseCardDto; mode?: SaleMode }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const setLine = useSetCartLine();
  const current = (item.variants ?? []).find((variant) => variant.itemId === item.id);
  const rows = current ? sizeRowsOf(item.variants ?? [], current) : [];
  // У «только опт» поле и цена — в упаковках, корзина хранит штуки.
  const only = item.wholesale !== undefined && !item.wholesale.retail;
  const perPack = only ? item.wholesale!.packQty : 1;
  const unit = only ? item.wholesale!.unit : item.unit;
  // Только строки своей заявки: размер, взятый в розницу, не считается лежащим в опте.
  const inCart = (itemId: string) => (lineOf(cart, itemId, mode)?.quantity ?? 0) / perPack;
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (rows.length < 2) return null;

  const valueOf = (itemId: string) => typed[itemId] ?? String(inCart(itemId) || '');
  const amountOf = (itemId: string) => {
    const number = Number(valueOf(itemId).replace(',', '.'));
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  const soldOut = (variant: ShowcaseVariantDto) => variant.stock === 'OUT_OF_STOCK';
  const total = rows.reduce((sum, row) => sum + amountOf(row.variant.itemId), 0);
  const sum = rows.reduce((acc, row) => acc + amountOf(row.variant.itemId) * row.variant.price, 0);
  const changed = rows.filter((row) => amountOf(row.variant.itemId) !== inCart(row.variant.itemId));

  function oneEach() {
    setDone(false);
    setTyped((now) => {
      const next = { ...now };
      for (const row of rows) if (!soldOut(row.variant) && amountOf(row.variant.itemId) === 0) next[row.variant.itemId] = '1';
      return next;
    });
  }

  async function put() {
    setFault(null);
    setDone(false);
    setBusy(true);
    try {
      for (const row of changed) {
        try {
          await setLine.mutateAsync({ itemId: row.variant.itemId, data: { quantity: amountOf(row.variant.itemId) * perPack, mode } });
        } catch (error) {
          const detail = (error as { info?: { detail?: unknown } } | null)?.info?.detail;
          setFault(t('item.sizes.failed', { size: row.size, reason: typeof detail === 'string' && detail ? detail : t('cart.failed') }));
          return;
        }
      }
      setTyped({});
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={t('item.sizes.title')} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body font-bold text-ink">{t('item.sizes.title')}</h2>
        <button type="button" onClick={oneEach}
          className="qo-hit h-9 rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface px-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {t('item.sizes.oneEach')}
        </button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-caption text-ink-muted">
            <th className="py-1 pr-2 font-semibold">{t('item.sizes.size')}</th>
            <th className="py-1 pr-2 font-semibold">{t('item.sizes.price')}</th>
            <th className="py-1 font-semibold">{t('item.sizes.quantity', { unit })}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ size, variant }) => (
            <tr key={variant.itemId} data-testid="size-row" className={cn('border-t border-hairline', soldOut(variant) && 'text-ink-subtle')}>
              <td className="py-2 pr-2">
                <span className={cn('font-bold', variant.itemId === item.id && 'text-accent')}>{size}</span>
                <span className="block text-caption"><StockNote stock={variant.stock} available={variant.available} short /></span>
              </td>
              <td className="py-2 pr-2 tabular-nums">{money(variant.price, currency)}</td>
              <td className="py-2">
                <input inputMode="decimal" aria-label={t('item.sizes.quantityOf', { size })} value={valueOf(variant.itemId)}
                  disabled={soldOut(variant) && inCart(variant.itemId) === 0}
                  onChange={(event) => { setDone(false); setTyped((now) => ({ ...now, [variant.itemId]: event.target.value })); }}
                  className="h-10 w-20 rounded-[var(--radius-control)] border-[1.5px] border-field-line bg-surface px-2 text-body tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" disabled={busy || changed.length === 0} onClick={() => void put()}
        className="h-12 rounded-[1rem] bg-accent px-5 text-body font-bold text-on-accent transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
        {total > 0
          ? t('item.sizes.put', { amount: quantityWithUnit(total, unit), sum: money(sum, currency) })
          : t('item.sizes.putEmpty')}
      </button>
      {done ? <p role="status" className="text-sm font-semibold text-ok-ink">{t('item.sizes.done')}</p> : null}
      {fault ? <p role="alert" className="text-sm font-semibold text-danger-ink">{fault}</p> : null}
      <p className="text-caption text-ink-subtle">{t('item.sizes.hint')}</p>
    </section>
  );
}
