import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/Button';
import {
  SCAN_CLOSED_EVENT,
  SCAN_EVENT,
  hasNativeScan,
  scanStatus,
  startScan,
  stopScan,
} from '../../shared/webview/bridge';

/**
 * Путь кабинета из кода: ссылка магазина, личная ссылка продавца, QR этикетки.
 * В коде бывает и сообщение целиком («Здравствуйте! … https://…»). Сверяется только
 * хост, как в приложении: на стенде кабинет по http, а ссылку могли сделать с https.
 */
export function portalPath(text: string, host = window.location.host): string | null {
  for (const match of text.matchAll(/https?:\/\/\S+/g)) {
    let url: URL;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    if (url.host === host) return url.pathname + url.search + url.hash;
  }
  return null;
}

/**
 * «Отсканировать QR» — камерой приложения. В браузере кнопки нет: там QR
 * сканируют камерой телефона, и ссылка открывается сама.
 */
export function ScanQrButton({ onScanned, className }: { onScanned?: () => void; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  // Свежие колбэки без перевешивания слушателей на каждой отрисовке.
  const latest = useRef({ navigate, onScanned, t, scanning });
  latest.current = { navigate, onScanned, t, scanning };

  useEffect(() => {
    if (!scanning) return;
    function onCode(event: Event) {
      const path = portalPath(String((event as CustomEvent).detail ?? ''));
      if (!path) {
        scanStatus('error', latest.current.t('scanQr.foreign'));
        return;
      }
      stopScan();
      setScanning(false);
      latest.current.onScanned?.();
      latest.current.navigate(path);
    }
    const onClosed = () => setScanning(false);
    window.addEventListener(SCAN_EVENT, onCode);
    window.addEventListener(SCAN_CLOSED_EVENT, onClosed);
    return () => {
      window.removeEventListener(SCAN_EVENT, onCode);
      window.removeEventListener(SCAN_CLOSED_EVENT, onClosed);
    };
  }, [scanning]);

  // Экран ушёл, а камера открыта — закрыть её, иначе коды пойдут в никуда.
  useEffect(() => () => {
    if (latest.current.scanning) stopScan();
  }, []);

  if (!hasNativeScan()) return null;
  return (
    <Button size="lg" variant="outline" className={className}
      onClick={() => {
        setScanning(true);
        startScan();
      }}>
      {t('scanQr.button')}
    </Button>
  );
}
