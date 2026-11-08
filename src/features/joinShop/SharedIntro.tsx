import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { countShareLogin, useGetJoinShopItem } from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../ui/Button';
import { ItemThumb } from '../catalog/ItemThumb';
import { rememberShareVisit } from './shareVisit';

/** Что открыла ссылка «Поделиться» (R-07): товар, раздел или новинки. */
export type Share = { kind: 'i'; itemId: string } | { kind: 'c'; categoryId: string } | { kind: 'new' };

/** Ссылка «Поделиться» ведёт сюда с `?item=`, `?category=` или `?new=1`. */
export function shareOf(params: URLSearchParams): Share | null {
  const item = params.get('item');
  if (item) return { kind: 'i', itemId: item };
  const category = params.get('category');
  if (category) return { kind: 'c', categoryId: category };
  return params.get('new') === '1' ? { kind: 'new' } : null;
}

/** Куда в кабинете ведёт ссылка вошедшего клиента: `?supplier=` переводит его в этот магазин, как QR этикетки. */
export function shareTarget(share: Share, supplierId: string): string {
  const supplier = `supplier=${encodeURIComponent(supplierId)}`;
  if (share.kind === 'i') return `/catalog/${encodeURIComponent(share.itemId)}?${supplier}`;
  if (share.kind === 'c') return `/catalog?category=${encodeURIComponent(share.categoryId)}&${supplier}`;
  return `/catalog?novelty=1&${supplier}`;
}

/**
 * Начало окна заявки по ссылке «Поделиться»: что прислали и вход для своих.
 *
 * Клиент магазина видит свою цену только после входа — поэтому первым идёт «Я клиент — войти».
 * В браузере токен живёт в памяти вкладки, и по ссылке человек приходит без него; вход Keycloak
 * при живой сессии пропускает форму. Уже вошедшего (приложение) страница уводит сама.
 * Гостю — товар без цены и заявка ниже, как на странице ссылки магазина.
 */
export function SharedIntro({ code, share, supplierId, showcase }: {
  code: string;
  share: Share;
  supplierId: string;
  showcase: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authenticated } = useAuth();
  const item = useGetJoinShopItem(code, share.kind === 'i' ? share.itemId : '', {
    query: { enabled: share.kind === 'i' && showcase, retry: false },
  });
  const shown = item.data?.status === 200 ? item.data.data : undefined;

  const enter = () => {
    // Счётчик — не повод задерживать человека: сбой учёта переход не останавливает.
    void countShareLogin(code, share.kind).catch(() => undefined);
    rememberShareVisit(code, share.kind);
    navigate(shareTarget(share, supplierId));
  };

  useEffect(() => {
    if (authenticated) enter();
    // Один раз при входе на страницу: уход в кабинет и есть конец этого экрана.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  return (
    <section aria-label={t('joinShop.share.title')} className="flex flex-col gap-3 border-0 border-b border-solid border-hairline pb-4">
      {shown ? (
        <div className="flex gap-3">
          <ItemThumb itemId={shown.id} src={shown.imageUrl} className="size-20 shrink-0 rounded-[var(--radius-control)]" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-semibold text-ink">{shown.name}</span>
            {shown.sku ? <span className="text-xs text-ink-muted">{t('joinShop.share.sku', { sku: shown.sku })}</span> : null}
            {shown.sizes.length > 0 ? <span className="text-xs text-ink-muted">{t('joinShop.share.sizes', { sizes: shown.sizes.join(', ') })}</span> : null}
          </div>
        </div>
      ) : null}
      <p className="m-0 text-sm text-ink-muted">{t('joinShop.share.priceAfterLogin')}</p>
      <Button onClick={enter}>{t('joinShop.share.login')}</Button>
      <p className="m-0 text-xs text-ink-faint">{t('joinShop.share.guest')}</p>
    </section>
  );
}
