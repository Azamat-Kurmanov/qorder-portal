import { describe, expect, it } from 'vitest';
import { serviceVat } from './serviceVat';

describe('НДС доставки и грузчиков', () => {
  it('сверху — прибавляется к итогу', () => {
    expect(serviceVat(5000, 16, 'ON_TOP')).toEqual({ vat: 800, onTop: 800 });
  });

  it('внутри — виден, но итог не растёт; округление как на сервере', () => {
    expect(serviceVat(2000, 16, 'INCLUDED')).toEqual({ vat: 275.86, onTop: 0 });
    expect(serviceVat(5000, 16, 'INCLUDED')).toEqual({ vat: 689.66, onTop: 0 });
  });

  it('без НДС, у неплательщика и без суммы — ничего', () => {
    expect(serviceVat(5000, 16, 'NONE')).toEqual({ vat: 0, onTop: 0 });
    expect(serviceVat(5000, undefined, 'ON_TOP')).toEqual({ vat: 0, onTop: 0 });
    expect(serviceVat(0, 16, 'ON_TOP')).toEqual({ vat: 0, onTop: 0 });
  });
});
