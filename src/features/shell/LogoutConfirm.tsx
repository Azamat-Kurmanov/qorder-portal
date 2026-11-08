import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';

/**
 * Выход с вопросом «Выйти из аккаунта?» — один на все кнопки «Выйти»:
 * значок на «Главной», профиль, «Все разделы». Иначе в одном месте
 * переспрашивали, а в другом выкидывали сразу, и промах стоил нового
 * входа паролем.
 *
 * `ask` открывает лист, `sheet` рисуется рядом с кнопкой. После закрытия
 * фокус возвращается на ту кнопку, с которой лист открыли: кнопки-триггера
 * у Radix здесь нет, и без этого фокус падал на соседний элемент шапки.
 */
export function useLogoutConfirm(): { ask: (event?: { currentTarget: EventTarget }) => void; sheet: ReactNode } {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [asking, setAsking] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  // Кнопка из события, а не document.activeElement: Safari и WKWebView не
  // дают кнопке фокус при касании, и фокус вернулся бы на body.
  const ask = (event?: { currentTarget: EventTarget }) => {
    opener.current = (event?.currentTarget as HTMLElement | undefined) ?? (document.activeElement as HTMLElement | null);
    setAsking(true);
  };
  const sheet = (
    <Sheet open={asking} onOpenChange={setAsking} title={t('profile.logoutAsk.title')} returnFocus={() => opener.current?.focus()}>
      <p className="mb-4 text-sm text-ink-muted">{t('profile.logoutAsk.note')}</p>
      <div className="flex gap-2">
        {/*
          «Остаться» — заливкой и первой: на неё глаз, палец и фокус при
          открытии листа (Radix ставит его на первую кнопку) — случайный
          Enter не выводит из аккаунта. Высота lg — не меньше 48 точек.
        */}
        <Button type="button" size="lg" className="flex-1" onClick={() => setAsking(false)}>
          {t('profile.logoutAsk.stay')}
        </Button>
        <Button type="button" size="lg" variant="outline" className="flex-1" onClick={logout}>{t('profile.logout')}</Button>
      </div>
    </Sheet>
  );
  return { ask, sheet };
}
