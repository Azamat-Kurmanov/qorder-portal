import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalNotificationsQueryKey,
  getGetPortalOverviewQueryKey,
  getGetPortalUnreadSummaryQueryKey,
  readPortalNotification,
  useGetPortalProfile,
  type PortalSupplierDto,
} from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { BACK } from '../shell/SectionHead';
import { cn } from '../../ui/cn';
import { useWideScreen } from '../../ui/useWideScreen';
import { dayMonth, money, shortDate } from '../../shared/format';
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, MessageCircle, PenLine, Store, User, Wallet, type IconComponent } from '../../ui/icons';
import { LOOKS, reasonOf } from '../notifications/NotificationsBell';
import { ShopTile, useShops } from '../shell/Shops';
import { SuppliersPage } from '../shell/SuppliersPage';
import { type GroupKey, type Overview, type Task } from './overviewModel';
import { localToday, useAllShops } from './useAllShops';

/**
 * «Все магазины» — дела и сообщения клиента по всем его поставщикам (ряд 17 канвы, вариант 3).
 *
 * Дела разбираются до нуля: «осталось N», затем «Всё разобрано». Нажатие открывает нужный
 * магазин сразу на нужном экране и гасит плашку. Сообщения — к сведению, строкой на магазин.
 * Заказывают только внутри магазина: здесь — только то, что ждёт клиента.
 */
export function AllShopsPage({ onSwitch }: { onSwitch: (supplierId: string) => void }) {
  const wide = useWideScreen();
  const [params, setParams] = useSearchParams();
  // Главный раздел — «Магазины» (просьба владельца 2026-11-07).
  const view = params.get('view') ?? 'shops';
  const overview = useAllShops();
  const { list } = useShops();
  const shops = new Map(list.map((shop) => [shop.supplierId, shop]));
  const go = (next: string) => setParams({ view: next });

  let content: ReactNode = null;
  if (view === 'shops') {
    content = <SuppliersPage onSwitch={onSwitch} back={false} />;
  } else if (overview) {
    const group = view.startsWith('group:') ? overview.groups.find((g) => `group:${g.key}` === view) : undefined;
    const tasks = <TasksPane overview={overview} shops={shops} go={go} withMessages={!wide} />;
    const messages = <MessagesPane overview={overview} shops={shops} />;
    if (group) content = <GroupScreen group={group.key} tasks={group.tasks} shops={shops} />;
    else if (view === 'debts') content = <DebtsScreen overview={overview} shops={shops} />;
    else if (view === 'step') content = <StepScreen overview={overview} shops={shops} onDone={() => go('tasks')} />;
    else {
      content = (
        <div className="flex flex-col gap-4">
          {!wide && <HubHead />}
          {view === 'messages' ? messages
            : wide ? <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-7">{tasks}{messages}</div>
            : tasks}
        </div>
      );
    }
  }

  const counts = { tasks: overview?.open.length ?? 0, messages: overview?.messages.length ?? 0 };
  const active = view === 'messages' ? 'messages' : view === 'shops' ? 'shops' : view === 'debts' ? 'debts' : 'tasks';
  return wide ? (
    <div className="flex min-h-screen bg-canvas">
      <HubSide active={active} counts={counts} go={go} shopCount={list.length} />
      <main className="min-w-0 flex-1 px-8 py-7"><div className="mx-auto max-w-[72rem]">{content}</div></main>
    </div>
  ) : (
    <div className="min-h-screen bg-canvas">
      <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">{content}</main>
      <HubBottom active={active} counts={counts} go={go} />
    </div>
  );
}

const TASKS_ICON = CheckCircle2;

/** Шапка раздела на телефоне: кто вошёл и сколько магазинов, справа — вернуться в открытый магазин. */
function HubHead() {
  const { t } = useTranslation();
  const name = useCustomerName();
  const { list, current } = useShops();
  return (
    <div className="flex items-center gap-3 pt-1">
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ok-soft text-lead font-extrabold text-ok-ink">{initials(name)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <h1 className="m-0 truncate text-title font-extrabold leading-tight">{name ?? t('allShops.title')}</h1>
        <span className="text-caption text-ink-muted">{t('allShops.shops', { count: list.length })}</span>
      </span>
      {current && (
        <Link to="/home" aria-label={t('allShops.backToShop', { name: current.name })} title={t('allShops.backToShop', { name: current.name })}
          className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] border-2 border-line bg-surface">
          <ShopTile supplier={current} className="size-8 rounded-lg text-sm" />
        </Link>
      )}
    </div>
  );
}

function useCustomerName(): string | undefined {
  const profile = useGetPortalProfile();
  return profile.data?.status === 200 ? profile.data.data.customerName : undefined;
}

function initials(name?: string): string {
  const words = (name ?? '').replace(/[«»"„“”']/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() || '·';
}

type HubKey = 'tasks' | 'messages' | 'shops' | 'debts';
type HubProps = { active: HubKey; counts: { tasks: number; messages: number }; go: (view: string) => void };

/** Нижнее меню раздела на телефоне: Магазины (главный) · Сообщения · Дела · Профиль. */
function HubBottom({ active, counts, go }: HubProps) {
  const { t } = useTranslation();
  const tab = (on: boolean) => cn(
    'relative flex min-h-16 flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent text-xs font-semibold no-underline',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
    on ? 'font-extrabold text-platform' : 'text-ink-muted',
  );
  const badge = (count: number, label: string) => count > 0 && (
    <span role="img" aria-label={label}
      className="absolute left-[calc(50%+6px)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-sale px-1.5 text-xs font-extrabold text-on-sale">{count}</span>
  );
  const items: { key: HubKey; icon: IconComponent; count?: number }[] = [
    { key: 'shops', icon: Store },
    { key: 'messages', icon: MessageCircle, count: counts.messages },
    { key: 'tasks', icon: TASKS_ICON, count: counts.tasks },
  ];
  return (
    <nav aria-label={t('allShops.nav')} className="fixed inset-x-0 bottom-0 z-30 flex bg-surface px-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--color-hairline)]">
      {items.map(({ key, icon: Icon, count }) => (
        <button key={key} type="button" onClick={() => go(key)} aria-current={active === key ? 'page' : undefined} className={tab(active === key)}>
          <Icon aria-hidden="true" className="size-6 text-platform" />
          {t(`allShops.tabs.${key}`)}
          {count !== undefined && badge(count, t(`allShops.tabs.${key}`) + ': ' + count)}
        </button>
      ))}
      <Link to="/profile" state={FROM_HUB} className={tab(false)}>
        <User aria-hidden="true" className="size-6 text-platform" />
        {t('allShops.tabs.profile')}
      </Link>
    </nav>
  );
}

/** Боковое меню раздела на мониторе: кто вошёл, Магазины (главный), Сообщения, Дела, Долги; внизу — Профиль. */
function HubSide({ active, counts, go, shopCount }: HubProps & { shopCount: number }) {
  const { t } = useTranslation();
  const name = useCustomerName();
  const { current } = useShops();
  const item = (on: boolean) => cn(
    'flex h-13 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border-0 px-3.5 text-left text-body no-underline',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    on ? 'bg-ok-soft font-extrabold text-ok-ink' : 'bg-transparent font-bold text-ink hover:bg-sunk',
  );
  const items: { key: HubKey; icon: IconComponent; count?: number }[] = [
    { key: 'shops', icon: Store },
    { key: 'messages', icon: MessageCircle, count: counts.messages },
    { key: 'tasks', icon: TASKS_ICON, count: counts.tasks },
    { key: 'debts', icon: Wallet },
  ];
  return (
    <aside className="sticky top-0 flex h-screen w-[17rem] shrink-0 flex-col gap-1.5 border-r-2 border-hairline bg-surface px-4 py-5">
      <div className="flex items-center gap-3 px-1.5 pb-4">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ok-soft text-lead font-extrabold text-ok-ink">{initials(name)}</span>
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-lead">{name ?? t('allShops.title')}</b>
          <span className="text-caption text-ink-muted">{t('allShops.shops', { count: shopCount })}</span>
        </span>
      </div>
      <nav aria-label={t('allShops.nav')} className="flex flex-col gap-1">
        {items.map(({ key, icon: Icon, count }) => (
          <button key={key} type="button" onClick={() => go(key)} aria-current={active === key ? 'page' : undefined} className={item(active === key)}>
            <Icon aria-hidden="true" className="size-6 shrink-0 text-platform" />
            <span className="flex-1">{t(`allShops.tabs.${key}`)}</span>
            {count ? <span className="rounded-[var(--radius-pill)] bg-sale px-2 text-caption font-extrabold text-on-sale">{count}</span> : null}
          </button>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        {current && (
          <Link to="/home" className={item(false)}>
            <ShopTile supplier={current} className="size-6 shrink-0 rounded-md text-xs" />
            <span className="min-w-0 flex-1 truncate">{t('allShops.backToShop', { name: current.name })}</span>
          </Link>
        )}
        <Link to="/profile" state={FROM_HUB} className={item(false)}>
          <User aria-hidden="true" className="size-6 shrink-0 text-platform" />
          {t('allShops.tabs.profile')}
        </Link>
      </div>
    </aside>
  );
}

/** Открыть дело: плашки гасятся в своём магазине, магазин выбирается, экран открывается. */
/** Профиль, открытый отсюда, возвращает «Назад» в «Дела», а не на «Главную» магазина. */
const FROM_HUB = { from: 'all-shops' };

function useOpenInShop() {
  const { select } = useSupplier();
  const navigate = useNavigate();
  const seen = useMarkSeen();
  return (supplierId: string, to: string, read: string[]) => {
    void seen(supplierId, read);
    select(supplierId);
    navigate(to);
  };
}

/** Отметить прочитанным в магазине `supplierId`, не переключаясь в него. */
function useMarkSeen() {
  const queryClient = useQueryClient();
  return async (supplierId: string, ids: string[]) => {
    await Promise.all(ids.map((id) => readPortalNotification(id, { headers: { 'X-Supplier-Id': supplierId } }).catch(() => undefined)));
    void queryClient.invalidateQueries({ queryKey: getGetPortalOverviewQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetPortalUnreadSummaryQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() });
  };
}

const GROUP_LOOK: Record<GroupKey, { icon: IconComponent; tone: string }> = {
  overdue: { icon: Clock, tone: 'bg-sale-soft text-sale-ink' },
  dueSoon: { icon: Wallet, tone: 'bg-hit-soft text-hit-ink' },
  invoices: { icon: FileText, tone: 'bg-hit-soft text-hit-ink' },
  decisions: { icon: PenLine, tone: 'bg-accent-soft text-accent-ink' },
  answers: { icon: MessageCircle, tone: 'bg-accent-soft text-accent-ink' },
};

type Shops = Map<string, PortalSupplierDto>;

/** Сумма по валютам магазинов: у поставщиков валюты могут различаться. */
function sumOf(items: { supplierId: string; amount?: number }[], shops: Shops): string {
  const by = new Map<string, number>();
  for (const item of items) {
    if (!item.amount) continue;
    const currency = shops.get(item.supplierId)?.currency ?? 'KZT';
    by.set(currency, (by.get(currency) ?? 0) + item.amount);
  }
  return [...by].map(([currency, value]) => money(value, currency as PortalSupplierDto['currency'])).join(' + ');
}

/** Заголовок вложенного экрана: «Назад» — к сводке «Все магазины», а не на «Главную». */
function SubTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3.5 pt-1">
      <Link to="/all-shops?view=tasks" aria-label={t('common.back')} className={BACK}>
        <ChevronLeft aria-hidden="true" className="size-7" />
        <span aria-hidden="true" className="hidden lg:inline">{t('common.back')}</span>
      </Link>
      <span className="flex min-w-0 flex-1 flex-col">
        <h1 className="m-0 text-title font-extrabold leading-tight text-ink lg:text-display">{title}</h1>
        {subtitle ? <span className="text-caption text-ink-muted">{subtitle}</span> : null}
      </span>
    </div>
  );
}

function nameOf(shops: Shops, id: string): string {
  return shops.get(id)?.name ?? '';
}

function TasksPane({ overview, shops, go, withMessages }: { overview: Overview; shops: Shops; go: (view: string) => void; withMessages: boolean }) {
  const { t } = useTranslation();
  // На телефоне колонки «Сообщения» рядом нет — без этой строки их видно только числом в нижнем меню.
  const messagesLink = withMessages && overview.messages.length > 0 && (
    <button type="button" onClick={() => go('messages')}
      className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-1 text-left text-body font-bold text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <MessageCircle aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{t('allShops.messagesLine', { count: overview.messages.length })}</span>
      <span className="font-extrabold text-accent-ink">{t('allShops.open')}</span>
    </button>
  );
  const debtTotal = sumOf(overview.debts.map((d) => ({ supplierId: d.supplierId, amount: d.debt })), shops);
  const debtLink = overview.debts.length > 0 && (
    <button type="button" onClick={() => go('debts')}
      className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-1 text-left text-body font-bold text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <Wallet aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{t('allShops.debtLine', { sum: debtTotal, count: overview.debts.length })}</span>
      <span className="font-extrabold text-accent-ink">{t('allShops.open')}</span>
    </button>
  );

  if (overview.open.length === 0) {
    return (
      <section aria-labelledby="all-done" className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-gallery)] border-2 border-ok/30 bg-ok-soft px-5 py-7 text-center text-ok-ink">
          <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-platform text-white"><Check className="size-9" /></span>
          <h2 id="all-done" className="m-0 text-title font-extrabold">{t('allShops.done.title')}</h2>
          <p className="m-0 text-body">{t('allShops.done.note', { count: shops.size })}</p>
        </div>
        {overview.groups.length > 0 && <Groups overview={overview} shops={shops} go={go} />}
        {messagesLink}
        {debtLink}
      </section>
    );
  }

  return (
    <section aria-label={t('allShops.tabs.tasks')} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-[var(--radius-gallery)] bg-platform bg-[radial-gradient(120%_140%_at_100%_0%,rgba(255,255,255,.22),transparent_55%)] p-4 text-white">
        <p className="m-0 flex items-baseline gap-2.5">
          <b className="text-[2.5rem] leading-none">{overview.open.length}</b>
          <span className="text-lead font-extrabold">{t('allShops.left', { count: overview.open.length })}</span>
        </p>
        <button type="button" onClick={() => go('step')}
          className="flex h-13 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border-0 bg-surface text-lead font-extrabold text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          {t('allShops.oneByOne')}<ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      <Groups overview={overview} shops={shops} go={go} />
      {messagesLink}
      {debtLink}
    </section>
  );
}

function Groups({ overview, shops, go }: { overview: Overview; shops: Shops; go: (view: string) => void }) {
  const { t } = useTranslation();
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {overview.groups.map(({ key, tasks }) => {
        const look = GROUP_LOOK[key];
        const Icon = look.icon;
        const waiting = tasks.filter((task) => !task.sent);
        const ids = [...new Set(tasks.map((task) => task.supplierId))];
        const sum = sumOf(waiting, shops);
        const names = ids.slice(0, 3).map((id) => nameOf(shops, id)).join(', ') + (ids.length > 3 ? ` +${ids.length - 3}` : '');
        return (
          <li key={key}>
            <button type="button" onClick={() => go(`group:${key}`)}
              className={cn(
                'flex min-h-19 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-tile)] border-2 bg-surface px-3.5 py-2.5 text-left',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                key === 'overdue' ? 'border-sale-line' : 'border-hairline',
              )}>
              <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', look.tone)}><Icon className="size-6" /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className={cn('text-lead leading-tight', key === 'overdue' && 'text-sale-ink')}>
                  {t(`allShops.groups.${dueWord(key, tasks)}`, { count: waiting.length || tasks.length })}
                </b>
                <span className="truncate text-caption text-ink-muted">
                  {sum && <b className="font-extrabold text-ink">{sum} · </b>}{names}
                </span>
              </span>
              <Stack ids={ids} shops={shops} />
              <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** «Сегодня», «Завтра» или «Сегодня и завтра» — по срокам платежей группы. */
function dueWord(key: GroupKey, tasks: Task[]): string {
  if (key !== 'dueSoon') return key;
  const today = localToday();
  const days = new Set(tasks.map((task) => (task.due === today ? 'today' : 'tomorrow')));
  return days.size > 1 ? 'dueSoon' : days.has('today') ? 'dueToday' : 'dueTomorrow';
}

function Stack({ ids, shops }: { ids: string[]; shops: Shops }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      {ids.slice(0, 3).map((id, index) => {
        const shop = shops.get(id);
        return shop ? (
          <ShopTile key={id} supplier={shop} className={cn('size-8 rounded-lg text-sm ring-2 ring-surface', index > 0 && '-ml-2')} />
        ) : null;
      })}
      {ids.length > 3 && <span className="-ml-2 flex size-8 items-center justify-center rounded-lg bg-sunk text-caption font-extrabold text-ink-muted ring-2 ring-surface">+{ids.length - 3}</span>}
    </span>
  );
}

/** Одно дело строкой: магазин, что ждёт и кнопка, открывающая его в магазине. */
function TaskLine({ task, shops }: { task: Task; shops: Shops }) {
  const { t } = useTranslation();
  const open = useOpenInShop();
  const shop = shops.get(task.supplierId);
  const what = task.sent ? t('allShops.sentNote') : task.notification
    ? reasonOf(task.notification.kind, t, task.notification.detail)
    : task.due ? t('allShops.payTask', { date: dayMonth(task.due) }) : t('allShops.overdueLine');
  return (
    <li className={cn('flex min-h-19 items-center gap-3 rounded-[var(--radius-tile)] border-2 border-hairline bg-surface px-3.5 py-2.5', task.sent && 'opacity-75')}>
      {shop && <ShopTile supplier={shop} className="size-11 shrink-0 rounded-xl text-lg" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-body leading-tight">{shop?.name}</b>
        <span className="text-caption text-ink-muted">{what}</span>
        {task.amount !== undefined && <b className="text-body tabular-nums">{money(task.amount, shop?.currency)}</b>}
      </span>
      {task.sent ? (
        <span className="flex items-center gap-1 text-caption font-extrabold text-ok-ink"><CheckCircle2 aria-hidden="true" className="size-5" />{t('allShops.sent')}</span>
      ) : (
        <button type="button" onClick={() => open(task.supplierId, task.to, task.read)}
          className="h-11 shrink-0 cursor-pointer rounded-[var(--radius-control)] border-0 bg-platform px-4 font-extrabold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {t(task.group === 'overdue' || task.group === 'dueSoon' || task.group === 'invoices' ? 'allShops.pay' : 'allShops.look')}
        </button>
      )}
    </li>
  );
}

function GroupScreen({ group, tasks, shops }: { group: GroupKey; tasks: Task[]; shops: Shops }) {
  const { t } = useTranslation();
  const waiting = tasks.filter((task) => !task.sent).length;
  const payments = group === 'overdue' || group === 'dueSoon';
  return (
    <div className="flex flex-col gap-3">
      <SubTitle title={t(`allShops.groups.${dueWord(group, tasks)}`, { count: waiting || tasks.length })}
        subtitle={payments ? t('allShops.eachSeller') : undefined} />
      {payments && tasks.length > 1 && (
        <p className="m-0 flex items-center gap-2.5 font-extrabold">
          {t('allShops.paidOf', { done: tasks.length - waiting, count: tasks.length })}
          <span role="progressbar" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={tasks.length - waiting}
            aria-label={t('allShops.paidOf', { done: tasks.length - waiting, count: tasks.length })}
            className="h-2.5 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-line">
            <span className="block h-full rounded-[var(--radius-pill)] bg-platform" style={{ width: `${((tasks.length - waiting) * 100) / tasks.length}%` }} />
          </span>
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {tasks.map((task) => <TaskLine key={task.key} task={task} shops={shops} />)}
      </ul>
      {payments && <p className="m-0 text-caption text-ink-muted">{t('allShops.payNote')}</p>}
    </div>
  );
}

/** «Разобрать по одному»: дело за делом, «Позже» откладывает до следующего захода. */
function StepScreen({ overview, shops, onDone }: { overview: Overview; shops: Shops; onDone: () => void }) {
  const { t } = useTranslation();
  const open = useOpenInShop();
  const [index, setIndex] = useState(0);
  const task = overview.open[index];
  if (!task) {
    return (
      <div className="flex flex-col gap-4">
        <SubTitle title={t('allShops.title')} />
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-gallery)] bg-ok-soft px-5 py-8 text-center text-ok-ink">
          <CheckCircle2 aria-hidden="true" className="size-12" />
          <p className="m-0 text-lead font-extrabold">{t('allShops.stepEnd')}</p>
          <button type="button" onClick={onDone} className="h-12 cursor-pointer rounded-[var(--radius-control)] border-0 bg-platform px-6 font-extrabold text-white">{t('allShops.toTasks')}</button>
        </div>
      </div>
    );
  }
  const shop = shops.get(task.supplierId);
  const what = task.sent ? t('allShops.sentNote') : task.notification
    ? reasonOf(task.notification.kind, t, task.notification.detail)
    : task.due ? t('allShops.payTask', { date: dayMonth(task.due) }) : t('allShops.overdueLine');
  const next = overview.open[index + 1];
  return (
    <div className="flex flex-col gap-4">
      <SubTitle title={t('allShops.stepTitle', { n: index + 1, count: overview.open.length })} />
      <section className="flex flex-col gap-3.5 rounded-[var(--radius-gallery)] border-2 border-hairline bg-surface p-5">
        <div className="flex items-center gap-3">
          {shop && <ShopTile supplier={shop} className="size-14 shrink-0 rounded-2xl text-2xl" />}
          <span className="min-w-0">
            <span className="block text-caption text-ink-muted">{what}</span>
            <b className="block text-title leading-tight">{shop?.name}</b>
          </span>
        </div>
        {task.amount !== undefined && <b className="text-[2.25rem] leading-none tabular-nums">{money(task.amount, shop?.currency)}</b>}
        {task.notification && <span className="text-caption text-ink-muted">{shortDate(task.notification.createdAt)}</span>}
        <button type="button" onClick={() => open(task.supplierId, task.to, task.read)}
          className="h-14 cursor-pointer rounded-[var(--radius-control)] border-0 bg-platform text-lead font-extrabold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {t(task.group === 'overdue' || task.group === 'dueSoon' || task.group === 'invoices' ? 'allShops.pay' : 'allShops.look')}
        </button>
        <button type="button" onClick={() => setIndex(index + 1)}
          className="h-12 cursor-pointer rounded-[var(--radius-control)] border-2 border-line bg-surface font-extrabold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {t('allShops.later')}
        </button>
      </section>
      {next && <p className="m-0 text-center text-caption text-ink-muted">{t('allShops.next', { name: nameOf(shops, next.supplierId) })}</p>}
    </div>
  );
}

function MessagesPane({ overview, shops }: { overview: Overview; shops: Shops }) {
  const { t } = useTranslation();
  const seen = useMarkSeen();
  const open = useOpenInShop();
  const all = overview.messages;
  return (
    <section aria-labelledby="all-messages" className="flex flex-col gap-3">
      <h2 id="all-messages" className="m-0 text-lead font-extrabold">{t('allShops.messagesTitle', { count: all.length })}</h2>
      <div className="flex items-center gap-3">
        <p className="m-0 flex-1 text-caption text-ink-muted">{t('allShops.messagesNote')}</p>
        {all.length > 0 && (
          <button type="button" onClick={() => all.forEach((m) => void seen(m.supplierId, m.items.map((n) => n.id)))}
            className="h-11 shrink-0 cursor-pointer rounded-[var(--radius-control)] border-2 border-line bg-surface px-3 text-caption font-extrabold text-ink">
            {t('allShops.allSeen')}
          </button>
        )}
      </div>
      {all.length === 0 && <p className="m-0 rounded-[var(--radius-card)] border-2 border-hairline bg-surface p-5 text-ink-muted">{t('allShops.noMessages')}</p>}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {all.map((message) => {
          const shop = shops.get(message.supplierId);
          return (
            <li key={message.supplierId}>
              <details className="group rounded-[var(--radius-tile)] border-2 border-hairline bg-surface open:border-accent">
                <summary className="flex min-h-17 cursor-pointer list-none items-center gap-3 px-3.5 py-2 [&::-webkit-details-marker]:hidden">
                  {shop && <ShopTile supplier={shop} className="size-11 shrink-0 rounded-xl text-lg" />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-body leading-tight">{shop?.name}</b>
                    <span className="truncate text-caption text-ink-muted">{message.items.map((n) => reasonOf(n.kind, t, n.detail)).join(' · ')}</span>
                  </span>
                  <span className="rounded-[var(--radius-pill)] bg-sale px-2 text-caption font-extrabold text-on-sale">{message.items.length}</span>
                  <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="m-0 flex list-none flex-col px-3.5 pb-3 pt-1">
                  {message.items.map((n) => {
                    const look = LOOKS[n.kind];
                    const Icon = look?.icon ?? MessageCircle;
                    return (
                      <li key={n.id} className="flex items-center gap-2.5 border-t border-hairline py-2">
                        <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', look?.tone ?? 'bg-sunk text-ink-muted')}><Icon className="size-4" /></span>
                        <span className="min-w-0 flex-1 text-caption font-bold">{reasonOf(n.kind, t, n.detail)}</span>
                        <span className="text-caption text-ink-muted">{shortDate(n.createdAt)}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex gap-2 px-3.5 pb-3.5">
                  <button type="button" onClick={() => void seen(message.supplierId, message.items.map((n) => n.id))}
                    className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] border-0 bg-accent-soft font-extrabold text-accent-ink">
                    <Check aria-hidden="true" className="size-4" />{t('allShops.seen')}
                  </button>
                  <button type="button" onClick={() => open(message.supplierId, '/home', message.items.map((n) => n.id))}
                    className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] border-2 border-line bg-surface font-extrabold text-ink">
                    <Store aria-hidden="true" className="size-4" />{t('allShops.toShop')}
                  </button>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      <Link to="/shops" className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-line bg-surface font-extrabold text-ink">
        <Store aria-hidden="true" className="size-5" />{t('allShops.myShops', { count: shops.size })}
      </Link>
    </section>
  );
}

function DebtsScreen({ overview, shops }: { overview: Overview; shops: Shops }) {
  const { t } = useTranslation();
  const open = useOpenInShop();
  const total = sumOf(overview.debts.map((d) => ({ supplierId: d.supplierId, amount: d.debt })), shops);
  const overdue = sumOf(overview.debts.map((d) => ({ supplierId: d.supplierId, amount: d.overdue })), shops);
  return (
    <div className="flex flex-col gap-3">
      <SubTitle title={t('allShops.debts.title')} subtitle={t('allShops.debts.in', { count: overview.debts.length })} />
      <section className="flex flex-col gap-1 rounded-[var(--radius-card)] border-2 border-sale-line bg-sale-soft p-4 text-sale-ink">
        <span className="text-body font-bold">{t('allShops.debts.total')}</span>
        <b className="text-[2.125rem] leading-none tabular-nums">{total}</b>
        {overdue && <span className="text-caption font-extrabold">{t('allShops.debts.overdue', { sum: overdue })}</span>}
      </section>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {overview.debts.map((debt) => {
          const shop = shops.get(debt.supplierId);
          const line = debt.overdue > 0
            ? t('allShops.debts.overdueLine', { sum: money(debt.overdue, shop?.currency) })
            : debt.nextDue ? t('allShops.payBy', { date: dayMonth(debt.nextDue) }) : t('allShops.debts.noDate');
          return (
            <li key={debt.supplierId}>
              <button type="button" onClick={() => open(debt.supplierId, '/debt', [])}
                className={cn(
                  'flex min-h-17 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-tile)] border-2 bg-surface px-3.5 py-2 text-left',
                  debt.overdue > 0 ? 'border-sale-line' : 'border-hairline',
                )}>
                {shop && <ShopTile supplier={shop} className="size-11 shrink-0 rounded-xl text-lg" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-body leading-tight">{shop?.name}</b>
                  <span className={cn('text-caption', debt.overdue > 0 ? 'font-bold text-sale-ink' : 'text-ink-muted')}>{line}</span>
                </span>
                <b className="text-body tabular-nums">{money(debt.debt, shop?.currency)}</b>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-caption text-ink-muted">{t('allShops.debts.note')}</p>
    </div>
  );
}
