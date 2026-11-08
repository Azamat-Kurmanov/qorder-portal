import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { AlertCircle, ArrowRight, ChevronDown, Info, Maximize2, Minimize2, ShoppingCart, X } from '../../ui/icons';
import { useClearCart } from './useCart';
import { useCartPart } from './cartPart';
import { PartSwitch } from './PartSwitch';
import { CartLines } from './CartLines';
import { closeCart, openCart, useCartDrawer } from './cartDrawer';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Bump } from '../../ui/Bump';
import { cn } from '../../ui/cn';
import { CartSavings } from './CartSavings';
import { GoodsLine, VatLine } from './CartTotals';
import { AdultNotice } from './AdultNotice';
import { CreditNotice } from './CreditNotice';
import { useCurrentShop } from '../shell/Shops';

/**
 * Корзина выдвижной панелью справа — по кнопке «Корзина» в шапке;
 * на телефоне — нижним листом до 85% высоты с ручкой, как в макете.
 *
 * Раньше она стояла третьей колонкой и отнимала у витрины 372 точки
 * постоянно, даже пустая. Панель появляется, когда её зовут: витрина
 * встаёт в четыре карточки, а о положенном говорят кнопка в шапке
 * (число и сумма) и уведомление «Добавлено».
 *
 * Состав берётся тем же `CartLines`, что и на оформлении: разойдись они —
 * расхождение цены («было — стало») показывалось бы в одном месте
 * и молчало в другом. Состав не запрашивается, пока не известно,
 * что поставщик есть (`active`).
 */
export function CartPanel({ active = true }: { active?: boolean }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const { open } = useCartDrawer();
  // Оптовая и розничная — разные заявки: панель показывает открытую, итог — её (как на оформлении).
  const parts = useCartPart(active);
  const cart = parts.cart;
  const clear = useClearCart();
  const shop = useCurrentShop();
  // Все строки заявки — и снятые галочкой: пустой корзина от снятых галочек не становится.
  const lines = parts.shown?.lines ?? [];
  const nothingPicked = (cart?.lines.length ?? 0) === 0;
  // Развернуть корзину на всю страницу и вернуть прежний размер — как окно с картой.
  const [expanded, setExpanded] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) closeCart(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          data-testid="cart-panel"
          aria-describedby={undefined}
          // Фокус при открытии — на саму панель, а не на первую кнопку: иначе
          // «Очистить» встречала бы рамкой фокуса, будто её предлагают нажать.
          // Tab по-прежнему ведёт по кнопкам, Esc закрывает.
          onOpenAutoFocus={(event) => { event.preventDefault(); (event.currentTarget as HTMLElement).focus(); }}
          className={cn(
            // Телефон — нижний лист до 85% высоты с ручкой, как в макете
            // «Карточка товара (телефон)»: витрина остаётся видна над ним.
            'qo-drawer fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] w-full flex-col outline-none rounded-t-[24px] border-t border-hairline bg-surface pt-3 shadow-float',
            // С `sm` — выдвижная панель справа во всю высоту.
            'sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[28.75rem] sm:rounded-[var(--radius-gallery)] sm:border-t-0 sm:pt-0',
            expanded && 'inset-0 max-h-none rounded-none border-t-0 sm:inset-0 sm:w-full sm:rounded-none',
          )}
        >
          <div data-testid="sheet-handle" aria-hidden="true" className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-center justify-between gap-3 px-4 pb-3 sm:items-start sm:px-6 sm:pb-4 sm:pt-6">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="text-base font-semibold text-ink sm:text-display sm:font-extrabold sm:tracking-[-0.01em]">
                {t('cart.panelTitle')}
              </Dialog.Title>
              <span className="truncate text-caption text-ink-muted sm:text-sm">
                {/* «3 товара · ИП «Мухамедиева»», как в макете: число строк, а не штук. */}
                {[t('cart.goods', { count: lines.length }), shop?.name].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {lines.length > 0 && (
                <button
                  type="button"
                  disabled={clear.isPending}
                  onClick={() => clear.mutate()}
                  className={cn(
                    'h-11 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-accent-ink underline underline-offset-[3px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
                  )}
                >
                  {t('cart.clear')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-label={expanded ? t('maps.restore') : t('maps.expand')}
                title={expanded ? t('maps.restore') : t('maps.expand')}
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface text-ink sm:size-12',
                  'transition-colors duration-200 hover:border-ink',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                {expanded ? <Minimize2 aria-hidden="true" className="size-5" /> : <Maximize2 aria-hidden="true" className="size-5" />}
              </button>
              <Dialog.Close
                aria-label={t('cart.close')}
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface text-ink sm:size-12',
                  'transition-colors duration-200 hover:border-ink',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <X aria-hidden="true" className="size-5" />
              </Dialog.Close>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-10 pt-4 text-center sm:pb-20 sm:pt-6">
              <span className="flex size-24 items-center justify-center rounded-full bg-canvas text-ink-faint">
                <ShoppingCart aria-hidden="true" className="size-10" />
              </span>
              <p className="text-lead font-bold text-ink">{t('cart.panelEmptyTitle')}</p>
              <p className="text-body leading-normal text-ink-muted">{t('cart.panelEmpty')}</p>
            </div>
          ) : (
            <>
              {/*
                Прокручивается всё, кроме подсказки до скидки, итога и главной
                кнопки: пометка об оплате идёт после товаров.
                Раньше они стояли внизу намертво и на ноутбуке съедали больше
                половины панели — на сам список оставалась полоска.
              */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
                <div className="pb-2 empty:hidden"><PartSwitch parts={parts} /></div>
                <CartLines />
                <div className="flex flex-col gap-3.5 pb-5 pt-1">
                  <AdultNotice cart={cart} />
                  <p className="flex gap-2.5 text-caption leading-[1.45] text-ink-muted">
                    <Info aria-hidden="true" className="mt-px size-4 shrink-0" />
                    {t('cart.payLater')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-hairline px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
                {/* «Ещё N — и скидка больше» — строкой над итогом: работает, пока заявка не отправлена. */}
                <CartSavings cart={cart} tierOnly />
                <CreditNotice cart={cart} />
                {/*
                  Итог — одной строкой; из чего он сложился (товары, скидки,
                  налог) раскрывается нажатием на неё. НДС — последним: он
                  «в том числе» именно в итоге, уже после скидки на заявку.
                */}
                <details className="group" data-testid="cart-breakdown">
                  <summary
                    className={cn(
                      'flex cursor-pointer list-none items-baseline justify-between gap-2 rounded-[var(--radius-control)] [&::-webkit-details-marker]:hidden',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    )}
                  >
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="text-lg font-bold text-ink">{t('cart.total')}</span>
                      <span className="flex items-center gap-1 text-caption font-semibold text-ink-muted">
                        <span className="group-open:hidden">{t('cart.breakdownShow')}</span>
                        <span className="hidden group-open:inline">{t('cart.breakdownHide')}</span>
                        <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-200 group-open:rotate-180" />
                      </span>
                    </span>
                    <Bump value={cart?.total ?? 0} className="whitespace-nowrap text-title font-extrabold tracking-[-0.02em] tabular-nums text-ink sm:text-display">
                      {money(cart?.total ?? 0, currency)}
                    </Bump>
                  </summary>
                  <div className="flex flex-col gap-2.5 pt-3">
                    {cart && <GoodsLine cart={cart} />}
                    <CartSavings cart={cart} withTier={false} />
                    {cart && <VatLine cart={cart} />}
                  </div>
                </details>
                {/* Единственное главное действие панели — крупное и цветом магазина. */}
                <Link
                  to="/checkout"
                  aria-disabled={nothingPicked}
                  onClick={(event) => { if (nothingPicked) event.preventDefault(); else closeCart(); }}
                  className={cn(
                    nothingPicked && 'pointer-events-none opacity-40',
                    'flex h-13 w-full items-center justify-center gap-2.5 rounded-[var(--radius-tile)] bg-accent',
                    'text-lead font-bold text-on-accent transition-colors duration-200 hover:bg-accent-hover',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  )}
                >
                  {t('cart.checkoutFull')}
                  <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * «Добавлено: …» внизу экрана — с кнопкой «Открыть корзину».
 *
 * Корзины больше не видно рядом с витриной, и без уведомления положенное
 * уходило бы молча: закупщик клал бы ту же позицию второй раз.
 */
export function AddedToast() {
  const { t } = useTranslation();
  const { added, failed } = useCartDrawer();
  // Живая область стоит всегда, а меняется только её текст: область,
  // смонтированная вместе с текстом, скринридер часто пропускает. И она
  // на всех ширинах — на телефоне значок «Добавлено» не рисуется, но
  // незрячему закупщику о положенном сказать всё равно нужно.
  const spoken = failed || (added ? t('cart.added', { name: added }) : '');
  return (
    <>
      <p role="status" className="sr-only">{spoken}</p>
      {failed ? (
        <div
          aria-hidden="true"
          className={cn(
            'fixed left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-[var(--radius-tile)] bg-night px-4 py-3',
            'bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-8',
            'text-body font-semibold text-white shadow-float',
            'transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0',
          )}
        >
          <AlertCircle aria-hidden="true" className="size-5 shrink-0 text-[#F0776C]" />
          <span>{failed}</span>
        </div>
      ) : added ? <AddedBadge added={added} /> : null}
    </>
  );
}

function AddedBadge({ added }: { added: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        // Только на мониторе: на телефоне о положенном говорит полоса корзины
        // над нижним меню, и уведомление легло бы поверх неё.
        'fixed bottom-8 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-3.5 rounded-[var(--radius-tile)] bg-night py-2 pl-4 pr-2 lg:flex',
        'text-body font-semibold text-white shadow-float',
        'transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0',
      )}
    >
      <span className="max-w-[18rem] truncate">{t('cart.added', { name: added })}</span>
      <button
        type="button"
        onClick={openCart}
        className="qo-hit h-10 shrink-0 rounded-[calc(var(--radius-control)*11/14)] bg-white px-3.5 font-bold text-on-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {t('cart.open')}
      </button>
    </div>
  );
}
