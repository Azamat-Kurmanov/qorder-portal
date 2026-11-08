import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { SupplierPicker } from './SupplierPicker';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const suppliers = [
  { supplierId: 'supplier-1', name: 'СтройБаза Алматы' },
  { supplierId: 'supplier-2', name: 'Бумага оптом' },
];

function rules(summary: unknown) {
  return [
    get('/api/portal/notifications/summary', summary),
    get('/api/portal/suppliers', suppliers),
  ];
}

describe('выбор поставщика', () => {
  it('называет число непрочитанного у каждого поставщика', async () => {
    stubFetch(rules([
      { supplierId: 'supplier-1', unread: 2 },
      { supplierId: 'supplier-2', unread: 5 },
    ]));

    renderScreen(<SupplierPicker />, { supplierId: 'supplier-1' });

    const rows = await screen.findAllByTestId('supplier-row');
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[1]).toHaveTextContent('5');
  });

  // Пустая пилюля читается как неполадка, а не как «новостей нет».
  it('ноль не рисует вовсе', async () => {
    stubFetch(rules([
      { supplierId: 'supplier-1', unread: 0 },
      { supplierId: 'supplier-2', unread: 3 },
    ]));

    renderScreen(<SupplierPicker />, { supplierId: 'supplier-1' });

    expect(await screen.findByLabelText('Непрочитанных: 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Непрочитанных: 0')).not.toBeInTheDocument();
  });

  // Сюда принудительно попадает тот, у кого доступ отозвали: счётчики работают без выбора.
  it('работает без выбранного поставщика', async () => {
    stubFetch(rules([{ supplierId: 'supplier-2', unread: 1 }]));

    renderScreen(<SupplierPicker />, { supplierId: null });

    expect(await screen.findByLabelText('Непрочитанных: 1')).toBeInTheDocument();
  });
});
