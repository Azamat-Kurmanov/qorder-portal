import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { MailPlus } from '../../ui/icons';
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
 * Карточка «Новые приглашения» в колонке «Мои магазины».
 *
 * Открывает то же окно магазинов: принять приглашение — это решение
 * с согласием на обработку данных, и принимается оно там, где видно,
 * кто приглашает и что человек подписывает.
 */
export function InvitesCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const invites = usePendingInvitations();
  if (invites.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'mt-1 flex min-h-13 w-full items-center gap-2.5 rounded-[var(--radius-control)] bg-accent-soft px-2 py-1.5 text-left',
        'transition-colors duration-200 hover:bg-accent/15',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      <span className="relative flex size-[2.125rem] shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*5/7)] bg-accent text-on-accent">
        <MailPlus aria-hidden="true" className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-sm font-bold text-accent-ink">
          {t('shops.invites.invites', { count: invites.length })}
        </span>
        <span className="truncate text-xs text-ink-muted">
          {invites.map((invite) => invite.supplier.name).join(', ')}
        </span>
      </span>
    </button>
  );
}

/**
 * Раздел «Новые приглашения» в окне магазинов.
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
    <section aria-labelledby="invites-title" className="flex flex-col gap-2">
      <h3 id="invites-title" className="flex items-center gap-2 px-1 text-sm font-extrabold text-ink">
        <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
        {t('shops.invites.title')}
      </h3>
      {invites.map((invite) => (
        <div
          key={invite.invitationId}
          data-testid="invite-row"
          className="flex flex-wrap items-center gap-3 rounded-[calc(var(--radius-tile)*1.125)] border-[1.5px] border-accent/40 bg-bar p-2.5"
        >
          <ShopTile supplier={invite.supplier} className="size-11 text-lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-base font-bold text-ink">{invite.supplier.name}</span>
            {invite.supplier.tagline && (
              <span className="truncate text-[0.8438rem] text-ink-muted">{invite.supplier.tagline}</span>
            )}
          </span>
          <span className="flex gap-2">
            <Button
              variant="accent"
              disabled={busy || !notice}
              aria-label={t('shops.invites.acceptAria', { name: invite.supplier.name })}
              onClick={() => answer(invite, true)}
            >
              {t('shops.invites.accept')}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              aria-label={t('shops.invites.declineAria', { name: invite.supplier.name })}
              onClick={() => answer(invite, false)}
            >
              {t('shops.invites.decline')}
            </Button>
          </span>
        </div>
      ))}
      <p className="px-1 text-caption leading-normal text-ink-muted">{t('shops.invites.consent')}</p>
      {notice && (
        <details className="rounded-[var(--radius-tile)] bg-sunk px-3 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-accent-ink">
            {t('shops.invites.consentLink')}
          </summary>
          <div className="max-h-60 overflow-y-auto pb-2">
            <ConsentNotice text={notice.text} />
          </div>
        </details>
      )}
      {failed && <p role="alert" className="px-1 text-sm font-semibold text-gone">{t('shops.invites.failed')}</p>}
      {status && <p role="status" className="px-1 text-sm font-semibold text-ok-ink">{status}</p>}
    </section>
  );
}
