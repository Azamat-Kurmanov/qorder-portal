import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router-dom';
import { LoadFailed } from './LoadFailed';

/**
 * Любой сбой экрана — «Нет связи» и повтор, а не служебная страница роутера
 * «Unexpected Application Error» (решение владельца 2026-10-30): клиенту
 * стек ни к чему, а чаще всего это и правда связь — не догрузился кусок
 * приложения. Сама ошибка — в консоль, для разбора.
 */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-4">
      <h1 className="text-xl font-extrabold text-ink">{t('common.noConnection')}</h1>
      <LoadFailed onRetry={() => window.location.reload()} />
    </main>
  );
}
