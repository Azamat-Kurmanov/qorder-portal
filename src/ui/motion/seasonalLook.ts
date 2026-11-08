/**
 * Узор «на сегодня»: «по сезону» — сезон по дате, в дни праздничного
 * повода — праздничный узор. Чистые функции без React — одинаковый файл в кабинете
 * клиента (`portal/src/ui/motion`) и в предпросмотре продавца
 * (`front/src/features/cabinetDesign`), тест одинаковости в портале.
 */
export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

/** Узор сезона. */
export const SEASON_LOOK: Record<Season, { pattern: string }> = {
  WINTER: { pattern: 'WINTER' },
  SPRING: { pattern: 'SPRING' },
  SUMMER: { pattern: 'SUMMER' },
  AUTUMN: { pattern: 'AUTUMN' },
};

/** Праздничный узор повода на его дни. */
export const OCCASION_LOOK: Record<string, { pattern: string }> = {
  NEW_YEAR: { pattern: 'NEW_YEAR' },
  MARCH_8: { pattern: 'MARCH_8' },
  NAURYZ: { pattern: 'NAURYZ' },
  RAMADAN: { pattern: 'RAMADAN' },
  SUMMER: { pattern: 'SUMMER' },
  BACK_TO_SCHOOL: { pattern: 'BACK_TO_SCHOOL' },
  BLACK_FRIDAY: { pattern: 'SALE' },
  BIRTHDAY: { pattern: 'BIRTHDAY' },
  SALE: { pattern: 'SALE' },
  CELEBRATION: { pattern: 'CELEBRATION' },
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
  /** Своё фото фона: праздник его не заменяет. */
  photo: boolean;
  occasion: string | null | undefined;
  occasionFrom: string | null | undefined;
  occasionUntil: string | null | undefined;
  /** «На эти дни — праздничный фон»; пусто — да. */
  occasionBackground: boolean | null | undefined;
}

export function todaysLook(input: LookInput, today: string): { pattern: string | null } {
  const pattern = input.pattern === 'SEASON' ? SEASON_LOOK[seasonOf(today)].pattern : input.pattern ?? null;
  const festive = input.occasion && input.occasionFrom && input.occasionUntil
    && input.occasionFrom <= today && today <= input.occasionUntil && input.occasionBackground !== false
    ? OCCASION_LOOK[input.occasion] : undefined;
  return { pattern: festive && !input.photo ? festive.pattern : pattern };
}
