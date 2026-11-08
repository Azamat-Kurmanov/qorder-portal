import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';

/**
 * Код для получения — макет «Мои заявки v2», блок у заявки «Можно забирать».
 *
 * Тёмная плашка на светлой странице — то же обращение, что в макете: код
 * ищут глазами у прилавка, и он должен быть самым заметным на экране.
 * Цифры разнесены и читаются по одной — так их диктуют продавцу, и так
 * же их прочтёт экранный диктор, а не как «четыре тысячи восемьсот…».
 */
/** `big` — на экране заявки (макет SimplePicOrderReady): код крупно по центру. */
export function PickupCode({ code, big = false, className }: { code: string; big?: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <div data-testid="pickup-code" className={cn('flex flex-col gap-1 bg-night text-white', big ? 'items-center rounded-[1.375rem] p-5 text-center' : 'rounded-[var(--radius-control)] px-4 py-3', className)}>
      <span className={cn('font-bold text-white/75', big ? 'text-sm' : 'text-2xs uppercase tracking-[0.06em]')}>{t('orders.v2.pickupCode')}</span>
      <b className={cn('font-extrabold leading-tight tabular-nums', big ? 'text-jumbo tracking-[0.22em]' : 'text-display tracking-[0.14em]')} aria-label={code.split('').join(' ')}>
        {code}
      </b>
      <span className={cn('text-white/80', big ? 'text-sm' : 'text-caption')}>{t('orders.v2.pickupCodeHint')}</span>
    </div>
  );
}
