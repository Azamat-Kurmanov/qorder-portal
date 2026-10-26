import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferralCard } from './ReferralCard';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

describe('карточка «позовите остальных поставщиков»', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubFetch([get('/api/portal/me', { customerName: 'Кафе' }), get('/api/portal/referrals', [])]);
  });

  it('показывается у подтверждённой заявки', () => {
    renderScreen(<ReferralCard confirmed />);

    expect(screen.getByText(/Позовите сюда остальных/)).toBeInTheDocument();
  });

  it('у неподтверждённой заявки её нет', () => {
    renderScreen(<ReferralCard confirmed={false} />);

    expect(screen.queryByText(/Позовите сюда остальных/)).toBeNull();
  });

  it('закрытая больше не показывается', async () => {
    const first = renderScreen(<ReferralCard confirmed />);
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByText(/Позовите сюда остальных/)).toBeNull();
    first.unmount();

    renderScreen(<ReferralCard confirmed />);

    expect(screen.queryByText(/Позовите сюда остальных/)).toBeNull();
  });
});
