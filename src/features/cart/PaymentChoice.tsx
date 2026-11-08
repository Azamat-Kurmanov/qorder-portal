import { useTranslation } from 'react-i18next';
import { Clock, Wallet } from '../../ui/icons';
import { cn } from '../../ui/cn';
import type { Checkout } from './useCheckout';

/**
 * Как клиент берёт товар: за оплату или в долг (под реализацию). Выбор обязателен —
 * продавец видит его сразу в очереди и решает, тратить ли время на заявку «в долг».
 */
export function PaymentChoice({ checkout }: { checkout: Checkout }) {
  const { t } = useTranslation();
  const options = [
    { credit: false, icon: Wallet, key: 'pay' },
    { credit: true, icon: Clock, key: 'credit' },
  ] as const;
  return (
    <fieldset data-testid="payment-choice" className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-lead font-extrabold text-ink">{t('checkout.payment.title')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(({ credit, icon: Icon, key }) => {
          const on = checkout.credit === credit;
          return (
            <label key={key}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border-2 p-3.5',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                // Выбранный — закрашен (просьба владельца 2026-11-07): одну рамку на светлом фоне не видно.
                on ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface',
              )}>
              <input type="radio" name="checkout-payment" className="sr-only" checked={on}
                onChange={() => checkout.setCredit(credit)} />
              <Icon aria-hidden="true" className={cn('mt-0.5 size-6 shrink-0', on ? 'text-on-shop' : 'text-ink-muted')} />
              <span className="flex min-w-0 flex-col">
                <b className={cn('text-base font-extrabold', on ? 'text-on-shop' : 'text-ink')}>{t(`checkout.payment.${key}`)}</b>
                <span className={cn('text-sm', on ? 'text-on-shop/85' : 'text-ink-muted')}>{t(`checkout.payment.${key}Hint`)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
