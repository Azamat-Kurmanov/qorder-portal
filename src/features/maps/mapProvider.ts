/**
 * Поставщик карты — то, что экраны знают о карте.
 *
 * Экран адреса не знает, чья под ним карта: OpenStreetMap сейчас, 2GIS,
 * Яндекс или Google потом — каждый реализует этот же набор действий,
 * а выбор поставщика станет настройкой компании.
 */
export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** Подпись на метке: название пункта и адрес. */
export interface MapCaption {
  title: string;
  address?: string | null;
}

export interface MapView {
  /** Ставит метку с подписью и приближает карту к ней. */
  show(point: MapPoint, caption: MapCaption): void;
  /** Нажали на карту. */
  onPick(handler: (point: MapPoint) => void): void;
  /** Рамка карты поменяла размер (окно развернули или свернули). */
  resize(): void;
  destroy(): void;
}

/** Кусочек карты для миниатюры: картинка и где она лежит внутри рамки. */
export interface MapTile {
  src: string;
  left: number;
  top: number;
  size: number;
}

export interface MapProvider {
  /**
   * Карта в рамке. Отменили (`signal`) раньше, чем догрузилась библиотека, —
   * карта не создаётся и приходит `null`: второй запуск того же окна (React
   * в разработке запускает эффект дважды) уже монтирует свою, и две карты
   * в одной рамке Leaflet не допускает.
   */
  mount(container: HTMLElement, center: MapPoint | null, signal?: AbortSignal,
    /** Где начать без точки: отмеченный пункт поставщика; пусто — `DEFAULT_CENTER`. */
    home?: MapPoint | null): Promise<MapView | null>;
  /** Картинки миниатюры с точкой ровно посередине рамки `width`×`height`. */
  thumbnail(point: MapPoint, width: number, height: number): MapTile[];
}

/**
 * С чего открывать карту, когда точки нет и у поставщика нет отмеченных пунктов (`useMapHome`).
 */
export const DEFAULT_CENTER: MapPoint = { latitude: 51.1694, longitude: 71.4491 };

/** Насколько приближать к выбранной точке: видны дом и подъезд. */
export const POINT_ZOOM = 17;

/** Широта и долгота словами: так их диктуют и вставляют в любую карту. */
export function coordinatesText(point: MapPoint): string {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

/** Точка из пары полей ответа; одна координата без другой — не точка. */
export function pointOf(latitude?: number | null, longitude?: number | null): MapPoint | null {
  return latitude == null || longitude == null ? null : { latitude, longitude };
}

export { osmProvider as mapProvider } from './osmProvider';
