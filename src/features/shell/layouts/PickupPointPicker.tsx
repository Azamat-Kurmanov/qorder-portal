import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useGetPortalDeliveryOptions } from '../../../api/generated';
import { refetchStockViews, usePickupPoint } from '../../../supplier/pickupPoint';
import { cn } from '../../../ui/cn';

/**
 * «Заберу в: …» — точка самовывоза, по складу которой витрина и корзина считают наличие.
 * Из одной точки выбирать нечего — тогда выбора нет. Устройство меню — как у выбора языка.
 */
export function PickupPointPicker({ ready, className }: {
  ready: boolean;
  /** Вид кнопки под соседей в шапке (например, белым по фирменной полосе на телефоне). */
  className?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const options = useGetPortalDeliveryOptions({ query: { enabled: ready } });
  const loaded = options.data?.status === 200;
  const points = options.data?.status === 200 ? options.data.data.pickupPoints ?? [] : [];
  const [point, setPoint] = usePickupPoint(() => refetchStockViews(queryClient));
  const [opened, setOpened] = useState(false);
  const holder = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  // Точку закрыли или убрали — выбор сбрасывается: сервер её всё равно не знает.
  const known = points.some((p) => p.id === point);
  useEffect(() => {
    if (loaded && point && !known) setPoint(null);
  }, [loaded, point, known, setPoint]);

  useEffect(() => {
    if (!opened) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpened(false);
      trigger.current?.focus();
    }
    function onOutside(event: MouseEvent) {
      if (!holder.current?.contains(event.target as Node)) setOpened(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [opened]);

  if (points.length < 2) return null;
  const chosen = points.find((p) => p.id === point);
  const label = chosen ? t('pickupPoint.label', { name: chosen.name }) : t('pickupPoint.none');

  function choose(id: string | null) {
    setOpened(false);
    trigger.current?.focus();
    setPoint(id);
  }

  const item = cn(
    'flex min-h-10 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-sm text-ink',
    'transition-colors duration-200 hover:bg-ink/5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
  );

  return (
    <div ref={holder} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={chosen?.address ?? t('pickupPoint.title')}
        aria-expanded={opened}
        aria-haspopup="menu"
        onClick={() => setOpened((open) => !open)}
        className={cn(
          'inline-flex h-10 max-w-[14rem] items-center gap-1.5 rounded-[var(--radius-small)] border border-line px-2.5',
          'text-sm font-semibold text-ink-muted transition-colors duration-200 hover:border-accent hover:text-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:h-[2.625rem]',
          opened && 'border-accent text-ink',
          className,
        )}
      >
        <MapPin aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{label}</span>
        <ChevronDown aria-hidden="true" className={cn('size-3 shrink-0 transition-transform duration-200', opened && 'rotate-180')} strokeWidth={2.2} />
      </button>

      {opened && (
        <div
          role="menu"
          aria-label={t('pickupPoint.title')}
          className={cn(
            'absolute right-0 top-full z-30 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0.5',
            'rounded-[var(--radius-tile)] border border-hairline bg-surface p-1.5 shadow-float',
          )}
        >
          <button type="button" role="menuitemradio" aria-checked={!chosen} onClick={() => choose(null)} className={item}>
            <span className="flex-1 font-semibold">{t('pickupPoint.all')}</span>
            {!chosen && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" strokeWidth={2.6} />}
          </button>
          {points.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === point}
              onClick={() => choose(p.id ?? null)} className={item}>
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-ink-subtle">{p.address}</span>
              </span>
              {p.id === point && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" strokeWidth={2.6} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
