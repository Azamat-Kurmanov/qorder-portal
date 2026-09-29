import type { Carrier, DeliveryOptionsDto, SubmitOrderDelivery } from '../../api/generated';

type Method = DeliveryOptionsDto['methods'][number];

/** Выбранный перевозчик; единственного сервер выберет сам — показываем его сразу. */
export function chosenCarrier(method: Method | undefined, value: SubmitOrderDelivery): Carrier | undefined {
  const carriers = method?.carriers ?? [];
  if (carriers.length === 1) return carriers[0];
  return carriers.find((carrier) => carrier.id === value.carrierId);
}

/** «До терминала» — только межгород и перевозчик, у которого терминал есть. */
export function terminalAllowed(method: Method | undefined, carrier: Carrier | undefined): boolean {
  return !!method?.intercity && !!carrier?.terminalAddress;
}

/** Перевозку клиент платит перевозчику: сумма «для сведения», в итог не входит. */
export function paysCarrierDirectly(method: Method | undefined): boolean {
  return (method?.carriers?.length ?? 0) > 0 && method?.transportPayee === 'DIRECT';
}
