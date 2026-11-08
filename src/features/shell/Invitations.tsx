import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalPendingInvitationsQueryKey,
  getGetPortalSuppliersQueryKey,
  getGetPortalUnreadSummaryQueryKey,
  useAcceptPortalPendingInvitation,
  useDeclinePortalPendingInvitation,
  useGetPortalConsentNotice,
  useGetPortalPendingInvitations,
  type PendingInvitationDto,
} from '../../api/generated';
import { ConsentNotice } from '../activation/ConsentNotice';
import { ShopTile } from './ShopTile';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { MailPlus } from '../../ui/icons';

/**
 * Приглашения других магазинов, которые ждут ответа.
 *
 * Спрашиваются без заголовка поставщика: вопрос «кто меня пригласил» задаётся
 * раньше выбора магазина. Отказ сервера — пустой список: приглашений не видно,
 * а кабинет работает как работал.
 */
export function usePendingInvitations(): PendingInvitationDto[] {
  const pending = useGetPortalPendingInvitations();
  return pending.data?.status === 200 && Array.isArray(pending.data.data) ? pending.data.data : [];
}

/**
 * Плашка «N новое приглашение» у входов в «Мои магазины» (Ещё, Профиль, шапка):
 * клиент видит приглашение, не открывая окно магазинов. Нет приглашений — ничего.
 */
export function InvitesPill({ onClick }: { onClick?: () => void }) {
  const { t } = useTranslation();
  const count = usePendingInvitations().length;
  if (count === 0) return null;
  const pill = 'mt-1 self-start shrink-0 whitespace-nowrap rounded-full border-0 bg-accent px-2 py-0.5 text-caption font-bold text-on-accent';
  const text = t('shops.invites.invites', { count });
  return onClick
    ? <button type="button" data-testid="invites-pill" onClick={onClick} aria-haspopup="dialog"
        className={`${pill} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}>{text}</button>
    : <span data-testid="invites-pill" className={pill}>{text}</span>;
}

/**
 * Раздел приглашений («Поставщик приглашает вас стать его клиентом») в окне магазинов.
 *
 * «Принять» открывает кабинет у магазина с согласием на обработку данных —
 * тем же, что при входе по ссылке; текст уведомления раскрывается здесь же.
 * «Отклонить» гасит приглашение: продавец видит, что ссылку закрыл покупатель.
 */
export function InvitesSection({ onAccepted }: { onAccepted: (supplierId: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const invites = usePendingInvitations();
  const noticeQuery = useGetPortalConsentNotice({ query: { enabled: invites.length > 0 } });
  const notice = noticeQuery.data?.status === 200 ? noticeQuery.data.data : undefined;
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetPortalPendingInvitationsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetPortalSuppliersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetPortalUnreadSummaryQueryKey() });
  };
  const accept = useAcceptPortalPendingInvitation();
  const decline = useDeclinePortalPendingInvitation();
  const busy = accept.isPending || decline.isPending;

  if (invites.length === 0) {
    return status ? <p role="status" className="px-1 text-sm font-semibold text-ok-ink">{status}</p> : null;
  }

  function answer(invite: PendingInvitationDto, yes: boolean) {
    setFailed(false);
    const name = invite.supplier.name;
    if (yes) {
      if (!notice) return;
      accept.mutate(
        { data: { invitationId: invite.invitationId, consentVersion: notice.version } },
        {
          onSuccess: (response) => {
            if (response.status !== 200) {
              setFailed(true);
              return;
            }
            setStatus(t('shops.invites.accepted', { name }));
            refresh();
            onAccepted(invite.supplier.supplierId);
          },
          onError: () => setFailed(true),
        },
      );
    } else {
      decline.mutate(
        { data: { invitationId: invite.invitationId } },
        {
          onSuccess: (response) => {
            if (response.status !== 204) {
              setFailed(true);
              return;
            }
            setStatus(t('shops.invites.declined', { name }));
            refresh();
          },
          onError: () => setFailed(true),
        },
      );
    }
  }

  return (
    <section aria-label={t('shops.invites.label')} className="flex flex-col gap-3">
      {invites.map((invite) => (
        <InviteCard
          key={invite.invitationId}
          invite={invite}
          busy={busy}
          noticeText={notice?.text}
          canAccept={!!notice}
          onAnswer={(yes) => answer(invite, yes)}
        />
      ))}
      {failed && <p role="alert" className="px-1 text-sm font-semibold text-gone">{t('shops.invites.failed')}</p>}
      {status && <p role="status" className="px-1 text-sm font-semibold text-ok-ink">{status}</p>}
    </section>
  );
}

/**
 * Одно приглашение — одной карточкой: кто зовёт, до какого числа, что это даст и два ответа.
 *
 * Главное действие крупно и первым, отказ — красной обводкой рядом, без заливки: случайный отказ гасит
 * приглашение насовсем, а случайное принятие ничего не стоит. Согласие на обработку данных —
 * одной строкой под кнопками, текст уведомления раскрывается в самой карточке: принимают его
 * здесь, и уходить ради него некуда.
 *
 * Раскладка — по ширине самой карточки (@container), а не экрана: в узком окне «Мои магазины»
 * на мониторе она та же, что на телефоне.
 */
function InviteCard({ invite, busy, noticeText, canAccept, onAnswer }: {
  invite: PendingInvitationDto;
  busy: boolean;
  noticeText?: string;
  canAccept: boolean;
  onAnswer: (yes: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const name = invite.supplier.name;
  const until = new Date(invite.expiresAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ru', { day: 'numeric', month: 'long' });
  return (
    <article
      data-testid="invite-row"
      className={cn(
        '@container relative overflow-hidden rounded-[var(--radius-card)] border-2 border-accent/30 bg-surface shadow-soft',
        'bg-[linear-gradient(135deg,var(--color-accent-soft)_0%,var(--color-surface)_60%)]',
      )}
    >
      <div className="flex flex-col gap-4 p-4 @md:p-5 @3xl:flex-row @3xl:items-center @3xl:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3 @md:gap-4">
          <ShopTile supplier={invite.supplier} initials className="size-12 shrink-0 rounded-xl text-lg shadow-soft @md:size-16 @md:rounded-2xl @md:text-xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-pill)] bg-accent px-2.5 py-0.5 text-xs font-bold text-on-accent">
              <MailPlus aria-hidden="true" className="size-3.5" />
              {t('shops.invites.badge')}
            </span>
            <h3 className="m-0 text-base font-extrabold leading-snug text-ink @md:text-xl">
              {t('shops.invites.cardTitle', { name })}
            </h3>
            <p className="m-0 text-sm text-ink-muted">
              {invite.supplier.tagline ? `${invite.supplier.tagline} · ` : ''}{t('shops.invites.until', { date: until })}
            </p>
            <p className="m-0 text-sm text-ink">{t('shops.invites.benefit')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 @md:flex-row @3xl:shrink-0">
          <Button
            variant="accent"
            size="lg"
            className="w-full @md:w-auto"
            disabled={busy || !canAccept}
            aria-label={t('shops.invites.acceptAria', { name })}
            onClick={() => onAnswer(true)}
          >
            {t('shops.invites.accept')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-gone/50 text-gone hover:border-gone hover:bg-gone/8 @md:w-auto"
            disabled={busy}
            aria-label={t('shops.invites.declineAria', { name })}
            onClick={() => onAnswer(false)}
          >
            {t('shops.invites.decline')}
          </Button>
        </div>
      </div>
      <div className="border-t border-accent/15 px-4 py-2.5 @md:px-5">
        <p className="m-0 text-caption leading-normal text-ink-muted">
          {t('shops.invites.consent')}{' '}
          {noticeText && (
            <button
              type="button"
              aria-expanded={noticeOpen}
              onClick={() => setNoticeOpen((was) => !was)}
              className="-my-2 cursor-pointer border-0 bg-transparent px-0 py-2 font-semibold text-accent-ink underline underline-offset-2"
            >
              {t(noticeOpen ? 'shops.invites.consentHide' : 'shops.invites.consentLink')}
            </button>
          )}
        </p>
        {noticeOpen && noticeText && (
          <div className="mt-2 max-h-60 overflow-y-auto rounded-[var(--radius-tile)] bg-sunk px-3 py-2">
            <ConsentNotice text={noticeText} />
          </div>
        )}
      </div>
    </article>
  );
}
