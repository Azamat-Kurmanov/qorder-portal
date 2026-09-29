import { test, type APIResponse } from '@playwright/test';
import { colleague, customer, customerApi, signInToPortal, tenant } from './support/stand';

/** Временная съёмка экранов для сверки с канвой. Не часть набора — удалить после сверки. */
test('съёмка экранов портала', async ({ browser }) => {
  test.setTimeout(15 * 60_000);
  const shots = process.env.SHOTS!;
  const log = async (label: string, r: APIResponse) => {
    const body = await r.text();
    console.log(label, r.status(), r.ok() ? '' : body.slice(0, 300));
    try { return JSON.parse(body); } catch { return undefined; }
  };
  const names = ['Куртка мужская зимняя Nord', 'Брюки женские классические Elegance', 'Брюки мужские чинос City',
    'Брюки спортивные унисекс Motion', 'Худи оверсайз', 'Футболка базовая', 'Джинсы мужские прямые Denim',
    'Свитер вязаный', 'Рубашка льняная', 'Пальто женское классическое Milano', 'Тренч женский Classic Beige', 'Жилет утеплённый'];
  const t = await tenant(browser, 'Дизайн', names.map((name, i) => ({
    sku: `D-${String(i + 1).padStart(3, '0')}`, name, unit: 'шт', price: 12990 + i * 5000,
  })));
  const s = t.staff;

  await log('details', await s.put('/api/tenant/seller-details', { data: {
    name: 'ИП «Мухамедиева»', address: 'Барахолка «Кенжехан-2»', city: 'Алматы', phone: '77270000000',
    whatsapp: '77270000000', tagline: 'Магазин одежды', vatPayer: true, vatRate: 16,
  } }));
  await log('hours', await s.put('/api/tenant/business-hours', { data: {
    timezone: 'Asia/Almaty',
    days: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, closed: false, opensAt: '07:00', closesAt: '17:00' })),
  } }));
  const outer = await log('cat1', await s.post('/api/catalog/categories', { data: { name: 'Верхняя одежда' } }));
  const lower = await log('cat2', await s.post('/api/catalog/categories', { data: { name: 'Нижняя одежда' } }));
  const cats = [outer?.id, lower?.id, lower?.id, lower?.id, outer?.id, outer?.id, lower?.id, outer?.id, outer?.id, outer?.id, outer?.id, outer?.id];
  let i = 0;
  for (const [sku, item] of Object.entries(t.items)) {
    await log(`item ${sku}`, await s.put(`/api/catalog/items/${item.id}`, { data: {
      sku, name: item.name, unit: item.unit, price: item.price, vatRate: 16, trackStock: true, stockQuantity: 100,
      categoryId: cats[i++], description: 'Классический крой, плотная ткань.',
    } }));
  }
  await log('promo', await s.put('/api/promotions/settings', { data: {
    saleEnabled: true, saleTitle: 'Осенняя распродажа', saleText: 'Пуховики и тренчи', saleCountdown: true,
    saleEndsOn: '2030-09-30', volumeEnabled: true, volumeTiers: [{ from: 100000, percent: 5 }],
    firstOrderEnabled: true, firstOrderPercent: 5, subscriptionOffered: true, subscriptionPromise: 'SALES_ONLY',
  } }));
  for (const sku of ['D-001', 'D-010', 'D-011']) await log(`sale ${sku}`, await s.put(`/api/promotions/items/${t.items[sku].id}`, { data: { percent: 20 } }));
  await log('hit', await s.put(`/api/promotions/marks/${t.items['D-001'].id}`, { data: { hit: true, novelty: false } }));
  await log('new', await s.put(`/api/promotions/marks/${t.items['D-003'].id}`, { data: { hit: false, novelty: true } }));
  await log('banners', await s.put('/api/showcase-banners', { data: { slides: [{
    visible: true, template: 'SALE', scheme: 'GRAPHITE', badge: 'До 30 сентября', title: 'Осенняя распродажа',
    text: 'Пуховики и тренчи', buttonText: 'Смотреть верхнюю одежду', discount: '-20%', target: 'SALE',
  }] } }));
  await log('publish', await s.post('/api/showcase-banners/publish'));

  const point = await log('pickup', await s.post('/api/delivery/pickup-points', { data: { name: 'Склад', address: 'Барахолка «Кенжехан-2»', active: true } }));
  await log('door', await s.post('/api/delivery/methods', { data: { name: 'До двери', type: 'DOOR_DELIVERY', requiresAddress: true, requiresFloor: false, requiresTimeSlot: false, tariffRule: 'FIXED', tariffAmount: 1500, active: true } }));
  await log('mode', await s.put('/api/delivery/mode', { data: { mode: 'ENABLED' } }));
  const who = await customer(t);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
  const page = await context.newPage();
  const token = await signInToPortal(page, who, t.id);
  const c = await customerApi(token, t.id);
  const put = (sku: string, q: number) => c.put(`/api/portal/cart/lines/${t.items[sku].id}`, { data: { quantity: q } });
  const review = await log('review', await c.post(`/api/portal/items/${t.items['D-002'].id}/reviews`, { data: { rating: 5, text: 'Сели идеально, ткань плотная и не мнётся.' } }));
  const reviews = await log('reviews', await s.get('/api/reviews'));
  const rid = review?.id ?? reviews?.content?.[0]?.id ?? reviews?.[0]?.id;
  if (rid) await log('publishReview', await s.post(`/api/reviews/${rid}/publish`));
  await log('fav', await c.post(`/api/portal/favorites/${t.items['D-004'].id}/toggle`));

  await log('pickupOnly', await s.put('/api/delivery/mode', { data: { mode: 'PICKUP_ONLY' } }));
  const keeper = await colleague(browser, t, 'Склад');
  // Четыре заявки: новая, ждёт ответа клиента, принята, можно забирать.
  const drafts: string[] = [];
  for (const sku of ['D-003', 'D-002', 'D-007', 'D-011']) {
    await c.delete('/api/portal/cart');
    await put(sku, 2);
    const order = await log(`order ${sku}`, await c.post('/api/portal/orders', { data: { note: '', delivery: { pickupPointId: point.id } } }));
    if (order?.draftId) drafts.push(order.draftId);
  }
  for (const d of drafts.slice(1)) await log('assign', await s.post(`/api/drafts/${d}/assignment`, { data: {} }));
  for (const d of drafts.slice(1)) {
    const req = await log('stockReq', await s.post(`/api/drafts/${d}/stock-request`, { data: {} }));
    const full = req?.id ? req : await log('stockGet', await s.get(`/api/drafts/${d}`));
    const rq = full?.id && full.lines?.[0]?.lineId ? full : full?.stockConfirmation ?? full;
    const id = rq?.id ?? rq?.requestId;
    console.log('stock shape', JSON.stringify(rq).slice(0, 400));
    await log('claim', await keeper.post(`/api/stock-requests/${id}/claim`));
    const detail = await log('sr', await s.get(`/api/stock-requests/${id}`));
    const lines = (detail?.lines ?? []).map((l: Record<string, unknown>) => ({ lineId: l.lineId ?? l.id, answer: 'IN_STOCK' }));
    await log('respond', await keeper.post(`/api/stock-requests/${id}/respond`, { data: { lines } }));
  }
  if (drafts[1]) {
    const draft = await log('draft1', await s.get(`/api/drafts/${drafts[1]}`));
    const lines = (draft?.lines ?? []).map((l: Record<string, unknown>) => ({ ...l, quantity: 1 }));
    await log('edit1', await s.put(`/api/drafts/${drafts[1]}`, { data: { lines, delivery: draft?.delivery } }));
    await log('reneg', await s.post(`/api/drafts/${drafts[1]}/renegotiate`));
  }
  for (const d of drafts.slice(2)) await log('accept', await s.post(`/api/drafts/${d}/accept`));
  if (drafts[3]) await log('picked', await s.post(`/api/drafts/${drafts[3]}/picked`));
  await log('modeBack', await s.put('/api/delivery/mode', { data: { mode: 'ENABLED' } }));
  await c.delete('/api/portal/cart');
  await put('D-002', 2); await put('D-004', 1); await put('D-001', 1);

  const shoot = async (path: string, name: string, w: number, h: number, act?: () => Promise<void>) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(path);
    await page.waitForTimeout(2500);
    if (act) { await act().catch((e) => console.log('act', name, String(e).slice(0, 200))); await page.waitForTimeout(1200); }
    await page.screenshot({ path: `${shots}/site-${name}.png` });
  };
  await shoot('/catalog', 'catalog', 1440, 900);
  await shoot('/catalog', 'catalog-cart', 1440, 900, () => page.getByRole('button', { name: /Корзина/ }).first().click());
  await shoot('/catalog', 'shops', 1440, 900, () => page.getByRole('button', { name: /Сменить магазин/ }).first().click());
  await shoot(`/catalog/${t.items['D-002'].id}`, 'product', 1440, 3400);
  await shoot('/checkout', 'checkout', 1440, 1660);
  await shoot('/orders', 'orders', 1440, 3300, async () => {
    for (const b of await page.getByRole('button', { name: /Заявка №/ }).all()) await b.click();
  });
  await shoot('/promotions', 'promotions', 1440, 1800);
  await shoot('/favorites', 'favorites', 1440, 900);
  await shoot('/catalog', 'm-catalog', 390, 844);
  await shoot(`/catalog/${t.items['D-002'].id}`, 'm-product', 390, 844);
  await shoot('/checkout', 'm-checkout', 390, 844);
  await shoot('/promotions', 'm-promotions', 390, 1700);
  await shoot('/orders', 'm-orders', 390, 844);
});
