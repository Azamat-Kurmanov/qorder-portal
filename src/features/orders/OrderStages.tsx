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

  // Кружки с галочками («Вариант Б», макет SimplePicOrderReady): пройденные — цветом магазина,
  // текущий — жёлтым с обводкой. Подпись переносится внутри своей колонки — по слогам, если длинная.
  return (
    <ol aria-label={t('orders.stages.label')} className="relative m-0 grid list-none grid-cols-4 p-0 pt-1">
      <span aria-hidden="true" className="absolute left-[12.5%] top-[calc(0.25rem+1.25rem)] h-1 w-3/4 -translate-y-1/2 bg-line" />
      <span aria-hidden="true" className="absolute left-[12.5%] top-[calc(0.25rem+1.25rem)] h-1 -translate-y-1/2 bg-shop"
        style={{ width: `${current * 25}%` }} />
      {steps.map((step, index) => {
        const done = index < current;
        const now = index === current;
        return (
          <li key={step} aria-current={now ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center gap-1.5 px-0.5 text-center">
            <span aria-hidden="true" className={cn(
              'flex size-10 items-center justify-center rounded-full',
              done ? 'bg-shop text-on-shop' : now ? 'bg-hit-soft text-hit-ink ring-4 ring-hit-ink/25' : 'border-2 border-line bg-surface',
            )}>
              {done ? <Check className="size-5" /> : now ? <span className="size-2.5 rounded-full bg-current" /> : null}
            </span>
            <span className={cn(
              'hyphens-auto text-caption leading-tight [overflow-wrap:anywhere]',
              now ? 'font-extrabold text-ink' : done ? 'font-bold text-ink' : 'text-ink-muted',
            )}>
              {step}
            </span>
            {now ? <span className="sr-only">{t('orders.stages.now')}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
