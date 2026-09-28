import { useTranslation } from 'react-i18next';
import { Button } from './Button';

/**
 * Список не загрузился — так и сказать, с кнопкой повтора.
 *
 * Без этого сбой сети выглядел как «Заявок нет» или пустой магазин,
 * и закупщик уходил, решив, что товара нет, а не что пропала связь.
 */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3.5 rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center shadow-[0_0_0_1px_var(--color-hairline)]"
    >
      <p className="max-w-[28rem] text-base leading-normal text-ink-muted">{t('common.loadFailed')}</p>
      <Button size="lg" onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  );
}
