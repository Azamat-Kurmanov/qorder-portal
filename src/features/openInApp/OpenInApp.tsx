import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { getConfig } from '../../config';
import { isAvailable } from '../../shared/webview/bridge';

/** Пакет приложения в магазине и в `intent://` (mobile.md §14, В2). */
const PACKAGE = 'kz.qorder.mobile';
const DISMISSED = 'qo.openInApp.dismissed';

export type Platform = 'android' | 'ios';

/**
 * Платформа браузера телефона; встроенное окно Android (WebView: `; wv)`) — `null`:
 * там `intent://` не открывается, а окно приложения и так уже приложение.
 */
export function platformOf(userAgent: string): Platform | null {
  if (/; wv\)/.test(userAgent)) return null;
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return null;
}

/**
 * Android открывает приложение по `intent://` с той же ссылкой; нет приложения —
 * уходит на запасной адрес (магазин приложений, без него — сама страница).
 */
export function intentHref(href: string, fallback: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':', '')};`
    + `package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

/**
 * «Откройте в приложении» (этап 8, D9) на страницах приглашений в браузере телефона.
 * В приложении (мост есть) и на компьютере — ничего. «Установить» кладёт ссылку в буфер:
 * первый запуск приложения подхватит её сам. «Продолжить в браузере» — до конца сеанса.
 */
export function OpenInApp() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED) === '1');
  const platform = typeof navigator === 'undefined' ? null : platformOf(navigator.userAgent);
  if (dismissed || !platform || isAvailable()) return null;

  const config = getConfig();
  const store = platform === 'android' ? config.ANDROID_APP_URL : config.IOS_APP_URL;
  const href = window.location.href;

  async function install() {
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      // Буфер закрыт — приглашение можно будет отсканировать или открыть ссылкой ещё раз.
    }
    window.location.assign(store);
  }

  function dismiss() {
    sessionStorage.setItem(DISMISSED, '1');
    setDismissed(true);
  }

  return (
    <section aria-label={t('openInApp.title')}
      className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-hairline bg-sunk p-3">
      <p className="text-base font-semibold text-ink">{t('openInApp.title')}</p>
      <p className="text-sm text-ink-muted">{t('openInApp.text')}{store ? ` ${t('openInApp.installHint')}` : ''}</p>
      <div className="flex flex-wrap gap-2">
        {platform === 'android' && (
          <Button asChild><a href={intentHref(href, store || href)}>{t('openInApp.open')}</a></Button>
        )}
        {store && <Button variant="outline" onClick={() => void install()}>{t('openInApp.install')}</Button>}
        <Button variant="soft" onClick={dismiss}>{t('openInApp.browser')}</Button>
      </div>
    </section>
  );
}
