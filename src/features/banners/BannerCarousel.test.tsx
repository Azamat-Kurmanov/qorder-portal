import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { CatalogPage } from '../catalog/CatalogPage';
import { BannerSlide } from './BannerSlide';
import { bannersFor } from './BannerCarousel';
import type { ShowcaseBannerDto } from '../../api/generated';
import { renderScreen } from '../../test/render';
import { get, stubFetch } from '../../test/http';

const SALE = {
  id: 's1', visible: true, template: 'SALE', scheme: 'GRAPHITE', badge: 'До 30 сентября',
  title: 'Осенняя распродажа', text: 'Пуховики и тренчи', buttonText: 'Смотреть товары', discount: '−20%',
  target: 'ITEM', targetItemId: 'item-1', imageItemId: 'item-1', imageSrc: 'https://cdn.example.kz/trench.jpg',
};

const BULK = {
  id: 's2', visible: true, template: 'BULK', scheme: 'BRAND', badge: 'Оптом дешевле',
  title: 'Берите больше', buttonText: 'Как это работает', discount: '−5%', discountNote: 'от 400 000 ₸',
  target: 'CATALOG',
};

function rules(banners: unknown[], dealCount = 3) {
  return [
    get('/api/portal/banners', banners),
    get('/api/portal/promotions', { volumeTiers: [], deals: [], dealCount }),
    get('/api/portal/suppliers', [{ supplierId: 'supplier-1', name: 'Мухамедиева', brandColor: '#1F5C57' }]),
    get('/api/portal/categories', []),
    get('/api/portal/catalog', { page: 0, size: 50, totalElements: 0, items: [] }),
    get('/api/portal/cart', { lines: [], total: 0, skipped: [] }),
  ];
}

function renderCatalog() {
  return renderScreen(
    <Routes>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/catalog/:itemId" element={<h1>Карточка позиции</h1>} />
      <Route path="/promotions" element={<h1>Акции</h1>} />
    </Routes>,
  );
}

describe('баннеры на витрине', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('показывает слайды магазина по одному, с точками и паузой', async () => {
    stubFetch(rules([SALE, BULK]));
    renderCatalog();

    const carousel = await screen.findByRole('region', { name: 'Акции магазина' });
    const first = within(carousel).getByRole('group', { name: '1 из 2: Осенняя распродажа' });
    expect(first).toHaveAttribute('aria-hidden', 'false');
    expect(within(first).getByText('−20%')).toBeInTheDocument();
    // Скрытый слайд убран из дерева доступности — ищется разметкой.
    expect(carousel.querySelector('[aria-label="2 из 2: Берите больше"]')).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(within(carousel).getByRole('button', { name: 'Слайд 2' }));
    expect(within(carousel).getByRole('button', { name: 'Слайд 2' })).toHaveAttribute('aria-current', 'true');

    await userEvent.click(within(carousel).getByRole('button', { name: 'Остановить показ слайдов' }));
    expect(within(carousel).getByRole('button', { name: 'Включить показ слайдов' })).toBeInTheDocument();
  });

  it('кнопка слайда ведёт в карточку товара', async () => {
    stubFetch(rules([SALE]));
    renderCatalog();

    await userEvent.click(await screen.findByRole('button', { name: /Смотреть товары/ }));
    expect(await screen.findByRole('heading', { name: 'Карточка позиции' })).toBeInTheDocument();
  });

  /** Шаблоны сверх первых трёх рисуются общими раскладками — и кнопка у них настоящая. */
  it('слайд нового шаблона показывает дату окончания и ведёт по кнопке', async () => {
    stubFetch(rules([{
      id: 's3', visible: true, template: 'LAST_DAYS', scheme: 'NAVY', title: 'Успейте до конца акции',
      buttonText: 'К акции', discount: '−40%', showUntil: '2026-09-30', target: 'ITEM', targetItemId: 'item-1',
    }]));
    renderCatalog();

    const carousel = await screen.findByRole('region', { name: 'Акции магазина' });
    expect(within(carousel).getByText('30.09')).toBeInTheDocument();
    expect(within(carousel).getByText('−40%')).toBeInTheDocument();

    await userEvent.click(within(carousel).getByRole('button', { name: /К акции/ }));
    expect(await screen.findByRole('heading', { name: 'Карточка позиции' })).toBeInTheDocument();
  });

  it('без опубликованных слайдов карусели нет', async () => {
    stubFetch(rules([]));
    renderCatalog();

    // Витрина успела ответить — а карусель так и не появилась.
    await screen.findByText(/Ничего не нашли по запросу/);
    expect(screen.queryByRole('region', { name: 'Акции магазина' })).not.toBeInTheDocument();
  });

  /** Кнопки, что ведут не в товар и не в рубрику, а в отбор витрины или на экран акций. */
  const TO = (target: string) => ({
    id: `to-${target}`, visible: true, template: 'BULK', scheme: 'BRAND', title: `Слайд ${target}`,
    buttonText: 'Смотреть', target,
  });

  it('кнопка слайда «распродажа» включает отбор «Со скидкой»', async () => {
    const { calls } = stubFetch(rules([TO('SALE')]));
    renderCatalog();

    await userEvent.click(await screen.findByRole('button', { name: /Смотреть/ }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('/api/portal/catalog?') && call.url.includes('onSale=true'))).toBe(true));
  });

  it('слайд «распродажа» не показывается, когда распродажа не идёт', async () => {
    stubFetch(rules([TO('SALE'), TO('NOVELTY')], 0));
    renderCatalog();

    expect(await screen.findByText('Слайд NOVELTY')).toBeInTheDocument();
    expect(screen.queryByText('Слайд SALE')).not.toBeInTheDocument();
    // Остался один слайд — точек нет.
    expect(screen.queryByRole('button', { name: 'Слайд 2' })).not.toBeInTheDocument();
  });

  it('кнопка слайда «новинки» включает отбор новинок', async () => {
    const { calls } = stubFetch(rules([TO('NOVELTY')]));
    renderCatalog();

    await userEvent.click(await screen.findByRole('button', { name: /Смотреть/ }));
    await waitFor(() => expect(calls.some((call) => call.url.includes('/api/portal/catalog?') && call.url.includes('novelty=true'))).toBe(true));
  });

  it('кнопка слайда «акции» ведёт на экран акций', async () => {
    stubFetch(rules([TO('PROMOTIONS')]));
    renderCatalog();

    await userEvent.click(await screen.findByRole('button', { name: /Смотреть/ }));
    expect(await screen.findByRole('heading', { name: 'Акции' })).toBeInTheDocument();
  });

  it('на телефоне (компактный слайд) строки описания нет — как в макете', () => {
    renderScreen(<BannerSlide slide={SALE as ShowcaseBannerDto} brand="#1F5C57" compact hidden={false} onAction={() => {}} />);
    expect(screen.getByText('Осенняя распродажа')).toBeInTheDocument();
    expect(screen.queryByText('Пуховики и тренчи')).not.toBeInTheDocument();
  });

  /**
   * Тематические шаблоны (праздники, кэшбэк, розыгрыш) раньше у покупателя
   * не рисовались вовсе: слайд оставался пустым цветным прямоугольником.
   */
  it('тематический шаблон показывает заголовок, кнопку и свою иллюстрацию', () => {
    const cashback = { ...SALE, template: 'CASHBACK', title: 'Кэшбэк 5%', discount: '5%' } as ShowcaseBannerDto;
    const { container } = renderScreen(<BannerSlide slide={cashback} brand="#1F5C57" compact={false} hidden={false} onAction={() => {}} />);
    expect(screen.getByText('Кэшбэк 5%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Смотреть товары/ })).toBeInTheDocument();
    expect(container.querySelector('svg[viewBox="0 0 200 200"]')).not.toBeNull();
  });

  it('на телефоне длинная подпись кнопки укорочена по словам, читалке — полная', () => {
    renderScreen(<BannerSlide slide={{ ...SALE, buttonText: 'Смотреть товары со скидкой' } as ShowcaseBannerDto} brand="#1F5C57" compact hidden={false} onAction={() => {}} />);
    const button = screen.getByRole('button', { name: 'Смотреть товары со скидкой' });
    expect(button).toHaveTextContent(/^Смотреть товары$/);
  });

  it('на телефоне плашка над заголовком укорочена по словам', () => {
    renderScreen(<BannerSlide slide={{ ...SALE, badge: 'На все товары летнего сезона скидка' } as ShowcaseBannerDto} brand="#1F5C57" compact hidden={false} onAction={() => {}} />);
    expect(screen.getByText('На все товары')).toBeInTheDocument();
    expect(screen.queryByText('На все товары летнего сезона скидка')).not.toBeInTheDocument();
  });

  it('на мониторе описание слайда остаётся', () => {
    renderScreen(<BannerSlide slide={SALE as ShowcaseBannerDto} brand="#1F5C57" compact={false} hidden={false} onAction={() => {}} />);
    expect(screen.getByText('Пуховики и тренчи')).toBeInTheDocument();
  });
});

describe('баннеры в рубрике', () => {
  const slide = (id: string, targetCategoryId?: string) =>
    ({ ...SALE, id, target: targetCategoryId ? 'CATEGORY' : 'CATALOG', targetCategoryId }) as ShowcaseBannerDto;
  const all = [slide('general'), slide('coats', 'c-coats'), slide('clothes', 'c-clothes')];

  it('в рубрике — её баннеры и баннеры рубрик над ней', () => {
    expect(bannersFor(all, { id: 'c-coats', path: 'c-clothes/c-coats' }).map((one) => one.id)).toEqual(['coats', 'clothes']);
  });

  it('у рубрики без своих баннеров и вне рубрик — все', () => {
    expect(bannersFor(all, { id: 'c-shoes', path: 'c-shoes' })).toBe(all);
    expect(bannersFor(all, undefined)).toBe(all);
  });
});
