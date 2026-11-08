import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Logo } from '../../ui/Logo';
import { Sheet } from '../../ui/Sheet';
import { Check } from '../../ui/icons';

const POINTS = ['order', 'track', 'chat', 'shops'] as const;

/**
 * «Работает на Q-Order» внизу каждого раздела: открывает окно о сервисе, а не форму заявки поставщика
 * (просьба владельца 2026-11-05: клиент, нажавший подпись, хотел узнать, что это, а не регистрироваться).
 * Заявка поставщика осталась — ссылкой внизу окна, для того, кто сам продаёт.
 */
export function AboutService() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-caption text-ink-subtle hover:text-ink-muted">
        {/* Знак — сцепленные Q и O без слова: имя системы уже написано в подписи. */}
        <Logo variant="links" height={16} decorative />
        {t('referral.poweredBy')}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={t('about.title')}>
        <div className="flex flex-col gap-4">
          <p className="m-0 text-base text-ink">{t('about.lead')}</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-body text-ink">
                <span aria-hidden="true" className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok-ink">
                  <Check className="size-4" />
                </span>
                {t(`about.points.${point}`)}
              </li>
            ))}
          </ul>
          <p className="m-0 rounded-[var(--radius-control)] bg-sunk px-4 py-3 text-sm text-ink-muted">{t('about.shopNote')}</p>
          <Button type="button" size="lg" onClick={() => setOpen(false)}>{t('about.close')}</Button>
          <Link to="/join" onClick={() => setOpen(false)} className="self-center text-sm font-bold text-shop-ink underline-offset-4 hover:underline">
            {t('about.sellerLink')}
          </Link>
        </div>
      </Sheet>
    </>
  );
}
