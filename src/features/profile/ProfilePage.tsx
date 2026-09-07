import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useGetPortalSuppliers, useGetPortalUnreadSummary } from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { useAuth } from '../../auth/useAuth';

/**
 * Профиль: с кем клиент работает и как переключиться.
 *
 * Переключатель здесь, а не в шапке каждого экрана: поставщиков у большинства
 * один, и постоянный выбор на виду создавал бы вопрос там, где его нет.
 */
export function ProfilePage() {
  const suppliers = useGetPortalSuppliers();
  const { supplierId, select } = useSupplier();
  const { logout } = useAuth();

  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];

  const summary = useGetPortalUnreadSummary();
  const unreadOf = (id: string) => (summary.data?.status === 200 ? summary.data.data : [])
    .find((row) => row.supplierId === id)?.unread ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Поставщики</h1>

      {list.length === 0 && (
        <p className="text-ink-subtle">
          Пока ни одного: кабинет открывает поставщик — попросите у него ссылку-приглашение.
        </p>
      )}

      {list.map((supplier) => {
        const unread = unreadOf(supplier.supplierId);

        return (
          <Card
            key={supplier.supplierId}
            data-testid="supplier-row"
            className="flex items-center justify-between gap-3 p-4"
          >
            <div className="flex min-w-0 flex-col items-start gap-1">
              <span className="font-medium text-ink">{supplier.name}</span>
              {supplier.supplierId === supplierId && (
                <span className="inline-flex h-6 items-center rounded-full border border-accent/30 bg-accent-soft px-2 text-xs font-medium text-accent">
                  Выбран
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
                aria-label={`Непрочитанных: ${unread}`}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-surface"
              >
                {unread}
              </span>
            )}

            {supplier.supplierId !== supplierId && (
              <Button variant="soft" onClick={() => select(supplier.supplierId)}>
                Перейти
              </Button>
            )}
          </Card>
        );
      })}

      <Button variant="ghost" onClick={logout}>Выйти</Button>
    </div>
  );
}
