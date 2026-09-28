import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShopsDialog } from './Shops';
import { InvitesCard } from './Invitations';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const OWN = { supplierId: 'supplier-1', name: 'СтройБаза Алматы' };
const INVITE = {
  invitationId: 'inv-1',
  expiresAt: '2026-10-01T00:00:00Z',
  supplier: { supplierId: 'supplier-2', name: 'ТОО «Береке»', tagline: 'Продукты оптом' },
};

function rules(extra: ReturnType<typeof method>[] = []) {
  return [
    ...extra,
    get('/api/portal/pending-invitations', [INVITE]),
    get('/api/portal/consent-notice', { version: '2026-09-10', language: 'ru', text: '# Уведомление\n\nТекст.' }),
    get('/api/portal/suppliers', [OWN]),
    get('/api/portal/notifications/summary', []),
  ];
}

/**
 * Приглашения других магазинов: видны в «Моих магазинах», принимаются
 * с согласием на обработку данных и отклоняются, не выходя из кабинета.
 */
describe('приглашения магазинов', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Приглашения в колонке — в карточке «Вы сейчас в», а не в блоке
  // «Мои магазины» под ней: дважды подряд одно и то же не показывается.
  it('колонка называет, кто пригласил', async () => {
    stubFetch(rules());
    renderScreen(<InvitesCard onOpen={() => {}} />);

    expect(await screen.findByText('1 новое приглашение')).toBeInTheDocument();
    expect(screen.getByText('ТОО «Береке»')).toBeInTheDocument();
  });

  it('«Принять» шлёт редакцию уведомления и открывает магазин', async () => {
    const onSwitch = vi.fn();
    const { calls } = stubFetch(rules([
      method('POST', '/api/portal/pending-invitations/accept', { id: 'acc-2', status: 'ACTIVE' }),
    ]));
    renderScreen(<ShopsDialog open onOpenChange={() => {}} onSwitch={onSwitch} />);

    const row = await screen.findByTestId('invite-row');
    const accept = within(row).getByRole('button', { name: 'Принять приглашение ТОО «Береке»' });
    await waitFor(() => expect(accept).toBeEnabled());
    await userEvent.click(accept);

    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith('supplier-2'));
    const post = calls.find((call) => call.url.includes('/pending-invitations/accept'));
    expect(JSON.parse(String(post?.init?.body))).toEqual({ invitationId: 'inv-1', consentVersion: '2026-09-10' });
  });

  it('«Отклонить» гасит приглашение', async () => {
    const { calls } = stubFetch([
      {
        match: (url, init) => url.includes('/pending-invitations/decline') && init?.method === 'POST',
        status: 204,
      },
      ...rules(),
    ]);
    renderScreen(<ShopsDialog open onOpenChange={() => {}} onSwitch={() => {}} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Отклонить приглашение ТОО «Береке»' }));

    await waitFor(() => expect(calls.some((call) => call.url.includes('/pending-invitations/decline'))).toBe(true));
    expect(await screen.findByText('Приглашение ТОО «Береке» отклонено')).toBeInTheDocument();
  });
});
