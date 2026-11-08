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

  it('«слишком часто» (429) — не мёртвая ссылка: повтор, а не «попросите новую»', async () => {
    stubFetch([get('/api/portal/join-shop/abc', { code: 'TOO_MANY_REQUESTS' }, 429)]);
    open();

    expect(await screen.findByRole('heading', { name: 'Не удалось открыть страницу' })).toBeInTheDocument();
    expect(screen.getByText('Слишком много попыток. Подождите минуту и попробуйте снова.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать ещё раз' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ссылка не работает' })).not.toBeInTheDocument();
  });

  it('502 от прокси HTML-страницей — «сервер не отвечает», а не «проверьте интернет»', async () => {
    stubFetch([{ ...get('/api/portal/join-shop/abc', '<html>Bad Gateway</html>', 502), headers: { 'content-type': 'text/html' } }]);
    open();

    expect(await screen.findByText('Сервер временно не отвечает. Попробуйте чуть позже.')).toBeInTheDocument();
  });

  it('403 — не «сервер не отвечает»: сервер ответил отказом', async () => {
    stubFetch([get('/api/portal/join-shop/abc', { code: 'FORBIDDEN' }, 403)]);
    open();

    expect(await screen.findByText(/Не получилось открыть страницу\. Попробуйте позже/)).toBeInTheDocument();
    expect(screen.queryByText(/Сервер временно не отвечает/)).not.toBeInTheDocument();
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
    // Номер не спрашивается: им станет номер, с которого придёт код.
    expect(screen.queryByLabelText('Ваш номер WhatsApp')).toBeNull();
    await userEvent.type(screen.getByLabelText('Ваше имя'), 'Ержан');
    await userEvent.type(screen.getByLabelText('Город'), 'Астана');
    const send = screen.getByRole('button', { name: 'Отправить заявку' });
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(send);

    const post = calls.find((call) => call.init?.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      companyName: 'Ержан', city: 'Астана', consentVersion: '2026-10-14',
    });
    expect(await screen.findByRole('link', { name: 'Открыть WhatsApp' })).toHaveAttribute('href', phoneCode.waLink);
    expect(screen.getByText(/Отправьте сообщение «Код 123456».*станет вашим номером для входа/)).toBeInTheDocument();
    expect(localStorage.getItem('qo.portal.joinShop.abc')).toBe('t1');
  });

  it('погашенная кнопка объясняет причину', async () => {
    const { calls } = stubFetch([get('/api/portal/consent-notice', notice), shop]);
    open();

    expect(await screen.findByText('Ответьте, кто вы: компания или частное лицо')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Частное лицо' }));
    expect(screen.getByText('Отметьте согласие на обработку данных')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    // Имя и город пусты — заявка не уходит.
    expect(calls.some((call) => call.init?.method === 'POST')).toBe(false);
  });

  it('код с номером — подсказка, с какого WhatsApp слать', async () => {
    localStorage.setItem('qo.portal.joinShop.abc', 't1');
    localStorage.setItem('qo.portal.joinShop.abc.code', JSON.stringify({ ...phoneCode, fromPhone: '77012222222' }));
    stubFetch([get('/api/portal/consent-notice', notice), get('/api/portal/join-shop/abc/requests/t1', { status: 'UNVERIFIED' }), shop]);
    open();
    expect(await screen.findByText(/Отправьте сообщение «Код 123456».*с WhatsApp номера \+7 701 222 22 22/)).toBeInTheDocument();
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
    // Глазок: придумывая пароль, человек видит, что набирает.
    await userEvent.click(screen.getByRole('button', { name: 'Показать введённое' }));
    expect(screen.getByLabelText('Придумайте пароль')).toHaveAttribute('type', 'text');
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

    // Окно ограничено по высоте: содержимое прокручивается, а не сжимается — иначе кнопка «Отправить заявку»
    // (overflow: hidden под блик) схлопывалась до нулевой высоты. Раскладку jsdom не считает — проверяется правило.
    expect(within(dialog).getByRole('heading', { name: 'Заявка в магазин ИП Мухамедиева' }).closest('.qo-card')?.className)
      .toContain('[&>*]:shrink-0');
    // Телефон: окно сразу на весь экран; свернуть — к витрине, развернуть — обратно.
    const collapse = within(dialog).getByRole('button', { name: 'Свернуть' });
    expect(collapse).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(collapse);
    const expand = within(dialog).getByRole('button', { name: 'Развернуть на весь экран' });
    expect(expand).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(expand);
    expect(within(dialog).getByRole('button', { name: 'Свернуть' })).toHaveAttribute('aria-pressed', 'true');
  });

  describe('ссылка «Поделиться» (R-07)', () => {
    const shared = [
      get('/api/portal/join-shop/abc/items/i9', { id: 'i9', name: 'Платье Лето', sku: 'DR-01', sizes: ['42', '44'] }),
      get('/api/portal/consent-notice', notice),
      get('/api/portal/join-shop/abc/items', { page: 0, size: 24, totalElements: 0, items: [] }),
      get('/api/portal/join-shop/abc/categories', []),
      method('POST', '/api/portal/join-shop/abc/share/i/login', null, 204),
      get('/api/portal/join-shop/abc', { shopName: 'ИП Мухамедиева', showcase: true, supplierId: 's1' }),
    ];
    const openShared = (authenticated: boolean) => renderScreen(
      <Routes>
        <Route path="/join-shop/:code" element={<JoinShopPage />} />
        <Route path="/catalog/:itemId" element={<p>карточка со своей ценой</p>} />
      </Routes>,
      { route: '/join-shop/abc?item=i9', supplierId: null, auth: authenticated ? {} : { authenticated: false, token: null, phone: null } },
    );

    it('гость видит товар без цены и заявку; «Я клиент — войти» ведёт в карточку магазина', async () => {
      const { calls } = stubFetch(shared);
      openShared(false);

      expect(await screen.findByText('Платье Лето')).toBeInTheDocument();
      expect(screen.getByText('Арт. DR-01')).toBeInTheDocument();
      expect(screen.getByText('Размеры: 42, 44')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Отправить заявку' })).toBeInTheDocument();
      expect(calls.some((call) => call.url.includes('/share/'))).toBe(false);

      await userEvent.click(screen.getByRole('button', { name: 'Я клиент — войти' }));
      expect(await screen.findByText('карточка со своей ценой')).toBeInTheDocument();
      expect(calls.some((call) => call.init?.method === 'POST' && call.url.includes('/share/i/login'))).toBe(true);
    });

    it('уже вошедший уходит в карточку сам', async () => {
      stubFetch(shared);
      openShared(true);
      expect(await screen.findByText('карточка со своей ценой')).toBeInTheDocument();
    });
  });

  it('закрытая витрина — товаров нет и их не спрашивают', async () => {
    const { calls } = stubFetch([get('/api/portal/consent-notice', notice), shop]);
    open();

    expect(await screen.findByRole('button', { name: 'Отправить заявку' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Товары магазина' })).toBeNull();
    expect(calls.some((call) => call.url.includes('/items'))).toBe(false);
  });
});
