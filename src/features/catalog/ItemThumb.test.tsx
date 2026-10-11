import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UNSAFE_ViewTransitionContext } from 'react-router-dom';
import { ItemThumb } from './ItemThumb';

const FILE = '/api/files/3f1e2d4c-0000-4000-8000-000000000001';
const SECOND = '/api/files/3f1e2d4c-0000-4000-8000-000000000002';

describe('миниатюра товара', () => {
  it('файл хранилища — копия ширины слота, вдвое — для чёткого экрана; под ней размытое превью', () => {
    const { container } = render(<ItemThumb itemId="i1" src={FILE} />);
    const main = container.querySelector('img[data-photo]') as HTMLImageElement;
    expect(main.getAttribute('src')).toBe(`${FILE}?w=480`);
    expect(main.getAttribute('srcset')).toBe(`${FILE}?w=480 1x, ${FILE}?w=960 2x`);
    expect(container.querySelector('img[data-preview]')!.getAttribute('src')).toBe(`${FILE}?w=32`);
  });

  it('ширина слота задаётся местом: строке хватает 160', () => {
    const { container } = render(<ItemThumb itemId="i1" src={FILE} width={160} />);
    expect(container.querySelector('img[data-photo]')!.getAttribute('src')).toBe(`${FILE}?w=160`);
  });

  it('чужой адрес — как есть, без превью', () => {
    const { container } = render(<ItemThumb itemId="i1" src="https://cdn.example.kz/a.jpg" />);
    expect(container.querySelector('img[data-photo]')!.getAttribute('src')).toBe('https://cdn.example.kz/a.jpg');
    expect(container.querySelector('img[data-preview]')).toBeNull();
  });

  it('второе фото грузится, только когда курсор пришёл на плитку', () => {
    const { container } = render(<div className="group/tile" data-testid="tile"><ItemThumb itemId="i1" src={FILE} second={SECOND} /></div>);
    expect(container.querySelector('img[data-second]')).toBeNull();
    fireEvent.pointerEnter(container.firstChild as HTMLElement, { pointerType: 'mouse' });
    expect(container.querySelector('img[data-second]')!.getAttribute('src')).toBe(`${SECOND}?w=480`);
  });

  it('фото плитки перелетает в карточку только на время своего перехода — туда и обратно', () => {
    const during = (from: string, to: string) => ({
      isTransitioning: true, flushSync: false,
      currentLocation: { pathname: from, search: '', hash: '', state: null, key: 'a' },
      nextLocation: { pathname: to, search: '', hash: '', state: null, key: 'b' },
    });
    const name = (value: Parameters<typeof UNSAFE_ViewTransitionContext.Provider>[0]['value']) => {
      const { container, unmount } = render(
        <UNSAFE_ViewTransitionContext.Provider value={value}><ItemThumb itemId="i1" src={FILE} flight /></UNSAFE_ViewTransitionContext.Provider>,
      );
      const shown = (container.querySelector('img[data-photo]') as HTMLElement).style.viewTransitionName;
      unmount();
      return shown;
    };
    expect(name(during('/catalog', '/catalog/i1'))).toBe('qo-item-photo');
    expect(name(during('/catalog/i1', '/catalog'))).toBe('qo-item-photo');
    expect(name(during('/catalog', '/catalog/i2'))).toBe('');
    expect(name({ isTransitioning: false })).toBe('');
  });

  it('курсор или палец на плитке — карточка товара грузится заранее: фото успевает долететь', () => {
    const client = new QueryClient();
    const prefetch = vi.spyOn(client, 'prefetchQuery').mockResolvedValue();
    const { container } = render(
      <QueryClientProvider client={client}>
        <div className="group/tile"><ItemThumb itemId="i1" src={FILE} flight /></div>
      </QueryClientProvider>,
    );
    fireEvent.pointerEnter(container.firstChild as HTMLElement);
    fireEvent.pointerEnter(container.firstChild as HTMLElement);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch.mock.calls[0][0].queryKey).toEqual(['/api/portal/catalog/i1']);
  });
});
