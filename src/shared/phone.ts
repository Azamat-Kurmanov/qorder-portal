import i18n from '../i18n';

/**
 * Телефоны любой страны. Сервер хранит номер в E.164 цифрами: код страны
 * и номер подряд, «77010000102», «996555123456». Тот же список кодов —
 * у страницы входа Keycloak (`phone-login.js`) и в портале с админкой.
 */

export interface Country {
  iso: string;
  code: string;
}

/** Страны СНГ — сверху выбора, по алфавиту; дальше остальные, тоже по алфавиту. */
export const CIS_COUNTRIES = ['AM', 'AZ', 'BY', 'KZ', 'KG', 'MD', 'RU', 'TJ', 'TM', 'UZ'];

/**
 * Название страны: свой перевод (`phoneCountry.<ISO>`), если справочник
 * браузера называет её непривычно для наших людей («Киргизия»), иначе — его.
 */
function nameOf(iso: string, lang: string, names: Intl.DisplayNames | null): string {
  return i18n.t(`phoneCountry.${iso}`, { lng: lang, defaultValue: '' }) || names?.of(iso) || iso;
}

export const COUNTRIES: Country[] = (
  'AF 93,AL 355,DZ 213,AD 376,AO 244,AG 1,AR 54,AM 374,AU 61,AT 43,AZ 994,BS 1,BH 973,' +
  'BD 880,BB 1,BY 375,BE 32,BZ 501,BJ 229,BT 975,BO 591,BA 387,BW 267,BR 55,BN 673,BG 359,' +
  'BF 226,BI 257,KH 855,CM 237,CA 1,CV 238,CF 236,TD 235,CL 56,CN 86,CO 57,KM 269,CG 242,' +
  'CD 243,CR 506,CI 225,HR 385,CU 53,CY 357,CZ 420,DK 45,DJ 253,DM 1,DO 1,EC 593,EG 20,' +
  'SV 503,GQ 240,ER 291,EE 372,SZ 268,ET 251,FJ 679,FI 358,FR 33,GA 241,GM 220,GE 995,DE 49,' +
  'GH 233,GR 30,GD 1,GT 502,GN 224,GW 245,GY 592,HT 509,HN 504,HK 852,HU 36,IS 354,IN 91,' +
  'ID 62,IR 98,IQ 964,IE 353,IL 972,IT 39,JM 1,JP 81,JO 962,KZ 7,KE 254,KI 686,KP 850,KR 82,' +
  'KW 965,KG 996,LA 856,LV 371,LB 961,LS 266,LR 231,LY 218,LI 423,LT 370,LU 352,MO 853,' +
  'MG 261,MW 265,MY 60,MV 960,ML 223,MT 356,MH 692,MR 222,MU 230,MX 52,FM 691,MD 373,MC 377,' +
  'MN 976,ME 382,MA 212,MZ 258,MM 95,NA 264,NR 674,NP 977,NL 31,NZ 64,NI 505,NE 227,NG 234,' +
  'MK 389,NO 47,OM 968,PK 92,PW 680,PS 970,PA 507,PG 675,PY 595,PE 51,PH 63,PL 48,PT 351,' +
  'PR 1,QA 974,RO 40,RU 7,RW 250,KN 1,LC 1,VC 1,WS 685,SM 378,ST 239,SA 966,SN 221,RS 381,' +
  'SC 248,SL 232,SG 65,SK 421,SI 386,SB 677,SO 252,ZA 27,SS 211,ES 34,LK 94,SD 249,SR 597,' +
  'SE 46,CH 41,SY 963,TW 886,TJ 992,TZ 255,TH 66,TL 670,TG 228,TO 676,TT 1,TN 216,TR 90,' +
  'TM 993,TV 688,UG 256,UA 380,AE 971,GB 44,US 1,UY 598,UZ 998,VU 678,VA 39,VE 58,VN 84,' +
  'XK 383,YE 967,ZM 260,ZW 263'
)
  .split(',')
  .map((pair) => {
    const [iso, code] = pair.split(' ');
    return { iso, code };
  });

/** Код страны в начале номера: самый длинный подходящий; у +7 — Казахстан. */
export function dialCodeOf(digits: string): string | null {
  let found: string | null = null;
  for (const { code } of COUNTRIES) {
    if (digits.startsWith(code) && (!found || code.length > found.length)) found = code;
  }
  return found;
}

/**
 * «77010000102» → «+7 701 000 01 02», «996555123456» → «+996 555123456».
 * Номер +7 разбит по разрядам, как его привыкли читать. У других стран
 * отделён только код: чужой номер, разбитый по чужим правилам, читается
 * хуже неразбитого. Не номер — как есть.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  const code = digits.length >= 8 ? dialCodeOf(digits) : null;
  return code ? `+${code} ${digits.slice(code.length)}` : phone;
}

/** Страны для выбора: сначала СНГ, затем остальные — по алфавиту на языке интерфейса. */
export function countryOptions(language: string): (Country & { name: string })[] {
  const lang = language.slice(0, 2);
  const names = (() => {
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return null;
    }
  })();
  const named = COUNTRIES.map((c) => ({ ...c, name: nameOf(c.iso, lang, names) }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, lang);
  return [
    ...named.filter((c) => CIS_COUNTRIES.includes(c.iso)).sort(byName),
    ...named.filter((c) => !CIS_COUNTRIES.includes(c.iso)).sort(byName),
  ];
}

/**
 * Цифры номера после кода страны из набранного как угодно. Для +7 понимаются
 * «+7 701 …» и «8 701 …» (код попадал в номер второй раз), для остальных —
 * номер целиком с кодом и местный ведущий 0.
 */
export function nationalDigits(input: string, code: string): string {
  const digits = input.replace(/\D/g, '');
  if (code === '7') return digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits;
  if (digits.startsWith(code) && digits.length - code.length >= 8) return digits.slice(code.length);
  return digits.replace(/^0/, '');
}
