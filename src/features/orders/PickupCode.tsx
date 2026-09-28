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
export function PickupCode({ code, className }: { code: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div data-testid="pickup-code" className={cn('flex flex-col gap-1 rounded-[var(--radius-control)] bg-night px-4 py-3 text-white', className)}>
      <span className="text-2xs font-bold uppercase tracking-[0.06em] text-white/70">{t('orders.v2.pickupCode')}</span>
      <b className="text-[1.625rem] font-extrabold leading-tight tracking-[0.14em] tabular-nums" aria-label={code.split('').join(' ')}>
        {code}
      </b>
      <span className="text-[0.7812rem] text-white/75">{t('orders.v2.pickupCodeHint')}</span>
    </div>
  );
}
