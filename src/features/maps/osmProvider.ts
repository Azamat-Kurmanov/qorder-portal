import type { MapCaption, MapPoint, MapProvider, MapView } from './mapProvider';
import { DEFAULT_CENTER, POINT_ZOOM, coordinatesText } from './mapProvider';

/**
 * OpenStreetMap через Leaflet.
 *
 * Библиотека и её стили грузятся при первом открытии карты, а не со всем
 * кабинетом: карту открывают редко, а весит она как треть экрана.
 * ponytail: общие тайлы tile.openstreetmap.org — для разработки и малой нагрузки;
 * в бою — свой сервер тайлов или платный поставщик (поменять адрес ниже).
 */
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Подпись собирается узлами, а не строкой HTML: адрес приходит извне. */
function captionNode(caption: MapCaption, point: MapPoint): HTMLElement {
  const box = document.createElement('div');
  const title = document.createElement('b');
  title.textContent = caption.title;
  box.append(title);
  if (caption.address) {
    const address = document.createElement('div');
    address.textContent = caption.address;
    box.append(address);
  }
  const coordinates = document.createElement('div');
  coordinates.className = 'qo-map-coordinates';
  coordinates.textContent = coordinatesText(point);
  box.append(coordinates);
  return box;
}

export const osmProvider: MapProvider = {
  async mount(container, center, signal, home) {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    await import('./map.css');
    // Пока грузилась библиотека, окно отменило монтаж: карту в эту рамку ставит уже другой запуск.
    if (signal?.aborted) return null;
    const start = center ?? home ?? DEFAULT_CENTER;
    container.classList.add('qo-map');
    const map = L.map(container, { zoomSnap: 0.5, attributionControl: false }).setView([start.latitude, start.longitude], center ? POINT_ZOOM : 12);
    L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
    // Рамка поменяла размер (окно развернули, свернули, окно браузера изменилось) —
    // карта дорисовывает тайлы сама, иначе остаётся серая пустота.
    const watcher = new ResizeObserver(() => map.invalidateSize());
    watcher.observe(container);
    // Метка без картинки: стандартный значок Leaflet ищет файлы, которых сборка не кладёт.
    const icon = L.divIcon({ className: 'qo-map-pin', html: '<span></span>', iconSize: [36, 38], iconAnchor: [18, 38], popupAnchor: [0, -36] });
    let marker: ReturnType<typeof L.marker> | null = null;

    const view: MapView = {
      show(point: MapPoint, caption: MapCaption) {
        const at: [number, number] = [point.latitude, point.longitude];
        marker ??= L.marker(at, { icon }).addTo(map);
        marker.setLatLng(at).bindPopup(captionNode(caption, point)).openPopup();
        // Плавный перелёт к точке; без анимации — тем, кто её отключил.
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        map.flyTo(at, Math.max(map.getZoom(), POINT_ZOOM), { duration: still ? 0 : 0.6 });
      },
      onPick(handler) {
        map.on('click', (event) => handler({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
      },
      resize() {
        // Точка остаётся посередине и после смены размера рамки.
        const center = marker?.getLatLng() ?? map.getCenter();
        map.invalidateSize();
        map.setView(center, map.getZoom(), { animate: false });
      },
      destroy() {
        watcher.disconnect();
        map.remove();
      },
    };
    return view;
  },

  thumbnail(point, width, height) {
    // Веб-Меркатор: где точка на сетке тайлов уровня ZOOM, в пикселях.
    const zoom = 16;
    const size = 256;
    const n = 2 ** zoom;
    const lat = (point.latitude * Math.PI) / 180;
    const x = ((point.longitude + 180) / 360) * n * size;
    const y = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n * size;
    // Рамка с точкой посередине; тайлы — все, что в неё попадают.
    const left = x - width / 2;
    const top = y - height / 2;
    const tiles: { src: string; left: number; top: number; size: number }[] = [];
    for (let tx = Math.floor(left / size); tx <= Math.floor((left + width) / size); tx++) {
      for (let ty = Math.floor(top / size); ty <= Math.floor((top + height) / size); ty++) {
        tiles.push({
          src: TILES.replace('{s}', 'abc'[(tx + ty) % 3]).replace('{z}', String(zoom))
            .replace('{x}', String(((tx % n) + n) % n)).replace('{y}', String(ty)),
          left: tx * size - left,
          top: ty * size - top,
          size,
        });
      }
    }
    return tiles;
  },

};
