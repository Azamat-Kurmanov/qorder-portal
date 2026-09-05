import { useEffect, type ReactNode } from 'react';
import { useGetPortalSuppliers } from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { ProfilePage } from './ProfilePage';

interface RequireSupplierProps {
  children: ReactNode;
}

/**
 * Не пускает на экраны кабинета, пока не выбран поставщик.
 *
 * Без него каждый запрос уходил бы без заголовка и получал отказ — клиент
 * увидел бы пустой каталог вместо понятного «выберите поставщика».
 *
 * Единственный поставщик выбирается сам: спрашивать выбор из одного варианта
 * значит требовать нажатия ни за чем.
 */
export function RequireSupplier({ children }: RequireSupplierProps) {
  const { supplierId, select } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];

  const onlyOne = list.length === 1 ? list[0].supplierId : null;
  const stale = supplierId !== null && list.length > 0
    && !list.some((supplier) => supplier.supplierId === supplierId);

  useEffect(() => {
    // Выбранный ранее поставщик мог отозвать доступ: тогда сохранённый выбор
    // указывает в никуда, и держаться за него значит показывать отказы.
    if (stale && onlyOne) select(onlyOne);
    else if (supplierId === null && onlyOne) select(onlyOne);
  }, [stale, onlyOne, supplierId, select]);

  if (suppliers.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <span
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-hairline border-t-accent"
        />
        <p className="text-ink-subtle">Смотрим, с кем вы работаете…</p>
      </div>
    );
  }

  if (supplierId === null || stale) return <ProfilePage />;

  return <>{children}</>;
}
