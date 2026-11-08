import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { InvitesPill } from './Invitations';
import { Link } from 'react-router-dom';
import { useGetPortalDebt } from '../../api/generated';
import { money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { useLogoutConfirm } from './LogoutConfirm';
import {
  Bell, ChevronRight, CircleHelp, ClipboardList, Heart, LayoutTemplate, LogOut, MessageCircle, Plus, Sparkles, Star, Store, Tag,
  Truck, User, Wallet, type IconComponent,
} from '../../ui/icons';
import { BackTitle } from '../../ui/BackTitle';
import { FontScalePicker } from './FontScale';
import { LanguagePicker } from './LanguagePicker';
import { ARRIVALS, useMainSections } from './sections';
import { useCurrentShop } from './Shops';
import { ThemeToggle } from './ThemeToggle';

export const ROW = 'flex min-h-16 w-full items-center gap-3.5 py-2.5 text-left text-base font-extrabold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent';

/** Строка раздела: значок, имя с подсказкой под ним, справа — отметка или стрелка. */
export function Line({ icon: Icon, label, hint, badge, note }: {
  icon: IconComponent; label: string; hint?: string; badge?: ReactNode;
  /** Под подписью — например, плашка приглашения: справа она сжимала бы название. */
  note?: ReactNode;
}) {
  return (
    <>
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-accent-soft text-shop-ink">
        <Icon className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {label}
        {hint && <span className="text-caption font-medium text-ink-muted">{hint}</span>}
        {note}
      </span>
      {badge}
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-ink-faint" />
    </>
  );
}

/** Группа строк под мелким заголовком — как настройки телефона. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="mt-1.5 px-1 text-body font-extrabold text-ink-muted">{title}</h2>
      <ul className="flex flex-col divide-y-2 divide-hairline rounded-[var(--radius-card)] border-2 border-line bg-surface px-4">{children}</ul>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex min-h-16 items-center gap-3 py-2 text-base font-extrabold text-ink">
      <span className="flex-1">{label}</span>
      {children}
    </li>
  );
}

/**
 * «Все разделы» — по «Варианту Б» канвы (SimplePicAllSections): «Назад» и имя магазина,
 * разделы крупными строками по группам (заказы, общение, магазины, мои данные) с подсказкой
 * под названием, ниже — язык, размер текста, тема и звонок в магазин; «Выйти» — справа в заголовке.
 * Оболочка кладёт сюда справку и точку самовывоза (`extras`).
 */
export function MorePage({ others, onInvite, extras }: {
  others: number;
  /** Пригласить поставщика; пусто — сотруднику в просмотре приглашать некого. */
  onInvite?: () => void;
  extras: ReactNode;
}) {
  const { t } = useTranslation();
  const logoutAsk = useLogoutConfirm();
  const shop = useCurrentShop();
  const currency = useSupplierCurrency();
  const { arrivals, sections } = useMainSections(true);
  const promotionsOn = sections.some((section) => section.path === '/promotions');
  const debt = useGetPortalDebt();
  const owed = debt.data?.status === 200 && debt.data.data.orders.length > 0 ? debt.data.data.debt : undefined;
  const reviewsOn = shop?.reviews;

  return (
    <div className="flex flex-col gap-3 pb-20">
      {/* «Выйти» — справа в заголовке, небольшим действием (решение владельца 2026-11-07): наверху, где его ищут, но не главной плашкой. */}
      <BackTitle
        title={t('shell.tabs.more')}
        subtitle={shop ? t('more.shop', { name: shop.name }) : undefined}
        action={(
          <button
            type="button"
            onClick={logoutAsk.ask}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-small)] px-2.5 text-body font-extrabold text-sale-ink hover:bg-sale-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogOut aria-hidden="true" className="size-5" />
            {t('profile.logout')}
          </button>
        )}
      />

      <Group title={t('more.groups.buy')}>
        <Entry to="/orders" icon={ClipboardList} label={t('more.myOrders')} hint={t('more.rows.orders')} />
        <Entry to="/templates" icon={LayoutTemplate} label={t('shell.sections.templates')} hint={t('more.rows.templates')} />
        <Entry to="/favorites" icon={Heart} label={t('shell.sections.favorites')} hint={t('more.rows.favorites')} />
        {owed !== undefined && (
          <Entry to="/debt" icon={Wallet} label={t('shell.sections.debt')} hint={money(owed, currency)} />
        )}
        {promotionsOn && (
          <Entry to="/promotions" icon={Tag} label={t('shell.sections.promotions')} hint={t('more.rows.promotions')} />
        )}
        {arrivals > 0 && (
          <Entry to={ARRIVALS.path} icon={Sparkles} label={t('shell.sections.newArrivals')} hint={t('more.rows.arrivals', { count: arrivals })} />
        )}
      </Group>

      <Group title={t('more.groups.talk')}>
        <Entry to="/messages" icon={MessageCircle} label={t('shell.tabs.messages')} hint={t('more.rows.messages')} />
        <Entry to="/questions" icon={CircleHelp} label={t('shell.sections.questions')} hint={t('more.rows.questions')} />
        {reviewsOn && <Entry to="/reviews" icon={Star} label={t('shell.sections.reviews')} hint={t('more.rows.reviews')} />}
        <Entry to="/notifications" icon={Bell} label={t('notifications.title')} hint={t('more.rows.notifications')} />
      </Group>

      <Group title={t('more.groups.shops')}>
        <Entry to="/shops" icon={Store} label={t('more.myShops')} hint={shop ? t('more.rows.shops', { name: shop.name }) : undefined}
          note={<InvitesPill />}
          badge={others > 0 ? <span role="img" aria-label={t('shell.othersHaveNews')} className="size-3 rounded-full bg-sale" /> : undefined} />
        {onInvite && (
          <li>
            <button type="button" onClick={onInvite} className={ROW}>
              <Line icon={Plus} label={t('more.inviteSupplier')} hint={t('more.rows.invite')} />
            </button>
          </li>
        )}
        <Entry to="/delivery" icon={Truck} label={t('shell.sections.delivery')} hint={t('more.rows.delivery')} />
      </Group>

      <Group title={t('more.groups.me')}>
        <Entry to="/profile" icon={User} label={t('more.profile')} hint={t('more.rows.profile')} />
      </Group>

      <Group title={t('more.groups.settings')}>
        <Row label={t('more.language')}><LanguagePicker /></Row>
        {/* compact — меню раскрывается влево: кнопка стоит у правого края строки. */}
        <Row label={t('more.fontSize')}><FontScalePicker compact /></Row>
        <Row label={t('more.theme')}><ThemeToggle /></Row>
      </Group>

      {extras}
      {logoutAsk.sheet}

    </div>
  );
}

function Entry({ to, ...line }: { to: string; icon: IconComponent; label: string; hint?: string; badge?: ReactNode; note?: ReactNode }) {
  return <li><Link to={to} className={ROW}><Line {...line} /></Link></li>;
}
