import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { MapPickerDialog } from './MapPickerDialog';
import { useMapHome } from './useMapHome';
import type { MapPoint } from './mapProvider';

/**
 * «Указать на карте» под полем адреса.
 *
 * Точки нет — одна кнопка. Есть — что она указана и
 * «Изменить» / «Убрать»: точка необязательна, адрес текстом остаётся главным.
 */
export function MapPointField({ point, title, address, onChange }: {
  point: MapPoint | null;
  title: string;
  address: string;
  onChange: (point: MapPoint | null, foundAddress: string | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const home = useMapHome();

  return (
    <div className="flex flex-wrap items-center gap-2 text-caption">
      {point ? (
        <>
          <span data-testid="map-point-set" className="inline-flex items-center gap-1 text-ink">
            {/* Без цифр координат: покупателю они ничего не говорят, их видно в окне карты. */}
            <MapPin aria-hidden="true" className="size-3.5 text-accent" /> {t('maps.set')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Button type="button" variant="ghost" size="chip" onClick={() => setOpen(true)}>{t('maps.change')}</Button>
            <Button type="button" variant="ghost" size="chip" onClick={() => onChange(null, null)}>{t('maps.remove')}</Button>
          </span>
        </>
      ) : (
        <Button type="button" variant="outline" size="chip" onClick={() => setOpen(true)}>
          <MapPin aria-hidden="true" className="size-4" /> {t('maps.pick')}
        </Button>
      )}
      {open ? (
        <MapPickerDialog
          title={title}
          address={address}
          initial={point}
          home={home}
          onClose={() => setOpen(false)}
          onPick={(picked, found) => { setOpen(false); onChange(picked, found); }}
        />
      ) : null}
    </div>
  );
}
