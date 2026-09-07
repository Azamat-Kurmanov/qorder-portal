import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
 *
 * Пустой список — тоже причина не пускать. Он означает, что поставщик кабинет
 * ещё не открыл: витрина в этом случае не пустая, а недоступная, и каждый её
 * запрос возвращает отказ. Объясняет это полоса в оболочке кабинета
 * (`features/shell/ActivationBanner`), а здесь важно, чтобы отказам неоткуда
 * было взяться.
 */
export function RequireSupplier({ children }: RequireSupplierProps) {
  const { t } = useTranslation();
  const { supplierId, select } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const answered = suppliers.data?.status === 200;
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];

  const onlyOne = list.length === 1 ? list[0].supplierId : null;
  // Выбор указывает в никуда и тогда, когда список пуст: доступ отозвали
  // у последнего поставщика или не открывали вовсе.
  const stale = supplierId !== null && answered
    && !list.some((supplier) => supplier.supplierId === supplierId);

  useEffect(() => {
    // Выбранный ранее поставщик мог отозвать доступ: тогда сохранённый выбор
    // указывает в никуда, и держаться за него значит показывать отказы.
    // Держаться нечем и в буквальном смысле: пока выбор жив, он уходит
    // заголовком `X-Supplier-Id` в каждом запросе кабинета — и каждый
    // получает отказ.
    if (stale && onlyOne) select(onlyOne);
    else if (stale) select(null);
    else if (supplierId === null && onlyOne) select(onlyOne);
  }, [stale, onlyOne, supplierId, select]);

  if (suppliers.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <span
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-hairline border-t-accent"
        />
        <p className="text-ink-subtle">{t('profile.looking')}</p>
      </div>
    );
  }

  if (supplierId === null || stale || (answered && list.length === 0)) return <ProfilePage />;

  return <>{children}</>;
}
