import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalCartQueryKey,
  getGetPortalSuppliersQueryKey,
  useSubmitPortalOrder,
  type CartDto,
  type CartStaleResponse,
  type PortalDraftCreated,
  type SubmitOrderDelivery,
} from '../../api/generated';
import { cartOf, useCart } from './useCart';
import { deliveryPrice, useDeliveryOptions } from './DeliveryBlock';
import { paysCarrierDirectly } from './carrier';
import { chosenLoaders, type LoadersLine } from './loaders';
import { serviceVat } from './serviceVat';
import { useMotion } from '../../ui/motion/motionLevel';
import { confetti, shouldCelebrate } from '../../ui/motion/confetti';
import { useCabinetDesign } from '../../supplier/cabinetDesign';

/**
 * Выбор по доставке или его отсутствие.
 *
 * Пустой объект отправлять нельзя: он означал бы «клиент выбрал», а выбора
 * не было, и заявка ушла бы менеджеру с видом сделанного решения.
 */
export function chosen(delivery: SubmitOrderDelivery): SubmitOrderDelivery | undefined {
  return delivery.methodId || delivery.pickupPointId ? delivery : undefined;
}

/**
 * Оформление заявки без разметки: корзина, получение, комментарий, итоги
 * и отправка. Одно на витрину (`CheckoutPage`) и на «Простой заказ»
 * (`StepsCheckout`) — два расчёта одной суммы однажды разошлись бы.
 *
 * Расхождение корзины с каталогом приходит отказом 409 вместе с самой
 * корзиной: заявка не создаётся, и решение принимает клиент.
 */
export function useCheckout(initialDelivery?: SubmitOrderDelivery) {
  const queryClient = useQueryClient();
  // Перед заявкой знак валюты — свежий: продавец мог сменить валюту, пока
  // список поставщиков лежал в кеше (staleTime минута).
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: getGetPortalSuppliersQueryKey() });
  }, [queryClient]);
  const cart = cartOf(useCart().data);
  const [note, setNote] = useState('');
  const [delivery, setDelivery] = useState<SubmitOrderDelivery>(initialDelivery ?? {});
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [stale, setStale] = useState<CartStaleResponse | null>(null);
  // Поставщик приостановлен платформой: заявку не примут, корзина остаётся.
  const [closed, setClosed] = useState(false);
  const options = useDeliveryOptions();
  // Товары — до скидки на заявку: скидка стоит отдельной строкой ниже,
  // и сумма к оплате складывается у человека на глазах.
  const goodsTotal = cart?.goodsTotal ?? cart?.total ?? 0;
  const payForGoods = cart?.total ?? 0;

  // Капли и Леденец при «ярко» празднуют отправку заявки конфетти.
  const level = useMotion();
  const design = useCabinetDesign();
  const submit = useSubmitPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        if (shouldCelebrate(level, design.template?.id)) void confetti();
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
  // НДС доставки и грузчиков — той же формулой, что сервер: у товаров он уже
  // в итоге корзины, здесь — только услуги продавца по режиму способа.
  const vatRate = cart?.shopVatRate ?? undefined;
  const deliveryVat = serviceVat(shippingInTotal, vatRate, method?.deliveryVatMode);
  const loadersVat = serviceVat(loadersInTotal, vatRate, method?.loadersVatMode);

  return {
    cart,
    lines,
    goodsTotal,
    loadersLines,
    options,
    method,
    delivery,
    setDelivery,
    note,
    setNote,
    totals: {
      shipping,
      direct,
      shippingInTotal,
      loaders,
      loadersInTotal,
      vatRate,
      deliveryVat,
      loadersVat,
      total: payForGoods + shippingInTotal + loadersInTotal + deliveryVat.onTop + loadersVat.onTop,
    },
    send: () => submit.mutate({ data: { note: note.trim() || undefined, delivery: chosen(delivery) } }),
    sending: submit.isPending,
    submitted,
    stale,
    closed,
  };
}

export type Checkout = ReturnType<typeof useCheckout>;
