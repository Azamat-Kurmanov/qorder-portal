import { describe, expect, it } from 'vitest';
// Контракт не экспортирует единую именованную схему `Currency` — orval
// инлайнит одинаковый набор в каждый DTO отдельно (см. комментарий
// в `currency.ts`). `PortalSupplierDtoCurrency` — тот самый enum, из
// которого `useSupplierCurrency()` читает валюту магазина, поэтому он
// и служит эталоном состава и порядка для этой проверки.
import { PortalSupplierDtoCurrency } from '../api/generated';
import { CURRENCIES, currencySign, type Currency } from './currency';

describe('справочник валют', () => {
  it('совпадает с перечислением валюты контракта — и составом, и порядком', () => {
    expect([...CURRENCIES]).toEqual(Object.values(PortalSupplierDtoCurrency));
  });

  it('у каждой валюты свой непустой знак', () => {
    const signs = CURRENCIES.map(currencySign);
    expect(signs.every((sign) => sign.length > 0)).toBe(true);
    expect(new Set(signs).size).toBe(CURRENCIES.length);
  });

  it('незнакомый код от сервера — сам код, а не undefined', () => {
    expect(currencySign('GBP' as Currency)).toBe('GBP');
  });

  it('знаки редких валют — словом кириллицей, не значком', () => {
    expect(currencySign('UZS')).toBe('сўм');
    expect(currencySign('KGS')).toBe('сом');
    expect(currencySign('EUR')).toBe('€');
  });
});
