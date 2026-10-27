import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderStatement } from './OrderStatement';
import { renderScreen } from '../../test/render';
import { file, stubFetch } from '../../test/http';

describe('выписка по заказам', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('за выбранный период скачивает PDF под именем сервера и честно говорит, что это не акт сверки', async () => {
    const saved: string[] = [];
    URL.createObjectURL = vi.fn(() => 'blob:statement');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    const { calls } = stubFetch([file('/api/portal/statement.pdf', '%PDF-1.4', 'statement-2026-10-01-2026-10-27.pdf')]);

    renderScreen(<OrderStatement />);
    await userEvent.click(screen.getByRole('button', { name: 'Выписка по заказам' }));
    expect(screen.getByText(/Это не акт сверки/)).toBeInTheDocument();

    const from = screen.getByLabelText('С');
    await userEvent.clear(from);
    await userEvent.type(from, '2026-10-01');
    const to = screen.getByLabelText('По');
    await userEvent.clear(to);
    await userEvent.type(to, '2026-10-27');
    await userEvent.click(screen.getByRole('button', { name: 'Скачать PDF' }));

    await waitFor(() => expect(saved).toEqual(['statement-2026-10-01-2026-10-27.pdf']));
    expect(calls[0].url).toContain('from=2026-10-01');
    expect(calls[0].url).toContain('to=2026-10-27');
  });
});
