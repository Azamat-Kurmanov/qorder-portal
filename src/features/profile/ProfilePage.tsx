import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useGetPortalSuppliers } from '../../api/generated';
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Поставщики</h1>

      {list.length === 0 && (
        <p className="text-ink-subtle">
          Пока ни одного: кабинет открывает поставщик — попросите у него ссылку-приглашение.
        </p>
      )}

      {list.map((supplier) => (
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

          {supplier.supplierId !== supplierId && (
            <Button variant="soft" onClick={() => select(supplier.supplierId)}>
              Перейти
            </Button>
          )}
        </Card>
      ))}

      <Button variant="ghost" onClick={logout}>Выйти</Button>
    </div>
  );
}
