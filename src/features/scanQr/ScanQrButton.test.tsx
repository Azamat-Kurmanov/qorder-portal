import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { ScanQrButton, portalPath } from './ScanQrButton';
import { renderScreen } from '../../test/render';
import { SCAN_EVENT } from '../../shared/webview/bridge';

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function scan(code: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent(SCAN_EVENT, { detail: code }));
  });
}

describe('portalPath', () => {
  it('берёт путь своей ссылки, даже из сообщения и с другой схемой', () => {
    expect(portalPath('https://portal.q-order.kz/join-shop/aB3?x=1', 'portal.q-order.kz')).toBe('/join-shop/aB3?x=1');
    expect(portalPath('Здравствуйте! http://portal.q-order.kz/catalog/7?supplier=s1 ждём', 'portal.q-order.kz'))
      .toBe('/catalog/7?supplier=s1');
  });

  it('чужой сайт и штрихкод — не код кабинета', () => {
    expect(portalPath('https://evil.kz/join-shop/aB3', 'portal.q-order.kz')).toBeNull();
    expect(portalPath('4870001234567', 'portal.q-order.kz')).toBeNull();
  });
});

describe('кнопка «Отсканировать QR»', () => {
  afterEach(() => {
    delete window.QOrderBridge;
  });

  it('в браузере без приложения кнопки нет', () => {
    renderScreen(<ScanQrButton />);
    expect(screen.queryByRole('button', { name: 'Отсканировать QR' })).toBeNull();
  });

  it('открывает камеру приложения, чужой код называет, свой — открывает', async () => {
    const bridge = { startScan: vi.fn(), stopScan: vi.fn(), scanStatus: vi.fn() };
    window.QOrderBridge = bridge;
    const onScanned = vi.fn();
    renderScreen(<><ScanQrButton onScanned={onScanned} /><Where /></>);

    await userEvent.click(screen.getByRole('button', { name: 'Отсканировать QR' }));
    expect(bridge.startScan).toHaveBeenCalled();

    scan('4870001234567');
    expect(bridge.scanStatus).toHaveBeenCalledWith('error', expect.stringContaining('не код Q-Order'));
    expect(bridge.stopScan).not.toHaveBeenCalled();

    scan(`${window.location.protocol}//${window.location.host}/join-shop/aB3dE5`);
    expect(bridge.stopScan).toHaveBeenCalled();
    expect(onScanned).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/join-shop/aB3dE5');
  });
});
