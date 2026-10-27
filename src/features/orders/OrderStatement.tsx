import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadMyOrderStatement } from '../../api/generated';
import { fileNameFrom, saveFile } from '../../shared/download';
import { Button } from '../../ui/Button';

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Выписка по заказам за период — PDF: заказы, оплаты, которые отметил продавец, и остаток.
 * Справочно, не акт сверки: акт составляет продавец в своём учёте, и экран так и говорит.
 */
export function OrderStatement() {
  const { t } = useTranslation();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="md" className="self-start" onClick={() => setOpen(true)}>
        {t('orders.statement.open')}
      </Button>
    );
  }

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const file = await downloadMyOrderStatement({ from, to });
      if (file.status !== 200) {
        setFailed(true);
        return;
      }
      await saveFile(file.data, fileNameFrom(file.headers, `statement-${from}-${to}.pdf`));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${formId}-title`} data-testid="order-statement"
      className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <h2 id={`${formId}-title`} className="m-0 text-base font-bold text-ink">{t('orders.statement.title')}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
          {t('orders.statement.from')}
          <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)}
            className="h-10 rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-3 text-sm font-normal text-ink focus:border-accent focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
          {t('orders.statement.to')}
          <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)}
            className="h-10 rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-3 text-sm font-normal text-ink focus:border-accent focus:outline-none" />
        </label>
        <Button variant="accent" disabled={busy || !from || !to || from > to} onClick={() => void download()}>
          {busy ? t('orders.statement.preparing') : t('orders.statement.download')}
        </Button>
      </div>
      <p className="m-0 text-caption text-ink-muted">{t('orders.statement.note')}</p>
      {failed ? <p role="alert" className="m-0 text-sm text-gone">{t('orders.statement.failed')}</p> : null}
    </section>
  );
}
