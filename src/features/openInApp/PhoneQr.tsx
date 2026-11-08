import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/Card';
import { getConfig } from '../../config';
import { useWideScreen } from '../../ui/useWideScreen';
import { isAvailable } from '../../shared/webview/bridge';

/**
 * «Откройте на телефоне» (макет SimplePicWebInvLanding): ссылку открыли на компьютере —
 * QR этой же страницы переносит её на телефон, где откроется приложение или страница
 * его установки. Только на мониторе: на телефоне есть {@link OpenInApp}.
 */
export function PhoneQr() {
  const { t } = useTranslation();
  const wide = useWideScreen();
  const [qr, setQr] = useState('');
  const show = wide && !isAvailable();

  useEffect(() => {
    if (!show) return;
    let alive = true;
    // bwip-js тяжёлый — только тем, кому карточку показывают.
    void import('bwip-js/browser').then((bwip) => {
      if (!alive) return;
      try {
        setQr(bwip.toSVG({ bcid: 'qrcode', text: window.location.href, scale: 4 }));
      } catch {
        // Не нарисовался — ссылку и так открыли, карточка просто не появится.
      }
    });
    return () => {
      alive = false;
    };
  }, [show]);

  if (!show || !qr) return null;
  const { ANDROID_APP_URL: android, IOS_APP_URL: ios } = getConfig();
  const store = 'flex h-14 flex-1 flex-col items-center justify-center rounded-[var(--radius-control)] bg-ink leading-tight text-surface';

  return (
    <Card data-testid="phone-qr" className="flex w-full max-w-[400px] flex-col items-center gap-4 p-6 text-center">
      <h2 className="text-xl font-extrabold text-ink">{t('openInApp.phoneTitle')}</h2>
      <div role="img" aria-label={t('openInApp.phoneQrAlt')}
        className="size-52 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-3 [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="m-0 text-base text-ink-muted">{t('openInApp.phoneHint')}</p>
      {/* Магазины — только заданные: приложения в сторе может ещё не быть. */}
      {(android || ios) && (
        <div className="flex w-full gap-2">
          {android && (
            <a href={android} target="_blank" rel="noopener noreferrer" className={store}>
              <span className="text-2xs opacity-80">{t('openInApp.getOn')}</span>
              <b className="text-base">Google Play</b>
            </a>
          )}
          {ios && (
            <a href={ios} target="_blank" rel="noopener noreferrer" className={store}>
              <span className="text-2xs opacity-80">{t('openInApp.downloadOn')}</span>
              <b className="text-base">App Store</b>
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
