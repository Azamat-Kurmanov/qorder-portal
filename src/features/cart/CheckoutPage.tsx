import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSubmitPortalOrder,
  type CartDto,
  type CartStaleResponse,
  type Delivery,
  type PortalDraftCreated,
} from '../../api/generated';
import { getGetPortalCartQueryKey } from '../../api/generated';
import { cartOf, useCart } from './useCart';
import { CartLines } from './CartLines';
import { DeliveryBlock, deliveryPrice, useDeliveryOptions } from './DeliveryBlock';
import { tenge } from '../../shared/format';

/**
 * Выбор по доставке или его отсутствие.
 *
 * Пустой объект отправлять нельзя: он означал бы «клиент выбрал», а выбора
 * не было, и заявка ушла бы менеджеру с видом сделанного решения.
 */
function chosen(delivery: Delivery): Delivery | undefined {
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = cartOf(useCart().data);
  const [note, setNote] = useState('');
  const [delivery, setDelivery] = useState<Delivery>({});
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [stale, setStale] = useState<CartStaleResponse | null>(null);
  // Условия доставки спрашиваются до всякого ветвления экрана: хук, стоящий
  // после раннего возврата, вызывается не на каждый отрисовке, и React такое
  // дерево не собирает.
  const options = useDeliveryOptions();
  const goodsTotal = cart?.total ?? 0;

  const submit = useSubmitPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        setStale(null);
        setSubmitted((response.data as PortalDraftCreated).draftId);
        void queryClient.invalidateQueries({ queryKey: getGetPortalCartQueryKey() });
      },
      onError: (error) => {
        const info = (error as { info?: CartStaleResponse }).info;
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
      <div className="flex flex-col items-start gap-4 p-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t('checkout.sent.title')}</h1>
        <p className="text-ink-muted">
          {t('checkout.sent.note')}
        </p>
        <Button size="lg" onClick={() => navigate('/catalog')}>{t('checkout.sent.toCatalog')}</Button>
      </div>
    );
  }

  const lines = cart?.lines ?? [];
  const method = options?.methods.find((candidate) => candidate.id === delivery.methodId);
  // Пусто означает «стоимость пока неизвестна», а не «бесплатно»: у зонального
  // и договорного тарифа её называет поставщик, и показать вместо неё ноль
  // значило бы пообещать за него.
  const shipping = deliveryPrice(method, goodsTotal, delivery.zoneId);

  return (
    <div className="flex flex-col gap-4">
      {/*
        Заголовок совпадает с названием раздела в меню: разойдись они —
        и человек, нажавший «Оформление», окажется на экране с другим именем
        и решит, что промахнулся.
      */}
      <h1 className="text-xl font-semibold tracking-tight text-ink lg:text-2xl">{t('checkout.title')}</h1>

      {/*
        На мониторе итог стоит отдельной колонкой справа и остаётся на месте
        при прокрутке: состав заявки длиннее экрана, и сумма, уехавшая вверх,
        заставляет прокручивать обратно ради одной цифры.
      */}
      <div
        data-testid="checkout-layout"
        // На телефоне обычный поток, а не одноколоночная сетка: липкий итог
        // держится за родителя, а в сетке родителем ему становится своя же
        // строка — и липнуть оказывается не к чему.
        className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6"
      >
        <div className="flex min-w-0 flex-col gap-3">
          {stale && (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-unclear/30 bg-unclear/8 p-4"
            >
              <p className="font-medium text-ink">{t('checkout.changed.title')}</p>
              <p className="text-sm text-ink-muted">
                {t('checkout.changed.note')}
              </p>
            </div>
          )}

          {/*
            Количество здесь не правят: заявку на этом экране сверяют, а меняют
            состав в корзине. Поэтому строка называет «5 мешков × 2 500 ₸» —
            то, что человек сличает с накладной.
          */}
          <CartLines editable={false} />

          <DeliveryBlock goodsTotal={goodsTotal} value={delivery} onChange={setDelivery} />

          <Card className="flex flex-col gap-2 p-3.5">
            <label className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-ink">{t('checkout.comment')}</span>
              <textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
                placeholder={t('checkout.commentPlaceholder')}
                className={cn(
                  'w-full resize-y rounded-[var(--radius-tile)] border border-hairline bg-surface p-3',
                  'text-sm text-ink placeholder:text-ink-faint',
                  'transition-all duration-300 focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
                )}
              />
            </label>
          </Card>
        </div>

        {/*
          На телефоне тот же итог липнет к низу: кнопка отправки не должна
          требовать прокрутки через весь состав заявки. Полоса жестов съедает
          низ экрана — без учёта безопасной области кнопка уходит под неё.
        */}
        <Card
          data-testid="checkout-summary"
          className={cn(
            'sticky bottom-0 z-10 flex flex-col gap-2.5 p-4',
            'pb-[calc(1rem+env(safe-area-inset-bottom))]',
            'lg:bottom-auto lg:top-4 lg:pb-4',
          )}
        >
          <p className="text-base font-semibold text-ink">{t('checkout.summary.title')}</p>

          <div className="flex justify-between text-sm text-ink-muted">
            <span>{t('checkout.summary.goods')}</span>
            <span data-testid="goods-total" className="tabular-nums text-ink">
              {tenge(goodsTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-ink-muted">
            <span>{t('checkout.summary.delivery')}</span>
            <span data-testid="delivery-total" className="tabular-nums text-ink">
              {shipping === undefined ? t('checkout.summary.negotiable') : tenge(shipping)}
            </span>
          </div>

          <div className="h-px bg-hairline" />

          <div className="flex items-baseline justify-between text-lg font-bold tracking-tight text-ink">
            <span>{t('checkout.summary.toPay')}</span>
            <span data-testid="total" className="tabular-nums">
              {tenge(goodsTotal + (shipping ?? 0))}
            </span>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={lines.length === 0 || submit.isPending}
            onClick={() =>
              submit.mutate({
                data: { note: note.trim() || undefined, delivery: chosen(delivery) },
              })
            }
          >
            {submit.isPending ? t('checkout.sending') : t('checkout.send')}
          </Button>

          {shipping === undefined && (
            <p className="text-xs text-ink-subtle">
              {t('checkout.summary.shippingNote')}
            </p>
          )}
          <p className="hidden text-xs leading-relaxed text-ink-subtle lg:block">
            {t('checkout.note')}
          </p>
        </Card>
      </div>
    </div>
  );
}
