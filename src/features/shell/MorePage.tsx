import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useGetPortalProfile } from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { cn } from '../../ui/cn';
import {
  Building2, ChevronRight, Heart, LayoutTemplate, MailPlus, MessageCircleQuestion, Star, Truck, type IconComponent,
} from '../../ui/icons';
import { FontScalePicker } from './FontScale';
import { LanguagePicker } from './LanguagePicker';
import { ARRIVALS, useMainSections } from './sections';
import { useCurrentShop } from './Shops';
import { ThemeToggle } from './ThemeToggle';
import { initialsOf } from './ViewerBadge';

const ROW = 'flex min-h-14 w-full items-center gap-3 py-2 text-left text-[0.9375rem] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent';

/** Строка раздела: значок, имя, справа — отметка или стрелка. */
function Line({ icon: Icon, label, badge }: { icon: IconComponent; label: string; badge?: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-sunk text-accent-ink">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {badge}
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-ink-faint" />
    </>
  );
}

/** Группа строк под мелким заголовком — как настройки телефона. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">{title}</h2>
      <ul className="flex flex-col divide-y divide-hairline rounded-[1.25rem] bg-surface px-3.5">{children}</ul>
    </section>
  );
}

function Row({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex min-h-[3.375rem] items-center gap-3 py-1.5 text-[0.9375rem] font-semibold text-ink', !last && 'border-b border-hairline')}>
      <span className="flex-1">{label}</span>
      {children}
    </div>
  );
}

/**
 * «Ещё» на телефоне — экраном, как в макете К-«Ещё»: кто вошёл и у кого
 * покупает, плитка остальных разделов, настройки и выход. Справку, звонок
 * и точку самовывоза оболочка кладёт сюда же (`extras`): из шапки К1 они ушли.
 */
export function MorePage({ others, onInvite, extras, footer }: {
  others: number;
  /** Пригласить поставщика; пусто — сотруднику в просмотре приглашать некого. */
  onInvite?: () => void;
  extras: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const shop = useCurrentShop();
  const profile = useGetPortalProfile();
  const name = profile.data?.status === 200 ? profile.data.data.customerName : undefined;
  const { arrivals } = useMainSections(true);

  return (
    <div className="flex flex-col gap-4 pb-20">
      <h1 className="sr-only">{t('shell.tabs.more')}</h1>
      <Link to="/profile" className="flex items-center gap-3.5 rounded-[1.5rem] bg-surface p-4 shadow-[2px_3px_6px_rgba(58,48,30,.07)]">
        <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-black text-accent-ink">
          {name ? initialsOf(name) : ''}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[1.1875rem] font-black text-ink">{name ?? t('shell.profile')}</span>
          {shop && <span className="truncate text-[0.8125rem] font-medium text-ink-muted">{t('more.buysFrom', { shop: shop.name })}</span>}
        </span>
      </Link>

      {/* Разделы — списком по группам (макеты «Кабинет клиента 2.0»), а не плиткой:
          плитки всех разделов стоят на «Главной». */}
      <Group title={t('more.groups.buy')}>
        <li><Link to="/favorites" className={ROW}><Line icon={Heart} label={t('shell.sections.favorites')} /></Link></li>
        <li><Link to="/templates" className={ROW}><Line icon={LayoutTemplate} label={t('shell.sections.templates')} /></Link></li>
        {arrivals > 0 && (
          <li>
            <Link to={ARRIVALS.path} className={ROW}>
              <Line icon={ARRIVALS.icon} label={t('shell.sections.newArrivals')}
                badge={<span className="rounded-[var(--radius-pill)] bg-sage-soft px-2 py-0.5 text-xs font-bold text-accent-ink">{arrivals}</span>} />
            </Link>
          </li>
        )}
      </Group>
      <Group title={t('more.groups.talk')}>
        <li><Link to="/questions" className={ROW}><Line icon={MessageCircleQuestion} label={t('shell.sections.questions')} /></Link></li>
        <li><Link to="/reviews" className={ROW}><Line icon={Star} label={t('shell.sections.reviews')} /></Link></li>
      </Group>
      <Group title={t('more.groups.suppliers')}>
        <li>
          <Link to="/profile" className={ROW}>
            <Line icon={Building2} label={t('shell.sections.profile')}
              badge={others > 0 ? <span role="img" aria-label={t('shell.othersHaveNews')} className="size-2.5 rounded-full bg-sale" /> : undefined} />
          </Link>
        </li>
        <li><Link to="/delivery" className={ROW}><Line icon={Truck} label={t('shell.sections.delivery')} /></Link></li>
        {onInvite && (
          <li><button type="button" onClick={onInvite} className={ROW}><Line icon={MailPlus} label={t('more.inviteSupplier')} /></button></li>
        )}
      </Group>

      <h2 className="px-1 pt-1 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">{t('more.groups.settings')}</h2>
      <div className="rounded-[1.375rem] bg-surface px-3.5 py-0.5 shadow-[2px_3px_6px_rgba(58,48,30,.07)]">
        <Row label={t('more.language')}><LanguagePicker /></Row>
        {/* compact — меню раскрывается влево: кнопка стоит у правого края строки. */}
        <Row label={t('more.fontSize')}><FontScalePicker compact /></Row>
        <Row label={t('more.theme')} last><ThemeToggle /></Row>
      </div>

      {extras}

      <button
        type="button"
        onClick={logout}
        className="flex min-h-13 items-center justify-center rounded-[1.125rem] bg-surface text-[0.9375rem] font-bold text-[#B3261E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('profile.logout')}
      </button>

      <div className="flex flex-col items-center gap-1 pt-2">{footer}</div>
    </div>
  );
}
