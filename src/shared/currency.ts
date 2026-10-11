// ЕДИНСТВЕННОЕ место со знаками валют в portal/src — приёмка
// (`noHardcodedCurrency.test.ts`) запрещает символы «₸», «₽», «€» в любом
// другом файле `.ts`/`.tsx`, включая комментарии.

// Контракт не экспортирует общую именованную схему `Currency`: orval
// инлайнит один и тот же набор в каждый DTO отдельно (`PortalSupplierDtoCurrency`,
// `PortalOrderDtoCurrency`, `PlatformTenantDtoCurrency`, …) — тот же случай,
// что описан в `.superpowers/archive/sdd-2026-10-11/2026-09-27-currency-3-front-seller/…` для
// кабинета продавца. Здесь заведён единственный тип для фронта; он структурно
// совпадает с любым из `<Dto>Currency`, сгенерированных orval (тот же
// литеральный union шести кодов), поэтому взаимозаменим с ними без приведения
// типов.
export type Currency = 'KZT' | 'RUB' | 'USD' | 'UZS' | 'KGS' | 'EUR';

// Порядок — как в контракте (совпадает с порядком ключей в
// `PortalSupplierDtoCurrency`/`PortalOrderDtoCurrency` сгенерированного
// клиента), тем же порядком варианты стоят на экранах, где валюту выбирают.
// `Object.keys(SIGNS)` для этого не годится: порядок ключей объекта —
// деталь рантайма, а не часть контракта.
export const CURRENCIES: readonly Currency[] = ['KZT', 'RUB', 'USD', 'UZS', 'KGS', 'EUR'];

// «сўм» и «сом» записаны словом кириллицей — приёмка запрещает знаки валют
// вне этого файла, а не кириллицу вообще, поэтому литерал допустим как есть.
const SIGNS: Record<Currency, string> = {
  KZT: '₸',
  RUB: '₽',
  USD: '$',
  EUR: '€',
  UZS: 'сўм',
  KGS: 'сом',
};

/** Знак валюты для суммы: «₸», «₽», «$», «сўм», «сом», «€». */
// Незнакомый код (сервер добавил валюту раньше портала) — сам код, а не «undefined».
export function currencySign(code: Currency): string {
  return SIGNS[code] ?? code;
}
