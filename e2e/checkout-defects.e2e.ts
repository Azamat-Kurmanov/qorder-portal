import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PLATFORM_PASSWORD, colleague, customer, customerApi, signInToPortal, tenant, type Customer, type Tenant,
} from './support/stand';

/**
 * Оформление заявки в кабинете: дефекты, найденные QA 2026-09-26.
 *
 * Тесты «воспроизводит дефект» падают на текущем коде — это доказательство,
 * а не регрессия. Исключение — последний сценарий, оптовая строка от корзины
 * до счёта: он обязан проходить. Отчёт:
 * `back/qorder/docs/qa/2026-09-26-portal-checkout.md`, реестр — `NEEDS_TO_SOLVE.md`.
 *
 * Запуск (стек поднят, пароль платформы — в переменной окружения):
 *   E2E_PLATFORM_PASSWORD=… npx playwright test e2e/checkout-defects.e2e.ts
 */

const SHOTS = join(process.cwd(), '..', '..', 'back', 'qorder', 'docs', 'qa', 'shots', 'portal-checkout');

// Не serial: каждый тест здесь падает намеренно, а serial пропустил бы
// все после первого падения. Упавший тест перезапускает воркер, и стенд
// заводится заново — медленнее, зато каждый дефект показан отдельно.
test.describe.configure({ mode: 'default' });

let zoned: Tenant;            // доставка по зонам с окнами
let pickupOnly: Tenant;       // «только самовывоз», две точки
let zonedClient: Customer;
let pickupClient: Customer;
let door: { id: string; center: string };
let southPoint: string;

test.beforeAll(async ({ browser }) => {
  test.skip(!PLATFORM_PASSWORD, 'нужен E2E_PLATFORM_PASSWORD — пароль superadmin из .env стенда');
  test.setTimeout(5 * 60_000);
  mkdirSync(SHOTS, { recursive: true });

  zoned = await tenant(browser, 'Зоны', [
    { sku: 'Z-001', name: 'Цемент М500', unit: 'мешок', price: 3200 },
    { sku: 'Z-002', name: 'Кирпич облицовочный', unit: 'шт', price: 120 },
  ]);
  const method = await (await zoned.staff.post('/api/delivery/methods', {
    data: {
      name: 'До двери', type: 'DOOR_DELIVERY', requiresAddress: true, requiresFloor: false,
      requiresTimeSlot: true, tariffRule: 'BY_ZONE', active: true,
    },
  })).json() as { id: string };
  const center = await (await zoned.staff.post(`/api/delivery/methods/${method.id}/zones`, {
    data: { name: 'Центр', price: 1500 },
  })).json() as { id: string };
  await zoned.staff.post(`/api/delivery/methods/${method.id}/zones`, { data: { name: 'Окраина', price: 3000 } });
  await zoned.staff.post(`/api/delivery/methods/${method.id}/slots`, { data: { fromTime: '10:00', toTime: '14:00' } });
  await zoned.staff.post(`/api/delivery/methods/${method.id}/slots`, { data: { fromTime: '14:00', toTime: '18:00' } });
  expect((await zoned.staff.put('/api/delivery/mode', { data: { mode: 'ENABLED' } })).ok()).toBeTruthy();
  door = { id: method.id, center: center.id };
  zonedClient = await customer(zoned);

  pickupOnly = await tenant(browser, 'Самовывоз', [
    { sku: 'P-001', name: 'Краска фасадная', unit: 'ведро', price: 7000 },
  ]);
  await pickupOnly.staff.post('/api/delivery/pickup-points', {
    data: { name: 'Склад Север', address: 'ул. Северная, 1', active: true },
  });
  southPoint = ((await (await pickupOnly.staff.post('/api/delivery/pickup-points', {
    data: { name: 'Склад Юг', address: 'ул. Южная, 2', active: true },
  })).json()) as { id: string }).id;
  pickupClient = await customer(pickupOnly);
});

/** Кладёт позицию в корзину от имени клиента: подписи кнопок витрины здесь ни при чём. */
async function putInCart(token: string, t: Tenant, sku: string, quantity: number) {
  const cart = await customerApi(token, t.id);
  const response = await cart.put(`/api/portal/cart/lines/${t.items[sku].id}`, { data: { quantity } });
  expect(response.ok(), await response.text()).toBeTruthy();
  await cart.dispose();
}

async function staffDraft(t: Tenant, id: string) {
  const response = await t.staff.get(`/api/drafts/${id}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { delivery?: Record<string, unknown> };
}

/** Ответ на подачу — вместе с номером заявки, если она создана. */
function submission(page: Page) {
  return page.waitForResponse((r) => r.url().endsWith('/api/portal/orders') && r.request().method() === 'POST');
}

const SEND = 'Отправить заявку продавцу';

test('воспроизводит дефект QA-004 (NTS-001): корзину с изменившейся ценой нельзя отправить', async ({ page }) => {
  const token = await signInToPortal(page, zonedClient, zoned.id);
  await putInCart(token, zoned, 'Z-001', 10);
  const item = zoned.items['Z-001'];
  expect((await zoned.staff.put(`/api/catalog/items/${item.id}`, {
    data: { sku: item.sku, name: item.name, unit: item.unit, price: 3500, trackStock: true, stockQuantity: 100, vatRate: 16 },
  })).ok()).toBeTruthy();

  await page.goto('/checkout');
  const send = page.getByRole('button', { name: SEND });
  const first = submission(page);
  await send.click();
  expect((await first).status()).toBe(409);
  await expect(page.getByText('Состав изменился')).toBeVisible();
  await page.screenshot({ path: join(SHOTS, 'fact-desktop-changed.png'), fullPage: true });

  // Клиент увидел новые цены и отправляет ещё раз — как велит текст плашки.
  const second = submission(page);
  await send.click();
  expect((await second).status(), 'повторная отправка после показанного расхождения').toBe(200);
  await expect(page.getByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
});

test('воспроизводит дефект QA-005 (NTS-002): зона и окно доставки не доходят до заявки', async ({ page }) => {
  const token = await signInToPortal(page, zonedClient, zoned.id);
  // Корзина могла остаться от прошлого сценария с «застрявшей» ценой: чистим.
  const cart = await customerApi(token, zoned.id);
  await cart.delete('/api/portal/cart');
  await cart.dispose();
  await putInCart(token, zoned, 'Z-002', 100);          // 100 × 120 = 12 000

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Доставка', exact: true }).click();
  await page.getByLabel('Зона доставки').selectOption({ index: 1 });   // «Центр · 1 500 ₸»
  await page.getByLabel('Адрес доставки').fill('пр. Абая, 10');
  await page.getByLabel('Дата доставки').fill('2030-09-30');
  await page.getByLabel('Окно доставки').selectOption('10:00–14:00');
  // Клиент видит «Итого» с ценой зоны.
  await expect(page.getByTestId('total')).toContainText('13');
  await page.screenshot({ path: join(SHOTS, 'fact-desktop-zone-chosen.png'), fullPage: true });

  const answer = submission(page);
  await page.getByRole('button', { name: SEND }).click();
  const response = await answer;
  expect(response.status()).toBe(200);
  const sentBody = response.request().postDataJSON() as { delivery?: { zoneId?: string; slot?: string } };
  expect(sentBody.delivery?.zoneId, 'кабинет отправил зону').toBe(door.center);
  const created = (await response.json()) as { draftId: string; total: number };

  const draft = await staffDraft(zoned, created.draftId);
  expect.soft(created.total, 'сумма заявки = «Итого» клиента').toBe(13500);
  expect.soft(draft.delivery?.status, 'доставка в заявке менеджера').toBe('RESOLVED');
  expect.soft(draft.delivery?.price, 'цена зоны').toBe(1500);
  expect(draft.delivery?.slot, 'окно доставки').toBe('10:00–14:00');
});

test('воспроизводит дефект QA-007 (NTS-003): при «только самовывоз» выбранная точка теряется', async ({ page }) => {
  const token = await signInToPortal(page, pickupClient, pickupOnly.id);
  await putInCart(token, pickupOnly, 'P-001', 2);

  await page.goto('/checkout');
  await page.getByText('Склад Юг, ул. Южная, 2').click();
  await page.screenshot({ path: join(SHOTS, 'fact-desktop-pickup-only.png'), fullPage: true });
  const answer = submission(page);
  await page.getByRole('button', { name: SEND }).click();
  const response = await answer;
  expect(response.status()).toBe(200);
  expect((response.request().postDataJSON() as { delivery?: { pickupPointId?: string } }).delivery?.pickupPointId,
    'кабинет отправил выбранную точку').toBe(southPoint);

  const draft = await staffDraft(pickupOnly, ((await response.json()) as { draftId: string }).draftId);
  expect.soft(draft.delivery?.status).toBe('RESOLVED');
  expect(draft.delivery?.pickupPointId, 'точка в заявке менеджера').toBe(southPoint);
});

/** Отказ подачи, который экран обязан объяснить словами (portal.md §4). */
async function expectExplainedFailure(page: Page, shot: string) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, shot), fullPage: true });
  await expect(page.getByRole('alert'), 'человек видит, что заявка не ушла').toBeVisible({ timeout: 5_000 });
}

test('воспроизводит дефект QA-008 (NTS-004): отказ 500 при отправке — экран молчит', async ({ page }) => {
  const token = await signInToPortal(page, zonedClient, zoned.id);
  await putInCart(token, zoned, 'Z-002', 10);
  await page.route('**/api/portal/orders', (route) => route.request().method() === 'POST'
    ? route.fulfill({
      status: 500, contentType: 'application/problem+json',
      body: JSON.stringify({ status: 500, code: 'INTERNAL_ERROR', detail: 'Внутренняя ошибка сервера' }),
    })
    : route.continue());
  await page.goto('/checkout');
  await page.getByRole('button', { name: SEND }).click();
  await expectExplainedFailure(page, 'fact-desktop-error-500.png');
});

test('воспроизводит дефект QA-008 (NTS-004): обрыв сети при отправке — экран молчит', async ({ page }) => {
  const token = await signInToPortal(page, zonedClient, zoned.id);
  await putInCart(token, zoned, 'Z-002', 10);
  await page.route('**/api/portal/orders', (route) => route.request().method() === 'POST'
    ? route.abort('internetdisconnected')
    : route.continue());
  await page.goto('/checkout');
  await page.getByRole('button', { name: SEND }).click();
  await expectExplainedFailure(page, 'fact-desktop-error-offline.png');
});

test('воспроизводит дефект QA-009 (NTS-004, NTS-011): ответ потерян, повтор молча получает «корзина пуста»', async ({ page }) => {
  const token = await signInToPortal(page, zonedClient, zoned.id);
  await putInCart(token, zoned, 'Z-002', 7);
  const before = (await (await zoned.staff.get('/api/drafts/counters')).json()) as { active: number };

  // Первый запрос доходит до сервера и создаёт заявку, но ответ до браузера не доходит.
  let lost = false;
  await page.route('**/api/portal/orders', async (route) => {
    if (route.request().method() !== 'POST' || lost) return route.continue();
    lost = true;
    await route.fetch();
    await route.abort('connectionreset');
  });
  await page.goto('/checkout');
  const send = page.getByRole('button', { name: SEND });
  await send.click();
  await page.waitForTimeout(1500);

  const retry = submission(page);
  await send.click();
  const answer = await retry;
  const after = (await (await zoned.staff.get('/api/drafts/counters')).json()) as { active: number };
  expect.soft(after.active - before.active, 'заявка создана ровно одна').toBe(1);
  expect.soft(answer.status(), 'сервер на повтор').toBe(400);
  await page.screenshot({ path: join(SHOTS, 'fact-desktop-lost-response-retry.png'), fullPage: true });
  // Ожидание: экран ведёт в «Мои заявки» или объясняет, что заявка, возможно, уже ушла.
  await expect(page.getByRole('alert').or(page.getByRole('heading', { name: 'Заявка отправлена' })))
    .toBeVisible({ timeout: 5_000 });
});

/**
 * Оптовая строка от корзины до счёта (спецификация «Условия продажи», проверка E2E).
 * Клиент кладёт штуки, сервер сам делит их на целые упаковки по цене ступени
 * и розничный остаток: 65 мешков = 3 упаковки по 20 × 1 800 + 5 мешков × 2 500 = 17 900.
 * Продавец — плательщик НДС 12 %: корзина и счёт обязаны назвать один и тот же НДС.
 */
test('оптовая строка: корзина → заявка → заказ → счёт с НДС по строкам', async ({ page, browser }) => {
  test.setTimeout(5 * 60_000);
  const wholesaler = await tenant(browser, 'Опт', []);
  const staff = wholesaler.staff;

  const details = await (await staff.get('/api/tenant/seller-details')).json() as Record<string, unknown>;
  const saved = await staff.put('/api/tenant/seller-details', {
    data: {
      ...details, bankName: 'АО «Банк QA»', bankBic: 'BANKKZKX', bankAccount: 'KZ111111111111111111', bankKbe: '17',
      vatPayer: true, vatRate: 12,
    },
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();

  const units = await (await staff.get('/api/catalog/seller-units')).json() as Array<{ id: string; name: string }>;
  const pack = units.find((unit) => unit.name === 'упаковка');
  expect(pack, 'готовая единица «упаковка»').toBeDefined();
  const created = await staff.post('/api/catalog/items', {
    data: {
      sku: 'W-001', name: 'Цемент М400', unit: 'мешок', price: 2500, trackStock: true, stockQuantity: 500,
      wholesale: {
        saleMode: 'BOTH', unitId: pack!.id, packQty: 20,
        tiers: [{ from: 1, price: 1800 }, { from: 10, price: 1700 }],
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const cement = ((await created.json()) as { id: string }).id;

  const client = await customer(wholesaler);
  const token = await signInToPortal(page, client, wholesaler.id);
  const cart = await customerApi(token, wholesaler.id);
  const put = await cart.put(`/api/portal/cart/lines/${cement}`, { data: { quantity: 65 } });
  expect(put.ok(), await put.text()).toBeTruthy();
  const cartLine = ((await put.json()) as { lines: Array<{ split?: { packs: number; packPrice: number; rest: number } }> })
    .lines[0];
  expect(cartLine.split, 'штуки поделены на упаковки и остаток').toMatchObject({ packs: 3, packPrice: 1800, rest: 5 });
  await cart.dispose();

  await page.goto('/checkout');
  // Сверку оформление рисует дважды — для телефона и для монитора, видна одна;
  // штуки она пишет перед разбиением.
  const line = page.getByTestId('cart-line').filter({ hasText: '65 мешков =', visible: true });
  await expect(line).toHaveCount(1);
  await expect(line).toContainText(/65 мешков = 3 упаковки \(по 20 мешков\) × 1\s800 ₸ \+ 5 мешков × 2\s500 ₸/);
  await expect(page.getByTestId('cart-vat').filter({ visible: true })).toContainText(/1\s917,86/);
  await page.screenshot({ path: join(SHOTS, 'wholesale-checkout.png'), fullPage: true });

  const answer = submission(page);
  await page.getByRole('button', { name: SEND }).click();
  const response = await answer;
  expect(response.status(), await response.text()).toBe(200);
  const { draftId } = (await response.json()) as { draftId: string };

  expect((await staff.post(`/api/drafts/${draftId}/assignment`, { data: {} })).ok()).toBeTruthy();

  // Остаток, заведённый руками, для WHEN_UNRELIABLE (умолчание) ненадёжен:
  // принять заявку можно только после ответа склада — как в работе.
  const { lines } = (await (await staff.get(`/api/drafts/${draftId}`)).json()) as { lines: Array<{ id: string }> };
  const requested = await staff.post(`/api/drafts/${draftId}/stock-request`);
  expect(requested.ok(), await requested.text()).toBeTruthy();
  const requestId = ((await requested.json()) as { id: string }).id;
  const keeper = await colleague(browser, wholesaler, 'Склад');
  expect((await keeper.post(`/api/stock-requests/${requestId}/claim`)).ok()).toBeTruthy();
  const answered = await keeper.post(`/api/stock-requests/${requestId}/respond`, {
    data: { lines: lines.map((draftLine) => ({ lineId: draftLine.id, answer: 'IN_STOCK' })) },
  });
  expect(answered.ok(), await answered.text()).toBeTruthy();

  const accepted = await staff.post(`/api/drafts/${draftId}/accept`);
  expect(accepted.ok(), await accepted.text()).toBeTruthy();
  const orders = await (await staff.get('/api/orders')).json() as Array<{ id: string; draftId: string }>;
  const order = orders.find((o) => o.draftId === draftId);
  expect(order, 'заказ по принятой заявке').toBeDefined();

  const issued = await staff.post(`/api/orders/${order!.id}/invoice`);
  expect(issued.ok(), await issued.text()).toBeTruthy();
  const invoice = (await issued.json()) as {
    total: number;
    lines: Array<{ quantity: number; unit: string; price: number; amount: number; packQty?: number }>;
    vatBreakdown: Array<{ rate: number; amount: number }>;
  };
  expect(invoice.lines).toHaveLength(2);
  expect(invoice.lines[0]).toMatchObject({ quantity: 3, unit: 'упаковка', price: 1800, amount: 5400, packQty: 20 });
  expect(invoice.lines[1]).toMatchObject({ quantity: 5, unit: 'мешок', price: 2500, amount: 12500 });
  expect(invoice.total).toBe(17900);
  expect(invoice.vatBreakdown).toEqual([{ rate: 12, amount: 1917.86 }]);
});
