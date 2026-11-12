import { MapPin } from '../../ui/icons';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { reversePortalMapPlace, searchPortalMapPlaces, type MapPlaceDto } from '../../api/generated';
import { Button } from '../../ui/Button';
import { MapDialog, mapBoxClass } from './MapDialog';
import { coordinatesText, mapProvider, type MapPoint, type MapView } from './mapProvider';

/**
 * Окно «Указать на карте»: найти адрес словами или нажать на карту.
 *
 * Выбранная точка — с меткой, на которой название и адрес, и карта
 * приближается к ней: человек видит, что выбрал, а не догадывается.
 * Адрес по нажатию берётся у карты, иначе — тот, что уже введён в форме.
 */
export function MapPickerDialog({ title, address, initial, home = null, cancelLabel, onClose, onPick }: {
  title: string;
  /** Адрес, уже введённый в форме. */
  address: string;
  initial: MapPoint | null;
  /** Где начать без точки — отмеченный пункт поставщика (`useMapHome`). */
  home?: MapPoint | null;
  /** Подпись кнопки отказа; по умолчанию «Отмена». */
  cancelLabel?: string;
  onClose: () => void;
  /** Точка и адрес, найденный картой (если нашёлся). */
  onPick: (point: MapPoint, foundAddress: string | null) => void;
}) {
  const { t } = useTranslation();
  // Рамка карты — состоянием, а не ссылкой: Radix кладёт окно в портал
  // на следующем проходе, и к первому эффекту рамки ещё нет.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  // Человек уже выбрал точку сам — поздний ответ автопоиска её не перебивает.
  const touchedRef = useRef(false);

  const [point, setPoint] = useState<MapPoint | null>(initial);
  const [found, setFound] = useState<string | null>(null);
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<MapPlaceDto[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Последний введённый адрес — для подписи метки внутри обработчика карты,
  // который вешается один раз.
  const captionRef = useRef({ title, address });
  captionRef.current = { title, address };

  useEffect(() => {
    if (!box) return;
    const controller = new AbortController();
    let view: MapView | null = null;
    void mapProvider.mount(box, initial, controller.signal, home).then((mounted) => {
      if (!mounted) return;
      if (controller.signal.aborted) { mounted.destroy(); return; }
      view = mounted;
      viewRef.current = mounted;
      if (initial) mounted.show(initial, captionRef.current);
      // Адрес уже введён, а точки нет — сразу показываем его на карте:
      // человеку остаётся проверить и поправить, а не искать заново.
      else if (address.trim().length >= 3) void findAndShow(address.trim(), mounted);
      mounted.onPick((picked) => {
        touchedRef.current = true;
        setPoint(picked);
        setFound(null);
        mounted.show(picked, captionRef.current);
        void reversePortalMapPlace({ lat: picked.latitude, lng: picked.longitude }).then((response) => {
          const label = response.status === 200 ? response.data.label ?? null : null;
          setFound(label);
          mounted.show(picked, { title: captionRef.current.title, address: label ?? captionRef.current.address });
        }).catch(() => undefined);
      });
    });
    return () => { controller.abort(); view?.destroy(); viewRef.current = null; };
    // Карта монтируется один раз — когда появилась рамка.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  async function findAndShow(text: string, view: MapView) {
    try {
      const response = await searchPortalMapPlaces({ q: text });
      const place = response.status === 200 ? response.data[0] : undefined;
      if (place?.latitude == null || place.longitude == null || viewRef.current !== view || touchedRef.current) return;
      const picked = { latitude: place.latitude, longitude: place.longitude };
      setPoint(picked);
      setFound(place.label ?? null);
      view.show(picked, { title: captionRef.current.title, address: place.label });
    } catch {
      // Не нашли — человек укажет точку сам.
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      const response = await searchPortalMapPlaces({ q: query.trim() });
      const places = response.status === 200 ? response.data : [];
      // Один найденный адрес — выбирать не из чего: сразу показываем его.
      if (places.length === 1) choose(places[0]);
      else setResults(places);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function choose(place: MapPlaceDto) {
    if (place.latitude == null || place.longitude == null) return;
    touchedRef.current = true;
    const picked = { latitude: place.latitude, longitude: place.longitude };
    setPoint(picked);
    setFound(place.label ?? null);
    setResults(null);
    viewRef.current?.show(picked, { title, address: place.label });
  }

  return (
    <MapDialog title={title} onClose={onClose} onResize={() => viewRef.current?.resize()}>
      {(expanded) => (<>
        <form className="flex gap-2" onSubmit={(event) => void search(event)}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            aria-label={t('maps.search')}
            placeholder={t('maps.search')}
            className="h-11 min-w-0 grow rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button type="submit" variant="outline" disabled={searching || query.trim().length < 3}>
            {searching ? t('maps.searching') : t('maps.find')}
          </Button>
        </form>

        {results !== null ? (
          results.length === 0 ? (
            <p className="m-0 text-caption text-ink-subtle">{t('maps.nothing')}</p>
          ) : (
            <div className="rounded-[var(--radius-tile)] border border-hairline bg-sunk p-2">
              <p className="m-0 px-2 pb-2 pt-1 text-caption font-semibold text-ink">
                {t('maps.choose', { count: results.length })}
              </p>
              <ul aria-label={t('maps.results')} className="m-0 flex max-h-[200px] list-none flex-col gap-1 overflow-auto p-0">
                {results.map((place) => (
                  <li key={`${place.latitude},${place.longitude}`}>
                    <button type="button" onClick={() => choose(place)}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-control)] bg-surface px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                      <MapPin aria-hidden="true" className="size-4 shrink-0 text-accent" />
                      <span className="grow">{place.label}</span>
                      <span aria-hidden="true" className="shrink-0 text-caption font-semibold text-accent-ink">{t('maps.show')} →</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}

        <div data-testid="map-picker-map" className={mapBoxClass(expanded)}>
          <div ref={setBox} className="h-full w-full" />
        </div>

        <p className="m-0 text-caption text-ink-subtle">
          {point ? (found ?? address ?? '') || t('maps.hint') : t('maps.hint')}
          {point ? (
            <span data-testid="map-picker-coordinates" className="block tabular-nums">
              {t('maps.coordinates', { value: coordinatesText(point) })}
            </span>
          ) : null}
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{cancelLabel ?? t('maps.cancel')}</Button>
          <Button type="button" variant="accent" disabled={!point} onClick={() => point && onPick(point, found)}>
            {t('maps.done')}
          </Button>
        </div>
      </>)}
    </MapDialog>
  );
}
