import type { PortalOrderDtoState } from '../../api/generated';
import { cn } from '../../ui/cn';

/**
 * Состояние заявки словами клиента.
 *
 * Внутренних статусов заявки тринадцать, и они про работу менеджера: очередь
 * проверки, ожидание склада, разбор. Клиенту нужно другое — ждать ему или
 * действовать, — и рассказывать ему про склад значит сообщать о возможной
 * нехватке раньше, чем поставщик решил, что с ней делать.
 *
 * Цвет здесь говорит не о важности, а о том, за кем ход: тёплый — за
 * клиентом, синий — за продавцом, зелёный и серый — вопрос решён. Оттенков
 * поэтому три, а не пять: два состояния ожидания у продавца отличаются
 * словом, а не краской — клиенту они означают одно и то же.
 *
 * Точка перед словом — не украшение: она даёт пилюле форму, узнаваемую
 * раньше, чем прочитан текст, и не остаётся единственным носителем смысла,
 * потому что рядом всегда стоит слово.
 */
const STATES: Record<PortalOrderDtoState, { label: string; tone: string; dot: string }> = {
  SUBMITTED: {
    label: 'Отправлена',
    tone: 'bg-brand/8 text-brand border-brand/20',
    dot: 'bg-brand',
  },
  IN_REVIEW: {
    label: 'На проверке',
    tone: 'bg-brand/8 text-brand border-brand/20',
    dot: 'bg-brand',
  },
  AWAITING_CONFIRMATION: {
    label: 'Нужен ваш ответ',
    tone: 'bg-accent-soft text-accent border-accent/30',
    dot: 'bg-accent',
  },
  ACCEPTED: {
    label: 'Принята',
    tone: 'bg-in-stock/10 text-in-stock border-in-stock/25',
    dot: 'bg-in-stock',
  },
  CLOSED: {
    label: 'Закрыта',
    tone: 'bg-sunk text-ink-subtle border-hairline',
    dot: 'bg-ink-faint',
  },
};

export function OrderStateBadge({ state }: { state: PortalOrderDtoState }) {
  const view = STATES[state];

  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
        view.tone,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', view.dot)} />
      {view.label}
    </span>
  );
}

/** Название состояния отдельно: списку оно нужно и без значка. */
export function stateLabel(state: PortalOrderDtoState): string {
  return STATES[state].label;
}
