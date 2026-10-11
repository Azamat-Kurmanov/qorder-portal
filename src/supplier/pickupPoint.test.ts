import { afterEach, describe, expect, it } from 'vitest';
import { setCurrentSupplierId } from './supplier';
import { currentPickupPoint, setPickupPoint } from './pickupPoint';

describe('выбор точки самовывоза', () => {
  afterEach(() => {
    window.localStorage.clear();
    setCurrentSupplierId(null);
  });

  it('точка хранится по продавцу', () => {
    setCurrentSupplierId('s1');
    setPickupPoint('p1');
    setCurrentSupplierId('s2');
    expect(currentPickupPoint()).toBeNull();
    setCurrentSupplierId('s1');
    expect(currentPickupPoint()).toBe('p1');
  });

  it('без хранилища выбор живёт в памяти', () => {
    setCurrentSupplierId('s3');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    try {
      setPickupPoint('p2');
      expect(currentPickupPoint()).toBe('p2');
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('«Все точки» убирает выбор', () => {
    setCurrentSupplierId('s1');
    setPickupPoint('p1');
    setPickupPoint(null);
    expect(currentPickupPoint()).toBeNull();
  });

  it('без продавца выбора нет', () => {
    setCurrentSupplierId(null);
    setPickupPoint('p1');
    expect(currentPickupPoint()).toBeNull();
  });
});
