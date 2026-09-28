import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useGetPortalSuppliers, useGetPortalUnreadSummary } from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { useAuth } from '../../auth/useAuth';
import { ConsentsBlock } from './ConsentsBlock';
import { ShopTile } from '../shell/Shops';

/**
 * Профиль: с кем клиент работает и как переключиться.
 *
 * Переключатель здесь, а не в шапке каждого экрана: поставщиков у большинства
 * один, и постоянный выбор на виду создавал бы вопрос там, где его нет.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const suppliers = useGetPortalSuppliers();
  const { supplierId, select } = useSupplier();
  const { logout } = useAuth();

  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];

  const summary = useGetPortalUnreadSummary();
  const unreadOf = (id: string) => (summary.data?.status === 200 ? summary.data.data : [])
    .find((row) => row.supplierId === id)?.unread ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="qo-page-title">{t('profile.title')}</h1>

      {list.length === 0 && (
        <p className="text-ink-subtle">{t('profile.empty')}</p>
      )}

      {list.map((supplier) => {
        const unread = unreadOf(supplier.supplierId);

        return (
          <Card
            key={supplier.supplierId}
            data-testid="supplier-row"
            className="flex items-center gap-3 p-4"
          >
            <ShopTile supplier={supplier} className="size-11 text-lg" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className="text-base font-bold text-ink">{supplier.name}</span>
              {supplier.supplierId === supplierId && (
                <span className="inline-flex h-6 items-center rounded-[var(--radius-pill)] bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                  {t('profile.selected')}
                </span>
              )}
            </div>

            {/*
              Число стоит и у выбранного поставщика: метка «Выбран» и счётчик
              отвечают на разные вопросы, а число у текущего подтверждает, что
              колокольчик и этот список говорят одно и то же. Ноль не рисуется —
              пустая пилюля читается как неполадка.
            */}
            {unread > 0 && (
              <span
                role="img"
                aria-label={t('profile.unread', { count: unread })}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-[var(--radius-pill)] bg-accent px-1.5 text-xs font-semibold text-on-accent"
              >
                {unread}
              </span>
            )}

            {supplier.supplierId !== supplierId && (
              <Button variant="soft" onClick={() => select(supplier.supplierId)}>
                {t('profile.switch')}
              </Button>
            )}
          </Card>
        );
      })}

      {/*
        Согласия здесь, а не отдельным разделом в рельсе: это справка о себе,
        за которой приходят раз в год, и место в постоянной навигации она
        занимала бы у экранов, которыми пользуются каждый день.
      */}
      <ConsentsBlock />

      <Button variant="ghost" onClick={logout}>{t('profile.logout')}</Button>
    </div>
  );
}
