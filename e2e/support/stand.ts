import { expect, request, type APIRequestContext, type Browser, type Page } from '@playwright/test';

/**
 * Стенд для сценариев кабинета: арендатор, его сотрудник, каталог, доставка
 * и приглашённый клиент.
 *
 * Путь тот же, что в `frontend/front/e2e/visual-walk.spec.ts`: готовых учётных
 * записей арендатора нет, поэтому всё заводится платформой. Отличие одно —
 * заводится через API, а не кликами: этим сценариям нужны данные, а не
 * снимки экранов админки. Токены платформы и сотрудника берутся настоящим
 * входом через Keycloak в браузере — выдачи по паролю у этих клиентов нет.
 *
 * Нужно до запуска: бэкенд на 5000, admin на 5175, front на 5173, portal на 5174,
 * Keycloak с KC_DEV_USERS=true, пароль платформы в E2E_PLATFORM_PASSWORD.
 */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';
export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5175';
export const FRONT_URL = process.env.E2E_FRONT_URL ?? 'http://localhost:5173';
export const PORTAL_URL = process.env.E2E_PORTAL_URL ?? 'http://localhost:5174';
export const PLATFORM_LOGIN = process.env.E2E_PLATFORM_LOGIN ?? 'superadmin';
export const PLATFORM_PASSWORD = process.env.E2E_PLATFORM_PASSWORD ?? '';

/** Пароль, который сценарий задаёт заведённым им же людям. */
export const NEW_PASSWORD = 'Qorder-QA-2026';

const RUN = String(Date.now()).slice(-7);
let serial = 0;
/** Уникальный хвост для телефонов и БИН: стенд между прогонами не чистится. */
function unique(): string {
  serial += 1;
  return `${RUN}${serial}`.slice(-7);
}

async function signIn(page: Page, login: string, password: string) {
  const user = page.locator('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])').first();
  await expect(user).toBeVisible({ timeout: 30_000 });
  await user.fill(login);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
}

async function changePasswordIfAsked(page: Page, password: string) {
  const fields = page.locator('input[type="password"]');
  await page.waitForTimeout(1500);
  if ((await fields.count()) < 2) return;
  await fields.nth(0).fill(password);
  await fields.nth(1).fill(password);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
}

/** Входит в SPA и снимает токен с первого же запроса к `/api`. */
async function tokenBySignIn(browser: Browser, url: string, login: string, password: string,
                             newPassword?: string): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const token = new Promise<string>((resolve) => {
    page.on('request', (req) => {
      const auth = req.headers().authorization;
      if (auth?.startsWith('Bearer ') && req.url().includes('/api/')) resolve(auth.slice(7));
    });
  });
  await page.goto(url);
  await signIn(page, login, password);
  if (newPassword) await changePasswordIfAsked(page, newPassword);
  const value = await Promise.race([
    token,
    new Promise<string>((_, reject) => setTimeout(() => reject(new Error(`нет токена после входа в ${url}`)), 45_000)),
  ]);
  await context.close();
  return value;
}

export async function api(token: string, headers: Record<string, string> = {}): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Accept-Language': 'ru', ...headers },
  });
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!response.ok()) throw new Error(`${what}: ${response.status()} ${await response.text()}`);
  return (await response.json()) as T;
}

export interface Tenant {
  id: string;
  staff: APIRequestContext;
  staffToken: string;
  items: Record<string, { id: string; price: number; unit: string; name: string; sku: string }>;
}

export interface Customer {
  phone: string;
  password: string;
}

let platform: APIRequestContext | undefined;

export async function platformApi(browser: Browser): Promise<APIRequestContext> {
  if (!platform) {
    const token = await tokenBySignIn(browser, `${ADMIN_URL}/tenants`, PLATFORM_LOGIN, PLATFORM_PASSWORD);
    platform = await api(token);
  }
  return platform;
}

/** Арендатор с сотрудником-администратором и позициями каталога. */
export async function tenant(browser: Browser, label: string,
                             items: Array<{ sku: string; name: string; unit: string; price: number }>): Promise<Tenant> {
  const admin = await platformApi(browser);
  const tail = unique();
  const created = await json<{ id: string }>(await admin.post('/api/tenant/platform/tenants', {
    data: { name: `ТОО QA ${label} ${tail}`, binIin: `31${tail.padStart(10, '0')}` },
  }), 'арендатор');
  const phone = `7706${tail}`;
  const account = await json<{ temporaryPassword: string }>(await admin.post(
    `/api/tenant/platform/tenants/${created.id}/accounts`,
    { data: { phone, name: `QA ${label}`, email: `qa${tail}@example.kz` } },
  ), 'сотрудник');
  const staffToken = await tokenBySignIn(browser, `${FRONT_URL}/queue`, phone, account.temporaryPassword, NEW_PASSWORD);
  const staff = await api(staffToken);

  const saved: Tenant['items'] = {};
  for (const item of items) {
    const body = await json<{ id: string }>(await staff.post('/api/catalog/items', {
      data: { ...item, trackStock: true, stockQuantity: 100, vatRate: 16 },
    }), `позиция ${item.sku}`);
    saved[item.sku] = { ...item, id: body.id };
  }
  return { id: created.id, staff, staffToken, items: saved };
}

/**
 * Ещё один сотрудник того же арендатора — например, кладовщик: на собственный
 * запрос складу менеджер не отвечает, наличие подтверждает тот, кто его видел.
 */
export async function colleague(browser: Browser, t: Tenant, label: string): Promise<APIRequestContext> {
  // Платформа заводит только первого администратора; остальных — сам арендатор.
  const roles = await json<Array<{ id: string; builtin?: string }>>(await t.staff.get('/api/tenant/roles'), 'роли');
  const phone = `7706${unique()}`;
  const account = await json<{ temporaryPassword: string }>(await t.staff.post('/api/tenant/staff', {
    data: {
      phone, name: `QA ${label}`, email: `qa${phone}@example.kz`,
      roleIds: roles.filter((role) => role.builtin === 'ADMIN').map((role) => role.id),
    },
  }), `сотрудник ${label}`);
  return api(await tokenBySignIn(browser, `${FRONT_URL}/queue`, phone, account.temporaryPassword, NEW_PASSWORD));
}

/** Приглашённый и активированный клиент одного поставщика. */
export async function customer(t: Tenant): Promise<Customer> {
  const phone = `7707${unique()}`;
  const invitation = await json<{ activationLink: string }>(await t.staff.post('/api/customers/invitations', {
    data: { phone, email: `client${phone}@example.kz`, name: 'ТОО Прораб QA' },
  }), 'приглашение');
  const code = new URL(invitation.activationLink).searchParams.get('code');
  const anonymous = await request.newContext({ baseURL: API_URL });
  await json(await anonymous.post('/api/portal/invitation/activate', {
    data: { code, consentVersion: process.env.E2E_CONSENT_VERSION ?? '2026-10-14', password: NEW_PASSWORD },
  }), 'активация');
  await anonymous.dispose();
  return { phone, password: NEW_PASSWORD };
}

/**
 * Клиент входит в кабинет настоящим входом через Keycloak.
 * Язык выбран заранее: окно выбора языка перекрыло бы форму.
 * Возвращает токен клиента, снятый с запросов кабинета, — им сценарий
 * кладёт позиции в корзину, не завязываясь на подписи кнопок витрины.
 */
export async function signInToPortal(page: Page, who: Customer, supplierId: string): Promise<string> {
  await page.addInitScript(([supplier]) => {
    window.localStorage.setItem('q-order.portal.language-chosen', 'ru');
    window.localStorage.setItem('qo.portal.supplier', supplier);
  }, [supplierId]);
  const token = new Promise<string>((resolve) => {
    page.on('request', (req) => {
      const auth = req.headers().authorization;
      if (auth?.startsWith('Bearer ') && req.url().includes('/api/portal/')) resolve(auth.slice(7));
    });
  });
  await page.goto(`${PORTAL_URL}/catalog`);
  await signIn(page, who.phone, who.password);
  return Promise.race([
    token,
    new Promise<string>((_, reject) => setTimeout(() => reject(new Error('нет токена клиента')), 45_000)),
  ]);
}

export async function customerApi(token: string, supplierId: string): Promise<APIRequestContext> {
  return api(token, { 'X-Supplier-Id': supplierId });
}

export async function draftCount(t: Tenant): Promise<number> {
  const response = await t.staff.get('/api/drafts', { params: { size: 100 } });
  const body = await json<unknown>(response, 'очередь');
  const list = Array.isArray(body) ? body : ((body as { content?: unknown[] }).content ?? []);
  return list.length;
}
