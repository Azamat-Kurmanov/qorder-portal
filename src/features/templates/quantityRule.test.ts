import { describe, expect, it } from 'vitest';
import { firstValid, quantityProblem } from './quantityRule';

describe('правило количества', () => {
  it('первое допустимое — минимум, поднятый до шага', () => {
    expect(firstValid({ min: 1, step: 18 })).toBe(18);
    expect(firstValid({ min: 10, step: 10 })).toBe(10);
    expect(firstValid({ min: 25, step: 10 })).toBe(30);
    expect(firstValid({})).toBe(1);
    expect(firstValid({ min: 3 })).toBe(3);
  });

  it('меньше минимума и не кратно шагу — названо', () => {
    expect(quantityProblem(5, { min: 10, step: 10 })).toBe('min');
    expect(quantityProblem(25, { min: 10, step: 10 })).toBe('step');
    expect(quantityProblem(36, { min: 1, step: 18 })).toBeNull();
    expect(quantityProblem(0.3, { step: 0.1 })).toBeNull();
    expect(quantityProblem(0, {})).toBe('invalid');
  });
});
