import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ClipboardList, Send, ShoppingCart, X, type IconComponent } from '../../ui/icons';
import { useGetMyPortalOrders } from '../../api/generated';
import { cartOf, useCart } from '../cart/useCart';
import { cn } from '../../ui/cn';

/** Скрытый блок помнится в браузере: это удобство, а не данные покупателя. */
const HIDDEN_KEY = 'qo.portal.firstSteps.hidden';

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Заявка ещё у продавца — ответа нет. Любое другое состояние — он ответил. */
const WAITING = new Set(['SUBMITTED', 'IN_REVIEW']);

interface Step {
  key: 'cart' | 'send' | 'answer';
  icon: IconComponent;
  href: string;
  done: boolean;
}

/**
 * «Как сделать первый заказ» — три шага для покупателя, который вошёл
 * впервые: положить товар в корзину, отправить заявку, дождаться ответа.
 * Галочки ставятся сами — по корзине и заявкам, а не по отметкам. Как только
 * продавец ответил на первую заявку, блок пропадает: дальше покупатель
 * дорогу знает. `active` — кабинет открыт и магазин выбран: без этого
 * запросы корзины и заявок вернули бы отказ.
 */
export function FirstSteps({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(readHidden);
  const cart = useCart(active && !hidden);
  const orders = useGetMyPortalOrders({ query: { enabled: active && !hidden } });

  if (!active || hidden || cart.isPending || orders.isPending) return null;
  const list = orders.data?.status === 200 ? orders.data.data : [];
  const lines = cartOf(cart.data)?.lines.length ?? 0;
  const sent = list.length > 0;
  const answered = list.some((order) => !WAITING.has(order.state ?? ''));
  if (answered) return null;

  const steps: Step[] = [
    { key: 'cart', icon: ShoppingCart, href: '/catalog', done: lines > 0 || sent },
    { key: 'send', icon: Send, href: '/checkout', done: sent },
    { key: 'answer', icon: ClipboardList, href: '/orders', done: false },
  ];

  const hide = () => {
    try {
      window.localStorage.setItem(HIDDEN_KEY, '1');
    } catch {
      // Без хранилища блок просто вернётся при следующем заходе.
    }
    setHidden(true);
  };

  // Справа — место под плавающую кнопку «вниз» (ScrollJumps): иначе она закрывает «Скрыть».
  return (
    <section aria-label={t('firstSteps.title')} className="border-b border-hairline bg-accent-soft/50 py-3 pl-4 pr-16 lg:pl-7 lg:pr-24">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm font-semibold text-ink">{t('firstSteps.title')}</span>
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          {steps.map((step, index) => (
            <li key={step.key}>
              <Link
                to={step.href}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-[13px] font-medium',
                  step.done ? 'border-transparent text-ink-muted line-through' : 'border-hairline bg-surface text-ink hover:border-accent',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-xs font-bold',
                    step.done ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent',
                  )}
                >
                  {step.done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <step.icon aria-hidden="true" className="size-4" />
                {t(`firstSteps.steps.${step.key}`)}{' '}
                <span className="sr-only">{t(step.done ? 'firstSteps.done' : 'firstSteps.todo')}</span>
              </Link>
            </li>
          ))}
        </ol>
        <span className="text-[13px] text-ink-muted">{t('firstSteps.noPay')}</span>
        <button
          type="button"
          onClick={hide}
          className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-control)] px-2 text-[13px] text-ink-muted hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
          {t('firstSteps.hide')}
        </button>
      </div>
    </section>
  );
}
