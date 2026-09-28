import { expect, test, type Page } from '@playwright/test';
import { FRONT_URL, NEW_PASSWORD, api, platformApi } from './support/stand';

/** Временный осмотр вкладки «Состав пресса». Не часть набора. */
test('осмотр: вкладка состава пресса', async ({ browser }) => {
  test.setTimeout(300_000);
  const shots = process.env.SHOTS!;
  const platform = await platformApi(browser);
  const tail = String(Date.now()).slice(-7);
  const created = await (await platform.post('/api/tenant/platform/tenants', {
    data: { name: `ТОО QA Пресс ${tail}`, binIin: `33${tail.padStart(10, '0')}` },
  })).json();
  const phone = `7709${tail}`;
  const account = await (await platform.post(`/api/tenant/platform/tenants/${created.id}/accounts`, {
    data: { phone, name: 'QA Прессы', email: `qa-press${tail}@example.kz` },
  })).json();

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ru-RU' });
  const page = await context.newPage();
  const token = new Promise<string>((resolve) => page.on('request', (req) => {
    const auth = req.headers().authorization;
    if (auth?.startsWith('Bearer ') && req.url().includes('/api/')) resolve(auth.slice(7));
  }));
  await page.goto(`${FRONT_URL}/catalog`);
  await signIn(page, phone, account.temporaryPassword);
  await page.waitForTimeout(1500);
  const fields = page.locator('input[type="password"]');
  if ((await fields.count()) >= 2) {
    await fields.nth(0).fill(NEW_PASSWORD);
    await fields.nth(1).fill(NEW_PASSWORD);
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
  }
  const staff = await api(await token);

  const ids: string[] = [];
  for (const [sku, stock] of [['HD-S', 10], ['HD-M', 7], ['HD-L', 4]] as const) {
    ids.push((await (await staff.post('/api/catalog/items', { data: {
      sku, name: `Худи ${sku.slice(3)}`, unit: 'шт', price: 12000, trackStock: true, stockQuantity: stock,
    } })).json()).id);
  }
  const bale = (await (await staff.post('/api/catalog/items', { data: {
    sku: 'BALE-1', name: 'Пресс худи', unit: 'пресс', price: 30000, trackStock: false,
  } })).json()).id;

  // 1. Настройка выключена: вкладки нет.
  await page.goto(`${FRONT_URL}/catalog?item=${bale}`);
  await page.waitForTimeout(3000);
  const tab = page.getByRole('tab', { name: /Состав пресса/ });
  expect(await tab.count()).toBe(0);
  await page.screenshot({ path: `${shots}/p1-off.png` });

  // 2. «Единицы опта»: включаем «Продаю прессами».
  await page.goto(`${FRONT_URL}/settings/seller-units`);
  await page.waitForTimeout(2500);
  const toggle = page.getByRole('checkbox', { name: 'Продаю прессами' });
  await toggle.click();
  await page.waitForTimeout(1500);
  await expect(toggle).toBeChecked();
  await page.screenshot({ path: `${shots}/p2-toggle.png` });

  // 3. Карточка: вкладка есть, делаем прессом S×2 и M×1, сохраняем.
  await page.goto(`${FRONT_URL}/catalog?item=${bale}`);
  await page.waitForTimeout(3000);
  await page.getByRole('tab', { name: /Состав пресса/ }).click();
  await page.screenshot({ path: `${shots}/p3-empty.png` });
  for (const name of ['Худи S', 'Худи M']) {
    await page.getByRole('button', { name: /Сделать прессом|Добавить/ }).last().click();
    const search = page.getByRole('searchbox', { name: 'Найти товар для пресса' });
    await search.fill('Худи');
    await search.locator('xpath=ancestor::div[3]').getByRole('button', { name: new RegExp(name) }).click();
  }
  await page.getByRole('button', { name: 'Больше' }).first().click();
  await page.screenshot({ path: `${shots}/p4-draft.png` });
  await page.getByRole('button', { name: /^Сохранить$/ }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${shots}/p5-saved.png` });

  const card = await (await staff.get(`/api/catalog/items/${bale}`)).json();
  console.log('PACK', JSON.stringify(card.pack), 'STOCK', JSON.stringify(card.item.stock));

  // 4. Перечитали страницу — состав и «собирается прессов» на месте.
  await page.reload();
  await page.waitForTimeout(3000);
  await page.getByRole('tab', { name: /Состав пресса/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/p6-reloaded.png` });
  console.log('TEXT', await page.locator('[role="tab"][aria-selected="true"]').textContent());
});

async function signIn(page: Page, login: string, password: string) {
  const user = page.locator('input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])').first();
  await expect(user).toBeVisible({ timeout: 30_000 });
  await user.fill(login);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
}
