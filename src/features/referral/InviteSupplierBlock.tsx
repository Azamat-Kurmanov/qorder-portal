import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { currentViewer } from '../../auth/oidcConfig';
import { InviteSupplierDialog } from './InviteSupplierDialog';
import { MyReferrals } from './MyReferrals';

/**
 * Под списком поставщиков: предложить ещё одному работать через Q-Order и свои
 * приглашения. Сотруднику, смотрящему свою витрину, не показывается — приглашает человек.
 */
export function InviteSupplierBlock() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (currentViewer() === 'staff') return null;

  return (
    <>
      <Card className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-ink-muted">{t('referral.promo')}</p>
        <Button variant="soft" onClick={() => setOpen(true)}>{t('referral.invite')}</Button>
      </Card>
      <MyReferrals />
      <InviteSupplierDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
