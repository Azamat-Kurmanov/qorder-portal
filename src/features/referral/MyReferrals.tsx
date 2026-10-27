import { intlLocale } from '../../i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { X } from '../../ui/icons';
import { Card } from '../../ui/Card';
import {
  getListMyReferralsQueryKey,
  useDeleteMyReferral,
  useListMyReferrals,
  type ReferralDto,
} from '../../api/generated';

/** Погасить можно, пока поставщик не оставил заявку: после неё ссылка уже его. */
const REMOVABLE = new Set(['SENT', 'OPENED']);

function stateKey(referral: ReferralDto): string {
  return referral.invited ? 'referral.state.INVITED' : `referral.state.${referral.status}`;
}

/** Свои приглашения поставщиков, новые сверху. Пустой список — ни строки. */
export function MyReferrals() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const list = useListMyReferrals();
  const remove = useDeleteMyReferral({
    mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListMyReferralsQueryKey() }) },
  });
  const [copied, setCopied] = useState<string | null>(null);
  const rows = list.data?.status === 200 ? list.data.data : [];

  if (rows.length === 0) return null;

  async function copy(referral: ReferralDto) {
    try {
      await navigator.clipboard.writeText(referral.link);
      setCopied(referral.id);
    } catch {
      // Буфер закрыт браузером — повторить нечем, кнопка просто не сработала.
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold text-ink">{t('referral.mine')}</h2>
      {rows.map((referral) => {
        const removable = REMOVABLE.has(referral.status);
        return (
          <Card key={referral.id} data-testid="referral-row" className="flex items-center gap-3 p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-ink">{referral.label || t('referral.noLabel')}</span>
              <span className="text-xs text-ink-muted">
                {new Date(referral.createdAt).toLocaleDateString(intlLocale())} · {t(stateKey(referral))}
              </span>
            </div>
            {removable && (
              <button
                type="button"
                onClick={() => void copy(referral)}
                className="text-sm font-semibold text-[var(--color-brand)]"
              >
                {copied === referral.id ? t('referral.copied') : t('referral.copy')}
              </button>
            )}
            {removable && (
              <button
                type="button"
                aria-label={t('referral.remove')}
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: referral.id })}
                className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-ink/5"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </Card>
        );
      })}
    </section>
  );
}
