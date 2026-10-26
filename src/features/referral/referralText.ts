import type { TFunction } from 'i18next';

/**
 * Текст приглашения — на языке кабинета: сервер языка интерфейса не знает,
 * он отдаёт только ссылку.
 */
export function referralMessage(link: string, t: TFunction): string {
  return t('referral.message', { link, interpolation: { escapeValue: false } });
}

/** WhatsApp без номера: контакт клиент выбирает сам в приложении. */
export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
