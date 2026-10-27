import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrderQueryKey,
  getGetMyPortalOrdersQueryKey,
  useAskAboutMyPortalOrder,
  type PortalOrderDto,
} from '../../api/generated';
import { rules } from '../../api/rules.generated';
import { decimal } from '../../shared/format';
import { quantityWithUnit } from '../../shared/units';
import { Button } from '../../ui/Button';
import { TriangleAlert } from '../../ui/icons';
import { linesOf } from './myOrdersModel';

export const PROBLEMS = ['SHORT', 'DEFECT', 'WRONG', 'OTHER'] as const;
export type Problem = (typeof PROBLEMS)[number];

/**
 * Текст обращения: что случилось, с какими товарами и сколько, подробности.
 * <p>
 * Уходит обычным сообщением в переписку заявки — там, где менеджер уже
 * отвечает клиенту и где клиент ждёт ответа. Отдельной очереди обращений нет:
 * вторая очередь значила бы второе место, куда менеджер забывает смотреть.
 */
export function problemText(
  problem: Problem,
  lines: { name: string; quantity: number; unit?: string }[],
  details: string,
  t: TFunction,
): string {
  return [
    t('orders.problem.message', { kind: t(`orders.problem.kind.${problem}`) }),
    ...lines.map((line) => `— ${line.name}: ${line.unit ? quantityWithUnit(line.quantity, line.unit) : decimal(line.quantity)}`),
    details.trim(),
  ].filter(Boolean).join('\n').slice(0, rules.AskAboutOrderRequest.text.maxLength);
}

/** Количество в пределах строки заказа; пустое и нечисло оставляются как есть — их отсеет отправка. */
function clamp(raw: string, max: number): string {
  const value = Number(raw);
  return raw === '' || Number.isNaN(value) ? raw : String(Math.min(Math.max(value, 0), max));
}

/** «Сообщить о проблеме» у полученной заявки: недовоз, брак, пересорт. */
export function ReportProblem({ order }: { order: PortalOrderDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<Problem>('SHORT');
  // Отмеченные строки и сколько из них с проблемой; по умолчанию — вся строка.
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [details, setDetails] = useState('');
  const lines = linesOf(order);

  const report = useAskAboutMyPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrderQueryKey(order.id) });
        setOpen(false);
        setSent(true);
      },
    },
  });
  const failed = report.isError || (report.data !== undefined && report.data.status !== 200);

  const chosen = Object.entries(picked)
    .map(([index, amount]) => ({ line: lines[Number(index)], amount: Number(amount) }))
    .filter(({ amount }) => amount > 0);
  const ready = chosen.length > 0 || details.trim() !== '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || report.isPending) return;
    report.mutate({
      id: order.id,
      data: {
        text: problemText(problem, chosen.map(({ line, amount }) => ({ name: line.name, quantity: amount, unit: line.unit })),
          details, t),
      },
    });
  };

  if (!open) {
    return (
      <div className="flex basis-full flex-col gap-2">
        {sent ? <p role="status" className="m-0 text-sm text-ink-muted">{t('orders.problem.sent')}</p> : null}
        <Button type="button" variant="outline" className="self-start" onClick={() => { setOpen(true); setSent(false); }}>
          <TriangleAlert aria-hidden="true" className="size-[18px]" />
          {t('orders.problem.open')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${formId}-title`} className="flex basis-full flex-col gap-3">
      <h3 id={`${formId}-title`} className="m-0 text-sm font-semibold text-ink">{t('orders.problem.title')}</h3>

      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">{t('orders.problem.title')}</legend>
        {PROBLEMS.map((kind) => (
          <label key={kind}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border-[1.5px] border-solid border-line px-4 text-[0.8125rem] font-semibold text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name={`${formId}-kind`} value={kind} checked={problem === kind}
              onChange={() => setProblem(kind)} className="sr-only" />
            {t(`orders.problem.kind.${kind}`)}
          </label>
        ))}
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold text-ink">{t('orders.problem.which')}</legend>
        {lines.map((line, index) => {
          const amount = picked[index];
          const checked = amount !== undefined;
          return (
            <div key={`${line.name}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={checked} className="size-4 accent-[var(--color-accent)]"
                  onChange={(event) => setPicked((current) => {
                    const next = { ...current };
                    if (event.target.checked) next[index] = String(line.quantity);
                    else delete next[index];
                    return next;
                  })} />
                <span className="min-w-0">{line.name}</span>
              </label>
              {checked ? (
                <label className="flex items-center gap-2 text-ink-muted">
                  {t('orders.problem.howMany')}
                  <input type="number" inputMode="decimal" min="0" max={line.quantity} step="any" value={amount}
                    // Больше, чем было в заказе, сообщить нельзя: «не довезли 50 из 5» менеджер не разберёт.
                    onChange={(event) => setPicked((current) => ({ ...current, [index]: clamp(event.target.value, line.quantity) }))}
                    className="h-9 w-24 rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-2 text-sm text-ink focus:border-accent focus:outline-none" />
                  {line.unit ?? ''}
                </label>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        {t('orders.problem.details')}
        <textarea rows={3} value={details} maxLength={rules.AskAboutOrderRequest.text.maxLength}
          placeholder={t('orders.problem.detailsPlaceholder')}
          onChange={(event) => setDetails(event.target.value)}
          className="resize-y rounded-[var(--radius-control)] border-[1.5px] border-solid border-line bg-surface px-3 py-2 text-sm font-normal text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none" />
      </label>

      {failed ? <p role="alert" className="m-0 text-sm text-gone">{t('orders.v2.askFailed')}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="accent" disabled={!ready || report.isPending}>
          {report.isPending ? t('orders.sending') : t('orders.problem.send')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t('orders.v2.askCancel')}</Button>
      </div>
    </form>
  );
}
