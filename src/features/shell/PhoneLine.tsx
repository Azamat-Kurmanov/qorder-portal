import { useTranslation } from 'react-i18next';
import { formatPhone } from '../../shared/phone';
import { cn } from '../../ui/cn';
import { Phone } from '../../ui/icons';
import { telLink } from './shopHours';

/**
 * Номер телефона с маленькой круглой кнопкой звонка — вместо крупных «Позвонить»
 * (решение владельца 2026-11-04: крупные кнопки навязывают звонок и отвлекают сотрудников
 * продавца). Номер — обычный текст: его видно и можно переписать, звонит только кнопка.
 */
export function PhoneLine({ phone, label, callLabel, className }: {
  phone: string | null | undefined;
  /** Подпись над номером: «Продавец», «Перевозчик»; без неё — только номер. */
  label?: string;
  /** Имя кнопки для чтения с экрана; по умолчанию «Позвонить в магазин». */
  callLabel?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const tel = telLink(phone ?? undefined);
  if (!phone || !tel) return null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <span className="flex min-w-0 flex-col leading-tight">
        {label ? <span className="text-xs text-ink-muted">{label}</span> : null}
        <span className="whitespace-nowrap text-body font-bold tabular-nums text-ink">{formatPhone(phone)}</span>
      </span>
      <a href={tel} aria-label={callLabel ?? t('shop.call')} title={callLabel ?? t('shop.call')}
        className={cn(
          'qo-hit flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-accent-ink',
          'transition-colors hover:border-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}>
        <Phone aria-hidden="true" className="size-4" />
      </a>
    </span>
  );
}
