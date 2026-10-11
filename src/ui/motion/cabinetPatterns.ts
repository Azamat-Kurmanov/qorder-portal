/**
 * Узоры фона кабинета клиента по отраслям — по два мотива линией на плитке.
 * Цвета в рисунке нет: узор — маска (`mask-image`), окраску даёт тема
 * (`.qo-bg-pattern`), поэтому он подходит к любой теме, днём и ночью.
 * Файл одинаковый в портале и кабинете продавца (тест одинаковости).
 */
const MOTIFS: Record<string, readonly [string, string]> = {
  FOOD: [
    'M12 7c-3-2-7 0-7 5s3 9 5 9c1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-9s-4-7-7-5z M12 7c0-2 1-4 3-4',
    'M12 21V8 M12 8c-2-1-3-3-3-5 2 0 3 2 3 5z M12 12c-2-1-4-2-4-5 2 0 4 2 4 5z M12 12c2-1 4-2 4-5-2 0-4 2-4 5z M12 16c-2-1-4-2-4-5 2 0 4 2 4 5z M12 16c2-1 4-2 4-5-2 0-4 2-4 5z',
  ],
  BUILD: [
    'M3 6h18v12H3z M3 12h18 M9 6v6 M15 12v6',
    'M14 4l6 6-3 3-6-6z M11 7 3 15l3 3 8-8',
  ],
  FASHION: [
    'M12 6a2 2 0 1 1 2 2c-1 .5-2 1-2 2 M12 10 3 17h18z',
    'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M10 10h.01 M14 10h.01 M10 14h.01 M14 14h.01',
  ],
  BEAUTY: [
    'M9 21h6v-9H9z M10 12V7l4-3v8',
    'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 9l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
  ],
  TECH: [
    'M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4',
    'M13 2 4 14h7l-1 8 9-12h-7z',
  ],
  AUTO: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 3v6 M12 15v6 M3 12h6 M15 12h6',
    'M15 4a4 4 0 0 0-1 5L4 19l1 1 10-10a4 4 0 0 0 5-1l-2-2-2 1-1-1 1-2z',
  ],
  HOME: [
    'M3 11 12 4l9 7 M5 10v10h14V10 M10 20v-6h4v6',
    'M8 3h8l3 8H5z M12 11v8 M8 21h8',
  ],
  GARDEN: [
    'M5 19C5 9 12 4 20 4c0 8-5 15-15 15z M5 19 14 10',
    'M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M12 4a3 3 0 0 1 0 6 3 3 0 0 1 0-6z M12 14a3 3 0 0 1 0 6 3 3 0 0 1 0-6z M4 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0z M14 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0z',
  ],
  KIDS: [
    'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
    'M12 3a5 5 0 0 0-5 5c0 4 5 8 5 8s5-4 5-8a5 5 0 0 0-5-5z M12 16c-1 2 1 3 0 5',
  ],
  SPORT: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
    'M3 10v4 M6 7v10 M18 7v10 M21 10v4 M6 12h12',
  ],
  HEALTH: [
    'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z',
  ],
  OFFICE: [
    'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4',
    'M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 16h7',
  ],
  // Сезоны.
  WINTER: [
    'M12 2v20 M3.3 7l17.4 10 M3.3 17l17.4-10 M12 5l-2-2 M12 5l2-2 M12 19l-2 2 M12 19l2 2',
    'M8 21h8v-4l3-5c1-2-1-4-3-3l-1 1V6a4 4 0 0 0-8 0v11z M8 17h8',
  ],
  SPRING: [
    'M12 22V11 M12 11c-4 0-6-3-6-7l3 2 3-3 3 3 3-2c0 4-2 7-6 7z M12 17c-3 0-5-2-6-4 3 0 5 1 6 4z',
    'M3 21C9 15 13 11 21 3 M8 16c-2-1-2-3-1-4 2 1 2 3 1 4z M13 11c-2-1-2-3-1-4 2 1 2 3 1 4z M10 14c1 2 3 2 4 1-1-2-3-2-4-1z',
  ],
  SUMMER: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
    'M2 10h20 M4 10c0 4 1 6 4 6s4-2 4-6 M12 10c0 4 1 6 4 6s4-2 4-6',
  ],
  AUTUMN: [
    'M12 22v-6 M12 16l-6 1 1-3-4-3 3-1-1-4 4 2 1-5 2 3 2-3 1 5 4-2-1 4 3 1-4 3 1 3z',
    'M3 12a9 9 0 0 1 18 0z M12 12v7a2 2 0 0 1-4 0',
  ],
  // Праздники — коды поводов.
  NEW_YEAR: [
    'M12 2l5 7h-3l5 6h-4l4 5H5l4-5H5l5-6H7z M12 20v2',
    'M4 10h16v11H4z M2 6h20v4H2z M12 6v15 M12 6c-2-4-6-3-5 0 M12 6c2-4 6-3 5 0',
  ],
  MARCH_8: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 21a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 21s-9-5.5-9-12a4.5 4.5 0 0 1 9-1.5A4.5 4.5 0 0 1 21 9c0 6.5-9 12-9 12z',
  ],
  NAURYZ: [
    'M12 20V10 M12 10c0-4-6-6-8-2s2 6 4 3 M12 10c0-4 6-6 8-2s-2 6-4 3',
    'M3 11h18c0 5-4 8-9 8s-9-3-9-8z M9 21h6 M8 7c0-2 2-2 2-4 M14 7c0-2 2-2 2-4',
  ],
  RAMADAN: [
    'M15 3a9 9 0 1 0 6 13A7 7 0 0 1 15 3z',
    'M9 3h6 M12 3v2 M8 5h8l1 3v9l-1 3H8l-1-3V8z M7 8h10 M7 17h10',
  ],
  BACK_TO_SCHOOL: [
    'M6 8a6 6 0 0 1 12 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z M9 4V3h6v1 M9 14h6v4H9z',
    'M5 19l1-4 10-10 3 3-10 10z M14 7l3 3 M5 19l3-1',
  ],
  // События и акции.
  BIRTHDAY: [
    'M4 21h16v-8H4z M4 16c2 1 4 1 6 0s4-1 6 0 4 1 4 0 M12 13V9 M12 9c-1-1-1-3 0-4 1 1 1 3 0 4z',
    'M12 2a5 6 0 0 0-5 6c0 4 5 8 5 8s5-4 5-8a5 6 0 0 0-5-6z M11 16h2 M12 16c1 2-1 4 1 6',
  ],
  SALE: [
    'M3 3h8l10 10-8 8L3 11z M7.5 7.5h.01',
    'M5 19L19 5 M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  CELEBRATION: [
    'M3 21l4-11 7 7z M14 3l1 3 M20 8l-3 1 M18 3l-2 3 M11 4c1 2 0 4-2 4 M20 13c-2-1-4 0-4 2',
    'M12 2l2.4 6.6L21 9l-5.2 4.4L17.6 21 12 17.2 6.4 21l1.8-7.6L3 9l6.6-.4z',
  ],
};

/** Группы узоров на экране продавца. */
export const PATTERN_GROUPS: Record<'industry' | 'season' | 'holiday' | 'event', readonly string[]> = {
  industry: ['FOOD', 'BUILD', 'FASHION', 'BEAUTY', 'TECH', 'AUTO', 'HOME', 'GARDEN', 'KIDS', 'SPORT', 'HEALTH', 'OFFICE'],
  season: ['WINTER', 'SPRING', 'SUMMER', 'AUTUMN'],
  holiday: ['NEW_YEAR', 'MARCH_8', 'NAURYZ', 'RAMADAN', 'BACK_TO_SCHOOL'],
  event: ['BIRTHDAY', 'SALE', 'CELEBRATION'],
};

/** Коды узоров: отрасли, сезоны, праздники, события и акции. */
export const PATTERN_CODES: readonly string[] = Object.keys(MOTIFS);

/** Сторона плитки узора, px. */
export const PATTERN_TILE = 140;

/**
 * Плитка узора для `mask-image`: два мотива, второй повёрнут и смещён по
 * диагонали — повтор не читается сеткой. `currentColor` в картинке — чёрный,
 * а для маски важна только непрозрачность.
 */
export function patternMask(code: string): string | null {
  const motifs = MOTIFS[code];
  if (!motifs) return null;
  const [a, b] = motifs;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PATTERN_TILE}" height="${PATTERN_TILE}" `
    + `viewBox="0 0 ${PATTERN_TILE} ${PATTERN_TILE}" fill="none" stroke="currentColor" stroke-width="1.5" `
    + 'stroke-linecap="round" stroke-linejoin="round">'
    + `<path transform="translate(14 14) scale(1.6)" d="${a}"/>`
    + `<path transform="translate(84 80) rotate(-14 19 19) scale(1.6)" d="${b}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
