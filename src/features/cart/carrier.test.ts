import { describe, expect, it } from 'vitest';
import { chosenCarrier, ownCarrierChosen, paysCarrierDirectly, terminalAllowed } from './carrier';

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

  it('свой перевозчик — только где продавец разрешил, и платит клиент сам', () => {
    const allowed = method({ allowOwnCarrier: true });
    expect(ownCarrierChosen(allowed, { ownCarrier: '' })).toBe(true);
    expect(ownCarrierChosen(method({}), { ownCarrier: 'inDriver' })).toBe(false);
    expect(chosenCarrier(allowed, { ownCarrier: 'inDriver' })).toBeUndefined();
    expect(paysCarrierDirectly(allowed, { ownCarrier: 'inDriver' })).toBe(true);
    expect(paysCarrierDirectly(allowed, {})).toBe(false);
  });
});
