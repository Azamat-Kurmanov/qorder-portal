import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetPortalCatalog, type GetPortalCatalogPresence, type GetPortalCatalogSort, type ShowcaseFacetDto } from '../../api/generated';
import { Button } from '../../ui/Button';
import { CHIP_ROW } from '../../ui/chipRow';
import { cn } from '../../ui/cn';
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Package, X } from '../../ui/icons';

/** Ключ выбранного варианта поля: «код:вариант» — так он уходит в запрос витрины. */
export const fieldKey = (code: string, option: string) => `${code}:${option}`;
import { useDismiss } from '../../ui/useDismiss';
import { Sheet } from '../../ui/Sheet';

/** Быстрый отбор («Хит продаж», «Новинка»…): каталог отдаёт готовые подпись, значок и число. */
export interface PhoneMark {
  key: string;
  label: string;
  icon: ReactNode;
  count?: number;
  /** Цвета отбора, как на витрине: светлый — не выбран, залитый — выбран (хит янтарный, новинка зелёная…). */
  idle: string;
  on: string;
}

/** Всё выбранное в фильтрах — его применяет «Применить», а не каждое нажатие. */
export interface PhoneFilterState {
  fields: string[];
  marks: string[];
  presence: GetPortalCatalogPresence;
}

const PRESENCES = ['ALL', 'IN_STOCK', 'OUT_OF_STOCK'] as const;

/** Значок «фильтры» — три ползунка. */
function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
    </svg>
  );
}

const PILL = cn(
  // Компактные (просьба владельца 2026-11-05): строка фильтров не должна спорить с товарами.
  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[var(--radius-pill)] border-[1.5px] border-solid px-3 text-caption font-bold',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

const CHOICE = (on: boolean) => cn(
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-2xl border-[2.5px] border-solid px-3.5 text-body font-extrabold',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45',
  on ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink',
);

/**
 * Фильтры каталога на телефоне — одной строкой (решение владельца 2026-11-05: ряды чипов перегружали экран).
 *
 * Значок в начале строки открывает слева панель со всеми фильтрами целиком; кнопка поля («Размер ▾»,
 * «Размер: 48, 50 ▾») — окно снизу только с этим полем. В окнах — «Сбросить» и «Применить»: выбор
 * применяется по «Применить», закрытое без него окно ничего не меняет.
 */
/** Рубрика каталога для выбора в строке фильтров: id пуст — «Все товары». */
export interface PhoneRubric {
  id?: string;
  /** Родительский раздел: окно рубрик показывает уровень за уровнем. */
  parentId?: string;
  name: string;
  /** Картинка раздела от менеджера; нет — снимок первого товара. */
  image?: string;
  count?: number;
}

/**
 * Картинка рубрики слева от названия (просьба владельца 2026-11-05): своей картинки у рубрики нет,
 * поэтому — снимок первого товара рубрики; без снимка — значок коробки, у «Все товары» — значок сетки.
 * Окно рубрик монтируется только открытым, и запросы идут только тогда.
 */
// ponytail: запрос на каждую рубрику (окно рубрик на телефоне, колонка рубрик на мониторе); если рубрик станет десятки — снимок рубрики отдавать сервером.
export function RubricPicture({ id, image, small = false }: { id?: string; image?: string; small?: boolean }) {
  // Картинка, поставленная менеджером у раздела, — первой; без неё — снимок первого товара раздела.
  const first = useGetPortalCatalog({ categoryId: id, page: 0, size: 1 }, { query: { enabled: !!id && !image, staleTime: 5 * 60_000 } });
  const src = image ?? (first.data?.status === 200 ? first.data.data.items?.[0]?.thumbnailUrl : undefined);
  const Icon = id ? Package : LayoutGrid;
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-sunk text-ink-muted', small ? 'size-8 rounded-lg' : 'size-11 rounded-xl')}>
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : <Icon className={small ? 'size-4' : 'size-5'} />}
    </span>
  );
}

export function PhoneFilters({ facets, marks, showPresence, value, onApply, rubrics, rubric, onRubric, wide = false }: {
  facets: ShowcaseFacetDto[];
  /** Рубрики — первой кнопкой строки («Все товары ▾»), выбор — окном снизу. */
  rubrics: PhoneRubric[];
  rubric: string | undefined;
  onRubric: (id: string | undefined) => void;
  marks: PhoneMark[];
  /** Наличие — только у магазина, где что-то закончилось. */
  showPresence: boolean;
  value: PhoneFilterState;
  onApply: (next: PhoneFilterState) => void;
  /**
   * Монитор (вариант В, решение владельца 2026-11-05): одна кнопка «Фильтры · N» открывает панель справа,
   * рядом — выбранное чипами с крестиком. Рубрики и быстрые отборы там — в левой колонке каталога.
   */
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const [panel, setPanel] = useState(false);
  const [facetOpen, setFacetOpen] = useState<string | null>(null);
  const [rubricsOpen, setRubricsOpen] = useState(false);
  // Уровень в окне рубрик: undefined — верхние разделы, иначе — подразделы этого раздела.
  const [level, setLevel] = useState<string | undefined>(undefined);
  const current = rubrics.find((one) => one.id === rubric) ?? rubrics[0];
  const childrenOf = (parentId: string | undefined) => rubrics.filter((one) => one.id !== undefined && (one.parentId ?? undefined) === parentId);
  const levelNode = level === undefined ? undefined : rubrics.find((one) => one.id === level);
  const [draft, setDraft] = useState<PhoneFilterState>(value);
  const open = (what: 'panel' | string) => {
    setDraft(value);
    if (what === 'panel') setPanel(true);
    else setFacetOpen(what);
  };
  const apply = () => { onApply(draft); setPanel(false); setFacetOpen(null); };
  const chosen = value.fields.length + value.marks.length + (value.presence !== 'IN_STOCK' ? 1 : 0);
  const toggleField = (key: string) => setDraft((was) => ({
    ...was, fields: was.fields.includes(key) ? was.fields.filter((one) => one !== key) : [...was.fields, key],
  }));
  const toggleMark = (key: string) => setDraft((was) => ({
    ...was, marks: was.marks.includes(key) ? was.marks.filter((one) => one !== key) : [...was.marks, key],
  }));
  const picked = (facet: ShowcaseFacetDto) =>
    facet.options.filter((option) => value.fields.includes(fieldKey(facet.code, option.code)));
  const opened = facets.find((facet) => facet.code === facetOpen);

  /*
   * Размеры — двумя группами: цифровые (44, 46…) и буквенные (S, M, XL…), каждая под своей подписью
   * (просьба владельца 2026-11-05). Группы — только когда есть и те, и другие.
   */
  const options = (facet: ShowcaseFacetDto) => {
    if (facet.code === 'SIZE') {
      const digits = facet.options.filter((option) => /^\d/.test((option.name ?? '').trim()) && !/^\dXL/i.test((option.name ?? '').trim()));
      const letters = facet.options.filter((option) => !digits.includes(option));
      if (digits.length > 0 && letters.length > 0) {
        return (
          <div className="flex flex-col gap-3">
            {[['digits', digits], ['letters', letters]].map(([kind, list]) => (
              <div key={kind as string} className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-ink-muted">{t(`catalog.filters.sizes.${kind as string}`)}</span>
                {optionList(facet, list as ShowcaseFacetDto['options'], t(`catalog.filters.sizes.${kind as string}`))}
              </div>
            ))}
          </div>
        );
      }
    }
    return optionList(facet, facet.options, facet.name);
  };

  const optionList = (facet: ShowcaseFacetDto, list: ShowcaseFacetDto['options'], label: string) => (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {list.map((option) => {
        const key = fieldKey(facet.code, option.code);
        const on = draft.fields.includes(key);
        return (
          <button key={key} type="button" aria-pressed={on} onClick={() => toggleField(key)} className={CHOICE(on)}>
            {option.name ?? facet.name}
            <span className={cn('text-xs font-semibold tabular-nums', on ? 'opacity-85' : 'text-ink-subtle')}>{option.count}</span>
          </button>
        );
      })}
    </div>
  );

  /*
   * Кнопки — сплошной полосой до самого края листа: прежде под ними просвечивали значения
   * (просьба владельца 2026-11-05). Две короткие подписи помещаются в половину ширины каждая.
   */
  const actions = (reset: () => void, pinned = false) => (
    <div className={cn('flex shrink-0 gap-2 bg-surface',
      pinned
        ? '-mx-4 border-t border-hairline px-4 pt-3'
        : 'sticky bottom-0 z-10 -mx-4 -mb-[calc(1rem+env(safe-area-inset-bottom))] mt-2 border-t border-hairline px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 lg:static lg:mx-0 lg:mb-0 lg:border-0 lg:p-0')}>
      <Button type="button" size="lg" variant="outline" className="min-w-0 flex-1" onClick={reset}>{t('catalog.filters.clear')}</Button>
      <Button type="button" size="lg" className="min-w-0 flex-1" onClick={apply}>{t('catalog.filters.apply')}</Button>
    </div>
  );

  // Монитор: здесь — одна кнопка «Фильтры · N»; выбранное чипами — отдельно (`ChosenChips`), строкой ниже.
  const wideRow = facets.length > 0 || showPresence ? (
    <button type="button" aria-haspopup="dialog" onClick={() => open('panel')}
      className={cn('flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border-[1.5px] px-3.5 text-sm font-bold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        chosen > 0 ? 'border-shop bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink hover:border-ink-muted')}>
      <SlidersIcon className="size-[1.125rem]" />
      {t('catalog.filters.label')}{chosen > 0 ? <span className="tabular-nums">· {chosen}</span> : null}
    </button>
  ) : null;

  return (
    <>
      {wide ? wideRow : (
      <div role="group" aria-label={t('catalog.filters.label')} className={cn(CHIP_ROW, '-mx-4 gap-2 px-4')}>
        <button type="button" aria-haspopup="dialog" aria-label={t('catalog.filters.all', { count: chosen })}
          onClick={() => open('panel')}
          className={cn(PILL, chosen > 0 ? 'border-shop bg-shop text-on-shop' : 'border-line bg-surface text-ink')}>
          <SlidersIcon className="size-[1.125rem]" />
          {chosen > 0 ? <span className="tabular-nums">{chosen}</span> : null}
        </button>
        {rubrics.length > 1 ? (
          <button type="button" aria-haspopup="dialog" onClick={() => { setLevel(rubrics.find((one) => one.id === rubric)?.parentId); setRubricsOpen(true); }}
            aria-label={t('catalog.filters.rubric', { name: current?.name ?? '' })}
            className={cn(PILL, rubric ? 'border-shop bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink')}>
            <span className="max-w-[11rem] truncate">{current?.name}</span>
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
          </button>
        ) : null}
        {facets.map((facet) => {
          const on = picked(facet);
          return (
            <button key={facet.code} type="button" aria-haspopup="dialog" onClick={() => open(facet.code)}
              className={cn(PILL, on.length > 0 ? 'border-shop bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink')}>
              <span className="max-w-[11rem] truncate">
                {on.length > 0 ? `${facet.name}: ${on.map((option) => option.name ?? '').join(', ')}` : facet.name}
              </span>
              <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
            </button>
          );
        })}
      </div>
      )}

      {/*
        Рубрики — окном снизу, уровень за уровнем (просьба владельца 2026-11-05): сначала разделы («Одежда», «Обувь»);
        раздел с подразделами открывает их, подраздел без вложенных — выбирается и закрывает окно.
      */}
      <Sheet open={rubricsOpen} onOpenChange={setRubricsOpen} title={levelNode?.name ?? t('catalog.rubrics')}>
        <div role="radiogroup" aria-label={levelNode?.name ?? t('catalog.rubrics')} className="flex flex-col gap-1.5">
          {levelNode ? (
            <button type="button" onClick={() => setLevel(levelNode.parentId)}
              className="flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-xl border-0 bg-transparent px-2 text-body font-bold text-accent-ink hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <ChevronLeft aria-hidden="true" className="size-5" />
              {rubrics.find((one) => one.id === levelNode.parentId)?.name ?? t('catalog.rubrics')}
            </button>
          ) : null}
          {(levelNode
            ? [{ ...levelNode, name: t('catalog.rubricAll', { name: levelNode.name }), parentId: undefined, all: true }, ...childrenOf(levelNode.id)]
            : [...rubrics.filter((one) => one.id === undefined), ...childrenOf(undefined)]
          ).map((one) => {
            const on = one.id === rubric;
            const deeper = !('all' in one) && one.id !== undefined && childrenOf(one.id).length > 0;
            return (
              <button key={`${one.id ?? 'all'}${'all' in one ? '-all' : ''}`} type="button" role="radio" aria-checked={on && !deeper}
                aria-haspopup={deeper ? 'true' : undefined}
                onClick={() => { if (deeper) setLevel(one.id); else { onRubric(one.id); setRubricsOpen(false); } }}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border-0 px-2 py-1.5 text-left text-lead font-extrabold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  on && !deeper ? 'bg-accent-soft text-accent-ink' : 'bg-transparent text-ink hover:bg-sunk',
                )}>
                <RubricPicture id={one.id} image={one.image} />
                <span className="min-w-0 flex-1">{one.name}</span>
                {one.count !== undefined ? <span className="text-sm font-semibold tabular-nums text-ink-muted">{one.count}</span> : null}
                {deeper ? <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                  : on ? <Check aria-hidden="true" className="size-5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* Одно поле — окном снизу. */}
      <Sheet open={!!opened} onOpenChange={(isOpen) => { if (!isOpen) setFacetOpen(null); }} title={opened?.name ?? ''}>
        {opened ? (
          <div className="flex flex-col gap-4">
            {options(opened)}
            {actions(() => setDraft((was) => ({ ...was, fields: was.fields.filter((key) => !key.startsWith(`${opened.code}:`)) })))}
          </div>
        ) : null}
      </Sheet>

      {/* Все фильтры — панелью слева, полностью раскрытые. */}
      <Sheet open={panel} onOpenChange={setPanel} title={t('catalog.filters.title')} side={wide ? 'right' : 'left'}>
        {/*
          Список прокручивается сам, а кнопки стоят под ним, вне прокрутки: прежде значения
          просвечивали под липкой полосой (просьба владельца 2026-11-05).
        */}
        <div className="flex min-h-0 flex-1 flex-col">
        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-3">
          {marks.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-lead font-extrabold text-ink">{t('catalog.marks.label')}</h3>
              <div role="group" aria-label={t('catalog.marks.label')} className="flex flex-wrap gap-2">
                {marks.map((mark) => {
                  const on = draft.marks.includes(mark.key);
                  return (
                    <button key={mark.key} type="button" aria-pressed={on} disabled={!on && mark.count === 0}
                      onClick={() => toggleMark(mark.key)}
                      className={cn(CHOICE(on), 'border-[2px]', on ? mark.on : mark.idle)}>
                      {mark.icon}{mark.label}
                      {mark.count !== undefined ? <span className={cn('text-xs font-semibold tabular-nums', on ? 'opacity-85' : 'text-ink-subtle')}>{mark.count}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          {showPresence ? (
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-lead font-extrabold text-ink">{t('catalog.presence.label')}</h3>
              <div role="group" aria-label={t('catalog.presence.label')} className="flex flex-wrap gap-2">
                {PRESENCES.map((presence) => (
                  <button key={presence} type="button" aria-pressed={draft.presence === presence}
                    onClick={() => setDraft((was) => ({ ...was, presence }))} className={CHOICE(draft.presence === presence)}>
                    {t(`catalog.presence.${presence}`)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {facets.map((facet) => (
            <section key={facet.code} className="flex flex-col gap-2">
              <h3 className="m-0 text-lead font-extrabold text-ink">{facet.name}</h3>
              {options(facet)}
            </section>
          ))}
        </div>
          {actions(() => setDraft({ fields: [], marks: [], presence: 'IN_STOCK' }), true)}
        </div>
      </Sheet>
    </>
  );
}

/** Порядок витрины — значком со стрелками; варианты — окном снизу, выбор сразу закрывает окно. */
export function SortButton({ value, options, onChange }: {
  value: GetPortalCatalogSort;
  options: GetPortalCatalogSort[];
  onChange: (next: GetPortalCatalogSort) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}
        aria-label={t('catalog.sort.button', { value: t(`catalog.sortPhone.${value}`) })}
        className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-[0.875rem] border-2 border-solid border-line bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <ArrowUpDown aria-hidden="true" className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={t('catalog.sort.label')}>
        <div role="radiogroup" aria-label={t('catalog.sort.label')} className="flex flex-col gap-1.5">
          {options.map((key) => {
            const on = key === value;
            return (
              <button key={key} type="button" role="radio" aria-checked={on}
                onClick={() => { onChange(key); setOpen(false); }}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border-0 px-2 py-1.5 text-left text-lead font-extrabold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  on ? 'bg-accent-soft text-accent-ink' : 'bg-transparent text-ink hover:bg-sunk',
                )}>
                {t(`catalog.sortPhone.${key}`)}
                {on ? <Check aria-hidden="true" className="size-5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

/**
 * Порядок на мониторе (просьба владельца 2026-11-05): кнопка «↑↓ Популярные ▾» и выплывающее меню
 * с вариантами; выбранный — с галочкой. Закрывается выбором, щелчком мимо и Esc.
 */
export function SortMenu({ value, options, onChange }: {
  value: GetPortalCatalogSort;
  options: GetPortalCatalogSort[];
  onChange: (next: GetPortalCatalogSort) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, useCallback(() => setOpen(false), []), box);
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" aria-haspopup="menu" aria-expanded={open}
        aria-label={t('catalog.sort.button', { value: t(`catalog.sortShort.${value}`) })}
        onClick={() => setOpen((was) => !was)}
        className={cn('flex h-10 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] bg-surface pl-3 pr-2.5 text-sm font-bold text-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          open ? 'border-ink-muted' : 'border-line hover:border-ink-muted')}>
        <ArrowUpDown aria-hidden="true" className="size-[1.125rem]" />
        {t(`catalog.sortShort.${value}`)}
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div role="menu" aria-label={t('catalog.sort.label')} hidden={!open}
        className={cn('absolute right-0 top-[calc(100%+0.5rem)] z-30 w-60 origin-top-right rounded-2xl border border-hairline bg-surface p-1.5',
          'shadow-[0_18px_40px_-14px_rgba(26,25,23,.35)] animate-[qo-menu-in_160ms_cubic-bezier(0.22,0.61,0.36,1)]')}>
        {options.map((key) => {
          const on = key === value;
          return (
            <button key={key} type="button" role="menuitemradio" aria-checked={on}
              onClick={() => { onChange(key); setOpen(false); }}
              className={cn('flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 text-left text-body',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                on ? 'bg-accent-soft font-extrabold text-accent-ink' : 'bg-transparent font-semibold text-ink hover:bg-sunk')}>
              <span className="flex-1">{t(`catalog.sortPhone.${key}`, { defaultValue: t(`catalog.sortShort.${key}`) })}</span>
              {on ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Выбранные отборы чипами с крестиком (монитор): поле и наличие; крестик снимает свой отбор сразу. */
export function ChosenChips({ facets, value, onApply }: {
  facets: ShowcaseFacetDto[];
  value: PhoneFilterState;
  onApply: (next: PhoneFilterState) => void;
}) {
  const { t } = useTranslation();
  const chips = facets.flatMap((facet) => facet.options
    .filter((option) => value.fields.includes(fieldKey(facet.code, option.code)))
    .map((option) => ({ key: fieldKey(facet.code, option.code), label: `${facet.name}: ${option.name ?? ''}` })));
  const CHIP = 'flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-shop pl-3 pr-1.5 text-caption font-bold text-on-shop';
  const cross = <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-white/20"><X className="size-3" /></span>;
  if (chips.length === 0 && value.presence === 'IN_STOCK') return null;
  return (
    <div role="group" aria-label={t('catalog.filters.chosenLabel')} className={cn(CHIP_ROW, 'flex min-w-0 flex-1 items-center gap-2')}>
      {chips.map((one) => (
        <button key={one.key} type="button" aria-label={t('catalog.filters.remove', { name: one.label })}
          onClick={() => onApply({ ...value, fields: value.fields.filter((key) => key !== one.key) })} className={CHIP}>
          {one.label}{cross}
        </button>
      ))}
      {value.presence !== 'IN_STOCK' ? (
        <button type="button" aria-label={t('catalog.filters.remove', { name: t(`catalog.presence.${value.presence}`) })}
          onClick={() => onApply({ ...value, presence: 'IN_STOCK' })} className={CHIP}>
          {t(`catalog.presence.${value.presence}`)}{cross}
        </button>
      ) : null}
    </div>
  );
}
