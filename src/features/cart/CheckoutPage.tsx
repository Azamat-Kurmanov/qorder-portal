import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, PenLine, Phone, Plus } from '../../ui/icons';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { cartOf, useCart } from './useCart';
import { CartLines, SkippedNotice } from './CartLines';
import { DeliveryBlock } from './DeliveryBlock';
import { phone as formatPhone } from '../../shared/format';
import { CartSavings } from './CartSavings';
import { AdultNotice } from './AdultNotice';
import { useCheckout } from './useCheckout';
import { CheckoutBreakdown, CheckoutTotal } from './CheckoutBreakdown';
import { VolumeHint } from '../catalog/views/VolumeHint';
import { useGetPortalPromotions } from '../../api/generated';

/**
 * Оформление — одна страница и ничего лишнего.
 *
 * Контрагент известен по учётной записи, реквизиты известны поставщику:
 * спрашивать остаётся комментарий. Доставку клиент выбирает там, где поставщик
 * её возит; пока способ не выбран, заявка дойдёт до менеджера с неразрешённой
 * доставкой — это рабочее состояние, а не ошибка.
 *
 * Расхождение корзины с каталогом приходит отказом 409 вместе с самой
 * корзиной: заявка не создаётся, и решение принимает клиент.
 */
export function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { phone: viewerPhone } = useAuth();
  const checkout = useCheckout();
  const { cart, lines, goodsTotal, loadersLines, delivery, setDelivery, note, setNote, submitted, stale, closed } = checkout;
  const { shipping, direct } = checkout.totals;
  /** Расчёт в липкой сводке на телефоне — по нажатию «Подробнее». */
  const [details, setDetails] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const promotionsQuery = useGetPortalPromotions();
  const promotions = promotionsQuery.data?.status === 200 ? promotionsQuery.data.data : undefined;

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-[36rem] flex-col items-center gap-4 rounded-[var(--radius-card)] bg-surface px-6 py-12 text-center shadow-[0_0_0_1px_var(--color-hairline)]">
        <span className="flex size-20 items-center justify-center rounded-full bg-in-stock/12 text-in-stock">
          <Check aria-hidden="true" className="size-10" strokeWidth={2.4} />
        </span>
        <h1 className="text-[1.75rem] font-extrabold tracking-[-0.02em] text-ink">{t('checkout.sent.title')}</h1>
        <p className="text-base leading-normal text-ink-muted">{t('checkout.sent.note')}</p>
        <div className="flex w-full flex-col gap-2.5 pt-2 sm:flex-row sm:justify-center">
          <Button variant="accent" size="lg" onClick={() => navigate('/orders')}>
            {t('checkout.sent.toOrders')}
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/catalog')}>
            {t('checkout.sent.toCatalog')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/*
        На мониторе итог стоит отдельной колонкой справа и остаётся на месте
        при прокрутке: сумма, уехавшая вверх, заставляет прокручивать обратно
        ради одной цифры.
      */}
      <div
        data-testid="checkout-layout"
        // На телефоне обычный поток, а не одноколоночная сетка: липкий итог
        // держится за родителя, а в сетке родителем ему становится своя же строка.
        className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6"
      >
        <div className="flex min-w-0 flex-col gap-4">
          {/*
            Заголовок — внутри левой колонки: итог справа начинается вровень
            с «Вернуться к покупкам», а не под заголовком — иначе над ним
            оставалась пустая полоса высотой в шаги и заголовок.
          */}
          {/* Одна строка: «назад» и заголовок — без шагов (макеты «Кабинет клиента 2.0»):
              всё оформление на одном экране, шаги лишь занимали место. */}
          <div className="flex items-center gap-3">
            <Link
              to="/catalog"
              aria-label={t('checkout.back')}
              className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            <h1 className="qo-page-title">{t('checkout.title')}</h1>
          </div>

          {/* «Не добавлено» — над формой, на любой ширине: молча пропущенная
              позиция обнаруживается уже при отгрузке. */}
          <SkippedLines />

          {closed && (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-[var(--radius-tile)] border border-unclear/30 bg-unclear/8 p-4"
            >
              <p className="font-semibold text-ink">{t('checkout.closed.title')}</p>
              <p className="text-sm text-ink-muted">{t('checkout.closed.note')}</p>
            </div>
          )}

          {stale && (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-[var(--radius-tile)] border border-unclear/30 bg-unclear/8 p-4"
            >
              <p className="font-semibold text-ink">{t('checkout.changed.title')}</p>
              <p className="text-sm text-ink-muted">{t('checkout.changed.note')}</p>
            </div>
          )}

          {/*
            Состав — отдельным блоком наверху, с «− +» у каждой строки, как
            в макетах корзины (К и ПК-К4): сводка справа остаётся итогом,
            а на телефоне липнет к низу и обязана быть низкой.
          */}
          <Card aria-labelledby="checkout-lines-title" role="region" className="flex flex-col gap-2 p-5">
            <h2 id="checkout-lines-title" className="text-xl font-bold text-ink">{t('checkout.linesTitle')}</h2>
            {/* Количество правится прямо здесь, как в макете корзины: за «плюсом» не нужно уходить в каталог. */}
            <CartLines withSkipped={false} />
            <Link to="/catalog" className="self-start text-sm font-semibold text-accent-ink underline underline-offset-[3px]">
              {t('checkout.editGoods')}
            </Link>
          </Card>

          <DeliveryBlock goodsTotal={goodsTotal} value={delivery} onChange={setDelivery} lines={loadersLines} />

          {/* Телефон и пожелание — по строке: пожелание пишут редко, поле раскрывается по нажатию. */}
          <Card className="flex flex-col divide-y divide-hairline px-5 py-1 lg:px-6">
            {viewerPhone && (
              <div className="flex min-h-14 items-center gap-3 py-2">
                <Phone aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[0.8125rem] text-ink-muted">{t('checkout.contact')}</span>
                  <b className="text-[0.9375rem] font-bold tabular-nums text-ink">{formatPhone(viewerPhone)}</b>
                </span>
              </div>
            )}
            {noteOpen || note ? (
              <div className="flex flex-col gap-2 py-3">
                <label htmlFor="checkout-comment" className="text-[0.9375rem] font-semibold text-ink">
                  {t('checkout.comment')} <span className="font-normal text-ink-subtle">· {t('checkout.optional')}</span>
                </label>
                <textarea
                  id="checkout-comment"
                  rows={3}
                  autoFocus={!note}
                  value={note}
                  maxLength={rules.SubmitOrderRequest.note.maxLength}
                  onChange={(event) => setNote(event.currentTarget.value)}
                  placeholder={t('checkout.commentPlaceholder')}
                  className={cn(
                    'w-full resize-y rounded-[var(--radius-tile)] border-0 bg-sunk p-3.5',
                    'text-base text-ink placeholder:text-ink-subtle',
                    'focus:outline-none focus:ring-2 focus:ring-accent',
                  )}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left text-[0.9375rem] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <PenLine aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                <span className="flex-1">{t('checkout.comment')}</span>
                <Plus aria-hidden="true" className="size-5 text-accent-ink" />
              </button>
            )}
          </Card>
        </div>

        {/*
          На телефоне та же сводка липнет к низу: кнопка отправки не должна
          требовать прокрутки через весь состав заявки.
        */}
        <Card
          data-testid="checkout-summary"
          aria-label={t('checkout.summary.title')}
          className={cn(
            'sticky bottom-0 z-10 flex flex-col gap-3.5 p-5',
            'max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]',
            'lg:bottom-auto lg:top-[calc(var(--header-h)+1.5rem)] lg:p-6',
          )}
        >
          {/*
            На телефоне сводка липнет к низу и обязана оставаться низкой: в ней
            итог и кнопка, а расчёт — по «Подробнее». Раскрытой по умолчанию она
            занимала полэкрана и закрывала «Состав заявки» при любой прокрутке.
          */}
          <h2 className={cn('text-xl font-bold text-ink', !details && 'max-lg:hidden')}>{t('checkout.summary.title')}</h2>


          <CheckoutBreakdown checkout={checkout} details={details} />

          <div className={cn(!details && 'max-lg:hidden')}>
            <CartSavings cart={cart} withTier={false} />
          </div>

          <CheckoutTotal checkout={checkout} details={details} onToggle={() => setDetails((open) => !open)} />

          <Button
            variant="accent"
            size="xl"
            className="h-15 w-full rounded-[calc(var(--radius-tile)*1.125)] text-lg"
            disabled={lines.length === 0}
            busy={checkout.sending}
            onClick={checkout.send}
          >
            {checkout.sending ? t('checkout.sending') : t('checkout.send')}
          </Button>

          {shipping === undefined && !direct && (
            <p className={cn('text-caption text-ink-muted', !details && 'max-lg:hidden')}>{t('checkout.summary.shippingNote')}</p>
          )}

          <AdultNotice cart={cart} />

          {/* До оптовой скидки — полосой под кнопкой, на мониторе (макет ПК-К2.4);
              на телефоне сводка липнет к низу и обязана быть низкой. */}
          <div className="max-lg:hidden"><VolumeHint data={promotions} compact /></div>

          <p className={cn('text-center text-caption text-ink-muted', !details && 'max-lg:hidden')}>{t('checkout.payLater')}</p>
        </Card>
      </div>
    </div>
  );
}

/** Позиции, которые положить не удалось, — отдельно от сводки: на телефоне её состав спрятан. */
function SkippedLines() {
  const cart = cartOf(useCart().data);
  return <SkippedNotice skipped={cart?.skipped ?? []} />;
}

