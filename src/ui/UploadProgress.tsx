import { useTranslation } from 'react-i18next';

/**
 * Полоса загрузки файла с процентом. Пока доли нет (`null`) — ничего не рисует:
 * экран держит долю в состоянии и сбрасывает её, когда запрос завершился.
 */
export function UploadProgress({ fraction, label }: { fraction: number | null; label: string }) {
  const { t } = useTranslation();
  if (fraction === null) return null;
  const percent = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
  // Всё отправлено, а ответа нет: сервер передаёт файл в хранилище поставщика.
  const saving = percent >= 100;
  return (
    <div className="flex w-full items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={saving ? undefined : percent}
        aria-valuetext={saving ? t('common.uploadSaving') : undefined}
        className="h-1.5 grow overflow-hidden rounded-full bg-sunk"
      >
        <div
          className={saving ? 'h-full w-full animate-pulse rounded-full bg-accent' : 'h-full rounded-full bg-accent transition-[width]'}
          style={saving ? undefined : { width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-caption tabular-nums text-ink-subtle">
        {saving ? t('common.uploadSaving') : `${percent} %`}
      </span>
    </div>
  );
}
