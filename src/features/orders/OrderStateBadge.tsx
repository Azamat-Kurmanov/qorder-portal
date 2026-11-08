import type { PortalOrderDtoState } from '../../api/generated';
import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';

/**
 * Состояние заявки словами клиента.
 *
 * Внутренних статусов заявки тринадцать, и они про работу менеджера: очередь
 * проверки, ожидание склада, разбор. Клиенту нужно другое — ждать ему или
 * действовать, — и рассказывать ему про склад значит сообщать о возможной
 * нехватке раньше, чем поставщик решил, что с ней делать.
 *
 * Цвет — этап (решение владельца 2026-10-30): продавец проверяет — жёлтый,
 * принята — синий, выдана — зелёный; тёплый цвет магазина — ход за клиентом,
 * серый — закрыта. Два состояния ожидания у продавца отличаются словом,
 * а не краской — клиенту они означают одно и то же.
 *
 * Точка перед словом — не украшение: она даёт пилюле форму, узнаваемую
 * раньше, чем прочитан текст, и не остаётся единственным носителем смысла,
 * потому что рядом всегда стоит слово.
 *
 * Здесь стоит только краска: слова состояний живут в словаре (`orders.state`)
 * под кодами, которые присылает сервер.
 */
const STATES: Record<PortalOrderDtoState, { tone: string; dot: string }> = {
  // Продавец проверяет — жёлтым, принята — синим, выдана — зелёным (решение владельца 2026-10-30).
  SUBMITTED: {
    tone: 'bg-hit-soft text-hit-ink border-hit-ink/25',
    dot: 'bg-hit-ink',
  },
  IN_REVIEW: {
    tone: 'bg-hit-soft text-hit-ink border-hit-ink/25',
    dot: 'bg-hit-ink',
  },
  AWAITING_CONFIRMATION: {
    tone: 'bg-accent-soft text-accent border-accent/30',
    dot: 'bg-accent',
  },
  ACCEPTED: {
    tone: 'bg-wholesale-soft text-wholesale-ink border-wholesale-ink/25',
    dot: 'bg-wholesale-ink',
  },
  // «Можно забирать» — ход за клиентом, как у ответа на изменения: цвет
  // магазина, а не спокойный зелёный, иначе собранная заявка не отличается
  // от просто принятой.
  READY: {
    tone: 'bg-accent-soft text-accent-ink border-accent/30',
    dot: 'bg-accent',
  },
  ISSUED: {
    tone: 'bg-ok-soft text-ok-ink border-ok-ink/25',
    dot: 'bg-ok-ink',
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
        'inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 text-xs font-medium',
        view.tone,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', view.dot)} />
      {t(`orders.state.${state}`)}
    </span>
  );
}
