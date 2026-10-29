import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { JoinShopPage } from './JoinShopPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const notice = { version: '2026-10-14', language: 'ru', text: '# Согласие\n\nТекст.' };
const shop = get('/api/portal/join-shop/abc', { shopName: 'ИП Мухамедиева' });
const later = new Date(Date.now() + 10 * 60_000).toISOString();
const phoneCode = { code: '123456', waLink: 'https://wa.me/77010000000?text=%D0%9A%D0%BE%D0%B4%20123456', expiresAt: later };

function open() {
  return renderScreen(
    <Routes><Route path="/join-shop/:code" element={<JoinShopPage />} /></Routes>,
    { route: '/join-shop/abc', supplierId: null, auth: { authenticated: false, token: null, phone: null } },
  );
}

describe('заявка в магазин по ссылке', () => {
  beforeEach(() => { localStorage.removeItem('qo.portal.joinShop.abc'); localStorage.removeItem('qo.portal.joinShop.abc.code'); });
  afterEach(() => vi.unstubAllGlobals());

  it('перевыпущенная ссылка — понятный тупик, а не пустая форма', async () => {
    stubFetch([get('/api/portal/join-shop/abc', { code: 'SHOP_LINK_NOT_FOUND' }, 404)]);
    open();

    expect(await screen.findByRole('heading', { name: 'Ссылка не работает' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отправить заявку' })).not.toBeInTheDocument();
  });

  it('заявка: без согласия не уходит; после — шаг «откройте WhatsApp» с готовым кодом', async () => {
    const { calls } = stubFetch([
      get('/api/portal/consent-notice', notice),
      method('POST', '/api/portal/join-shop/abc/requests', { token: 't1', status: 'UNVERIFIED', phoneCode }, 201),
      get('/api/portal/join-shop/abc/requests/t1', { status: 'UNVERIFIED' }),
      shop,
    ]);
    open();

    expect(await screen.findByRole('heading', { name: 'Заявка в магазин ИП Мухамедиева' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Частное лицо' }));
    expect(screen.queryByLabelText(/БИН/)).toBeNull();
    await userEvent.type(screen.getByLabelText('Ваш номер WhatsApp'), '+7 701 000 00 12');
    await userEvent.type(screen.getByLabelText('Ваше имя'), 'Ержан');
    await userEvent.type(screen.getByLabelText('Город'), 'Астана');
    const send = screen.getByRole('button', { name: 'Отправить заявку' });
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(send);

    const post = calls.find((call) => call.init?.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      phone: '+77010000012', companyName: 'Ержан', city: 'Астана', consentVersion: '2026-10-14',
    });
    expect(await screen.findByRole('link', { name: 'Открыть WhatsApp' })).toHaveAttribute('href', phoneCode.waLink);
    expect(screen.getByText(/Отправьте сообщение «Код 123456»/)).toBeInTheDocument();
    expect(localStorage.getItem('qo.portal.joinShop.abc')).toBe('t1');
  });

  it('компания или ИП: без БИН/ИИН заявка не уходит, с ним — уходит вместе с БИН', async () => {
    const { calls } = stubFetch([
      get('/api/portal/consent-notice', notice),
      method('POST', '/api/portal/join-shop/abc/requests', { token: 't1', status: 'UNVERIFIED', phoneCode }, 201),
      get('/api/portal/join-shop/abc/requests/t1', { status: 'UNVERIFIED' }),
      shop,
    ]);
    open();

    await userEvent.click(await screen.findByRole('radio', { name: 'Компания или ИП' }));
    await userEvent.type(screen.getByLabelText('Ваш номер WhatsApp'), '+77010000012');
    await userEvent.type(screen.getByLabelText('Название компании или ИП'), 'ТОО Ромашка');
    await userEvent.type(screen.getByLabelText('Город'), 'Астана');
    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(calls.some((call) => call.init?.method === 'POST')).toBe(false);

    await userEvent.type(screen.getByLabelText('БИН или ИИН ИП'), '123456789013');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    const post = calls.find((call) => call.init?.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({ companyName: 'ТОО Ромашка', bin: '123456789013' });
  });

  it('вернулся из WhatsApp и вкладка перезагрузилась — код на месте, новый не нужен', async () => {
    localStorage.setItem('qo.portal.joinShop.abc', 't1');
    localStorage.setItem('qo.portal.joinShop.abc.code', JSON.stringify(phoneCode));
    stubFetch([get('/api/portal/join-shop/abc/requests/t1', { status: 'UNVERIFIED' }), shop]);
    open();

    expect(await screen.findByRole('link', { name: 'Открыть WhatsApp' })).toHaveAttribute('href', phoneCode.waLink);
  });

  it('вернулся по ссылке, заявка у магазина — «отправлена», формы нет', async () => {
    localStorage.setItem('qo.portal.joinShop.abc', 't1');
    stubFetch([get('/api/portal/join-shop/abc/requests/t1', { status: 'PENDING' }), shop]);
    open();

    expect(await screen.findByRole('heading', { name: 'Заявка отправлена' })).toBeInTheDocument();
  });

  it('отказ — с причиной магазина', async () => {
    localStorage.setItem('qo.portal.joinShop.abc', 't1');
    stubFetch([get('/api/portal/join-shop/abc/requests/t1', { status: 'DECLINED', reason: 'Работаем только с юрлицами' }), shop]);
    open();

    expect(await screen.findByText('Работаем только с юрлицами')).toBeInTheDocument();
  });

  it('одобрено — задаёт пароль, затем предлагает войти', async () => {
    localStorage.setItem('qo.portal.joinShop.abc', 't1');
    const { calls } = stubFetch([
      get('/api/portal/join-shop/abc/requests/t1', { status: 'APPROVED', passwordNeeded: true }),
      method('POST', '/api/portal/join-shop/abc/requests/t1/password', null, 204),
      shop,
    ]);
    open();

    await userEvent.type(await screen.findByLabelText('Придумайте пароль'), 'Secret2026!');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(calls.some((call) => call.url.includes('/password') && call.init?.method === 'POST')).toBe(true);
    expect(await screen.findByRole('button', { name: 'Войти в кабинет' })).toBeInTheDocument();
  });

  it('заявки по сохранённому токену нет — предлагает отправить заново', async () => {
    localStorage.setItem('qo.portal.joinShop.abc', 'old');
    stubFetch([get('/api/portal/join-shop/abc/requests/old', { code: 'ACCESS_REQUEST_NOT_FOUND' }, 404), get('/api/portal/consent-notice', notice), shop]);
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Отправить заявку заново' }));
    expect(await screen.findByRole('heading', { name: 'Заявка в магазин ИП Мухамедиева' })).toBeInTheDocument();
    expect(localStorage.getItem('qo.portal.joinShop.abc')).toBeNull();
  });

  it('открытая витрина: товары без цен фоном, заявка окном поверх, и его не закрыть', async () => {
    stubFetch([
      get('/api/portal/consent-notice', notice),
      get('/api/portal/join-shop/abc/items', { page: 0, size: 24, totalElements: 1, items: [
        { id: 'i1', name: 'Цемент М400', unit: 'мешок', imageUrl: 'https://cdn.example.kz/c.jpg' },
      ] }),
      get('/api/portal/join-shop/abc/categories', [{ id: 'c1', name: 'Сухие смеси', path: 'c1', sortOrder: 1 }]),
      get('/api/portal/join-shop/abc', { shopName: 'ИП Мухамедиева', showcase: true }),
    ]);
    open();

    const dialog = await screen.findByRole('dialog');
    expect(await screen.findByRole('heading', { name: 'Заявка в магазин ИП Мухамедиева' })).toBeInTheDocument();
    const showcase = await screen.findByRole('region', { name: 'Товары магазина', hidden: true });
    expect(await screen.findByText('Цемент М400')).toBeInTheDocument();
    expect(showcase).toHaveTextContent('Цены и наличие откроются в кабинете');
    expect(showcase).not.toHaveTextContent('₸');

    await userEvent.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Развернуть на весь экран' }));
    const collapse = within(dialog).getByRole('button', { name: 'Свернуть' });
    expect(collapse).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(collapse);
    expect(within(dialog).getByRole('button', { name: 'Развернуть на весь экран' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('закрытая витрина — товаров нет и их не спрашивают', async () => {
    const { calls } = stubFetch([get('/api/portal/consent-notice', notice), shop]);
    open();

    expect(await screen.findByRole('button', { name: 'Отправить заявку' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Товары магазина' })).toBeNull();
    expect(calls.some((call) => call.url.includes('/items'))).toBe(false);
  });
});
