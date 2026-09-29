import { describe, expect, it } from 'vitest';
import { chosenCarrier, paysCarrierDirectly, terminalAllowed } from './carrier';

const cdek = { id: 'c1', name: 'СДЭК', terminalAddress: 'Астана, терминал' };
const baiterek = { id: 'c2', name: 'Байтерек' };
const method = (patch: Record<string, unknown>) => ({
  id: 'm1', name: 'Межгород', pickup: false, requiresAddress: true, requiresFloor: false, requiresTimeSlot: false,
  negotiable: false, zones: [], slots: [], carriers: [cdek], intercity: true, transportPayee: 'SELLER', ...patch,
}) as never;

describe('перевозчик на оформлении', () => {
  it('единственный выбран сам, из нескольких — выбранный', () => {
    expect(chosenCarrier(method({}), {})).toEqual(cdek);
    expect(chosenCarrier(method({ carriers: [cdek, baiterek] }), {})).toBeUndefined();
    expect(chosenCarrier(method({ carriers: [cdek, baiterek] }), { carrierId: 'c2' })).toEqual(baiterek);
  });

  it('«до терминала» — только межгород и перевозчик с терминалом', () => {
    expect(terminalAllowed(method({}), cdek)).toBe(true);
    expect(terminalAllowed(method({ intercity: false }), cdek)).toBe(false);
    expect(terminalAllowed(method({}), baiterek)).toBe(false);
  });

  it('«напрямую» — только у способа перевозчиком', () => {
    expect(paysCarrierDirectly(method({ transportPayee: 'DIRECT' }))).toBe(true);
    expect(paysCarrierDirectly(method({}))).toBe(false);
    expect(paysCarrierDirectly(undefined)).toBe(false);
  });
});
