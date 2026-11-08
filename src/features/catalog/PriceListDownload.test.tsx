import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';

const download = vi.fn();
const saveFile = vi.fn(() => Promise.resolve());
vi.mock('../../api/generated', () => ({ downloadPortalPriceList: (...a: unknown[]) => download(...a) }));
vi.mock('../../shared/download', () => ({
  saveFile: (...a: unknown[]) => saveFile(...(a as [])),
  fileNameFrom: (_headers: Headers, fallback: string) => fallback,
}));

const { PriceListDownload } = await import('./PriceListDownload');

beforeEach(async () => {
  await i18n.changeLanguage('ru');
  download.mockReset();
  saveFile.mockClear();
});

describe('прайс-лист файлом', () => {
  it('Excel открытого раздела — файлом, PDF — тем же разделом', async () => {
    download.mockResolvedValue({ status: 200, data: new Blob(['x']), headers: new Headers() });
    render(<PriceListDownload categoryId="cat-1" note="Рядом с ценой написано, за что она" />);

    // Выпадающим меню: пояснение и две ссылки со значками (просьба владельца 2026-11-05).
    await userEvent.click(screen.getByRole('button', { name: /Прайс-лист/ }));
    expect(screen.getByRole('menu')).toHaveTextContent('Рядом с ценой написано, за что она');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Скачать Excel' }));
    expect(download).toHaveBeenCalledWith({ categoryId: 'cat-1', format: 'xlsx' });
    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), 'price.xlsx');
    await userEvent.click(screen.getByRole('button', { name: /Прайс-лист/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Скачать PDF' }));
    expect(download).toHaveBeenLastCalledWith({ categoryId: 'cat-1', format: 'pdf' });
  });

  it('отказ сервера — сообщение, файла нет', async () => {
    download.mockResolvedValue({ status: 403, data: {}, headers: new Headers() });
    render(<PriceListDownload />);

    await userEvent.click(screen.getByRole('button', { name: /Прайс-лист/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Скачать PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось скачать прайс');
    expect(saveFile).not.toHaveBeenCalled();
  });
});
