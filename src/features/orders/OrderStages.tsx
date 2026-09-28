import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';
import type { OrderKind } from './myOrdersModel';

/**
 * Четыре этапа идущей заявки — «Отправлена → Продавец проверяет →
 * Подтверждена → Можно забирать», как в макете «Мои заявки».
 *
 * Строка «Где сейчас заявка» называет только текущий шаг; шкала отвечает
 * на вопрос, который задают продавцу по телефону чаще всего: «а дальше
 * что и долго ли ещё?». Когда ход за клиентом, второй шаг так и назван —
 * «Нужен ваш ответ»: заявка стоит на нём, пока клиент не ответит.
 */
const CURRENT: Partial<Record<OrderKind, number>> = { review: 1, answer: 1, accepted: 2, ready: 3 };

export function OrderStages({ kind, delivery }: { kind: OrderKind; delivery: boolean }) {
  const { t } = useTranslation();
  const current = CURRENT[kind];
  if (current === undefined) return null;

  const steps = [
    t('orders.stages.sent'),
    kind === 'answer' ? t('orders.stages.answer') : t('orders.stages.checking'),
    t('orders.stages.accepted'),
    delivery ? t('orders.stages.readyDelivery') : t('orders.stages.ready'),
  ];

  return (
    <ol aria-label={t('orders.stages.label')} className="m-0 grid list-none grid-cols-4 gap-2 p-0">
      {steps.map((step, index) => {
        const done = index < current;
        const now = index === current;
        return (
          <li key={step} aria-current={now ? 'step' : undefined} className="flex min-w-0 flex-col gap-1.5">
            <span className={cn('h-1.5 rounded-full', done || now ? 'bg-accent' : 'bg-hairline')} />
            <span className={cn('flex items-center gap-1 text-caption leading-tight', now ? 'font-bold text-ink' : done ? 'text-ink-muted' : 'text-ink-subtle')}>
              {done ? <Check aria-hidden="true" className="size-3.5 shrink-0 text-accent" /> : null}
              {step}
            </span>
            {now ? <span className="text-2xs font-bold uppercase tracking-[0.06em] text-accent-ink">{t('orders.stages.now')}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
