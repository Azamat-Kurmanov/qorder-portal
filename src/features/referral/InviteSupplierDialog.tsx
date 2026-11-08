import { useEffect, useId, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { ChevronLeft } from '../../ui/icons';
import { useWideScreen } from '../../ui/useWideScreen';
import { MyReferrals } from './MyReferrals';
import { cn } from '../../ui/cn';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { rules } from '../../api/rules.generated';
import {
  getListMyReferralsQueryKey,
  useCreateReferral,
  useGetPortalProfile,
  type ReferralDto,
} from '../../api/generated';
import { referralMessage, whatsappHref } from './referralText';

/** Константой: `reset` формы зависит от начальных значений, и новый объект на каждой отрисовке зациклил бы подстановку имени. */
const EMPTY = { referrerName: '', label: '' };

const INPUT = 'h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-base text-ink';
/** Телефон — по макету: поле на мягкой подложке внутри белой карточки. */
const PHONE_INPUT = 'h-13 w-full rounded-[0.875rem] border-0 bg-canvas px-3.5 text-base font-semibold text-ink';
const PHONE_CARD = 'flex flex-col gap-2.5 rounded-[1.375rem] bg-surface p-3.5 border-2 border-solid border-hairline';

/** Отказ сервера словами: два предела человеку есть чем объяснить, остальное — одним текстом. */
function failureKey(error: unknown): string {
  const code = (error as { info?: { code?: unknown } } | null)?.info?.code;
  if (code === 'REFERRAL_DAILY_LIMIT') return 'referral.dailyLimit';
  if (code === 'REFERRAL_LIVE_LIMIT') return 'referral.liveLimit';
  return 'referral.failed';
}

/**
 * Окно приглашения своего поставщика в Q-Order.
 * <p>
 * Приглашение создаётся по нажатию, а не при открытии окна: открыл и передумал —
 * ничего не осталось. Созданное помнится до закрытия окна, и «Скопировать»
 * после «Отправить» не заводит второе.
 */
export function InviteSupplierDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const queryClient = useQueryClient();
  const profile = useGetPortalProfile({ query: { enabled: open } });
  const customerName = profile.data?.status === 200 ? profile.data.data.customerName ?? '' : '';
  const form = useFormRules({
    schema: rules.CreateReferralRequest,
    initial: EMPTY,
  });
  const [show, setShow] = useState(true);
  const [made, setMade] = useState<ReferralDto | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState('');
  const create = useCreateReferral();
  const { reset } = form;
  // Телефон — экраном по макету «Пригласить поставщика»; монитор — прежним листом.
  const wide = useWideScreen();
  const input = wide ? INPUT : PHONE_INPUT;

  // Название — то, под которым клиента знает нынешний поставщик; поправить можно.
  useEffect(() => {
    if (customerName) reset({ referrerName: customerName, label: '' });
  }, [customerName, reset]);

  function close(next: boolean) {
    if (!next) {
      setMade(null);
      setFailure(null);
      setCopied(false);
      setQr('');
    }
    onOpenChange(next);
  }

  async function ensure(): Promise<ReferralDto | null> {
    if (made) return made;
    if (!form.validate()) return null;
    setFailure(null);
    try {
      const response = await create.mutateAsync({
        data: {
          referrerName: form.values.referrerName.trim() || undefined,
          showReferrer: show,
          label: form.values.label.trim() || undefined,
        },
      });
      const referral = response.data as ReferralDto;
      setMade(referral);
      void queryClient.invalidateQueries({ queryKey: getListMyReferralsQueryKey() });
      return referral;
    } catch (error) {
      form.applyServerFault(error);
      setFailure(failureKey(error));
      return null;
    }
  }

  async function sendWhatsapp() {
    const referral = await ensure();
    if (referral) window.open(whatsappHref(referralMessage(referral.link, t)), '_blank', 'noopener');
  }

  async function copy() {
    const referral = await ensure();
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.link);
      setCopied(true);
    } catch {
      // Буфер закрыт браузером — ссылка и так видна в окне, её можно выделить.
    }
  }

  /** QR несёт ту же ссылку, что и WhatsApp: поставщик наводит любую камеру. bwip-js тяжёлый — грузится по нажатию. */
  async function showQr() {
    const referral = await ensure();
    if (!referral) return;
    try {
      const bwip = await import('bwip-js/browser');
      setQr(bwip.toSVG({ bcid: 'qrcode', text: referral.link, scale: 4 }));
    } catch {
      // Не нарисовался — ссылка на виду, её можно отправить или скопировать.
    }
  }

  const label = wide ? 'text-sm font-medium text-ink' : 'text-xs font-bold text-ink-muted';
  const nameCard = (
    <div className={wide ? 'flex flex-col gap-4' : PHONE_CARD}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className={label}>{t('referral.nameLabel')}</label>
        <input
          id={`${id}-name`}
          value={form.values.referrerName}
          onChange={(event) => form.field('referrerName').onChange(event.currentTarget.value)}
          onBlur={form.field('referrerName').onBlur}
          aria-invalid={form.faults.referrerName ? 'true' : 'false'}
          className={input}
        />
        <FieldFaultText fault={form.faults.referrerName} name="referrerName" />
      </div>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={show}
          onChange={(event) => setShow(event.currentTarget.checked)}
          className="mt-0.5 size-5 accent-[var(--color-brand)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className={wide ? undefined : 'font-semibold'}>{t('referral.showLabel')}</span>
          <span className="text-xs text-ink-muted">{t('referral.showNote')}</span>
        </span>
      </label>
    </div>
  );
  const labelCard = (
    <div className={wide ? 'flex flex-col gap-1.5' : PHONE_CARD}>
      <label htmlFor={`${id}-label`} className={label}>{t('referral.labelLabel')}</label>
      <input
        id={`${id}-label`}
        value={form.values.label}
        onChange={(event) => form.field('label').onChange(event.currentTarget.value)}
        onBlur={form.field('label').onBlur}
        aria-invalid={form.faults.label ? 'true' : 'false'}
        className={input}
      />
      <span className="text-xs text-ink-muted">{t('referral.labelHint')}</span>
      <FieldFaultText fault={form.faults.label} name="label" />
    </div>
  );
  const notes = (
    <>
      {failure && (
        <p role="alert" className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink">
          {t(failure)}
        </p>
      )}
      {qr && (
        <div className="flex flex-col items-center gap-2 rounded-[1.375rem] border-2 border-hairline bg-surface p-4 text-center">
          <div role="img" aria-label={t('referral.qrAlt')} data-testid="referral-qr"
            className="size-56 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <span className="text-sm font-semibold text-ink">{t('referral.qrHint')}</span>
        </div>
      )}
      {made && (
        // Вкладку мог не открыть браузер — ссылка остаётся на виду.
        <div className="flex flex-col gap-1 rounded-[var(--radius-control)] bg-sunk px-3 py-2.5 text-sm">
          <span className="text-ink-muted">{t('referral.ready')}</span>
          <span className={cn('break-all font-medium text-ink')}>{made.link}</span>
        </div>
      )}
    </>
  );
  const actions = (
    <>
      {/* Главная — во всю ширину: в узкой панели монитора три кнопки в ряд сжимали её. */}
      <Button size="lg" className={cn('w-full', !wide && 'bg-ok-ink text-on-ink hover:bg-ok-ink/90')} disabled={create.isPending} onClick={() => void sendWhatsapp()}>
        {create.isPending ? t('referral.sending') : t('referral.send')}
      </Button>
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* На телефоне, как в макете, копирование — тихой ссылкой под главной кнопкой. */}
        <Button size="lg" variant={wide ? 'outline' : 'ghost'} className="sm:flex-1" disabled={create.isPending} onClick={() => void copy()}>
          {t('referral.copy')}
        </Button>
        {/* Поставщик рядом — показать код с экрана быстрее, чем пересылать ссылку. */}
        <Button size="lg" variant={wide ? 'outline' : 'ghost'} className="sm:flex-1" disabled={create.isPending || Boolean(qr)} onClick={() => void showQr()}>
          {t('referral.showQr')}
        </Button>
      </div>
      {copied && <p role="status" className="text-sm text-ink-muted">{t('referral.copied')}</p>}
    </>
  );

  if (wide) {
    return (
      <Sheet open={open} onOpenChange={close} title={t('referral.title')}>
        <div className="flex flex-col gap-4">
          {nameCard}
          {labelCard}
          {notes}
          {actions}
        </div>
      </Sheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Content aria-describedby={`${id}-sub`} className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-canvas">
          <header className="flex items-center gap-3 bg-surface px-4 pb-3.5 pt-[calc(0.875rem+env(safe-area-inset-top))] shadow-[0_4px_16px_rgba(58,48,30,.06)]">
            <Dialog.Close
              aria-label={t('catalog.back')}
              className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-canvas text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft aria-hidden="true" className="size-[1.375rem]" />
            </Dialog.Close>
            <span className="flex min-w-0 flex-col gap-0.5">
              <Dialog.Title className="text-title font-black tracking-[-0.02em] text-ink">{t('referral.title')}</Dialog.Title>
              <p id={`${id}-sub`} className="text-caption text-ink-muted">{t('referral.subtitle')}</p>
            </span>
          </header>
          {/* Листается весь экран: кнопки идут за полями, а не закреплены внизу. */}
          <div className="flex flex-col gap-2.5 px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3.5">
            {nameCard}
            {labelCard}
            {notes}
            <div className="flex flex-col gap-2">{actions}</div>
            <MyReferrals />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
