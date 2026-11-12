/**
 * Страны для выбора города: коды ISO 3166-1 alpha-2, названия даёт браузер (`Intl.DisplayNames`).
 * Сначала — страны, откуда и куда чаще всего ездят клиенты; дальше — все по алфавиту.
 */
const FIRST = ['KZ', 'RU', 'KG', 'UZ', 'TJ', 'TM', 'CN', 'TR', 'AE'] as const;

const ALL = ('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM '
  + 'CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT '
  + 'HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH '
  + 'MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA '
  + 'SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN '
  + 'VU WS YE ZA ZM ZW').split(' ');

/** Название страны на языке кабинета; браузер без названия — сам код. */
export function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Страны для списка: частые первыми, остальные по алфавиту на языке кабинета. */
export function countryOptions(language: string): { code: string; name: string }[] {
  const named = (code: string) => ({ code, name: countryName(code, language) });
  const rest = ALL.filter((code) => !(FIRST as readonly string[]).includes(code))
    .map(named)
    .sort((a, b) => a.name.localeCompare(b.name, language));
  return [...FIRST.map(named), ...rest];
}
