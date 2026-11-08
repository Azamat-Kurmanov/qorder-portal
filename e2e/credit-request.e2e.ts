import { expect, test, type Page } from '@playwright/test';
import { FRONT_URL, PORTAL_URL } from './support/stand';

/**
 * «В долг» от корзины до решения продавца — на учётках стенда (ТОО «Роза»):
 * клиент выбирает «Возьму в долг», продавец видит просьбу в очереди и в заявке,
 * отвечает «Только за оплату», клиент видит отказ в «Моих заявках».
 *
 *   E2E_CLIENT_PASSWORD=… E2E_SELLER_PASSWORD=… npx playwright test e2e/credit-request.e2e.ts
 */
const ROZA = process.env.E2E_SUPPLIER ?? '01a0f62c-c48a-7ca0-af35-51cc4a66f510';
const CLIENT = { phone: '7010000011', password: process.env.E2E_CLIENT_PASSWORD ?? '' };
const SELLER = { phone: '7762731342', password: process.env.E2E_SELLER_PASSWORD ?? '' };
const SHOTS = 'temp/visual/credit';

async function signIn(page: Page, phone: string, password: string) {
  await page.getByPlaceholder('701 000 00 00').fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
}

test('клиент просит в долг, продавец отвечает «только за оплату»', async ({ browser }) => {
  test.skip(!CLIENT.password || !SELLER.password, 'нужны пароли учёток стенда');
  test.setTimeout(4 * 60_000);

  // Клиент: товар в корзину, оформление «в долг».
  const client = await (await browser.newContext()).newPage();
  await client.addInitScript((supplier) => {
    localStorage.setItem('q-order.portal.language-chosen', 'ru');
    localStorage.setItem('qo.portal.supplier', supplier);
  }, ROZA);
  const token = new Promise<string>((resolve) => client.on('request', (req) => {
    const auth = req.headers().authorization;
    if (auth?.startsWith('Bearer ') && req.url().includes('/api/portal/')) resolve(auth.slice(7));
  }));
  await client.goto(`${PORTAL_URL}/catalog`);
  await signIn(client, CLIENT.phone, CLIENT.password);
  const bearer = await token;
  const api = await client.context().request;
  const headers = { Authorization: `Bearer ${bearer}`, 'X-Supplier-Id': ROZA };
  const items = await (await api.get('http://localhost:5000/api/portal/catalog?size=20', { headers })).json();
  const item = items.items.find((i: { available?: boolean; price?: number; variants?: unknown[] }) => i.price && i.available !== false && !i.variants?.length);
  const quantity = Math.max(item.terms?.minQuantity ?? 1, item.terms?.quantityStep ?? 1);
  const put = await api.put(`http://localhost:5000/api/portal/cart/lines/${item.id}`, { headers, data: { quantity } });
  expect(put.ok(), await put.text()).toBeTruthy();

  await client.setViewportSize({ width: 1440, height: 900 });
  await client.goto(`${PORTAL_URL}/checkout`);
  const send = client.getByRole('button', { name: /отправить заявку/i });
  await expect(send).toBeDisabled();
  await client.getByText('Возьму в долг').click();
  await client.screenshot({ path: `${SHOTS}/1-checkout.png`, fullPage: true });
  await expect(send).toBeEnabled();
  const created = client.waitForResponse((r) => r.url().endsWith('/api/portal/orders') && r.request().method() === 'POST');
  await send.click();
  const { draftId } = await (await created).json() as { draftId: string };
  await expect(client.getByText(/заявка отправлена/i)).toBeVisible();

  // Продавец: просьба видна в очереди и в заявке.
  const seller = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await seller.goto(`${FRONT_URL}/queue`);
  await signIn(seller, SELLER.phone, SELLER.password);
  const pill = seller.getByTestId('credit-pill').filter({ hasText: 'Просит в долг' }).first();
  await expect(pill).toBeVisible({ timeout: 30_000 });
  await seller.screenshot({ path: `${SHOTS}/2-queue.png` });
  await seller.goto(`${FRONT_URL}/drafts/${draftId}`);
  const bar = seller.getByTestId('credit-request');
  await expect(bar).toContainText('Клиент просит товар в долг');
  await seller.screenshot({ path: `${SHOTS}/3-draft.png` });
  await bar.getByRole('button', { name: 'Только за оплату' }).click();
  await expect(bar).toContainText('Вы отказали в долге');
  await seller.screenshot({ path: `${SHOTS}/4-declined.png` });

  // Клиент видит решение.
  await client.goto(`${PORTAL_URL}/orders/${draftId}`);
  await expect(client.getByTestId('order-credit').first()).toContainText('только за оплату', { timeout: 15_000 });
  await client.screenshot({ path: `${SHOTS}/5-orders.png`, fullPage: true });
});
