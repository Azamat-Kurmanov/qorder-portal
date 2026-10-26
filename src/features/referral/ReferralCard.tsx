import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../ui/icons';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useAuth } from '../../auth/useAuth';
import { currentViewer } from '../../auth/oidcConfig';
import { InviteSupplierDialog } from './InviteSupplierDialog';

const KEY = 'q-order.portal.referral-card.';

function closedFor(who: string): boolean {
  try {
    return window.localStorage.getItem(KEY + who) === '1';
  } catch {
    return false;
  }
}

/**
 * «Удобно? Позовите остальных» — у подтверждённой заявки, пока человек не закрыл.
 * Закрытие помнит браузер: на другом устройстве карточка покажется ещё раз — не страшно.
 */
export function ReferralCard({ confirmed }: { confirmed: boolean }) {
  const { t } = useTranslation();
  const { phone } = useAuth();
  const who = phone ?? 'anonymous';
  const [closed, setClosed] = useState(() => closedFor(who));
  const [inviting, setInviting] = useState(false);

  if (!confirmed || closed || currentViewer() === 'staff') return null;

  function close() {
    setClosed(true);
    try {
      window.localStorage.setItem(KEY + who, '1');
    } catch {
      // Хранилище закрыто — карточка скрыта до перезагрузки, и только.
    }
  }

  return (
    <Card className="flex items-center gap-3 p-4">
      <p className="flex-1 text-sm font-medium text-ink">{t('referral.cardTitle')}</p>
      <Button variant="soft" onClick={() => setInviting(true)}>{t('referral.cardInvite')}</Button>
      <button
        type="button"
        aria-label={t('referral.cardClose')}
        onClick={close}
        className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-ink/5"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
      <InviteSupplierDialog open={inviting} onOpenChange={setInviting} />
    </Card>
  );
}
