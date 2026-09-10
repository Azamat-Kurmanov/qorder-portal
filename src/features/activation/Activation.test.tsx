import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivationPage } from './ActivationPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';
import i18n from '../../i18n';

/** Уведомление читается до входа: без него кнопка не должна работать вовсе. */
const NOTICE = {
  version: '2026-09-05',
  language: 'ru',
  text: 'Уведомление об обработке персональных данных. Обрабатываем номер телефона…',
};

describe('активация приглашения', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  /**
   * Основной путь: приглашённого впервые никто не просит войти, потому что
   * входить ему нечем — пароля у него нет и взяться ему неоткуда. Он
   * придумывает пароль прямо здесь, и владение кодом из ссылки служит
   * единственным доказательством личности.
   */
  it('без входа спрашивает пароль и открывает кабинет', async () => {
    const { calls } = stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate', {
        id: 'account-1',
        supplierId: 'supplier-7',
        customerId: 'customer-1',
        phone: '77010000001',
        status: 'ACTIVE',
      }),
    ]);

    renderScreen(<ActivationPage />, {
      route: '/activate?code=abc123',
      auth: { authenticated: false, token: null },
    });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.type(screen.getByLabelText(/пароль/i), 'Строитель-2026!');
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    await waitFor(() => {
      const activation = calls.find((call) => call.init?.method === 'POST');
      expect(activation).toBeDefined();
      // Номера в теле нет и здесь: сервер знает его из самого приглашения,
      // а названный формой номер открывал бы переславшему ссылку чужой кабинет.
      expect(JSON.parse(String(activation?.init?.body))).toEqual({
        code: 'abc123',
        consentVersion: '2026-09-05',
        password: 'Строитель-2026!',
      });
    });
    expect(window.localStorage.getItem('qo.portal.supplier')).toBe('supplier-7');
  });

  /**
   * У кого пароль уже есть — а так бывает, когда пригласил и второй
   * поставщик, — тому приглашение пароля не меняет. Сервер отвечает тем же
   * отказом, что и на негодный код, и объяснить причину экран не вправе:
   * он предлагает вход как возможный выход, а не утверждает, что код верен.
   */
  it('на отказ без входа предлагает войти', async () => {
    const login = vi.fn();
    stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate',
        { code: 'INVITATION_INVALID', detail: 'Приглашение недействительно' }, 401),
    ]);

    renderScreen(<ActivationPage />, {
      route: '/activate?code=abc123',
      auth: { authenticated: false, token: null, login },
    });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.type(screen.getByLabelText(/пароль/i), 'Строитель-2026!');
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    await userEvent.click(await screen.findByRole('button', { name: /войти/i }));
    expect(login).toHaveBeenCalled();
  });

  /** Вошедшему пароль не нужен: он его уже задал, и второй никто не просит. */
  it('вошедшему поля пароля не показывает', async () => {
    stubFetch([get('/api/portal/consent-notice', NOTICE)]);

    renderScreen(<ActivationPage />, { route: '/activate?code=abc123' });

    await screen.findByRole('checkbox');
    expect(screen.queryByLabelText(/пароль/i)).not.toBeInTheDocument();
  });

  /**
   * Пустой пароль без входа — свой отказ, а не общий: человеку есть что
   * исправить, и одинаковый текст оставил бы его гадать.
   */
  it('пустой пароль называет причину', async () => {
    stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate',
        { code: 'PORTAL_PASSWORD_REQUIRED', detail: 'Придумайте пароль' }, 400),
    ]);

    renderScreen(<ActivationPage />, {
      route: '/activate?code=abc123',
      auth: { authenticated: false, token: null },
    });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.type(screen.getByLabelText(/пароль/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/пароль/i);
  });

  /** Отказ по частоте — не «код негоден»: повторять надо позже, а не искать новый. */
  it('слишком частые попытки называет частотой', async () => {
    stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate',
        { code: 'PORTAL_TOO_MANY_ATTEMPTS', detail: 'Слишком много попыток' }, 429),
    ]);

    renderScreen(<ActivationPage />, {
      route: '/activate?code=abc123',
      auth: { authenticated: false, token: null },
    });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.type(screen.getByLabelText(/пароль/i), 'Строитель-2026!');
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/попыт/i);
  });

  /** Наша авария — не вина человека: ссылка жива, повторить стоит. */
  it('недоступность сервиса не выдаёт за негодный код', async () => {
    stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate',
        { code: 'PORTAL_REALM_UNAVAILABLE', detail: 'Сервис недоступен' }, 503),
    ]);

    renderScreen(<ActivationPage />, {
      route: '/activate?code=abc123',
      auth: { authenticated: false, token: null },
    });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.type(screen.getByLabelText(/пароль/i), 'Строитель-2026!');
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/позже|недоступ/i);
  });

  it('после входа отправляет код, согласие и запоминает поставщика', async () => {
    const { calls } = stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate', {
        id: 'account-1',
        supplierId: 'supplier-7',
        customerId: 'customer-1',
        phone: '77010000001',
        status: 'ACTIVE',
      }),
    ]);

    renderScreen(<ActivationPage />, { route: '/activate?code=abc123' });

    // Номер не спрашивают: человек вошёл под ним. Показывают его затем, чтобы
    // вошедший не тем сразу это увидел, а не гадал над одинаковым отказом.
    expect(await screen.findByText(/7 701 000-00-01/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/телефон/i)).not.toBeInTheDocument();

    // Пока уведомление не принято, кабинет не открывается: обработка началась
    // бы раньше, чем человека о ней уведомили.
    expect(screen.getByRole('button', { name: /открыть кабинет/i })).toBeDisabled();

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    await waitFor(() => {
      const activation = calls.find((call) => call.init?.method === 'POST');
      expect(activation).toBeDefined();
      // Номера в теле нет: сервер читает его из токена сам, и названный
      // формой номер открывал бы переславшему ссылку чужую историю заказов.
      expect(JSON.parse(String(activation?.init?.body))).toEqual({
        code: 'abc123',
        // Редакция уходит та, которую человеку показали: через год отвечать
        // придётся за неё, а не за сегодняшний текст.
        consentVersion: '2026-09-05',
      });
    });
    // Поставщик из ответа: с этого момента кабинету есть что ставить в заголовок.
    expect(window.localStorage.getItem('qo.portal.supplier')).toBe('supplier-7');
  });

  it('отказ не объясняет причину', async () => {
    stubFetch([
      get('/api/portal/consent-notice', NOTICE),
      method('POST', '/api/portal/invitation/activate',
        { code: 'INVITATION_INVALID', detail: 'Приглашение недействительно' }, 401),
    ]);

    renderScreen(<ActivationPage />, { route: '/activate?code=expired' });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /открыть кабинет/i }));

    // Текст один на все причины: иначе форма подсказывает, кто чей поставщик.
    expect(await screen.findByRole('alert')).toHaveTextContent(/приглашение недействительно/i);
    expect(screen.queryByText(/истек|использован|не найден/i)).not.toBeInTheDocument();
  });

  it('ссылка без кода объясняет, что она неполная', () => {
    stubFetch([]);
    renderScreen(<ActivationPage />, { route: '/activate' });

    expect(screen.getByText(/ссылка неполная/i)).toBeInTheDocument();
  });

  /**
   * Единственный экран, открытый без входа, — и единственный, где человек
   * читает уведомление об обработке данных и соглашается с ним. Согласие
   * с русским текстом не является согласием с казахским, поэтому язык
   * обязан переключаться здесь же, а не только внутри кабинета.
   */
  it('язык переключается прямо на странице приглашения', async () => {
    stubFetch([get('/api/portal/consent-notice', NOTICE)]);

    renderScreen(<ActivationPage />, { route: '/activate?code=abc123' });

    expect(await screen.findByRole('button', { name: /Язык интерфейса/ }))
      .toBeInTheDocument();
  });

  it('смена языка перечитывает уведомление о согласии', async () => {
    const { calls } = stubFetch([get('/api/portal/consent-notice', NOTICE)]);

    renderScreen(<ActivationPage />, { route: '/activate?code=abc123' });

    await screen.findByRole('button', { name: /Язык интерфейса/ });
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/consent-notice'))).toBe(true);
    });
    const before = calls.filter((call) => call.url.includes('/consent-notice')).length;

    await userEvent.click(screen.getByRole('button', { name: /Язык интерфейса/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ҚАЗ' }));

    // Уведомление приходит на языке заголовка, и вместе с согласием на сервер
    // уходит редакция документа: показать казахский экран с русским текстом
    // значит записать согласие с текстом, которого человек не читал.
    await waitFor(() => {
      expect(calls.filter((call) => call.url.includes('/consent-notice')).length)
        .toBeGreaterThan(before);
    });

    await i18n.changeLanguage('ru');
  });
});