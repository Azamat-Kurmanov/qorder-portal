import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchPortalMapPlaces } from '../../api/generated';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { MapDialog, mapBoxClass } from './MapDialog';
import { coordinatesText, mapProvider, type MapPoint, type MapView } from './mapProvider';
import { useMapHome } from './useMapHome';
import './mapThumb.css';

/**
 * Полоса карты рисуется шириной с запасом и обрезается рамкой блока:
 * метка остаётся посередине, какой бы ширины ни был блок.
 */
const STRIP_WIDTH = 720;
const STRIP_HEIGHT = 96;

/**
 * Полоса карты под адресом — нажать и посмотреть, где это.
 * Узнаётся как карта сразу, а не по слову «На карте»: так понятнее всем.
 *
 * Точка указана — показываем её. Нет — ищем место по тексту адреса
 * и честно говорим, что найденное может быть неточным.
 */
export function MapViewButton({ title, address, point, className }: {
  title: string;
  address?: string | null;
  point?: MapPoint | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const home = useMapHome();
  if (!point && !address?.trim()) return null;

  return (
    <>
      <button type="button" onClick={(event) => { event.stopPropagation(); setOpen(true); }}
        aria-label={t('maps.viewLabel', { title })} title={t('maps.viewLabel', { title })}
        data-testid="map-thumbnail"
        className={cn(
          'group relative block h-24 w-full cursor-pointer overflow-hidden rounded-[var(--radius-control)] border border-hairline bg-sunk',
          'transition-shadow hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          className,
        )}>
        {point ? (
          <span aria-hidden="true" className="qo-thumb-tiles">
            {mapProvider.thumbnail(point, STRIP_WIDTH, STRIP_HEIGHT).map((tile) => (
              <img key={tile.src} src={tile.src} alt="" draggable={false} loading="lazy"
                className="pointer-events-none absolute max-w-none select-none"
                style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }} />
            ))}
          </span>
        ) : (
          // Точки нет — условная карта: узнаётся как карта, но не притворяется точной.
          <span aria-hidden="true" className="qo-thumb-placeholder" />
        )}
        <span aria-hidden="true" className="qo-thumb-pin" />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-surface px-2.5 py-1 text-[0.75rem] font-semibold text-ink shadow-[var(--shadow-soft)] transition-colors group-hover:text-accent-ink">
          <MapPin aria-hidden="true" className="size-3.5" /> {point ? t('maps.openMap') : t('maps.findOnMap')}
        </span>
      </button>
      {open ? <MapViewDialog title={title} address={address ?? ''} point={point ?? null} home={home} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function MapViewDialog({ title, address, point, home, onClose }: {
  title: string;
  address: string;
  point: MapPoint | null;
  home: MapPoint | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Рамка — состоянием: Radix кладёт окно в портал на следующем проходе.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const [shown, setShown] = useState<MapPoint | null>(point);
  const [state, setState] = useState<'exact' | 'approximate' | 'searching' | 'missing'>(point ? 'exact' : 'searching');

  useEffect(() => {
    if (!box) return;
    const controller = new AbortController();
    void mapProvider.mount(box, point, controller.signal, home).then(async (view) => {
      if (!view) return;
      if (controller.signal.aborted) { view.destroy(); return; }
      viewRef.current = view;
      if (point) { view.show(point, { title, address }); return; }
      try {
        const response = await searchPortalMapPlaces({ q: address.trim() });
        const place = response.status === 200 ? response.data[0] : undefined;
        if (controller.signal.aborted) return;
        if (place?.latitude == null || place.longitude == null) { setState('missing'); return; }
        const found = { latitude: place.latitude, longitude: place.longitude };
        setShown(found);
        setState('approximate');
        view.show(found, { title, address });
      } catch {
        if (!controller.signal.aborted) setState('missing');
      }
    });
    return () => { controller.abort(); viewRef.current?.destroy(); viewRef.current = null; };
    // Карта монтируется один раз — когда появилась рамка.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  return (
    <MapDialog title={title} onClose={onClose} onResize={() => viewRef.current?.resize()}>
      {(expanded) => (<>
        {address ? <p className="m-0 text-sm text-ink">{address}</p> : null}
        <div data-testid="map-view-map" className={mapBoxClass(expanded)}>
          <div ref={setBox} className="h-full w-full" />
        </div>
        <p data-testid="map-view-note" className="m-0 text-caption text-ink-subtle">
          {state === 'approximate' ? t('maps.approximate') : null}
          {state === 'missing' ? t('maps.notFound') : null}
          {state === 'searching' ? t('maps.searching') : null}
          {shown ? <span className="block tabular-nums">{t('maps.coordinates', { value: coordinatesText(shown) })}</span> : null}
        </p>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>{t('maps.close')}</Button>
        </div>
      </>)}
    </MapDialog>
  );
}
