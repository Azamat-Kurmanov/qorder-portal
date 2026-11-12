import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useGetPortalProfile, useGetPortalSuppliers } from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { currentViewer, entryChooseUrl, getUserManager } from '../../auth/oidcConfig';
import { phone as formatPhone } from '../../shared/format';
import { SUPPORTED_LANGUAGES, currentLanguage } from '../../i18n';
import { useAccountLanguage } from '../language/accountLanguage';
import { FONT_SCALES, applyFontScale, currentFontScale, rememberFontScale } from '../../ui/fontScale';
import { chooseTheme, useTheme } from '../../ui/theme';
import { Switch } from '../../ui/Switch';
import { BackTitle } from '../../ui/BackTitle';
import { cn } from '../../ui/cn';
import { ALargeSmall, ChevronLeft, ChevronRight, Globe, LogOut, Moon, Plus, ShieldCheck, Store, User } from '../../ui/icons';
import { useWideScreen } from '../../ui/useWideScreen';
import { useLogoutConfirm } from '../shell/LogoutConfirm';
import { BACK } from '../shell/SectionHead';
import { HOME } from '../../ui/sectionBack';
import { useCurrentShop } from '../shell/Shops';
import { InviteSupplierDialog } from '../referral/InviteSupplierDialog';
import { InvitesPill } from '../shell/Invitations';
import { MyReferrals } from '../referral/MyReferrals';
import { CompanyBlock } from './CompanyBlock';
import { PromoSubscription } from './PromoSubscription';
import { PushBlock } from './PushBlock';
import { ConsentsBlock } from './ConsentsBlock';
import { ProfileCity } from './ProfileCity';

/**
 * Профиль — «Вариант Б» (макеты SimplePicProfile / SimplePicWebProfile): кто вы, магазины,
 * реквизиты, уведомления, согласия и то, как кабинет читается (язык, размер текста, тема).
 *
 * Список магазинов живёт на «Мои магазины» (/shops) — здесь на него одна строка.
 * Монитор: реквизиты слева, остальное справа, как в макете.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const wide = useWideScreen();
  const fromHub = (useLocation().state as { from?: string } | null)?.from === 'all-shops';
  const back = fromHub ? '/all-shops' : HOME;
  const { phone } = useAuth();
  const profile = useGetPortalProfile();
  const name = profile.data?.status === 200 ? profile.data.data.customerName : undefined;
  const number = phone ? formatPhone(phone) : undefined;
  const logoutAsk = useLogoutConfirm();
  const chooseHref = entryChooseUrl();

  const settings = <ReadingSettings />;
  const logout = (
    <button type="button" onClick={logoutAsk.ask}
      className="flex h-16 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-solid border-sale-ink/30 bg-surface text-lead font-extrabold text-sale-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <LogOut aria-hidden="true" className="size-5" />
      {t('profile.logout')}
    </button>
  );
  const switchCabinet = chooseHref ? (
    <a href={chooseHref} className="self-center min-h-11 py-3 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline">
      {t('profile.switchCabinet')}
    </a>
  ) : null;

  if (wide) {
    return (
      <div className="flex flex-col gap-5">
        <BackTitle to={back} title={t('profile.pageTitle')} subtitle={[name, number].filter(Boolean).join(' · ') || undefined} />
        <div className="grid grid-cols-[40rem_minmax(0,1fr)] items-start gap-7">
          <div className="flex flex-col gap-3.5">
            <CompanyBlock />
            <ShopsCard />
            <PasswordBlock />
          </div>
          <div className="flex flex-col gap-3.5">
            <PushBlock />
            <PromoSubscription />
            <ProfileCity />
            {settings}
            <ConsentsBlock />
            <div className="flex gap-3">{logout}</div>
            {switchCabinet}
          </div>
        </div>
        {logoutAsk.sheet}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 pb-4">
      <div className="flex items-center gap-3.5 pt-1 pb-1">
        {/* «Назад» на «Главную» магазина, а из «Все магазины» — обратно в «Дела» (просьба владельца 2026-11-07). */}
        <Link to={back} aria-label={t('common.back')} className={BACK}>
          <ChevronLeft aria-hidden="true" className="size-7" />
        </Link>
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ok-soft text-shop-ink">
          <User className="size-8" />
        </span>
        <span className="flex min-w-0 flex-col">
          <h1 className="m-0 truncate text-title font-extrabold leading-tight text-ink">{name ?? t('profile.pageTitle')}</h1>
          {number ? <span className="text-body text-ink-muted">{number}</span> : null}
        </span>
      </div>
      <ShopsCard />
      <PasswordBlock />
      <CompanyBlock />
      <PushBlock />
      <ConsentsBlock />
      <PromoSubscription />
      <ProfileCity />
      {settings}
      {logout}
      {switchCabinet}
      {logoutAsk.sheet}
    </div>
  );
}

const ROW = 'flex w-full cursor-pointer items-center gap-3.5 bg-transparent px-4 py-3.5 text-left text-ink no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent';

function RowBody({ icon, label, hint, note }: { icon: ReactNode; label: string; hint?: string; note?: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-ok-soft text-shop-ink">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-lead font-extrabold">{label}</b>
        {hint ? <span className="truncate text-caption text-ink-muted">{hint}</span> : null}
        {note}
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-faint" />
    </>
  );
}

/**
 * «Пароль для входа»: задать или сменить — штатной страницей Keycloak (`kc_action=UPDATE_PASSWORD`), без бэкенда.
 * Входящему кодом из WhatsApp пароль не нужен; он для входа по номеру и паролю (docs/work/2026-11-10-login-code-or-password).
 * Сотруднику, смотрящему кабинет, строки нет: его пароль — в realm сотрудников.
 */
export function PasswordBlock() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (currentViewer() === 'staff') return null;
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface">
      <button type="button" disabled={busy} className={ROW} onClick={() => {
        setBusy(true);
        void getUserManager().signinRedirect({
          state: { returnTo: '/profile' },
          extraQueryParams: { kc_action: 'UPDATE_PASSWORD' },
          ui_locales: currentLanguage(),
        }).catch(() => setBusy(false));
      }}>
        <RowBody icon={<ShieldCheck className="size-6" />} label={t('profile.password.title')} hint={t('profile.password.hint')} />
      </button>
    </div>
  );
}

/** «Мои магазины» и «Пригласить поставщика» — одной карточкой, как в макете. */
function ShopsCard() {
  const { t } = useTranslation();
  const suppliers = useGetPortalSuppliers();
  const count = suppliers.data?.status === 200 ? suppliers.data.data.length : 0;
  const shop = useCurrentShop();
  const [inviting, setInviting] = useState(false);
  const staff = currentViewer() === 'staff';
  const hint = [count > 0 ? t('profile.shops', { count }) : null, shop ? t('more.rows.shops', { name: shop.name }) : null]
    .filter(Boolean).join(' · ');
  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface">
        <Link to="/shops" className={ROW}>
          <RowBody icon={<Store className="size-6" />} label={t('more.myShops')} hint={hint || undefined} note={<InvitesPill />} />
        </Link>
        {staff ? null : (
          <button type="button" onClick={() => setInviting(true)} className={cn(ROW, 'border-0 border-t-2 border-solid border-hairline')}>
            <RowBody icon={<Plus className="size-6" />} label={t('more.inviteSupplier')} hint={t('more.rows.invite')} />
          </button>
        )}
      </div>
      {staff ? null : <MyReferrals />}
      <InviteSupplierDialog open={inviting} onOpenChange={setInviting} />
    </>
  );
}

const CHOICE = 'flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-2xl border-[3px] border-solid px-1.5 text-center text-caption font-extrabold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const on = (active: boolean) => (active ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink');

/** Язык, размер текста и тема — крупными кнопками на виду, а не в меню. */
function ReadingSettings() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { save } = useAccountLanguage();
  const language = currentLanguage();
  const [scale, setScale] = useState(currentFontScale);
  const dark = useTheme() === 'dark';
  const heading = (icon: ReactNode, text: string, id?: string) => (
    <b id={id} className="flex items-center gap-1.5 text-lead font-extrabold text-ink">
      <span aria-hidden="true" className="text-shop-ink">{icon}</span>{text}
    </b>
  );
  return (
    <section className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface p-4">
      {heading(<Globe className="size-5" />, t('more.language'))}
      <div role="group" aria-label={t('more.language')} className="flex gap-1.5">
        {SUPPORTED_LANGUAGES.map((lng) => (
          <button key={lng} type="button" aria-pressed={lng === language} className={cn(CHOICE, on(lng === language))}
            onClick={() => {
              if (lng === language) return;
              void i18n.changeLanguage(lng);
              // Ответы сервера переведены по заголовку — старые тексты не должны пережить смену языка.
              queryClient.clear();
              save(lng);
            }}>
            {t(`language.full.${lng}`)}
          </button>
        ))}
      </div>
      {heading(<ALargeSmall className="size-5" />, t('more.fontSize'))}
      <div role="group" aria-label={t('more.fontSize')} className="flex gap-1.5">
        {FONT_SCALES.map((step) => (
          <button key={step} type="button" aria-pressed={step === scale} className={cn(CHOICE, on(step === scale))}
            onClick={() => { setScale(step); applyFontScale(step); rememberFontScale(step); }}>
            {t(`fontScale.${step}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex-1">{heading(<Moon className="size-5" />, t('theme.label'), 'profile-dark')}</span>
        <Switch on={dark} labelledBy="profile-dark" onToggle={() => chooseTheme(dark ? 'light' : 'dark')} />
      </div>
    </section>
  );
}
