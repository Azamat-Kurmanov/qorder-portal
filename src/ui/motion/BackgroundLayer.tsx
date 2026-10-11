import { useState, type CSSProperties } from 'react';
import { patternMask } from './cabinetPatterns';

/** Своё фото фона: адрес и настройки, как их отдаёт сервер. */
export interface BackgroundPhoto {
  url?: string;
  fit?: string;
  veil?: string;
  blur?: string;
  fixed?: boolean;
}

/**
 * Насколько вуаль цвета подложки закрывает фото. Среднее и сильное держат
 * контраст текста 4,5:1 на любом фото, светлом и тёмном (тест), лёгкое —
 * для спокойных снимков.
 */
export const VEIL = { LIGHT: 0.45, MEDIUM: 0.65, STRONG: 0.82 } as const;

/**
 * Фон кабинета под живым фоном: узор отрасли или своё фото под вуалью.
 * Фото проверяется скрытым `img` (тот же запрос, что у слоя) — показывается
 * после загрузки наплывом, а не загрузилось — слой снят, видна подложка.
 * Вид — `liveTheme.css` (`.qo-bg`); наплыв гасит «спокойно» (`data-motion`
 * оболочки или предпросмотра). Файл одинаковый в портале и кабинете продавца.
 */
export function BackgroundLayer({ pattern, photo }: {
  pattern: string | null | undefined;
  photo: BackgroundPhoto | null | undefined;
}) {
  const [state, setState] = useState<{ url?: string; loaded?: boolean; failed?: boolean }>({});
  const url = photo?.url;
  // Новое фото — заново ждём загрузки.
  if (state.url !== url) setState({ url });
  const mask = pattern ? patternMask(pattern) : null;
  if (photo && url && !state.failed) {
    return (
      <div aria-hidden="true" className="qo-bg" data-scroll={photo.fixed ? undefined : true}>
        <img src={url} alt="" hidden onLoad={() => setState({ url, loaded: true })} onError={() => setState({ url, failed: true })} />
        <div className="qo-bg-photo" data-loaded={state.loaded || undefined}
          data-fit={(photo.fit ?? 'COVER').toLowerCase()} data-blur={(photo.blur ?? 'NONE').toLowerCase()}
          style={{ '--bg-photo': `url("${url}")` } as CSSProperties} />
        <div className="qo-bg-veil" style={{ opacity: VEIL[(photo.veil ?? 'MEDIUM') as keyof typeof VEIL] ?? VEIL.MEDIUM }} />
      </div>
    );
  }
  if (!mask || url) return null;
  return (
    <div aria-hidden="true" className="qo-bg" data-pattern={pattern!.toLowerCase()}>
      <div className="qo-bg-pattern" style={{ '--bg-pattern': mask } as CSSProperties} />
    </div>
  );
}
