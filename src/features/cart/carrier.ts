import type { Carrier, DeliveryOptionsDto, SubmitOrderDelivery } from '../../api/generated';

type Method = DeliveryOptionsDto['methods'][number];

/** Выбранный перевозчик; единственного сервер выберет сам — показываем его сразу. */
export function chosenCarrier(method: Method | undefined, value: SubmitOrderDelivery): Carrier | undefined {
  const carriers = method?.carriers ?? [];
  if (ownCarrierChosen(method, value)) return undefined;
  if (carriers.length === 1) return carriers[0];
  return carriers.find((carrier) => carrier.id === value.carrierId);
}

/** «До терминала» — только межгород и перевозчик, у которого терминал есть. */
export function terminalAllowed(method: Method | undefined, carrier: Carrier | undefined): boolean {
  return !!method?.intercity && !!carrier?.terminalAddress;
}

/** Клиент выбрал своего перевозчика («Другой…»); имя может быть ещё не вписано. */
export function ownCarrierChosen(method: Method | undefined, value: SubmitOrderDelivery | undefined): boolean {
  return !!method?.allowOwnCarrier && value?.ownCarrier !== undefined;
}

/**
 * Перевозку клиент платит перевозчику: сумма «для сведения», в итог не входит.
 * Свой перевозчик клиента — всегда так: продавец ему не платит.
 */
export function paysCarrierDirectly(method: Method | undefined, value?: SubmitOrderDelivery): boolean {
  if (ownCarrierChosen(method, value)) return true;
  return (method?.carriers?.length ?? 0) > 0 && method?.transportPayee === 'DIRECT';
}
