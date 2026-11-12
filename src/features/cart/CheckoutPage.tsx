import { useEffect, useState } from 'react';
import { BranchNote } from '../city/BranchNote';
import { CITY_CHIP, HeaderCity } from '../city/HeaderCity';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Phone, Send, Truck } from '../../ui/icons';
import { useWideScreen } from '../../ui/useWideScreen';
import { openCart } from './cartDrawer';
import { LineThumb } from './LineThumb';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { cartOf, useCart, useClearCart } from './useCart';
import { CartLines, SkippedNotice, showsStock } from './CartLines';
import { StockNote } from '../catalog/StockNote';
import { DeliveryBlock, hasDeliveryExtras, missingToFree, useDeliveryOptions } from './DeliveryBlock';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { phone as formatPhone } from '../../shared/format';
import { CartSavings } from './CartSavings';
import { AdultNotice } from './AdultNotice';
import { useCheckout, type Checkout } from './useCheckout';
import { useCartPart } from './cartPart';
import { PartSwitch } from './PartSwitch';
import { CheckoutBreakdown, CheckoutTotal } from './CheckoutBreakdown';
import { VolumeHint } from '../catalog/views/VolumeHint';
import { CreditNotice } from './CreditNotice';
import { PaymentChoice } from './PaymentChoice';
import { useGetPortalPromotions, type DeliveryOptionsDto } from '../../api/generated';
import { PageHelp } from '../shell/HelpGuide';

type Step = 1 | 2 | 3;

/**
 * Оформление по шагам («Вариант Б», макеты SimplePicCart / SimplePicCheckout* / SimplePicWebCheckout).
 *
 * Телефон — три экрана: «Товары» → «Как получить» → «Отправить», кнопкой «Дальше»; «Назад» ведёт
 * на шаг раньше. Монитор — один экран: полоса шагов, слева способ получения и пожелания, справа
 * «Ваша заявка» с итогом и кнопкой; товары правятся в выдвижной корзине («Изменить товары»).
 *
 * Контрагент известен по учётной записи, реквизиты известны поставщику. Пока способ получения
 * не выбран, заявка дойдёт до менеджера с неразрешённой доставкой — это рабочее состояние.
 * Расхождение корзины с каталогом приходит отказом 409 вместе с самой корзиной: заявка не
 * создаётся, и решение принимает клиент — телефон для этого возвращается к товарам.
 */
export function CheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const wide = useWideScreen();
  const checkout = useCheckout();
  const parts = useCartPart();
  const { lines, goodsTotal, loadersLines, delivery, setDelivery, submitted, stale } = checkout;
  const [step, setStep] = useState<Step>(1);
  // Шаг «Как получить» на телефоне — два экрана: «где и когда», затем «грузчики и перевозчик», если они есть.
  const [extrasOpen, setExtrasOpen] = useState(false);
  const options = useDeliveryOptions();
  const chosenMethod = options?.methods.find((candidate) => candidate.id === delivery.methodId);
  const withExtras = hasDeliveryExtras(chosenMethod);
  const currency = useSupplierCurrency();
  const onExtras = step === 2 && extrasOpen && withExtras;
  const go = (next: Step, extrasScreen = false) => { setStep(next); setExtrasOpen(extrasScreen); window.scrollTo?.({ top: 0 }); };
  const back_ = () => (onExtras ? go(2) : step === 3 && withExtras ? go(2, true) : go((step - 1) as Step));
  // Корзина изменилась на сервере — решать клиенту, поэтому назад к товарам.
  useEffect(() => { if (stale) setStep(1); }, [stale]);

  if (submitted) {
    const other = checkout.part ? (checkout.part === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE') : undefined;
    const left = other ? parts.counts[other] : 0;
    return (
      <div className="mx-auto flex max-w-[36rem] flex-col items-center gap-4 rounded-[var(--radius-card)] bg-surface px-6 py-12 text-center shadow-[0_0_0_1px_var(--color-hairline)]">
        <span className="flex size-20 items-center justify-center rounded-full bg-in-stock/12 text-in-stock">
          <Check aria-hidden="true" className="size-10" strokeWidth={2.4} />
        </span>
        <h1 className="text-display font-extrabold tracking-[-0.02em] text-ink">{t('checkout.sent.title')}</h1>
        <p className="text-base leading-normal text-ink-muted">{t('checkout.sent.note')}</p>
        {/* Оптовая и розничная заявки раздельные: вторая ждёт в корзине — к ней одним нажатием. */}
        {other && left > 0 && (
          <Button variant="accent" size="xl" className="w-full" onClick={() => { parts.setMode(other); checkout.again(); setStep(1); }}>
            {t(`checkout.part.next.${other}`, { count: left })}
          </Button>
        )}
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

  const current: Step = wide ? 2 : step;
  const title = wide ? t('checkout.title') : onExtras ? t('checkout.steps.titleExtras') : t(`checkout.steps.title${step}`);
  const back = !wide && step > 1
    ? <button type="button" aria-label={t('checkout.steps.back')} onClick={back_} className={BACK}>
        <ArrowLeft aria-hidden="true" className="size-5" />
      </button>
    : <Link to="/catalog" aria-label={t('checkout.back')} className={BACK}><ArrowLeft aria-hidden="true" className="size-5" /></Link>;

  const delivery_ = <DeliveryBlock goodsTotal={goodsTotal} value={delivery} onChange={setDelivery} lines={loadersLines} />;

  if (wide) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          {back}
          <h1 className="qo-page-title">{title}</h1>
          <BranchNote />
          <div className="ml-auto"><Steps current={current} wide /></div>
          {/* «Как пользоваться» — у названия экрана: из шапки монитора кнопка убрана. */}
          <PageHelp className="shrink-0" />
        </div>
        <div data-testid="checkout-layout" className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <PartSwitch parts={parts} />
            <Notices checkout={checkout} />
            {/* Корзина изменилась — состав с «было/стало» прямо здесь: решать клиенту. */}
            {stale && <GoodsCard />}
            {delivery_}
            {checkout.askCredit && <PaymentChoice checkout={checkout} />}
            <NoteField checkout={checkout} />
          </div>
          <Summary checkout={checkout} wide />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {back}
        <h1 className="qo-page-title flex-1">{title}</h1>
        <PageHelp />
      </div>
      {step === 1 && <PartSwitch parts={parts} />}
      {/* Город клиента — для него считается доставка; нажатие — в профиль, где он меняется. */}
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        <HeaderCity className={CITY_CHIP} />
        <BranchNote />
      </div>
      <Steps current={current} />
      <Notices checkout={checkout} />

      {step === 1 && (
        <>
          <ClearCart />
          <GoodsCard />
          {/* Низ как в макете SimplePicCart: какая заявка и на сколько, затем «Дальше: как получить». */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lead font-bold text-ink">
                {t(parts.split && parts.part ? `checkout.part.${parts.part}` : 'checkout.summary.yours')}
              </span>
              <b data-testid="goods-total" className="whitespace-nowrap text-display font-extrabold tabular-nums text-ink">
                {checkout.cart ? money(checkout.cart.total, currency) : null}
              </b>
            </div>
            <NextButton label={t('checkout.steps.nextReceive')} disabled={lines.length === 0} onClick={() => go(2)} />
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <DeliveryBlock goodsTotal={goodsTotal} value={delivery} onChange={setDelivery} lines={loadersLines}
            part={onExtras ? 'extras' : 'where'} />
          {!onExtras && <DeliveryFoot method={chosenMethod} shipping={checkout.totals.shipping} goodsTotal={goodsTotal} />}
          <NextButton disabled={lines.length === 0} onClick={() => (onExtras || !withExtras ? go(3) : go(2, true))} />
        </>
      )}

      {step === 3 && (
        <>
          <ReceiveCard checkout={checkout} onChange={() => go(2)} />
          {checkout.askCredit && <PaymentChoice checkout={checkout} />}
          <NoteField checkout={checkout} />
          <Summary checkout={checkout} wide={false} />
        </>
      )}
    </div>
  );
}

/** Состав заявки с «− +» у строк — шаг «Товары» на телефоне. */
function GoodsCard() {
  const { t } = useTranslation();
  return (
    <Card aria-labelledby="checkout-lines-title" role="region" className="flex flex-col gap-2 p-5">
      <h2 id="checkout-lines-title" className="text-xl font-bold text-ink">{t('checkout.linesTitle')}</h2>
      <CartLines withSkipped={false} />
      <Link to="/catalog" className="self-start text-sm font-semibold text-accent-ink underline underline-offset-[3px]">
        {t('checkout.addGoods')}
      </Link>
    </Card>
  );
}

const BACK = 'flex size-14 shrink-0 items-center justify-center rounded-[var(--radius-control)] border-2 border-line bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** Полоса шагов: пройденные — зелёные с галочкой, текущий — жёлтый, впереди — серые. */
function Steps({ current, wide = false }: { current: Step; wide?: boolean }) {
  const { t } = useTranslation();
  return (
    <ol aria-label={t('checkout.steps.label')} className={cn('m-0 flex list-none gap-1.5 p-0', !wide && 'w-full')}>
      {([1, 2, 3] as const).map((n) => {
        const done = n < current;
        return (
          <li key={n} aria-current={n === current ? 'step' : undefined}
            className={cn(
              'flex h-10 items-center justify-center gap-1 rounded-xl text-caption font-extrabold leading-tight',
              // Телефон: три шага делят ширину поровну и не вылезают за экран (на 390 точках «Отправить» обрезался).
              wide ? 'whitespace-nowrap px-3' : 'min-w-0 flex-1 px-1 text-center text-2xs',
              done ? 'bg-shop text-on-shop' : n === current ? 'bg-hit-soft text-hit-ink' : 'bg-sunk text-ink-faint',
            )}>
            {done ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : <span aria-hidden="true">{n}</span>}
            {t(`checkout.steps.${wide ? 'wide' : 'short'}${n}`)}
          </li>
        );
      })}
    </ol>
  );
}

/** Над «Дальше» на экране доставки: сколько стоит и сколько не хватает до бесплатной (макет). */
function DeliveryFoot({ method, shipping, goodsTotal }: {
  method: DeliveryOptionsDto['methods'][number] | undefined;
  shipping: number | undefined;
  goodsTotal: number;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  // Цены нет (договорная, зона не выбрана, платят перевозчику) — молчим: «Доставка по договорённости»
  // над «Дальше» путала (владелец 2026-11-09), а договорную уже назвала карточка способа.
  if (!method || method.pickup || shipping === undefined) return null;
  const missing = missingToFree(method, goodsTotal);
  const cost = shipping === 0 ? t('checkout.steps.free') : money(shipping, currency);
  return (
    <p data-testid="delivery-foot" className="m-0 text-base font-bold text-ok-ink">
      {t('checkout.steps.deliveryFoot', { cost })}
      {missing !== undefined && method.freeFromAmount !== undefined
        ? ` · ${t('checkout.steps.freeFoot', { from: money(method.freeFromAmount, currency), missing: money(missing, currency) })}`
        : ''}
    </p>
  );
}

function NextButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label?: string }) {
  const { t } = useTranslation();
  return (
    <Button variant="accent" size="xl" className="h-16 w-full rounded-[1.375rem] text-lg" disabled={disabled} onClick={onClick}>
      {label ?? t('checkout.steps.next')}
      <ChevronRight aria-hidden="true" className="size-6" />
    </Button>
  );
}

/** Отказы и расхождения — на любом шаге: «не добавлено», магазин закрыт, отправка не удалась, корзина изменилась. */
function Notices({ checkout }: { checkout: Checkout }) {
  const { t } = useTranslation();
  const { closed, failed, stale } = checkout;
  const box = 'flex flex-col gap-1 rounded-[var(--radius-tile)] border border-unclear/30 bg-unclear/8 p-4';
  return (
    <>
      <SkippedLines />
      {closed && (
        <div role="alert" className={box}>
          <p className="font-semibold text-ink">{t('checkout.closed.title')}</p>
          <p className="text-sm text-ink-muted">{t('checkout.closed.note')}</p>
        </div>
      )}
      {failed && (
        <div role="alert" className={box}>
          <p className="font-semibold text-ink">{t(`checkout.${failed}.title`)}</p>
          <p className="text-sm text-ink-muted">{t(`checkout.${failed}.note`)}</p>
          {failed === 'maybeSent' && (
            <Link to="/orders" className="self-start text-sm font-semibold text-accent underline">{t('orders.title')}</Link>
          )}
        </div>
      )}
      {stale && (
        <div role="alert" className={box}>
          <p className="font-semibold text-ink">{t('checkout.changed.title')}</p>
          <p className="text-sm text-ink-muted">{t('checkout.changed.note')}</p>
        </div>
      )}
    </>
  );
}

/** Пожелание продавцу — поле на виду, как в макете: «можно не писать». */
function NoteField({ checkout }: { checkout: Checkout }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="checkout-comment" className="text-lead font-extrabold text-ink">
        {t('checkout.comment')} <span className="font-medium text-ink-muted">— {t('checkout.optionalShort')}</span>
      </label>
      <textarea
        id="checkout-comment"
        rows={2}
        value={checkout.note}
        maxLength={rules.SubmitOrderRequest.note.maxLength}
        onChange={(event) => checkout.setNote(event.currentTarget.value)}
        placeholder={t('checkout.commentPlaceholder')}
        className="w-full resize-y rounded-[var(--radius-control)] border-2 border-field-line bg-surface p-3.5 text-base text-ink placeholder:text-ink-subtle focus:border-shop focus:ring-1 focus:ring-shop focus:outline-none"
      />
    </div>
  );
}

/** «Как получите» на последнем шаге телефона — с «Изменить», чтобы вернуться к выбору. */
function ReceiveCard({ checkout, onChange }: { checkout: Checkout; onChange: () => void }) {
  const { t } = useTranslation();
  const chosen = !!checkout.delivery.methodId;
  return (
    <Card className="flex items-center gap-3 p-4">
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ok-soft text-ok-ink">
        <Truck className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-lead font-extrabold text-ink">{t('checkout.steps.receive')}</b>
        <span className="text-sm text-ink-muted">{t(chosen ? 'checkout.steps.receiveChosen' : 'checkout.steps.receiveLater')}</span>
      </span>
      <button type="button" onClick={onChange} className="cursor-pointer border-0 bg-transparent p-0 text-body font-bold text-shop-ink underline-offset-4 hover:underline">
        {t('checkout.steps.change')}
      </button>
    </Card>
  );
}

/** «Ваша заявка»: итог, телефон для связи, что будет дальше и отправка. На мониторе — колонкой справа. */
function Summary({ checkout, wide }: { checkout: Checkout; wide: boolean }) {
  const { t } = useTranslation();
  const { phone: viewerPhone } = useAuth();
  const { cart, lines, totals } = checkout;
  const promotionsQuery = useGetPortalPromotions();
  const promotions = promotionsQuery.data?.status === 200 ? promotionsQuery.data.data : undefined;
  return (
    <Card
      data-testid="checkout-summary"
      aria-label={t('checkout.summary.title')}
      className={cn('flex flex-col gap-3.5 p-5', wide && 'sticky top-[calc(var(--header-h)+1.5rem)] border-[3px] border-shop p-6')}
    >
      {wide && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-title font-extrabold text-ink">{t('checkout.summary.yours')}</h2>
            <button type="button" onClick={openCart} className="cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-shop-ink underline-offset-4 hover:underline">
              {t('checkout.editGoods')}
            </button>
          </div>
          {lines.length > 0 && (
            <div aria-hidden="true" className="flex gap-2 overflow-hidden">
              {lines.slice(0, 5).map((line) => (
                <LineThumb key={`${line.itemId}:${line.mode ?? ''}`} seed={line.itemId} src={line.imageUrl} className="size-14 shrink-0 rounded-[var(--radius-control)]" />
              ))}
            </div>
          )}
          {/* Наличие по строкам — миниатюры его не показывают, а «Продавец проверит, всё ли есть» ниже. */}
          {lines.some(showsStock) && (
            <ul data-testid="checkout-stock" className="m-0 flex list-none flex-col gap-1 p-0">
              {lines.filter(showsStock).map((line) => (
                <li key={`${line.itemId}:${line.mode ?? ''}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{line.name}</span>
                  <StockNote stock={line.stock} available={line.available} needed={line.quantity} short className="mt-0 shrink-0 text-caption" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <CheckoutBreakdown checkout={checkout} details />
      <CartSavings cart={cart} withTier={false} />
      <CreditNotice cart={cart} />
      <CheckoutTotal checkout={checkout} details />
      {viewerPhone && (
        <p className="m-0 flex items-center gap-2 text-sm text-ink">
          <Phone aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <span>{t('checkout.contact')} <b className="tabular-nums">{formatPhone(viewerPhone)}</b></span>
        </p>
      )}
      <section className="rounded-[1.125rem] bg-ok-soft px-3.5 py-3 text-sm text-ok-ink">
        <b className="mb-1 block text-body">{t('checkout.next.title')}</b>
        <ol className="m-0 flex list-decimal flex-col gap-0.5 pl-5">
          <li>{t('checkout.next.check')}</li>
          <li>{t('checkout.next.decide')}</li>
          <li>{t('checkout.next.deliver')}</li>
        </ol>
      </section>
      <Button
        variant="accent"
        size="xl"
        className="h-auto min-h-16 w-full whitespace-normal rounded-[1.375rem] py-2 text-lg leading-tight"
        disabled={lines.length === 0 || checkout.credit === null}
        busy={checkout.sending}
        onClick={checkout.send}
      >
        <Send aria-hidden="true" className="size-6" />
        {checkout.sending ? t('checkout.sending') : t('checkout.send')}
      </Button>
      {checkout.credit === null && lines.length > 0 && (
        <p role="note" className="m-0 text-center text-sm font-semibold text-ink">{t('checkout.payment.required')}</p>
      )}
      {totals.shipping === undefined && !totals.direct && (
        <p className="text-sm text-ink-muted">{t('checkout.summary.shippingNote')}</p>
      )}
      <AdultNotice cart={cart} />
      {wide && <VolumeHint data={promotions} compact />}
      {/* Крупнее мелкой сноски (просьба владельца 2026-11-06): последняя строка экрана, её читают перед отправкой. */}
      <p className="text-center text-base font-semibold text-ink-muted">{t('checkout.payLaterShort')}</p>
    </Card>
  );
}

/** Позиции, которые положить не удалось, — отдельно от сводки: на телефоне её состав спрятан. */
function SkippedLines() {
  const cart = cartOf(useCart().data);
  return <SkippedNotice skipped={cart?.skipped ?? []} />;
}

/**
 * «Очистить корзину» — со вторым нажатием: весь набранный товар одним касанием
 * пропадал бы и от случайного нажатия.
 */
function ClearCart() {
  const { t } = useTranslation();
  const lines = cartOf(useCart().data)?.lines.length ?? 0;
  const clear = useClearCart();
  const [asking, setAsking] = useState(false);
  if (lines === 0) return null;
  const full = asking ? t('cart.clearSure') : t('cart.clearAll');
  return (
    <button
      type="button"
      disabled={clear.isPending}
      onClick={() => (asking ? clear.mutate(undefined, { onSettled: () => setAsking(false) }) : setAsking(true))}
      onBlur={() => setAsking(false)}
      // Пилюлей, не шире своего текста, у правого края.
      className={cn(
        'inline-flex h-9 shrink-0 self-end items-center whitespace-nowrap rounded-[var(--radius-pill)] border px-3 text-sm font-semibold',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
        asking ? 'border-sale-ink/30 bg-sale-soft text-sale-ink' : 'border-line bg-surface text-ink-muted hover:text-ink',
      )}
    >
      {full}
    </button>
  );
}
