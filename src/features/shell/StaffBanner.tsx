import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useResetPortalServiceData } from '../../api/generated';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * Полоса поверх кабинета, когда его открыл сам арендатор.
 *
 * Нужна затем, чтобы человек не принял свою проверку за работу клиента.
 * Заявка, поданная отсюда, доходит до очереди менеджера по-настоящему —
 * в этом и смысл проверки, — но помечается проверочной и в метрики канала
 * не идёт. Не сказать об этом значило бы дать администратору решить, что
 * он смотрит чей-то настоящий кабинет.
 *
 * Здесь же уборка: проверка оставляет заявки, корзину и отметки, и убрать
 * их должно быть можно тем же движением, каким проверка началась. Иначе
 * следы копятся в очереди и мешают менеджеру.
 */
export function StaffBanner({ webUrl }: { webUrl: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [erased, setErased] = useState<number | null>(null);

  const reset = useResetPortalServiceData({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        setErased(response.data.drafts);
        // Кеш сбрасывается целиком: убрано было и в корзине, и в заявках,
        // и в избранном — перечислять ключи по одному значит однажды забыть один.
        void queryClient.invalidateQueries();
      },
    },
  });

  return (
    <div
      role="status"
      className={cn(
        'border-b border-hairline bg-accent-soft px-4 py-2.5 lg:px-7',
        'flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink',
      )}
    >
      <span className="font-medium">{t('shell.staffBanner.title')}</span>
      <span className="text-ink-muted">{t('shell.staffBanner.note')}</span>

      <div className="ml-auto flex items-center gap-2">
        {erased !== null && (
          <span className="text-ink-muted">
            {erased > 0
              ? t('shell.staffBanner.erased', { count: erased })
              : t('shell.staffBanner.nothingToErase')}
          </span>
        )}
        <Button
          variant="ghost"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        >
          {reset.isPending ? t('shell.staffBanner.erasing') : t('shell.staffBanner.erase')}
        </Button>
        {/*
          Обычная ссылка, а не переход роутера: рабочее место — другое
          приложение на другом адресе, и уводить туда надо браузером.
        */}
        <a
          href={webUrl}
          className={cn(
            'inline-flex h-11 items-center rounded-[var(--radius-control)] px-4',
            'text-sm font-medium text-accent transition-all duration-300 hover:bg-ink/5',
          )}
        >
          {t('shell.staffBanner.toWorkplace')}
        </a>
      </div>
    </div>
  );
}
