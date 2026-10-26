import { cartOf, useCart, useSetCartLine } from './useCart';
import { PackContents, packMembers } from '../catalog/PackContents';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../ui/icons';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { LineThumb } from './LineThumb';
import { closeCart } from './cartDrawer';
import { QuantityField } from './QuantityField';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import type { Currency } from '../../shared/currency';
import { quantityWithUnit, unitPer } from '../../shared/units';
import { cn } from '../../ui/cn';
import type { CartLineDto, CartSplitDto, SkippedLineDto } from '../../api/generated';

interface CartLinesProps {
  /**
   * Можно ли править количество прямо в строке.
   *
   * Там, где заявка уже собрана и её сверяют, количество — часть подписи
   * «20 мешков × 2 500 тенге»: так строка читается целиком. Там, где корзину
   * набирают, оно живёт в поле со ступеньками — иначе менять его пришлось
   * бы уходом на другой экран.
   */
  editable?: boolean;
  /** Показывать ли «Не добавлено» над списком: оформление ставит его отдельно, над формой. */
  withSkipped?: boolean;
  className?: string;
}

/**
 * Состав корзины: то, что набрано, и то, что положить не удалось.
 *
 * Один список в одной карточке с волосяными разделителями, а не карточка
 * на строку: заявка — это одна вещь, а десять отдельных карточек читаются
 * как десять несвязанных.
 *
 * Расхождение цены показывается парой «было — стало», а не одной суммой:
 * клиент собирал заявку на другую сумму, и подменить её молча значит продать
 * по цене, которой он не видел.
 */
export function CartLines({ editable = true, withSkipped = true, className }: CartLinesProps) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const setLine = useSetCartLine();
  const lines = cart?.lines ?? [];
  const skipped = cart?.skipped ?? [];
  // Строки, которые уже схлопываются: запрос уходит, когда строка ушла
  // с глаз, — иначе всё, что ниже, прыгало бы вверх одним рывком.
  const [leaving, setLeaving] = useState<string[]>([]);
  // Убранное крестиком можно вернуть: крестик стоит рядом с количеством,
  // и промах пальцем не должен стоить позиции, набранной заново.
  const [removed, setRemoved] = useState<{ itemId: string; name: string; quantity: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  function remove(line: CartLineDto) {
    const key = line.itemId;
    setLeaving((keys) => [...keys, key]);
    setTimeout(() => setLine.mutate({ itemId: line.itemId, data: { quantity: 0 } }, {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        setRemoved({ itemId: line.itemId, name: line.name, quantity: line.quantity });
        clearTimeout(undoTimer.current);
        undoTimer.current = setTimeout(() => setRemoved(null), 6000);
      },
      onSettled: () => setLeaving((keys) => keys.filter((left) => left !== key)),
    }), 200);
  }

  function undo() {
    if (!removed) return;
    setLine.mutate({ itemId: removed.itemId, data: { quantity: removed.quantity } });
    clearTimeout(undoTimer.current);
    setRemoved(null);
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {withSkipped && <SkippedNotice skipped={skipped} />}

      {lines.length === 0 && (
        // В сводке оформления пустота — тихая подпись, а не текст наравне с суммами.
        <p className={editable ? 'text-ink-muted' : 'text-sm text-ink-subtle'}>{t('cart.empty')}</p>
      )}

      {removed && editable && (
        <div
          role="status"
          className={cn(
            'flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-sunk py-1 pl-3.5 pr-1 text-sm text-ink',
            'transition-opacity duration-200 starting:opacity-0',
          )}
        >
          <span className="min-w-0 truncate">{t('cart.removed', { name: removed.name })}</span>
          <button
            type="button"
            onClick={undo}
            className={cn(
              'h-11 shrink-0 rounded-[var(--radius-small)] px-3 font-semibold text-accent-ink',
              'transition-colors duration-200 hover:bg-ink/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            {t('cart.undo')}
          </button>
        </div>
      )}

      {lines.length > 0 && editable && (
        /*
          В корзине строки идут списком с разделителями прямо по колонке, без
          своей карточки: колонка и есть лист корзины, и рамка вокруг рамки
          читалась бы вложенным окном.
        */
        <div className="flex flex-col">
          {lines.map((line) => {
            const going = leaving.includes(line.itemId);
            return (
            <div
              key={line.itemId}
              data-testid="cart-line"
              className={cn(
                'grid border-b border-hairline transition-[grid-template-rows,opacity] duration-200 ease-out last:border-b-0',
                going ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]',
              )}
            >
            <div className={cn('min-h-0', going && 'overflow-hidden')}>
            <div className="flex gap-3.5 py-4">
              {/* Картинка — та же ссылка, что и название: для диктора одна, второй он не услышит. */}
              <Link to={itemHref(line)} onClick={closeCart} tabIndex={-1} aria-hidden="true" className="shrink-0">
                <LineThumb seed={line.itemId} src={line.imageUrl} className="h-[4.75rem] w-16 rounded-[var(--radius-control)]" />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-body font-semibold leading-[1.3] text-ink">
                    <ItemLink line={line} />
                  </p>
                  {/*
                    Убрать одну строку — крестиком у названия, как в макете.
                    Отдельной операции удаления нет: ноль и есть «убрать»
                    (см. `useSetCartLine`), и итог пересчитывает тот же ответ.
                    «Очистить» в шапке панели остаётся — для всей корзины.
                  */}
                  <button
                    type="button"
                    aria-label={t('cart.removeLine', { name: line.name })}
                    disabled={setLine.isPending || going}
                    onClick={() => remove(line)}
                    className={cn(
                      '-mr-3 -mt-3 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-small)] text-ink-faint',
                      'transition-colors duration-200 hover:bg-ink/5 hover:text-ink',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
                    )}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <PriceLine line={line} editable currency={currency} />
                {line.pack ? <PackContents label={t('pack.inPress')} members={packMembers(line.pack)} /> : null}
                <NextTier line={line} currency={currency} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <QuantityField itemId={line.itemId} unit={line.unit} terms={line.terms} variant="line" />
                  <p
                    data-testid="line-total"
                    className="shrink-0 text-base font-extrabold tabular-nums text-ink"
                  >
                    {money(line.total, currency)}
                  </p>
                </div>
              </div>
            </div>
            </div>
            </div>
            );
          })}
        </div>
      )}

      {lines.length > 0 && !editable && (
        // Сверочный список стоит внутри сводки заявки — без своей карточки:
        // рамка в рамке читалась бы вложенным окном.
        <div className="flex flex-col">
          {lines.map((line) => (
            <div
              key={line.itemId}
              data-testid="cart-line"
              className="flex items-center gap-3 border-b border-hairline py-3 last:border-b-0"
            >
              <Link to={itemHref(line)} onClick={closeCart} tabIndex={-1} aria-hidden="true" className="shrink-0">
                <LineThumb seed={line.itemId} src={line.imageUrl} className="size-12" />
              </Link>
              <div className="min-w-0 flex-1 break-words">
                <p className="text-body font-semibold leading-[1.3] text-ink"><ItemLink line={line} /></p>
                <PriceLine line={line} editable={false} currency={currency} />
                {line.pack ? <PackContents label={t('pack.inPress')} members={packMembers(line.pack)} /> : null}
              </div>
              <p
                data-testid="line-total"
                className="shrink-0 text-body font-bold tabular-nums text-ink"
              >
                {money(line.total, currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Карточка товара строки. Из выдвижной корзины переход её закрывает: иначе
 * карточка открылась бы под шторкой, и клиент решил бы, что ссылка не работает.
 */
function itemHref(line: CartLineDto): string {
  return `/catalog/${encodeURIComponent(line.itemId)}`;
}

function ItemLink({ line }: { line: CartLineDto }) {
  return (
    <Link
      to={itemHref(line)}
      onClick={closeCart}
      className="rounded-[4px] text-inherit no-underline hover:text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {line.name}
    </Link>
  );
}

/**
 * Изменилась ли цена по-настоящему, а не началась скидка.
 *
 * Товар, положенный до акции, сервер помечает `priceChanged`: цена при
 * добавлении — обычная, сейчас — со скидкой. Но обычная цена та же
 * (`listPrice` = `priceAtAdding`), и «было 31 990, стало 28 791» читалось бы
 * как смена цены продавцом. Это скидка — и показывается она как скидка.
 */
export function priceReallyChanged(line: CartLineDto): boolean {
  if (!line.priceChanged) return false;
  const discountOnly = line.listPrice !== undefined && !!line.discountPercent
    && line.priceAtAdding === line.listPrice && line.split?.packPriceAtAdding === undefined;
  return !discountOnly;
}

/**
 * Цена под названием — или расхождение «было — стало».
 *
 * Цена, изменившаяся с момента добавления, — не мелочь оформления: клиент
 * собирал заявку на другую сумму, и увидеть он должен обе.
 */
function PriceLine({ line, editable, currency }: { line: CartLineDto; editable: boolean; currency: Currency | undefined }) {
  const { t } = useTranslation();
  // У смешанной строки могла измениться розница, цена упаковки или обе.
  const packWas = line.split?.packPriceAtAdding;
  return priceReallyChanged(line) ? (
    <p className="text-caption font-medium text-unclear-ink">
      {line.priceAtAdding !== line.price || packWas === undefined
        ? t('cart.priceChanged', { was: money(line.priceAtAdding, currency), now: money(line.price, currency) })
        : null}
      {packWas !== undefined && line.split ? (
        <span className="block">
          {t('cart.packPriceChanged', { was: money(packWas, currency), now: money(line.split.packPrice, currency) })}
        </span>
      ) : null}
    </p>
  ) : (
    <>
      <p className="flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
        {amountLine(line, editable, currency, t)}
        {/* В сводке оформления — в строку, как в макете: сводка обязана оставаться низкой. */}
        {!editable && line.listPrice !== undefined && line.discountPercent ? (
          <span className="flex items-center gap-1.5">
            <s className="tabular-nums text-ink-faint">{money(line.listPrice, currency)}</s>
            <span className="font-bold text-sale-ink">−{line.discountPercent}%</span>
          </span>
        ) : null}
      </p>
      {editable && line.listPrice !== undefined && line.discountPercent ? (
        // Скидка — своей строкой и с подписью: слитые в одну строку три суммы
        // не говорили, какая из них настоящая, а какая была до скидки.
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
          <span className="rounded-full bg-sale-soft px-2 py-px font-bold tabular-nums text-sale-ink">
            −{line.discountPercent}%
          </span>
          <span className="text-ink-faint">
            {t('cart.withoutDiscount')}{' '}
            <s className="tabular-nums">{money(line.listPrice, currency)}</s>
          </span>
        </p>
      ) : null}
    </>
  );
}

/**
 * Подпись под названием.
 *
 * Вариант («чёрный · L») — первым: он и отличает строку от соседней с тем же
 * названием. Количество названо только там, где его не видно в поле ввода: продублируй
 * его рядом со ступеньками — и при расхождении (поле ещё не отправило новое
 * значение) строка сообщила бы два разных количества сразу.
 */
function amountLine(line: CartLineDto, editable: boolean, currency: Currency | undefined, t: TFunction): string {
  const split = line.split;
  // Строка с упаковками называет разбиение целиком: «2 упаковки (по 20 мешков) × 1 800
  // + 5 мешков × 100» — клиент видит, что пошло по опту, а что в розницу.
  const amount = split
    ? `${editable ? '' : `${quantityWithUnit(line.quantity, line.unit)} = `}${splitText(line, split, currency, t)}`
    : editable
      ? t('cart.pricePerUnit', { price: money(line.price, currency), unit: unitPer(line.unit) })
      : `${quantityWithUnit(line.quantity, line.unit)} × ${money(line.price, currency)}`;
  // Вариант — перед ценой: у близнецов одно название, и строки «Худи» чёрного
  // и белого без него читались бы одной позицией, положенной дважды.
  const priced = line.yourPrice ? `${amount} · ${t('cart.yourPrice')}` : amount;
  return line.variantLabel ? `${line.variantLabel} · ${priced}` : priced;
}

function splitText(line: CartLineDto, split: CartSplitDto, currency: Currency | undefined, t: TFunction): string {
  const packs = `${quantityWithUnit(split.packs, split.packUnit)} (${t('cart.wholesale.pack', {
    amount: quantityWithUnit(split.packQty, line.unit),
  })}) × ${money(split.packPrice, currency)}`;
  return split.rest > 0
    ? `${packs} + ${quantityWithUnit(split.rest, line.unit)} × ${money(line.price, currency)}`
    : packs;
}

/**
 * Что сделать ради оптовой цены — и сколько это сбережёт: «Добавьте ещё 15 мешков —
 * и будет 3 упаковки по 1 800, выгода 200». Числа считает сервер.
 */
function NextTier({ line, currency }: { line: CartLineDto; currency: Currency | undefined }) {
  const { t } = useTranslation();
  const hint = line.hint;
  if (!hint) return null;
  return (
    <p data-testid="next-tier" className="text-caption font-semibold text-accent-ink">
      {t('cart.wholesale.hint', {
        amount: quantityWithUnit(hint.addPieces, line.unit),
        packs: quantityWithUnit(hint.packs, line.split?.packUnit ?? t('cart.wholesale.packWord')),
        price: money(hint.packPrice, currency),
        saving: money(hint.saving, currency),
      })}
    </p>
  );
}

/**
 * «Не добавлено» — отдельным блоком и всегда наверху.
 *
 * Молча пропущенная позиция обнаруживается уже при отгрузке: клиент считает,
 * что заказал набор, а приедет неполный.
 */
export function SkippedNotice({ skipped }: { skipped: SkippedLineDto[] }) {
  const { t } = useTranslation();

  if (skipped.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-unclear/30 bg-unclear/8 p-4"
    >
      <p className="font-medium text-ink">{t('cart.notAdded')}</p>
      {skipped.map((line) => (
        <p key={line.itemId} className="text-sm text-ink">
          {line.name} — {line.reason}
        </p>
      ))}
      <p className="text-sm text-ink-subtle">{t('cart.chooseReplacement')}</p>
    </div>
  );
}
