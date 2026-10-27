import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import {
  getGetPortalTemplatesQueryKey,
  useSchedulePortalTemplate,
  useUnschedulePortalTemplate,
  type OrderTemplateDto,
} from '../../api/generated';

type Kind = 'WEEKLY' | 'MONTHLY';

const FIELD = cn(
  'h-11 rounded-[var(--radius-control)] border-0 bg-sunk px-3 text-body text-ink',
  'focus:outline-none focus:ring-2 focus:ring-accent',
);

/** «По четвергам в 15:00 · следующий раз 29 октября» — те же слова, что видит продавец. */
export function scheduleText(template: OrderTemplateDto, t: (key: string, options?: Record<string, unknown>) => string, language: string): string | null {
  if (!template.repeatKind || template.repeatDay == null) return null;
  const when = template.repeatKind === 'WEEKLY'
    ? t(`templates.auto.weekday${template.repeatDay}`)
    : t('templates.auto.monthDay', { day: template.repeatDay });
  const text = t('templates.auto.when', { when, time: template.repeatTime?.slice(0, 5) ?? '' });
  return template.nextRunAt
    ? `${text} · ${t('templates.auto.next', { date: new Date(template.nextRunAt).toLocaleDateString(language, { day: 'numeric', month: 'long' }) })}`
    : text;
}

/**
 * Автозаказ шаблона (backend.md §18.28, п. 5): в выбранный день набор сам ложится в корзину
 * и приходит уведомление; заявку клиент отправляет сам — цены и наличие с прошлого раза могли измениться.
 */
export function TemplateSchedule({ template }: { template: OrderTemplateDto }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const text = scheduleText(template, t, i18n.language);

  if (editing) return <ScheduleForm template={template} onDone={() => setEditing(false)} />;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span data-testid="template-schedule" className={cn('text-[0.8125rem]', text ? 'font-semibold text-accent-ink' : 'text-ink-subtle')}>
        {text ? t('templates.auto.on', { text }) : t('templates.auto.off')}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-11 text-[0.8125rem] font-semibold text-accent-ink underline underline-offset-2"
      >
        {t(text ? 'templates.auto.change' : 'templates.auto.set')}
      </button>
    </div>
  );
}

function ScheduleForm({ template, onDone }: { template: OrderTemplateDto; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>(template.repeatKind === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY');
  const [day, setDay] = useState(template.repeatDay ?? 1);
  const [time, setTime] = useState(template.repeatTime?.slice(0, 5) ?? '09:00');
  const [failed, setFailed] = useState(false);
  const done = {
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetPortalTemplatesQueryKey() }); onDone(); },
    onError: () => setFailed(true),
  };
  const save = useSchedulePortalTemplate({ mutation: done });
  const remove = useUnschedulePortalTemplate({ mutation: done });
  const busy = save.isPending || remove.isPending;
  const days = kind === 'WEEKLY' ? [1, 2, 3, 4, 5, 6, 7] : Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <form
      data-testid="template-schedule-form"
      className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-accent-soft/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setFailed(false);
        save.mutate({ id: template.id, data: { kind, day, time } });
      }}
    >
      <p className="text-[0.8125rem] text-ink">{t('templates.auto.explain')}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {t('templates.auto.kind')}
          <select value={kind} className={FIELD} onChange={(event) => { setKind(event.target.value as Kind); setDay(1); }}>
            <option value="WEEKLY">{t('templates.auto.weekly')}</option>
            <option value="MONTHLY">{t('templates.auto.monthly')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {t('templates.auto.day')}
          <select value={day} className={FIELD} onChange={(event) => setDay(Number(event.target.value))}>
            {days.map((value) => (
              <option key={value} value={value}>
                {kind === 'WEEKLY' ? t(`templates.auto.dayName${value}`) : t('templates.auto.dayNumber', { day: value })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {t('templates.auto.time')}
          <input type="time" value={time} required className={FIELD} onChange={(event) => setTime(event.target.value)} />
        </label>
      </div>
      {kind === 'MONTHLY' && day > 28 ? <p className="text-xs text-ink-subtle">{t('templates.auto.shortMonth')}</p> : null}
      {failed ? <p role="alert" className="text-sm text-gone">{t('templates.auto.failed')}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !time}>{t('templates.auto.save')}</Button>
        {template.repeatKind ? (
          <Button type="button" variant="outline" disabled={busy}
            onClick={() => { setFailed(false); remove.mutate({ id: template.id }); }}>
            {t('templates.auto.remove')}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onDone}>{t('templates.auto.cancel')}</Button>
      </div>
    </form>
  );
}
