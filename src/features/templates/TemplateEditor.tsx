import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalTemplatesQueryKey,
  useGetPortalCatalog,
  useGetPortalTemplateLines,
  useUpdatePortalTemplate,
  type OrderTemplateDto,
  type ShowcaseItemDto,
  type TemplateLineDto,
} from '../../api/generated';
import { quantityWithUnit } from '../../shared/units';
import { firstValid, quantityProblem } from './quantityRule';
import { rules } from '../../api/rules.generated';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

const FIELD = 'h-11 w-full rounded-[var(--radius-control)] border-0 bg-sunk px-3 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent';

/** Строка шаблона на экране правки; у добавленного из каталога известен минимум заказа. */
type EditLine = TemplateLineDto;

/**
 * Правка шаблона прямо в его карточке: название, количество каждой позиции, «убрать»
 * и «найти и добавить товар» из каталога магазина.
 */
export function TemplateEditor({ template, onDone }: { template: OrderTemplateDto; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const response = useGetPortalTemplateLines(template.id);
  const loaded: TemplateLineDto[] | undefined = response.data?.status === 200 ? response.data.data : undefined;
  const [name, setName] = useState(template.name);
  // Правки поверх загруженного: количество строкой поля, убранные — отдельным списком.
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<EditLine[]>([]);
  const [query, setQuery] = useState('');
  const searching = query.trim().length >= 2;
  const found = useGetPortalCatalog({ query: query.trim(), size: 6 }, { query: { enabled: searching } });
  const results: ShowcaseItemDto[] = searching && found.data?.status === 200 ? found.data.data.items ?? [] : [];
  const update = useUpdatePortalTemplate({
    mutation: {
      onSuccess: (result) => {
        if (result.status !== 200) return;
        void queryClient.invalidateQueries({ queryKey: getGetPortalTemplatesQueryKey() });
        onDone();
      },
    },
  });

  if (!loaded) return <p className="m-0 text-sm text-ink-subtle">{t('templates.edit.loading')}</p>;
  const left: EditLine[] = [...loaded, ...added].filter((line) => !removed.includes(line.itemId));
  const has = (itemId: string) => left.some((line) => line.itemId === itemId);
  const quantityOf = (line: EditLine) => quantities[line.itemId] ?? String(line.quantity);
  const ruleOf = (line: EditLine) => ({ min: line.minQuantity, step: line.quantityStep });
  const bad = (line: EditLine) => quantityProblem(Number(quantityOf(line).replace(',', '.')), ruleOf(line)) !== null;
  /** Подсказка о правиле товара: «не меньше 10 кг, по 10 кг» — её видно до ошибки, а не после. */
  const hintOf = (line: EditLine) => {
    const unit = line.unit ?? '';
    const min = line.minQuantity && line.minQuantity > 1 ? line.minQuantity : undefined;
    const step = line.quantityStep && line.quantityStep !== 1 ? line.quantityStep : undefined;
    if (min && step) return t('templates.edit.minStep', { min: quantityWithUnit(min, unit), step: quantityWithUnit(step, unit) });
    if (step) return t('templates.edit.step', { step: quantityWithUnit(step, unit) });
    if (min) return t('templates.edit.min', { amount: quantityWithUnit(min, unit) });
    return null;
  };
  const add = (item: ShowcaseItemDto) => {
    const rule = { min: item.terms?.minQuantity, step: item.terms?.quantityStep };
    setRemoved((prev) => prev.filter((id) => id !== item.id));
    if (!loaded.some((line) => line.itemId === item.id)) {
      setAdded((prev) => [...prev.filter((line) => line.itemId !== item.id),
        { itemId: item.id, name: item.name, unit: item.unit, quantity: firstValid(rule),
          minQuantity: rule.min, quantityStep: rule.step }]);
    }
    setQuery('');
  };
  const valid = name.trim() !== '' && left.length > 0 && !left.some(bad);
  const detail = (update.error as { info?: { detail?: unknown } } | null)?.info?.detail;

  return (
    <div data-testid="template-editor" className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">{t('templates.name')}</span>
        <input type="text" value={name} maxLength={rules.SaveTemplateRequest.name.maxLength}
          onChange={(event) => setName(event.currentTarget.value)} className={FIELD} />
      </label>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {left.map((line) => (
          <li key={line.itemId} className="flex items-center gap-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-ink">{line.name ?? t('templates.edit.gone')}</span>
              {hintOf(line) ? (
                <span className={cn('text-caption', bad(line) ? 'text-gone' : 'text-ink-muted')}>{hintOf(line)}</span>
              ) : null}
            </span>
            <label className="flex items-center gap-1.5">
              <span className="sr-only">{t('templates.edit.quantity', { name: line.name ?? '' })}</span>
              <input type="text" inputMode="decimal" value={quantityOf(line)} aria-invalid={bad(line)}
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  setQuantities((prev) => ({ ...prev, [line.itemId]: text }));
                }}
                className={cn(FIELD, 'w-20 text-right tabular-nums', bad(line) && 'ring-2 ring-gone')} />
              <span className="w-8 text-caption text-ink-muted">{line.unit ?? ''}</span>
            </label>
            <Button variant="outline" disabled={left.length === 1}
              aria-label={t('templates.edit.removeAria', { name: line.name ?? '' })}
              onClick={() => setRemoved((prev) => [...prev, line.itemId])}>
              {t('templates.edit.remove')}
            </Button>
          </li>
        ))}
      </ul>
      {left.length === 1 ? <p className="m-0 text-caption text-ink-muted">{t('templates.edit.lastLine')}</p> : null}
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t('templates.edit.addTitle')}</span>
          <input type="search" value={query} placeholder={t('templates.edit.addPlaceholder')}
            onChange={(event) => setQuery(event.currentTarget.value)} className={FIELD} />
        </label>
        {searching && found.isSuccess && results.length === 0 ? (
          <p className="m-0 text-caption text-ink-muted">{t('templates.edit.notFound')}</p>
        ) : null}
        {results.length > 0 ? (
          <ul data-testid="template-search" className="m-0 flex list-none flex-col gap-1 p-0">
            {results.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-[var(--radius-control)] bg-sunk px-3 py-2">
                <span className="min-w-0 flex-1 text-body text-ink">{item.name}</span>
                <Button variant="outline" disabled={has(item.id)}
                  aria-label={t('templates.edit.addAria', { name: item.name })} onClick={() => add(item)}>
                  {has(item.id) ? t('templates.edit.inTemplate') : t('templates.edit.add')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {update.isError ? (
        <p role="alert" className="m-0 text-sm text-gone">
          {typeof detail === 'string' && detail ? detail : t('templates.edit.failed')}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button className="flex-1" disabled={!valid || update.isPending}
          onClick={() => update.mutate({
            id: template.id,
            data: {
              name: name.trim(),
              lines: left.map((line) => ({ itemId: line.itemId, quantity: Number(quantityOf(line).replace(',', '.')) })),
            },
          })}>
          {update.isPending ? t('templates.saving') : t('templates.save')}
        </Button>
        <Button variant="outline" onClick={onDone}>{t('templates.auto.cancel')}</Button>
      </div>
    </div>
  );
}
