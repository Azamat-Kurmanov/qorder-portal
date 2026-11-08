import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * «Назад» (решения владельца 2026-11-05): стрелка у имени раздела всегда ведёт на «Главную»
 * (`HOME`); стрелка в карточке возвращает в раздел, из которого карточку открыли, даже если
 * по пути листали похожие товары.
 *
 * Возврат — шагом назад по истории до записи раздела, а не новым переходом: так раздел
 * открывается с тем же отбором и прокруткой. Путь вкладки хранится в sessionStorage с номером
 * записи истории (`history.state.idx` роутера) и переживает перезагрузку.
 */
const KEY = 'qo.portal.trail';

interface Entry {
  idx: number;
  path: string;
}

/** Раздел — страница одного уровня (`/catalog`, `/orders`); `/catalog/<id>` — карточка внутри раздела. */
function isSection(path: string): boolean {
  return path.split('/').filter(Boolean).length === 1;
}

function currentIdx(): number {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : 0;
}

function read(): Entry[] {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? (value as Entry[]) : [];
  } catch {
    return [];
  }
}

/** Записывает открытую страницу; записи «впереди» неё (после шага назад и нового перехода) отбрасываются. */
export function useTrackTrail(): void {
  const location = useLocation();
  useEffect(() => {
    const idx = currentIdx();
    const trail = read().filter((entry) => entry.idx < idx);
    trail.push({ idx, path: location.pathname });
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-100)));
    } catch {
      // Хранилище недоступно — «Назад» уйдёт на запасной адрес.
    }
  }, [location]);
}

/** Куда ведёт стрелка у имени раздела. */
export const HOME = '/home';

/** «Назад» из карточки: в раздел, откуда её открыли; открытая по ссылке — на [fallback]. */
export function useBackToSection(fallback = '/catalog'): () => void {
  const navigate = useNavigate();
  return () => {
    const idx = currentIdx();
    const target = read()
      .reverse()
      .find((entry) => entry.idx < idx && isSection(entry.path));
    if (target) navigate(target.idx - idx);
    else navigate(fallback);
  };
}
