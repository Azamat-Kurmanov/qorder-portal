import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
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
          <div className="flex flex-col gap-5 pb-1">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 self-start rounded-md text-body font-semibold text-accent-ink hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="size-[18px]" />
              {t('checkout.back')}
            </Link>

            {/*
              Шаги — подсказка, где человек находится, а не мастер из трёх экранов:
              всё оформление помещается на одну страницу, и листать его по шагам
              значило бы прятать итог.
            */}
            <ol aria-label={t('checkout.steps.label')} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body">
              <li className="flex items-center gap-2 font-semibold text-in-stock">
                <span className="flex size-7 items-center justify-center rounded-full bg-in-stock text-white">
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                </span>
                {t('checkout.steps.chosen')}
              </li>
              <li aria-hidden="true" className="h-0.5 w-8 rounded bg-line" />
              <li aria-current="step" className="flex items-center gap-2 font-bold text-ink">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-sm text-on-accent">2</span>
                {t('checkout.steps.receive')}
              </li>
              <li aria-hidden="true" className="h-0.5 w-8 rounded bg-line" />
              <li className="flex items-center gap-2 font-medium text-ink-muted">
                <span className="flex size-7 items-center justify-center rounded-full border-[1.5px] border-line text-sm">3</span>
                {t('checkout.steps.send')}
              </li>
            </ol>

            <h1 className="qo-page-title">
              {t('checkout.title')}
            </h1>
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
            Состав на телефоне — отдельным блоком наверху: сводка там липнет
            к низу и обязана оставаться низкой, а сверить заказ глазами —
            по снимкам, а не по одной сумме — нужно и на телефоне.
          */}
          <Card aria-labelledby="checkout-lines-title" role="region" className="flex flex-col gap-2 p-5 lg:hidden">
            <h2 id="checkout-lines-title" className="text-xl font-bold text-ink">{t('checkout.linesTitle')}</h2>
            <CartLines editable={false} withSkipped={false} />
            <Link to="/catalog" className="self-start text-sm font-semibold text-accent-ink underline underline-offset-[3px]">
              {t('checkout.editGoods')}
            </Link>
          </Card>

          <DeliveryBlock goodsTotal={goodsTotal} value={delivery} onChange={setDelivery} lines={loadersLines} />

          <Card className="flex flex-col gap-3 p-5 lg:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold text-ink">
                <label htmlFor="checkout-comment">{t('checkout.comment')}</label>
              </h2>
              <span className="text-sm text-ink-subtle">{t('checkout.optional')}</span>
            </div>
            <textarea
              id="checkout-comment"
              rows={3}
              value={note}
              maxLength={rules.SubmitOrderRequest.note.maxLength}
              onChange={(event) => setNote(event.currentTarget.value)}
              placeholder={t('checkout.commentPlaceholder')}
              className={cn(
                'w-full resize-y rounded-[var(--radius-tile)] border-2 border-line bg-surface p-4',
                'text-base text-ink placeholder:text-ink-subtle',
                'transition-all duration-300 focus:border-accent focus:outline-none',
                'focus:shadow-[0_0_0_4px_var(--color-accent-soft)]',
              )}
            />
          </Card>

          {viewerPhone && (
            <Card className="flex flex-col gap-1.5 p-5 lg:p-6">
              <h2 className="text-xl font-bold text-ink">{t('checkout.contact')}</h2>
              <p className="text-[1.375rem] font-bold tabular-nums text-ink">{formatPhone(viewerPhone)}</p>
            </Card>
          )}
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

          {/*
            Количество здесь не правят: заявку на этом экране сверяют, а меняют
            состав в корзине. Поэтому строка называет «5 мешков × 2 500 тенге» —
            то, что человек сличает с накладной. На телефоне состав спрятан:
            сводка там прилипает к низу и обязана оставаться низкой.
          */}
          <div className="hidden max-h-[40vh] overflow-y-auto lg:block">
            <CartLines editable={false} withSkipped={false} />
          </div>
          <Link
            to="/catalog"
            className="hidden self-start text-sm font-semibold text-accent-ink underline underline-offset-[3px] lg:inline"
          >
            {t('checkout.editGoods')}
          </Link>

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

          <div className="hidden flex-col gap-2.5 rounded-[var(--radius-tile)] bg-sunk p-4 lg:flex">
            <h3 className="text-body font-bold text-ink">{t('checkout.next.title')}</h3>
            <ol className="flex flex-col gap-2">
              {(['check', 'change', 'pickup'] as const).map((step, index) => (
                <li key={step} className="flex gap-2.5 text-sm leading-[1.45] text-ink-muted">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">
                    {index + 1}
                  </span>
                  {t(`checkout.next.${step}`)}
                </li>
              ))}
            </ol>
          </div>
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

