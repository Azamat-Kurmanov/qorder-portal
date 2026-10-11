import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
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
  // Отказ на сам список — тоже мёртвый выбор, только сказанный иначе: сервер
  // проверяет заголовок `X-Supplier-Id` и у этого запроса, и выбор, оставшийся
  // от прежнего входа (клиентом или в чужой магазин), отвергает раньше, чем
  // успевает отдать список.
  const refused = supplierId !== null && (suppliers.error as { status?: number } | null)?.status === 403;

  // Ссылка из QR этикетки товара несёт продавца: `?supplier=`. Доступ к нему есть —
  // кабинет переходит в его магазин сам; нет — обычный выбор поставщика, без ошибки.
  const [params, setParams] = useSearchParams();
  const wanted = params.get('supplier');
  const allowed = wanted !== null && list.some((supplier) => supplier.supplierId === wanted);
  useEffect(() => {
    if (!wanted || !answered) return;
    select(allowed ? wanted : null);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('supplier');
      return next;
    }, { replace: true });
  }, [wanted, allowed, answered, select, setParams]);

  useEffect(() => {
    // Выбранный ранее поставщик мог отозвать доступ: тогда сохранённый выбор
    // указывает в никуда, и держаться за него значит показывать отказы.
    // Держаться нечем и в буквальном смысле: пока выбор жив, он уходит
    // заголовком `X-Supplier-Id` в каждом запросе кабинета — и каждый
    // получает отказ.
    // Отвергнутый выбор сбрасывается и при ссылке с поставщиком: без этого список так и
    // отвечал бы отказом, и ссылка ждала бы его вечно.
    if (wanted) {
      if (refused) select(null);
      return;
    }
    if (stale && onlyOne) select(onlyOne);
    else if (stale || refused) select(null);
    else if (supplierId === null && onlyOne) select(onlyOne);
  }, [wanted, stale, refused, onlyOne, supplierId, select]);

  // Сбой списка экран не пропускает. Экран внутри спросил бы список ещё раз,
  // упавший запрос на это время снова уходит в ожидание, и проверка сняла бы
  // экран — чтобы поставить его обратно, как только придёт тот же отказ.
  // Кабинет крутился бы в этом круге без конца, не отвечая на нажатия.
  if (suppliers.isError && !refused) {
    return <p className="py-12 text-center text-ink-subtle">{t('profile.failed')}</p>;
  }

  if (suppliers.isPending || refused) {
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
