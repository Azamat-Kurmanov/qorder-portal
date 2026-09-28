import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryBlock } from './DeliveryBlock';
import type { SubmitOrderDelivery } from '../../api/generated';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

/** Способ доставки, у которого спрашивают и адрес, и этаж. */
const deliveryOptions = {
  mode: 'ENABLED',
  methods: [{
    id: 'method-1',
    name: 'Доставка по городу',
    pickup: false,
    requiresAddress: true,
    requiresFloor: true,
    requiresTimeSlot: false,
    price: 1500,
    negotiable: false,
    zones: [],
    slots: [],
  }],
  pickupPoints: [],
};

const suppliers = [
  { supplierId: 'supplier-1', name: 'Мой поставщик' },
  { supplierId: 'supplier-2', name: 'Стройторг' },
];

/**
 * Обёртка вокруг блока: сам блок — управляемый компонент, а состояние
 * ему в тестах даёт этот держатель, как в бою — экран оформления.
 */
function Harness({
  initial,
  onChangeSpy,
}: {
  initial?: SubmitOrderDelivery;
  onChangeSpy?: (next: SubmitOrderDelivery) => void;
}) {
  const [value, setValue] = useState<SubmitOrderDelivery>(initial ?? { methodId: 'method-1' });
  return (
    <DeliveryBlock
      goodsTotal={0}
      value={value}
      onChange={(next) => {
        onChangeSpy?.(next);
        setValue(next);
      }}
    />
  );
}

/**
 * Предложение адреса на оформлении.
 *
 * Клиент, закупающийся у нескольких поставщиков, набирает один и тот же
 * адрес выгрузки заново у каждого. Проверяется то, что можно взять адрес
 * у соседнего поставщика одним нажатием — и что предложение не путается
 * с адресом, уже названным текущему.
 */
describe('предложение известного адреса', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('на пустом поле адреса предлагает адрес соседнего поставщика', async () => {
    stubFetch([
      get('/api/portal/delivery', deliveryOptions),
      get('/api/portal/suppliers', suppliers),
      get('/api/portal/addresses', [
        {
          supplierId: 'supplier-2',
          address: 'ул. Абая, 10',
          city: 'Алматы',
          floor: 3,
          usedAt: '2026-09-01T10:00:00Z',
        },
      ]),
    ]);

    renderScreen(<Harness />, { supplierId: 'supplier-1' });
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    const suggestion = await screen.findByRole('button', { name: /Стройторг/i });
    expect(suggestion).toHaveTextContent('ул. Абая, 10');
  });

  it('на заполненном поле адреса предложения нет', async () => {
    stubFetch([
      get('/api/portal/delivery', deliveryOptions),
      get('/api/portal/suppliers', suppliers),
      get('/api/portal/addresses', [
        {
          supplierId: 'supplier-2',
          address: 'ул. Абая, 10',
          city: 'Алматы',
          floor: 3,
          usedAt: '2026-09-01T10:00:00Z',
        },
      ]),
    ]);

    renderScreen(
      <Harness initial={{ methodId: 'method-1', address: 'ул. Уже заполнено, 1' }} />,
      { supplierId: 'supplier-1' },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    // Ждём, пока список известных адресов точно догрузится, прежде чем
    // утверждать, что предложения нет — иначе тест прошёл бы и без блока.
    expect(await screen.findByLabelText(/адрес доставки/i)).toHaveValue('ул. Уже заполнено, 1');
    expect(screen.queryByRole('button', { name: /Стройторг/i })).not.toBeInTheDocument();
  });

  it('нажатие подставляет адрес, город и этаж в форму', async () => {
    const onChangeSpy = vi.fn();
    stubFetch([
      get('/api/portal/delivery', deliveryOptions),
      get('/api/portal/suppliers', suppliers),
      get('/api/portal/addresses', [
        {
          supplierId: 'supplier-2',
          address: 'ул. Абая, 10',
          city: 'Алматы',
          floor: 3,
          usedAt: '2026-09-01T10:00:00Z',
        },
      ]),
    ]);

    renderScreen(<Harness onChangeSpy={onChangeSpy} />, { supplierId: 'supplier-1' });
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    const suggestion = await screen.findByRole('button', { name: /Стройторг/i });
    await userEvent.click(suggestion);

    // Идентификаторы справочника, окно и дата не подставляются никогда:
    // они принадлежат справочнику соседнего поставщика, а не человеку.
    expect(onChangeSpy).toHaveBeenCalledWith({
      methodId: 'method-1',
      address: 'ул. Абая, 10',
      city: 'Алматы',
      floor: 3,
    });
    expect(await screen.findByLabelText(/адрес доставки/i)).toHaveValue('ул. Абая, 10');
    expect(screen.getByLabelText(/этаж/i)).toHaveValue(3);
  });

  /**
   * Данные подобраны так, чтобы верная и неверная реализация расходились:
   * у текущего поставщика — один адрес, у соседа — другой. Предложен должен
   * быть соседский; если бы оба адреса совпадали, тест остался бы зелёным
   * и на реализации, которая не отфильтровывает текущего поставщика.
   */
  it('адрес текущего поставщика в предложениях не участвует', async () => {
    stubFetch([
      get('/api/portal/delivery', deliveryOptions),
      get('/api/portal/suppliers', suppliers),
      get('/api/portal/addresses', [
        {
          supplierId: 'supplier-1',
          address: 'ул. Текущая, 1',
          usedAt: '2026-09-02T10:00:00Z',
        },
        {
          supplierId: 'supplier-2',
          address: 'ул. Соседняя, 5',
          usedAt: '2026-09-01T10:00:00Z',
        },
      ]),
    ]);

    renderScreen(<Harness />, { supplierId: 'supplier-1' });
    await userEvent.click(await screen.findByRole('button', { name: 'Доставка' }));

    const suggestion = await screen.findByRole('button', { name: /Стройторг/i });
    expect(suggestion).toHaveTextContent('ул. Соседняя, 5');
    expect(screen.queryByText(/ул\. Текущая, 1/)).not.toBeInTheDocument();
  });
});

/**
 * «Только самовывоз» — решение поставщика, а не отсутствие способов:
 * даже если в справочнике остался способ доставки, кнопка «Доставка»
 * не нажимается и выбор самовывоза не сбивает.
 */
describe('только самовывоз', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('кнопка «Доставка» отключена, даже когда способ доставки заведён', async () => {
    const onChangeSpy = vi.fn();
    stubFetch([
      get('/api/portal/delivery', {
        ...deliveryOptions,
        mode: 'PICKUP_ONLY',
        methods: [
          ...deliveryOptions.methods,
          { ...deliveryOptions.methods[0], id: 'pickup-1', name: 'Самовывоз', pickup: true, requiresAddress: false, requiresFloor: false },
        ],
      }),
      get('/api/portal/suppliers', suppliers),
      get('/api/portal/addresses', []),
    ]);

    renderScreen(<Harness initial={{ methodId: 'pickup-1' }} onChangeSpy={onChangeSpy} />, { supplierId: 'supplier-1' });

    const courier = await screen.findByRole('button', { name: 'Доставка' });
    expect(courier).toBeDisabled();
    await userEvent.click(courier);
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});

/**
 * Один способ получения выбирается сам: спрашивать «какой из одного»
 * незачем, а невыбранный он ушёл бы менеджеру вопросом.
 */
describe('единственный способ получения', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubOptions(options: unknown) {
    stubFetch([
      get('/api/portal/delivery', options),
      get('/api/portal/suppliers', suppliers),
      get('/api/portal/addresses', []),
    ]);
  }

  it('единственная доставка выбрана сразу', async () => {
    const onChangeSpy = vi.fn();
    stubOptions(deliveryOptions);

    renderScreen(<Harness initial={{}} onChangeSpy={onChangeSpy} />, { supplierId: 'supplier-1' });

    expect(await screen.findByRole('button', { name: 'Доставка' })).toHaveAttribute('aria-pressed', 'true');
    expect(onChangeSpy).toHaveBeenCalledWith({ methodId: 'method-1' });
  });

  it('единственный самовывоз у поставщика «только самовывоз» выбран сразу', async () => {
    const onChangeSpy = vi.fn();
    stubOptions({
      ...deliveryOptions,
      mode: 'PICKUP_ONLY',
      methods: [
        ...deliveryOptions.methods,
        { ...deliveryOptions.methods[0], id: 'pickup-1', name: 'Самовывоз', pickup: true, requiresAddress: false, requiresFloor: false },
      ],
    });

    renderScreen(<Harness initial={{}} onChangeSpy={onChangeSpy} />, { supplierId: 'supplier-1' });

    await screen.findByRole('button', { name: 'Самовывоз' });
    await vi.waitFor(() => expect(onChangeSpy).toHaveBeenCalledWith({ methodId: 'pickup-1' }));
  });

  it('из двух способов не выбирается ничего', async () => {
    const onChangeSpy = vi.fn();
    stubOptions({
      ...deliveryOptions,
      methods: [
        ...deliveryOptions.methods,
        { ...deliveryOptions.methods[0], id: 'pickup-1', name: 'Самовывоз', pickup: true, requiresAddress: false, requiresFloor: false },
      ],
    });

    renderScreen(<Harness initial={{}} onChangeSpy={onChangeSpy} />, { supplierId: 'supplier-1' });

    expect(await screen.findByRole('button', { name: 'Доставка' })).toHaveAttribute('aria-pressed', 'false');
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});
