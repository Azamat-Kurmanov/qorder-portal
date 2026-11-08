import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useGetPortalPhoneStatus, useIssuePortalPhoneCode, type PhoneCodeDto } from '../../api/generated';

function isPhoneRefusal(error: unknown): boolean {
  return (error as { info?: { code?: unknown } } | null)?.info?.code === 'PHONE_NOT_VERIFIED';
}

/**
 * Номер не подтверждён — сервер отказывает почти во всём (`403 PHONE_NOT_VERIFIED`, backend.md §18.28, п. 7).
 * Вместо россыпи «не удалось загрузить» по экранам — одна просьба поверх кабинета: получить код,
 * отправить его магазину в WhatsApp. Обычно номер подтверждён ещё в заявке по ссылке магазина,
 * и экран не появляется вовсе: он ловит только сам отказ.
 */
export function PhoneGate() {
  const queryClient = useQueryClient();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    if (cache.getAll().some((query) => isPhoneRefusal(query.state.error))) setBlocked(true);
    return cache.subscribe((event) => {
      if (event.type === 'updated' && isPhoneRefusal(event.query.state.error)) setBlocked(true);
    });
  }, [queryClient]);

  if (!blocked) return null;
  return <ConfirmPhone onVerified={() => { setBlocked(false); void queryClient.invalidateQueries(); }} />;
}

function ConfirmPhone({ onVerified }: { onVerified: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState<PhoneCodeDto | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const issue = useIssuePortalPhoneCode();
  // Пока код у клиента — спрашиваем раз в 2 секунды (так просит сервер); без кода ждать нечего.
  const status = useGetPortalPhoneStatus({ query: { enabled: code !== null, refetchInterval: 2_000 } });
  const verified = status.data?.status === 200 && status.data.data.verified;

  useEffect(() => { if (verified) onVerified(); }, [verified, onVerified]);

  async function getCode() {
    setFailure(null);
    try {
      const response = await issue.mutateAsync();
      if (response.status === 200) setCode(response.data);
    } catch (error) {
      const reason = (error as { info?: { code?: unknown } } | null)?.info?.code;
      setFailure(reason === 'PHONE_CODE_LIMIT' ? 'joinShop.codeLimit' : reason === 'PHONE_CODE_NO_CHANNEL' ? 'joinShop.noChannel' : 'joinShop.failed');
    }
  }

  const fresh = code && new Date(code.expiresAt).getTime() > Date.now() ? code : null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="phone-gate-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4">
      <Card className="flex w-full max-w-[420px] flex-col gap-4 p-6">
        <h2 id="phone-gate-title" className="text-xl font-semibold tracking-tight text-ink">{t('phoneGate.title')}</h2>
        <p className="text-sm text-ink-muted">{t('phoneGate.lead')}</p>
        {fresh ? (
          <>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink">
              <li>{t('joinShop.confirmStep1')}</li>
              <li>{t('joinShop.confirmStep2', { code: fresh.code })}</li>
              <li>{t('joinShop.confirmStep3')}</li>
            </ol>
            <a href={fresh.waLink} target="_blank" rel="noreferrer"
              className="flex h-12 items-center justify-center rounded-[var(--radius-control)] bg-whatsapp px-4 text-base font-semibold text-white">
              {t('joinShop.openWhatsApp')}
            </a>
            <p role="status" className="text-center text-xs text-ink-faint">{t('joinShop.waiting')}</p>
          </>
        ) : null}
        {failure ? <p role="alert" className="rounded-[var(--radius-control)] border border-gone/30 bg-gone/8 px-3 py-2 text-sm text-ink">{t(failure)}</p> : null}
        {/* Новый код — тихой ссылкой с переносом: кнопкой во всю ширину длинная подпись не помещалась на телефоне. */}
        {fresh ? (
          <button type="button" disabled={issue.isPending} onClick={() => void getCode()}
            className="min-h-11 text-center text-sm font-semibold text-accent-ink underline underline-offset-2 disabled:opacity-50">
            {t('joinShop.newCode')}
          </button>
        ) : (
          <Button size="lg" disabled={issue.isPending} onClick={() => void getCode()}>{t('joinShop.getCode')}</Button>
        )}
      </Card>
    </div>
  );
}
