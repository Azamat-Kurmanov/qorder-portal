import { useTranslation } from 'react-i18next';
import type { ShowcaseFacetDto } from '../../api/generated';
import { cn } from '../../ui/cn';

/** Выбранное как `КОД:вариант` — ровно так его принимает витрина. */
export const fieldKey = (code: string, option: string) => `${code}:${option}`;

/**
 * Отбор витрины по полям рубрики: «Цвет: Красный · Синий», «Утеплённая».
 *
 * Поля и варианты присылает сервер — только те, что продавец разрешил для отбора
 * и что реально встречаются в рубрике, с числом моделей: чип, ведущий в пустоту,
 * хуже его отсутствия. Варианты одного поля — «или», разных — «и».
 */
export function FieldFilters({ facets, selected, onChange }: {
  facets: ShowcaseFacetDto[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  if (facets.length === 0) return null;
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((one) => one !== key) : [...selected, key]);

  return (
    <div data-testid="field-filters" className="flex flex-col gap-2">
      {facets.map((facet) => (
        <div key={facet.code} role="group" aria-label={facet.name} className="flex flex-wrap items-center gap-2">
          {facet.type === 'BOOLEAN' ? null : <span className="text-xs font-semibold text-ink-muted">{facet.name}</span>}
          {facet.options.map((option) => {
            const key = fieldKey(facet.code, option.code);
            const on = selected.includes(key);
            return (
              <button key={key} type="button" aria-pressed={on} onClick={() => toggle(key)}
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-pill)] border-[1.5px] border-solid px-3 text-[0.8125rem] font-semibold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink hover:border-ink-muted',
                )}>
                {option.name ?? facet.name}
                <span className="tabular-nums text-ink-subtle">{option.count}</span>
              </button>
            );
          })}
        </div>
      ))}
      {selected.length > 0 ? (
        <button type="button" onClick={() => onChange([])}
          className="self-start cursor-pointer text-[0.8125rem] font-semibold text-accent-ink hover:underline">
          {t('catalog.filters.reset')}
        </button>
      ) : null}
    </div>
  );
}
