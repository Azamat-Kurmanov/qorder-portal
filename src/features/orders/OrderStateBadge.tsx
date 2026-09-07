import type { PortalOrderDtoState } from '../../api/generated';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
 *
 * Здесь стоит только краска: слова состояний живут в словаре (`orders.state`)
 * под кодами, которые присылает сервер.
 */
const STATES: Record<PortalOrderDtoState, { tone: string; dot: string }> = {
  SUBMITTED: {
    tone: 'bg-brand/8 text-brand border-brand/20',
    dot: 'bg-brand',
  },
  IN_REVIEW: {
    tone: 'bg-brand/8 text-brand border-brand/20',
    dot: 'bg-brand',
  },
  AWAITING_CONFIRMATION: {
    tone: 'bg-accent-soft text-accent border-accent/30',
    dot: 'bg-accent',
  },
  ACCEPTED: {
    tone: 'bg-in-stock/10 text-in-stock border-in-stock/25',
    dot: 'bg-in-stock',
  },
  CLOSED: {
    tone: 'bg-sunk text-ink-subtle border-hairline',
    dot: 'bg-ink-faint',
  },
};

export function OrderStateBadge({ state }: { state: PortalOrderDtoState }) {
  const { t } = useTranslation();
  const view = STATES[state];

  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
        view.tone,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', view.dot)} />
      {t(`orders.state.${state}`)}
    </span>
  );
}

/** Название состояния отдельно: списку оно нужно и без значка. */
export function stateLabel(state: PortalOrderDtoState, t: TFunction): string {
  return t(`orders.state.${state}`);
}
