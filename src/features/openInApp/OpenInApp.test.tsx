import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { OpenInApp, intentHref, platformOf } from './OpenInApp';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36';

function as(userAgent: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

beforeEach(async () => {
  await i18n.changeLanguage('ru');
  sessionStorage.clear();
  window.__APP_CONFIG__ = { ANDROID_APP_URL: 'https://play.google.com/store/apps/details?id=kz.qorder.mobile', IOS_APP_URL: '' };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.__APP_CONFIG__;
  delete (window as { QOrderBridge?: unknown }).QOrderBridge;
});

describe('«Откройте в приложении»', () => {
  it('платформа по браузеру', () => {
    expect(platformOf(ANDROID)).toBe('android');
    expect(platformOf(IPHONE)).toBe('ios');
    expect(platformOf(DESKTOP)).toBeNull();
    expect(platformOf('Mozilla/5.0 (Linux; Android 13; V2058 Build/TP1A; wv) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36')).toBeNull();
  });

  it('intent:// с той же ссылкой и запасным адресом', () => {
    expect(intentHref('https://portal.q-order.kz/join-shop/AB?item=1', 'https://play.example/x'))
      .toBe('intent://portal.q-order.kz/join-shop/AB?item=1#Intent;scheme=https;package=kz.qorder.mobile;'
        + 'S.browser_fallback_url=https%3A%2F%2Fplay.example%2Fx;end');
  });

  it('Android: открыть, установить, продолжить в браузере — и до конца сеанса больше не показывается', async () => {
    as(ANDROID);
    const { unmount } = render(<OpenInApp />);
    expect(screen.getByRole('link', { name: 'Открыть в приложении' }).getAttribute('href')).toMatch(/^intent:\/\//);
    expect(screen.getByRole('button', { name: 'Установить приложение' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить в браузере' }));
    expect(screen.queryByText('В приложении Q-Order удобнее')).toBeNull();
    unmount();
    render(<OpenInApp />);
    expect(screen.queryByText('В приложении Q-Order удобнее')).toBeNull();
  });

  it('iPhone без адреса App Store — только «продолжить в браузере»', () => {
    as(IPHONE);
    render(<OpenInApp />);
    expect(screen.queryByRole('link', { name: 'Открыть в приложении' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Установить приложение' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Продолжить в браузере' })).toBeInTheDocument();
  });

  it('на компьютере и внутри приложения — ничего', () => {
    as(DESKTOP);
    const { unmount } = render(<OpenInApp />);
    expect(screen.queryByText('В приложении Q-Order удобнее')).toBeNull();
    unmount();
    as(ANDROID);
    (window as { QOrderBridge?: unknown }).QOrderBridge = {};
    render(<OpenInApp />);
    expect(screen.queryByText('В приложении Q-Order удобнее')).toBeNull();
  });
});
