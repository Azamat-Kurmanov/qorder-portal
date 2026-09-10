import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ViewerBadge } from './ViewerBadge';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

/** Учётная запись клиента у поставщика — та же форма, что отдаёт `GET /api/portal/me`. */
const ACCOUNT = {
  id: 'a1',
  supplierId: 'supplier-1',
  customerId: 'c1',
  phone: '77010000001',
  status: 'ACTIVE',
  service: false,
  customerName: 'Асхат Каримов',
};

describe('сведения вошедшего в шапке кабинета', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('называет клиента по имени и повторяет номер, под которым он вошёл', async () => {
    stubFetch([get('/api/portal/me', ACCOUNT)]);

    renderScreen(<ViewerBadge active />);

    expect(await screen.findByText('Асхат Каримов')).toBeInTheDocument();
    // Номер записан так, как его читают вслух, а не так, как хранит сервер:
    // «77010000001» человек не узнаёт в своём собственном номере.
    expect(screen.getByText('+7 701 000 00 01')).toBeInTheDocument();
  });

  it('ставит на кружок инициалы имени, а не безликий значок', async () => {
    stubFetch([get('/api/portal/me', ACCOUNT)]);

    renderScreen(<ViewerBadge active />);

    expect(await screen.findByTestId('viewer-initials')).toHaveTextContent('АК');
  });

  /*
   * Имени у записи может не быть — поставщик его не заполнял, или это
   * служебный кабинет арендатора. Выдуманные инициалы были бы чужими буквами
   * на экране человека, поэтому вместо них остаётся прежний значок, а строкой
   * имени встаёт номер: он известен всегда.
   */
  it('без имени показывает номер и оставляет прежний значок', async () => {
    stubFetch([get('/api/portal/me', { ...ACCOUNT, customerName: undefined })]);

    renderScreen(<ViewerBadge active />);

    expect(await screen.findByRole('link', { name: 'Профиль' })).toBeInTheDocument();
    expect(screen.getByText('+7 701 000 00 01')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-initials')).not.toBeInTheDocument();
  });

  /*
   * Ссылка названа именем и номером, а не словом «Профиль»: подпись перекрыла
   * бы собой всё содержимое, и диктор промолчал бы о том, ради чего плашку
   * и заводили.
   */
  it('с именем ссылка читается именем, а не служебной подписью', async () => {
    stubFetch([get('/api/portal/me', ACCOUNT)]);

    renderScreen(<ViewerBadge active />);

    expect(await screen.findByRole('link', { name: /Асхат Каримов/ })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  /*
   * Запрос уходит с заголовком `X-Supplier-Id` и до подтверждения доступа
   * вернул бы отказ — тот же порядок, что у колокольчика.
   */
  it('не спрашивает учётную запись, пока доступ не подтверждён', () => {
    const { calls } = stubFetch([get('/api/portal/me', ACCOUNT)]);

    renderScreen(<ViewerBadge active={false} />);

    expect(calls).toHaveLength(0);
  });
});
