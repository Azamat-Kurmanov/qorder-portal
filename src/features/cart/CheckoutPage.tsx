import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSubmitPortalOrder,
  type CartDto,
  type CartStaleResponse,
  type SubmitOrderDelivery,
  type PortalDraftCreated,
} from '../../api/generated';
import { getGetPortalCartQueryKey, getGetPortalSuppliersQueryKey } from '../../api/generated';
import { cartOf, useCart } from './useCart';
import { CartLines, SkippedNotice } from './CartLines';
import { DeliveryBlock, deliveryPrice, useDeliveryOptions } from './DeliveryBlock';
import { phone as formatPhone, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { CartSavings } from './CartSavings';
import { GoodsLine, VatLine } from './CartTotals';
import { paysCarrierDirectly } from './carrier';
import { chosenLoaders, type LoadersLine } from './loaders';
import { AdultNotice } from './AdultNotice';

/**
 * Выбор по доставке или его отсутствие.
 *
 * Пустой объект отправлять нельзя: он означал бы «клиент выбрал», а выбора
 * не было, и заявка ушла бы менеджеру с видом сделанного решения.
 */
function chosen(delivery: SubmitOrderDelivery): SubmitOrderDelivery | undefined {
  return delivery.methodId || delivery.pickupPointId ? delivery : undefined;
}

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
  const currency = useSupplierCurrency();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Перед заявкой знак валюты — свежий: продавец мог сменить валюту, пока
  // список поставщиков лежал в кеше (staleTime минута).
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: getGetPortalSuppliersQueryKey() });
  }, [queryClient]);
  const cart = cartOf(useCart().data);
  const { phone: viewerPhone } = useAuth();
  const [note, setNote] = useState('');
  const [delivery, setDelivery] = useState<SubmitOrderDelivery>({});
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [stale, setStale] = useState<CartStaleResponse | null>(null);
  // Поставщик приостановлен платформой: заявку не примут, корзина остаётся.
  const [closed, setClosed] = useState(false);
  // Условия доставки спрашиваются до всякого ветвления экрана: хук, стоящий
  // после раннего возврата, вызывается не на каждый отрисовке, и React такое
  // дерево не собирает.
  const options = useDeliveryOptions();
  // Товары — до скидки на заявку: скидка стоит отдельной строкой ниже,
  // и сумма к оплате складывается у человека на глазах.
  const goodsTotal = cart?.goodsTotal ?? cart?.total ?? 0;
  const payForGoods = cart?.total ?? 0;

  const submit = useSubmitPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        setStale(null);
        setClosed(false);
        setSubmitted((response.data as PortalDraftCreated).draftId);
        void queryClient.invalidateQueries({ queryKey: getGetPortalCartQueryKey() });
      },
      onError: (error) => {
        const info = (error as { info?: CartStaleResponse }).info;
        setClosed(info?.code === 'TENANT_INTAKE_CLOSED');
        if (info?.code === 'CART_STALE') {
          setStale(info);
          // Корзина в теле отказа — уже пересчитанная: кладём её в кеш,
          // чтобы экран показал то же, что увидел сервер.
          queryClient.setQueryData<{ data: CartDto }>(getGetPortalCartQueryKey(), {
            ...(queryClient.getQueryData(getGetPortalCartQueryKey()) as { data: CartDto }),
            data: info.cart,
          });
        }
      },
    },
  });

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

  const lines = cart?.lines ?? [];
  const method = options?.methods.find((candidate) => candidate.id === delivery.methodId);
  // Пусто означает «стоимость пока неизвестна», а не «бесплатно»: у зонального
  // и договорного тарифа её называет поставщик, и показать вместо неё ноль
  // значило бы пообещать за него.
  const shipping = deliveryPrice(method, goodsTotal, delivery.zoneId);
  // Доставку, оплачиваемую перевозчику напрямую, клиент видит, но в итог она не входит.
  const direct = paysCarrierDirectly(method);
  const shippingInTotal = direct ? 0 : shipping ?? 0;
  // Корзина считается в штуках: по ним и вес, и «за количество».
  const loadersLines: LoadersLine[] = lines.map((line) => ({ quantity: line.quantity ?? 0, unitWeightKg: line.unitWeightKg }));
  // Грузчики продавцу входят в итог; «напрямую» — строкой под итогом, в сумму не входят.
  const loaders = chosenLoaders(method?.loaders, delivery, loadersLines);
  const loadersInTotal = loaders && !loaders.direct ? loaders.amount ?? 0 : 0;

  return (
    <div className="flex flex-col gap-5">
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
          <h2 className="text-xl font-bold text-ink">{t('checkout.summary.title')}</h2>

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

          <div className="flex flex-col gap-2 border-t border-hairline pt-3.5">
            {/* Пустая корзина — без «Товары, 0 позиций · 0 тенге» и без НДС: нулевые строки читаются как посчитанное. */}
            {cart && lines.length > 0 && <GoodsLine cart={cart} />}
            {/*
              НДС — сразу под товарами, а не над «К оплате»: сервер считает
              налог по товарам, и под суммой с доставкой строка «в т.ч.»
              утверждала бы, что налог внутри доставки уже посчитан.
            */}
            {cart && lines.length > 0 && <VatLine cart={cart} />}
            <div className="flex justify-between gap-2 text-body text-ink-muted">
              <span>{t('checkout.summary.delivery')}</span>
              <span data-testid="delivery-total" className="tabular-nums text-ink">
                {direct
                  ? (shipping === undefined
                    ? t('checkout.delivery.carrierTariff')
                    : t('checkout.summary.deliveryInfo', { amount: money(shipping, currency) }))
                  : (shipping === undefined ? t('checkout.summary.negotiable') : money(shipping, currency))}
              </span>
            </div>
            {loaders && !loaders.direct && (
              <div className="flex justify-between gap-2 text-body text-ink-muted">
                <span>{t('checkout.summary.loaders')}</span>
                <span data-testid="loaders-total" className="tabular-nums text-ink">
                  {loaders.amount === undefined ? t('checkout.summary.loadersLater') : money(loaders.amount, currency)}
                </span>
              </div>
            )}
          </div>

          <CartSavings cart={cart} withTier={false} />

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold text-ink">{t('checkout.summary.toPay')}</span>
            <span data-testid="total" className="text-[1.75rem] font-extrabold tracking-[-0.02em] tabular-nums text-ink">
              {money(payForGoods + shippingInTotal + loadersInTotal, currency)}
            </span>
          </div>
          {direct && shipping !== undefined && (
            <p data-testid="delivery-direct" className="text-caption text-ink-muted">
              {t('checkout.summary.deliveryDirect', { amount: money(shipping, currency) })}
            </p>
          )}
          {loaders?.direct && (
            <p data-testid="loaders-direct" className="text-caption text-ink-muted">
              {t('checkout.summary.loadersDirect', {
                amount: loaders.amount === undefined ? t('checkout.summary.loadersLater') : money(loaders.amount, currency),
              })}
            </p>
          )}

          <Button
            variant="accent"
            size="xl"
            className="h-15 w-full rounded-[calc(var(--radius-tile)*1.125)] text-lg"
            disabled={lines.length === 0 || submit.isPending}
            onClick={() =>
              submit.mutate({
                data: { note: note.trim() || undefined, delivery: chosen(delivery) },
              })
            }
          >
            {submit.isPending ? t('checkout.sending') : t('checkout.send')}
          </Button>

          {shipping === undefined && !direct && (
            <p className="text-caption text-ink-muted">{t('checkout.summary.shippingNote')}</p>
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
