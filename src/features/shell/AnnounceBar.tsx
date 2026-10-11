import { useTranslation } from 'react-i18next';
import { useGetPortalDeliveryOptions, useGetPortalPromotions } from '../../api/generated';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { announceMessages } from './announceMessages';

/** Строки полосы из условий открытого магазина; `enabled` — тема с полосой. */
export function useAnnounceMessages(enabled: boolean): string[] {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const promotions = useGetPortalPromotions({ query: { enabled } });
  const delivery = useGetPortalDeliveryOptions({ query: { enabled } });
  if (!enabled) return [];
  return announceMessages({
    promotions: promotions.data?.status === 200 ? promotions.data.data : undefined,
    delivery: delivery.data?.status === 200 ? delivery.data.data : undefined,
    currency,
  }, t);
}

/**
 * Полоса открытого магазина — внутри области его валюты (`SupplierCurrencyScope`
 * оболочки): вызванный в теле оболочки хук видел бы валюту пустой.
 */
export function ShopAnnounceBar({ enabled }: { enabled: boolean }) {
  return <AnnounceBar messages={useAnnounceMessages(enabled)} />;
}

/**
 * Полоса объявлений над шапкой (Вспышка, Лукбук, Сезон). Несколько строк —
 * бегущей строкой («живо» и выше, `.qo-announce` в index.css): строки
 * повторены дважды, и ход бесшовный; копия не звучит для программы чтения.
 * Одна строка — стоит на месте. Нет строк — полосы нет.
 */
export function AnnounceBar({ messages }: { messages: string[] }) {
  const { t } = useTranslation();
  if (messages.length === 0) return null;
  const ticker = messages.length > 1;
  const row = (hidden: boolean) => (
    <span className="qo-announce-row" aria-hidden={hidden || undefined}>
      {messages.map((message) => <span key={message}>{message}</span>)}
    </span>
  );
  return (
    <section aria-label={t('shell.announce.label')} className="qo-announce" data-ticker={ticker || undefined}>
      <div className="qo-announce-track">
        {row(false)}
        {ticker ? row(true) : null}
      </div>
    </section>
  );
}
