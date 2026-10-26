import { Check } from '../../ui/icons';
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

  // Полосы, а не кружки с линиями (макеты «Кабинет клиента 2.0»): на узком
  // телефоне четыре подписи под кружками наезжали друг на друга. Подпись
  // переносится внутри своей колонки — по слогам, если слово длинное.
  return (
    <ol aria-label={t('orders.stages.label')} className="m-0 grid list-none grid-cols-4 gap-1.5 p-0">
      {steps.map((step, index) => {
        const done = index < current;
        const now = index === current;
        return (
          <li key={step} aria-current={now ? 'step' : undefined} className="flex min-w-0 flex-col gap-1.5">
            <span aria-hidden="true" className={cn('h-1.5 rounded-full', done || now ? 'bg-ok' : 'bg-hairline')} />
            <span
              className={cn(
                'hyphens-auto text-xs leading-tight [overflow-wrap:anywhere]',
                now ? 'font-extrabold text-ink' : done ? 'text-ink-muted' : 'text-ink-subtle',
              )}
            >
              {done ? <Check aria-hidden="true" className="mr-0.5 inline size-3 align-[-1px] text-ok" /> : null}
              {step}
            </span>
            {now ? <span className="sr-only">{t('orders.stages.now')}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
