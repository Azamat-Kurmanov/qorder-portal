import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  useGetMyPortalOrders,
  useGetPortalDebt,
  useGetPortalProfile,
  type PortalOrderDto,
} from '../../api/generated';
import { dayMonth, money } from '../../shared/format';
import { cn } from '../../ui/cn';
import { ChevronDown, ChevronRight, ClipboardList, Clock, LayoutGrid, LogOut, Package, PenLine, Truck, User, Wallet, type IconComponent } from '../../ui/icons';
import { answerText, kindOf } from '../orders/myOrdersModel';
import { useLogoutConfirm } from '../shell/LogoutConfirm';
import { PhoneLine } from '../shell/PhoneLine';
import { ShopTile } from '../shell/ShopTile';
import { useCurrentShop } from '../shell/Shops';
import { HomeCart, HomeMessages, HomeRepeat } from './homeIcons';
import { useAllShops } from '../allShops/useAllShops';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';

/**
 * «Главная» — «Вариант Б» канвы (SimplePicHome, SimplePicWebHome): магазин и его часы,
 * четыре большие плитки (Заказать, Мои заявки, Как в прошлый раз, Вопрос продавцу),
 * карточка заявки, где сейчас главное, долг, если есть, и «Все разделы».
 * Одно главное действие — «Заказать»; всё редкое — во «Всех разделах».
 */
export function HomePage() {
  const { t } = useTranslation();
  const shop = useCurrentShop();
  const tasks = useAllShops()?.open.length ?? 0;
  const logoutAsk = useLogoutConfirm();
  const profile = useGetPortalProfile();
  const name = profile.data?.status === 200 ? profile.data.data.customerName : undefined;

  const orders = useGetMyPortalOrders();
  const list = orders.data?.status === 200 ? orders.data.data : [];
  const going = list.filter((order) => !['done', 'cancelled'].includes(kindOf(order)));
  const current = pickCurrent(going);
  // «Как в прошлый раз» — последняя полученная заявка: там «Заказать то же ещё раз».
  const last = list.filter((order) => kindOf(order) === 'done')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const currency = useSupplierCurrency();
  const debt = useGetPortalDebt();
  const owed = debt.data?.status === 200 && debt.data.data.debt > 0 ? debt.data.data : undefined;
  const due = owed?.plan?.filter((step) => step.left > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  return (
    <div className="flex flex-col gap-2.5 lg:gap-4">
      {logoutAsk.sheet}
      {/*
        Только на телефоне (просьба владельца 2026-11-07): над баннером — кто вошёл (организация или ФИО);
        нажатие раскрывает «Профиль» и под ним «Выйти». На мониторе то же в шапке.
      */}
      <details className="group relative lg:hidden">
        <summary className="qo-hit flex h-12 w-full cursor-pointer list-none items-center gap-2 rounded-full border-2 border-line bg-surface px-3.5 text-body font-extrabold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
          <User aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{name ?? t('shell.profile')}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute inset-x-0 top-full z-20 mt-2 flex flex-col gap-1 rounded-[var(--radius-tile)] border border-line bg-surface p-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,.35)]">
          <Link to="/profile" className="flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] px-3 font-bold text-ink hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <User aria-hidden="true" className="size-5" />
            {t('shell.profile')}
          </Link>
          <button type="button" onClick={logoutAsk.ask}
            className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border-0 bg-transparent px-3 text-left font-extrabold text-sale-ink hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <LogOut aria-hidden="true" className="size-5" />
            {t('profile.logout')}
          </button>
        </div>
      </details>
      {/*
        Баннер магазина (решение владельца 2026-11-05): знак, имя, часы и адрес — внутри обложки цвета
        магазина; в углу — «Другие магазины», внизу справа — номер с кнопкой звонка.
      */}
      {/* ponytail: обложка — цвет и знак магазина; фото-обложку добавить, когда у магазина появится поле для неё. */}
      <section aria-label={shop?.name} className="relative isolate overflow-hidden rounded-[1.75rem] bg-shop text-on-shop">
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(120%_140%_at_100%_0%,rgba(255,255,255,.22),transparent_55%)]" />
        {shop?.logoUrl ? (
          <img src={shop.logoUrl} alt="" aria-hidden="true" className="absolute -right-8 -top-10 -z-10 size-48 rotate-[-8deg] object-contain opacity-15 lg:size-72" />
        ) : (
          <span aria-hidden="true" className="absolute -top-12 right-4 -z-10 select-none text-[12rem] font-black leading-none text-on-shop/10 lg:-top-20 lg:text-[18rem]">
            {shop?.name.replace(/^[^\p{L}]+/u, '').charAt(0)}
          </span>
        )}
        <div className="flex min-h-[7.5rem] flex-col gap-2 p-3 lg:min-h-[12rem] lg:gap-3 lg:p-6">
          {/* «Выйти» с баннера убран (просьба владельца 2026-11-07): на телефоне он в меню над баннером, на мониторе — в шапке. */}
          <div className="flex items-center justify-end gap-2">
          {/* «Другие магазины» стала «Все магазины» (ряд 17 канвы): число — дела во всех магазинах. */}
          <Link to="/all-shops"
            className="qo-hit flex h-9 items-center gap-1.5 rounded-full bg-white pl-3.5 pr-1.5 text-caption font-extrabold text-on-white no-underline shadow-[0_6px_16px_-8px_rgba(0,0,0,.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-shop">
            <LayoutGrid aria-hidden="true" className="size-4" />
            {t('home.allShops')}
            {tasks > 0
              ? <span role="img" aria-label={t('home.allShopsTasks', { count: tasks })} className="flex h-6 min-w-6 items-center justify-center rounded-full bg-sale px-1.5 text-caption text-on-sale">{tasks}</span>
              : <span aria-hidden="true" className="w-2" />}
          </Link>
          </div>
          <div className="mt-auto flex flex-wrap items-end gap-x-6 gap-y-3">
            {/* Название и знак — не ссылка: окно магазинов открывает только «Другие магазины» (просьба владельца 2026-11-05). */}
            <div className="flex min-w-0 flex-1 items-center gap-3.5 lg:gap-4">
              {shop && (
                <ShopTile supplier={shop} alt="" initials className="size-12 shrink-0 rounded-[0.875rem] text-xl ring-[3px] ring-white/80 lg:size-20 lg:rounded-[1.125rem] lg:text-3xl" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-title font-extrabold leading-tight lg:text-display">{shop?.name}</span>
              </span>
            </div>
            {shop?.phone ? (
              <span className="rounded-2xl bg-white/95 py-1.5 pl-3 pr-1.5">
                <PhoneLine phone={shop.phone} />
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* «Все разделы» — сразу под баннером (решение владельца 2026-11-05). */}
      <Link to="/more" className="flex min-h-14 items-center gap-3 rounded-[var(--radius-tile)] border-2 border-line bg-surface px-3.5 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:min-h-16 lg:px-5">
        <LayoutGrid aria-hidden="true" className="size-6 shrink-0 text-shop-ink" />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-body font-extrabold lg:text-lead">{t('home.allSections')}</b>
          <span className="text-caption font-semibold text-ink-muted max-lg:hidden">{t('home.allSectionsHint')}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </Link>

      <h1 className="sr-only">
        {name ? t('home.hello', { name: name.split(' ')[0] }) : t('home.helloAnon')}
      </h1>

      <ul aria-label={t('home.sections')} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <Tile to="/catalog" icon={HomeCart} label={t('home.order')} tone={TILE.order} iconTone={ICON.order} />
        <Tile to="/orders" icon={ClipboardList} label={t('home.myOrders')} tone={TILE.orders} iconTone={ICON.orders}
          badge={going.length || undefined} badgeLabel={t('home.inProgress', { count: going.length })} />
        <Tile to={last ? `/orders/${last.id}` : '/orders'} icon={HomeRepeat} label={t('home.likeLastTime')} tone={TILE.repeat} iconTone={ICON.repeat} />
        <Tile to="/questions" icon={HomeMessages} label={t('home.askSeller')} tone={TILE.ask} iconTone={ICON.ask}
          // Крупнее соседей на телефоне (просьба владельца 2026-11-06): облачко читалось мелким.
          // -my-1.5: крупный значок не сдвигает подпись — она на одной линии с соседней плиткой.
          iconSize="size-11 -my-1.5 lg:my-0 lg:size-11" />
      </ul>

      {/*
        Своё, а не общее (просьба владельца 2026-11-05): под заголовком «Требует внимания», и у каждой карточки
        подпись, к чему она — «Заявка №…» или «Ваш долг магазину».
      */}
      {current || owed ? (
        <section aria-labelledby="home-attention" className="flex flex-col gap-2 lg:gap-3">
          <h2 id="home-attention" className="m-0 mt-1 text-caption font-extrabold uppercase tracking-[0.04em] text-ink-muted lg:text-body">
            {t('home.attention')}
          </h2>
          <div className="grid gap-2.5 lg:grid-cols-2 lg:gap-4">
            {current && <CurrentOrder order={current} />}
            {owed && (
              <Link to="/debt" className="flex items-center gap-3 rounded-[var(--radius-tile)] border-2 border-sale bg-surface px-3.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:gap-4 lg:px-5 lg:py-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sale-soft text-sale-ink lg:size-12">
                  <Wallet className="size-5 lg:size-6" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-caption font-bold text-ink-muted lg:text-caption">{t('home.card.debt')}</span>
                  <b className="text-body font-extrabold text-sale-ink lg:text-lead">{money(owed.debt, currency)}</b>
                  <span className="text-caption text-ink-muted lg:text-body">
                    {due ? t('home.debtDue', { date: dayMonth(due.dueDate) }) : t('home.debtOpen')}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
              </Link>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Цвета плиток «Главной». Временно все белые, как «Мои заявки» (просьба владельца 2026-11-06, на пробу).
 * Откат — вернуть прежние: order 'bg-shop text-on-shop', repeat 'border-hit-ink/25 bg-hit-soft text-hit-ink',
 * ask 'border-ok-ink/25 bg-ok-soft text-ok-ink'.
 */
const WHITE_TILE = 'border-line bg-surface text-ink';
const TILE = { order: WHITE_TILE, orders: WHITE_TILE, repeat: WHITE_TILE, ask: WHITE_TILE };
/**
 * Значки плиток — одним цветом, как значки нижнего меню (третья проба владельца 2026-11-06:
 * «Как в прошлый раз» был янтарным и выпадал). Откат — пустые строки: значок снова цвета текста.
 */
const ICON_TONE = 'text-home-icon';
const ICON = { order: ICON_TONE, orders: ICON_TONE, repeat: ICON_TONE, ask: ICON_TONE };

/** Заявка для карточки: где ход за клиентом — первой, затем готовая, затем самая свежая. */
function pickCurrent(going: PortalOrderDto[]): PortalOrderDto | undefined {
  const rank = (order: PortalOrderDto) => ({ answer: 0, ready: 1, accepted: 2, review: 3 } as Record<string, number>)[kindOf(order)] ?? 4;
  return [...going].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt))[0];
}

function Tile({ to, icon: Icon, label, tone, iconTone, iconSize = 'size-8 lg:size-11', badge, badgeLabel }: {
  to: string;
  icon: IconComponent;
  label: string;
  tone: string;
  /** Цвет одного значка; пусто — цвета текста плитки. */
  iconTone?: string;
  /** Размер значка: телефон и монитор. */
  iconSize?: string;
  badge?: number;
  badgeLabel?: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          // Невысокие плитки (просьба владельца 2026-11-04): вся «Главная» — магазин, плитки, заявка,
          // долг и «Все разделы» — помещается в один экран без прокрутки.
          'relative flex h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border-[3px] border-transparent p-2 text-center',
          'text-lead font-extrabold leading-tight transition-transform hover:-translate-y-0.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          'lg:h-[8.5rem] lg:gap-3 lg:rounded-[1.5rem] lg:text-title',
          tone,
        )}
      >
        {badge ? (
          <span role="img" aria-label={badgeLabel}
            className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-sale px-2 text-body font-extrabold text-on-sale lg:right-4 lg:top-4 lg:h-9 lg:min-w-9">
            {badge}
          </span>
        ) : null}
        <Icon aria-hidden="true" className={cn(iconSize, iconTone)} />
        {label}
      </Link>
    </li>
  );
}

/** Карточка заявки, где сейчас главное: статус словами и что дальше. */
function CurrentOrder({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const kind = kindOf(order);
  const onWay = kind === 'ready' && !order.pickup && !!order.delivery;
  const look: { icon: IconComponent; tone: string; title: string; hint: string } =
    kind === 'answer'
      ? { icon: PenLine, tone: 'bg-sale-soft text-sale-ink', title: answerText(order, t), hint: t('home.card.answerHint') }
      : kind === 'ready'
        ? {
          icon: onWay ? Truck : Package,
          tone: 'bg-ok-soft text-ok-ink',
          title: onWay ? t('home.status.onWay') : t('home.status.ready'),
          hint: order.pickupCode ? t('home.card.code', { code: order.pickupCode }) : '',
        }
        : {
          icon: Clock,
          tone: 'bg-hit-soft text-hit-ink',
          title: kind === 'accepted' ? t('home.status.accepted') : t('home.status.review'),
          hint: '',
        };
  const Icon = look.icon;
  return (
    <Link
      to={`/orders/${order.id}`}
      data-testid="home-current"
      aria-label={`${t('home.yourOrder')}: ${look.title}`}
      className="flex items-center gap-3 rounded-[var(--radius-tile)] border-2 border-shop bg-surface px-3.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:gap-4 lg:px-5 lg:py-3"
    >
      <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full lg:size-12', look.tone)}>
        <Icon className="size-5 lg:size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {/* К чему карточка — номер и сумма заявки; ниже — что случилось и что сделать. */}
        <span className="text-caption font-bold text-ink-muted lg:text-caption">
          {t('home.card.order', { number: order.orderNumber, sum: money(order.total, order.currency) })}
        </span>
        <b className="text-body font-extrabold text-ink lg:text-lead">{look.title}</b>
        {look.hint ? <span className="text-caption text-ink-muted lg:text-body">{look.hint}</span> : null}
      </span>
      <span className="flex h-11 shrink-0 items-center gap-1 rounded-[var(--radius-control)] border-2 border-line px-4 text-body font-extrabold text-ink max-lg:hidden">
        {t('home.look')}<ChevronRight aria-hidden="true" className="size-6" />
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted lg:hidden" />
    </Link>
  );
}
