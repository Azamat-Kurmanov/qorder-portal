import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ArrowRight, Info, ShoppingCart, X } from 'lucide-react';
import { cartOf, useCart, useClearCart } from './useCart';
import { CartLines } from './CartLines';
import { closeCart, openCart, useCartDrawer } from './cartDrawer';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Bump } from '../../ui/Bump';
import { cn } from '../../ui/cn';
import { CartSavings } from './CartSavings';
import { GoodsLine, VatLine } from './CartTotals';
import { AdultNotice } from './AdultNotice';
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
  const cart = cartOf(useCart(active).data);
  const clear = useClearCart();
  const shop = useCurrentShop();
  const lines = cart?.lines ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) closeCart(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          data-testid="cart-panel"
          aria-describedby={undefined}
          className={cn(
            // Телефон — нижний лист до 85% высоты с ручкой, как в макете
            // «Карточка товара (телефон)»: витрина остаётся видна над ним.
            'qo-drawer fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] w-full flex-col rounded-t-[24px] border-t border-hairline bg-surface pt-3 shadow-float',
            // С `sm` — выдвижная панель справа во всю высоту.
            'sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[28.75rem] sm:rounded-[var(--radius-gallery)] sm:border-t-0 sm:pt-0',
          )}
        >
          <div data-testid="sheet-handle" aria-hidden="true" className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-center justify-between gap-3 px-4 pb-3 sm:items-start sm:px-6 sm:pb-4 sm:pt-6">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="text-base font-semibold text-ink sm:text-[1.625rem] sm:font-extrabold sm:tracking-[-0.01em]">
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
              <p className="text-[1.1875rem] font-bold text-ink">{t('cart.panelEmptyTitle')}</p>
              <p className="text-body leading-normal text-ink-muted">{t('cart.panelEmpty')}</p>
              <Dialog.Close
                className={cn(
                  'mt-2 h-12 rounded-[var(--radius-control)] border-[1.5px] border-line px-6 text-body font-semibold text-ink',
                  'hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                {t('cart.toCatalog')}
              </Dialog.Close>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
                <CartLines />
              </div>

              <div className="flex flex-col gap-3.5 border-t border-hairline px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
                {/*
                  Итоги по макету «Каталог v2»: товары, скидки, налог, итог.
                  НДС — последним перед «Итого»: он «в том числе» именно
                  в итоге, уже после скидки на заявку.
                */}
                {cart && <GoodsLine cart={cart} />}
                <CartSavings cart={cart} />
                {cart && <VatLine cart={cart} />}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold text-ink">{t('cart.total')}</span>
                  <Bump value={cart?.total ?? 0} className="text-[1.75rem] font-extrabold tracking-[-0.02em] tabular-nums text-ink">
                    {money(cart?.total ?? 0, currency)}
                  </Bump>
                </div>
                {/* Единственное главное действие панели — крупное и цветом магазина. */}
                <Link
                  to="/checkout"
                  onClick={closeCart}
                  className={cn(
                    'flex h-14 w-full items-center justify-center gap-2.5 rounded-[var(--radius-tile)] bg-accent',
                    'text-lead font-bold text-on-accent transition-colors duration-200 hover:bg-accent-hover',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  )}
                >
                  {t('cart.checkoutFull')}
                  <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
                <Dialog.Close
                  className={cn(
                    'h-12 w-full rounded-[var(--radius-control)] border-[1.5px] border-line text-body font-semibold text-ink',
                    'hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  )}
                >
                  {t('cart.continue')}
                </Dialog.Close>
                <AdultNotice cart={cart} />
                <p className="flex gap-2.5 text-caption leading-[1.45] text-ink-muted">
                  <Info aria-hidden="true" className="mt-px size-4 shrink-0" />
                  {t('cart.payLater')}
                </p>
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
        className="h-10 shrink-0 rounded-[calc(var(--radius-control)*11/14)] bg-white px-3.5 font-bold text-[#1A1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {t('cart.open')}
      </button>
    </div>
  );
}
