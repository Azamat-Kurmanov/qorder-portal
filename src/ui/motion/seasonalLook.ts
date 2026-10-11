/**
 * Узор и живой фон «на сегодня»: «по сезону» — сезон по дате, в дни праздничного
 * повода — праздничная пара. Чистые функции без React — одинаковый файл в кабинете
 * клиента (`portal/src/ui/motion`) и в предпросмотре продавца
 * (`front/src/features/cabinetDesign`), тест одинаковости в портале.
 */
export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

/** Пара сезона: узор и живой фон. */
export const SEASON_LOOK: Record<Season, { pattern: string; backdrop: string }> = {
  WINTER: { pattern: 'WINTER', backdrop: 'SNOW' },
  SPRING: { pattern: 'SPRING', backdrop: 'PETALS' },
  SUMMER: { pattern: 'SUMMER', backdrop: 'SUNSHINE' },
  AUTUMN: { pattern: 'AUTUMN', backdrop: 'LEAVES' },
};

/** Праздничная пара повода: узор и живой фон на дни повода. */
export const OCCASION_LOOK: Record<string, { pattern: string; backdrop: string }> = {
  NEW_YEAR: { pattern: 'NEW_YEAR', backdrop: 'GARLAND' },
  MARCH_8: { pattern: 'MARCH_8', backdrop: 'HEARTS' },
  NAURYZ: { pattern: 'NAURYZ', backdrop: 'PETALS' },
  RAMADAN: { pattern: 'RAMADAN', backdrop: 'STARS' },
  SUMMER: { pattern: 'SUMMER', backdrop: 'SUNSHINE' },
  BACK_TO_SCHOOL: { pattern: 'BACK_TO_SCHOOL', backdrop: 'CONFETTI' },
  BLACK_FRIDAY: { pattern: 'SALE', backdrop: 'SALE_TAGS' },
  BIRTHDAY: { pattern: 'BIRTHDAY', backdrop: 'BALLOONS' },
  SALE: { pattern: 'SALE', backdrop: 'SALE_TAGS' },
  CELEBRATION: { pattern: 'CELEBRATION', backdrop: 'FIREWORKS' },
};

/** Сезон по дате ГГГГ-ММ-ДД: декабрь–февраль — зима, март–май — весна и т. д. */
export function seasonOf(today: string): Season {
  const month = Number(today.slice(5, 7));
  if (month === 12 || month <= 2) return 'WINTER';
  if (month <= 5) return 'SPRING';
  if (month <= 8) return 'SUMMER';
  return 'AUTUMN';
}

export interface LookInput {
  /** Узор продавца: код, `SEASON` или пусто. */
  pattern: string | null | undefined;
  /** Живой фон: выбор продавца или темы, `SEASON` — по сезону. */
  backdrop: string;
  /** Своё фото фона: праздник его не заменяет. */
  photo: boolean;
  occasion: string | null | undefined;
  occasionFrom: string | null | undefined;
  occasionUntil: string | null | undefined;
  /** «На эти дни — праздничный фон»; пусто — да. */
  occasionBackground: boolean | null | undefined;
}

export function todaysLook(input: LookInput, today: string): { pattern: string | null; backdrop: string } {
  const season = SEASON_LOOK[seasonOf(today)];
  let pattern = input.pattern === 'SEASON' ? season.pattern : input.pattern ?? null;
  let backdrop = input.backdrop === 'SEASON' ? season.backdrop : input.backdrop;
  const festive = input.occasion && input.occasionFrom && input.occasionUntil
    && input.occasionFrom <= today && today <= input.occasionUntil && input.occasionBackground !== false
    ? OCCASION_LOOK[input.occasion] : undefined;
  if (festive) {
    backdrop = festive.backdrop;
    if (!input.photo) pattern = festive.pattern;
  }
  return { pattern, backdrop };
}
