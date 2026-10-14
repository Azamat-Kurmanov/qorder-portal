import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  useReportPortalTransportPayment,
  type TransportPaymentDto,
} from '../../api/generated';
import { apiRequest } from '../../api/client';
import { rules } from '../../api/rules.generated';
import { fileNameFrom, saveFile } from '../../shared/download';
import type { Currency } from '../../shared/currency';
import { money } from '../../shared/format';

/** «2026-10-05» → «05.10.2026»: срок в квитанции — календарная дата, без часового пояса. */
function day(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

const INPUT = 'h-10 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-sm text-ink';

/**
 * Оплата перевозки для клиента: квитанция продавца и «Я оплатил».
 * Ход и переходы — на сервере; блок показывает его ответ и шлёт сообщение об оплате.
 */
export function TransportPayment({ orderId, payment, currency }: {
  orderId: string;
  payment: TransportPaymentDto;
  currency: Currency | undefined;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const refId = useId();
  const paidAtId = useId();
  const commentId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ paymentRef: '', paidAt: '', comment: '' });
  const [failed, setFailed] = useState<string | null>(null);
  const [fileFailed, setFileFailed] = useState(false);

  async function openFile(url: string, index: number) {
    setFileFailed(false);
    try {
      const file = await apiRequest<{ data: Blob; headers: Headers }>(url);
      await saveFile(file.data, fileNameFrom(file.headers, `receipt-${index + 1}`));
    } catch {
      setFileFailed(true);
    }
  }
  const report = useReportPortalTransportPayment({
    mutation: {
      onMutate: () => setFailed(null),
      // Текст отказа сервер уже перевёл и назвал причину — показываем его.
      onError: (error) => {
        const detail = (error as { info?: { detail?: unknown } } | null)?.info?.detail;
        setFailed(typeof detail === 'string' && detail ? detail : t('orders.payment.failed'));
      },
      onSuccess: () => {
        setOpen(false);
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrderQueryKey(orderId) });
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
      },
    },
  });
  const receipt = payment.receipt;
  // Квитанция бывает и файлом посредника (снимок бумажной или PDF): по ней тоже платят.
  const files = payment.receiptFiles ?? [];
  const canReport = (!!receipt || files.length > 0)
    && (payment.status === 'AWAITING_PAYMENT' || payment.status === 'REJECTED');
  const limits = rules.PaymentReportRequest;
  const blank = (value: string) => value.trim() || undefined;

  return (
    <div data-testid="transport-payment" className="flex flex-col gap-2 text-sm text-ink">
      <span className="text-xs font-semibold uppercase tracking-[.06em] text-ink-subtle">{t('orders.payment.title')}</span>
      {payment.status === 'REJECTED'
        ? <span className="text-ink">{t('orders.payment.rejected', { reason: payment.rejectionReason ?? '' })}</span>
        : payment.control !== 'DATA_ONLY' || payment.status === 'AWAITING_RECEIPT'
          ? <span className="text-ink-muted">{t(`orders.payment.status.${payment.status}`)}</span>
          : null}
      {receipt ? (
        <div data-testid="transport-receipt" className="flex flex-col gap-1">
          <span className="font-semibold">{money(receipt.amount, currency)} · {receipt.payee}</span>
          {receipt.requisites ? <span className="whitespace-pre-line text-ink-muted">{receipt.requisites}</span> : null}
          {receipt.number ? <span className="text-ink-muted">{t('orders.payment.number', { number: receipt.number })}</span> : null}
          {receipt.dueDate ? <span className="text-ink-muted">{t('orders.payment.due', { date: day(receipt.dueDate) })}</span> : null}
          {receipt.comment ? <span className="text-ink-muted">{receipt.comment}</span> : null}
          {receipt.payUrl ? (
            <a href={receipt.payUrl} target="_blank" rel="noopener noreferrer"
              className="font-semibold text-accent-ink hover:underline">{t('orders.payment.payOnline')}</a>
          ) : null}
        </div>
      ) : null}
      {files.length ? (
        <div data-testid="transport-receipt-files" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-ink-muted">{t('orders.payment.files')}</span>
          {/* Квитанция — персональные данные: файл отдаётся только через свой заказ
              с токеном, поэтому скачивается вызовом, а не переходом по ссылке. */}
          {files.map((url, index) => (
            <button key={url} type="button" onClick={() => void openFile(url, index)}
              className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent-ink hover:underline">
              {t('orders.payment.file', { index: index + 1 })}
            </button>
          ))}
          {fileFailed ? <p role="alert" className="m-0 w-full text-sm text-gone">{t('orders.payment.fileFailed')}</p> : null}
        </div>
      ) : null}
      {canReport && !open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="self-start rounded-[var(--radius-control)] border border-hairline px-4 py-2 font-semibold text-ink">
          {t('orders.payment.paid')}
        </button>
      ) : null}
      {canReport && open ? (
        <form className="flex flex-col gap-2" onSubmit={(event) => {
          event.preventDefault();
          report.mutate({ id: orderId, data: {
            paymentRef: blank(form.paymentRef), paidAt: blank(form.paidAt), comment: blank(form.comment),
          } });
        }}>
          <label htmlFor={refId} className="text-xs text-ink-subtle">{t('orders.payment.paymentRef')}</label>
          <input id={refId} className={INPUT} value={form.paymentRef} maxLength={limits.paymentRef?.maxLength}
            onChange={(event) => setForm({ ...form, paymentRef: event.currentTarget.value })} />
          <label htmlFor={paidAtId} className="text-xs text-ink-subtle">{t('orders.payment.paidAt')}</label>
          <input id={paidAtId} type="date" className={INPUT} value={form.paidAt}
            onChange={(event) => setForm({ ...form, paidAt: event.currentTarget.value })} />
          <label htmlFor={commentId} className="text-xs text-ink-subtle">{t('orders.payment.comment')}</label>
          <input id={commentId} className={INPUT} value={form.comment} maxLength={limits.comment?.maxLength}
            onChange={(event) => setForm({ ...form, comment: event.currentTarget.value })} />
          {failed ? <p role="alert" className="m-0 text-sm text-gone">{failed}</p> : null}
          <button type="submit" disabled={report.isPending}
            className="self-start rounded-[var(--radius-control)] bg-accent px-4 py-2 font-semibold text-on-accent disabled:opacity-50">
            {t('orders.payment.send')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
