import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../i18n';
import { MapPointField } from './MapPointField';
import { MapPickerDialog } from './MapPickerDialog';
import { MapViewButton } from './MapViewButton';
import { pointOf } from './mapProvider';

const shown: unknown[] = [];
vi.mock('./mapProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mapProvider')>();
  return {
    ...actual,
    mapProvider: {
      mount: () => Promise.resolve({ show: (...args: unknown[]) => shown.push(args), onPick: () => {}, resize: () => {}, destroy: () => {} }),
      thumbnail: () => [{ src: 'https://tile.test/1.png', left: 0, top: 0, size: 256 }],
    },
  };
});

vi.mock('./useMapHome', () => ({ useMapHome: () => null }));

const searchMapPlaces = vi.fn();
vi.mock('../../api/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/generated')>()),
  searchPortalMapPlaces: (...args: unknown[]) => searchMapPlaces(...args),
  reversePortalMapPlace: () => Promise.resolve({ status: 204 }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('ru');
  shown.length = 0;
  searchMapPlaces.mockReset();
});

describe('точка адреса на карте', () => {
  it('точка — только из пары координат', () => {
    expect(pointOf(43.2, 76.9)).toEqual({ latitude: 43.2, longitude: 76.9 });
    expect(pointOf(43.2, undefined)).toBeNull();
  });

  it('без точки — кнопка, с точкой — «указана» и «Убрать», без перехода на чужой сайт', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<MapPointField point={null} title="Склад" address="" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Указать на карте/ })).toBeInTheDocument();

    rerender(<MapPointField point={{ latitude: 51.1, longitude: 71.4 }} title="Склад" address="" onChange={onChange} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('map-point-set')).toHaveTextContent('Точка на карте указана');
    await userEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('несколько найденных адресов — понятный список, выбор ставит метку с названием и адресом', async () => {
    searchMapPlaces.mockResolvedValue({ status: 200, data: [
      { label: 'улица Акан Серы, 40/2, Астана', latitude: 51.184219, longitude: 71.376597 },
      { label: 'улица Акан Серы, 40/6, Астана', latitude: 51.184489, longitude: 71.375952 },
    ] });
    const onPick = vi.fn();
    render(<MapPickerDialog title="Пивная держава" address="" initial={null} onClose={vi.fn()} onPick={onPick} />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Адрес или место' }), 'Акан Серы 40');
    await userEvent.click(screen.getByRole('button', { name: 'Найти' }));
    expect(await screen.findByText('Нашли 2 адреса — нажмите на нужный')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /улица Акан Серы, 40\/6, Астана/ }));

    expect(shown.at(-1)).toEqual([{ latitude: 51.184489, longitude: 71.375952 },
      { title: 'Пивная держава', address: 'улица Акан Серы, 40/6, Астана' }]);
    expect(screen.getByTestId('map-picker-coordinates')).toHaveTextContent('Широта, долгота: 51.184489, 71.375952');
    await userEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(onPick).toHaveBeenCalledWith({ latitude: 51.184489, longitude: 71.375952 }, 'улица Акан Серы, 40/6, Астана');
  });

  it('введённый адрес при открытии сразу показан на карте', async () => {
    searchMapPlaces.mockResolvedValue({ status: 200, data: [
      { label: 'улица Акан Серы, 40/2, Астана', latitude: 51.184219, longitude: 71.376597 },
    ] });
    render(<MapPickerDialog title="Пивная держава" address="Акан Серы 40/2" initial={null} onClose={vi.fn()} onPick={vi.fn()} />);

    expect(await screen.findByTestId('map-picker-coordinates')).toHaveTextContent('51.184219, 71.376597');
    expect(shown.at(-1)).toEqual([{ latitude: 51.184219, longitude: 71.376597 },
      { title: 'Пивная держава', address: 'улица Акан Серы, 40/2, Астана' }]);
  });

  it('«На карте» у сохранённого адреса без точки — находит по тексту и предупреждает о неточности', async () => {
    searchMapPlaces.mockResolvedValue({ status: 200, data: [
      { label: 'улица Тумар, 17, Алматы', latitude: 43.27, longitude: 76.86 },
    ] });
    render(<MapViewButton title="Адрес доставки" address="Тумар 17, Алматы" />);

    expect(screen.getByTestId('map-thumbnail')).toHaveTextContent('Найти на карте');
    await userEvent.click(screen.getByRole('button', { name: 'Адрес доставки — открыть карту' }));

    expect(await screen.findByText('Точка найдена по тексту адреса и может быть неточной')).toBeInTheDocument();
    expect(shown.at(-1)).toEqual([{ latitude: 43.27, longitude: 76.86 }, { title: 'Адрес доставки', address: 'Тумар 17, Алматы' }]);
    expect(screen.queryByRole('button', { name: 'Готово' })).toBeNull();
  });

  it('окно карты разворачивается на весь экран и возвращается', async () => {
    render(<MapPickerDialog title="Склад" address="" initial={null} onClose={vi.fn()} onPick={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Развернуть на весь экран' }));
    expect(screen.getByTestId('map-picker-map').className).toContain('flex-1');
    await userEvent.click(screen.getByRole('button', { name: 'Вернуть прежний размер' }));
    expect(screen.getByTestId('map-picker-map').className).toContain('h-[420px]');
  });
});
