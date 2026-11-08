import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ShowcaseVariantDto } from '../../api/generated';
import { fieldText } from './fieldText';
import { cn } from '../../ui/cn';

/** Поле, по которому варианты отличаются: цвет, размер, объём… */
export interface Axis {
  code: string;
  name: string;
  colour: boolean;
  options: string[];
  /** Цвет кружка, заданный продавцом у варианта поля (#RRGGBB), — по подписи значения. */
  hexes?: Record<string, string>;
}

const COLOUR = /цвет|түс|colou?r/i;
const SIZE = /размер|өлшем|size/i;

/**
 * Цвета по названию — для кружков выбора. Продавец пишет цвет словом,
 * а не кодом; неизвестное слово остаётся подписью, а не выдуманным цветом.
 */
const COLOURS: [RegExp, string][] = [
  [/тёмно-син|темно-син|navy/i, '#1F2E4D'],
  [/бел|white|ақ/i, '#FFFFFF'],
  [/чёрн|черн|black|қара/i, '#1F1F1C'],
  [/сер|grey|gray|сұр/i, '#9A9A95'],
  [/беж|beige/i, '#D8CFC2'],
  [/коричн|brown/i, '#7A5236'],
  [/бордо|burgundy/i, '#7B2233'],
  [/красн|red|қызыл/i, '#C8423B'],
  [/голуб|light blue/i, '#8EC1E6'],
  [/син|blue|көк/i, '#2F5DA8'],
  [/хаки|khaki/i, '#7C7A4F'],
  [/зел|green|жасыл/i, '#4E8A4B'],
  [/жёлт|желт|yellow|сары/i, '#E6C34A'],
  [/оранж|orange/i, '#E08A3C'],
  [/роз|pink/i, '#E7A0AE'],
  [/фиолет|purple|violet/i, '#7E5AA6'],
];

export function colourOf(name: string): string | undefined {
  return COLOURS.find(([pattern]) => pattern.test(name))?.[1];
}

/** Значения полей варианта, как их читает клиент: код поля → текст. */
export function valuesOf(variant: ShowcaseVariantDto): Map<string, { name: string; text: string; hex?: string }> {
  return new Map(variant.fields
    .map((field) => [field.code, { name: field.name, text: fieldText(field), hex: field.hex }] as const)
    .filter(([, value]) => value.text !== ''));
}

/**
 * Оси выбора — поля, значения которых у вариантов различаются. Совпадающие
 * (состав, сезон) выбирать не из чего, и в выбор они не попадают. Цвет
 * первым, размер вторым, как в макете.
 */
export function axesOf(variants: ShowcaseVariantDto[]): Axis[] {
  const values = variants.map(valuesOf);
  const codes = new Map<string, string>();
  values.forEach((map) => map.forEach((value, code) => { if (!codes.has(code)) codes.set(code, value.name); }));
  const axes: Axis[] = [];
  codes.forEach((name, code) => {
    const options = [...new Set(values.map((map) => map.get(code)?.text).filter((text): text is string => !!text))];
    if (options.length < 2) return;
    const hexes: Record<string, string> = {};
    values.forEach((map) => { const value = map.get(code); if (value?.hex) hexes[value.text] = value.hex; });
    axes.push({ code, name, colour: COLOUR.test(name) || COLOUR.test(code), options, hexes });
  });
  const rank = (axis: Axis) => (axis.colour ? 0 : SIZE.test(axis.name) || SIZE.test(axis.code) ? 1 : 2);
  return axes.sort((a, b) => rank(a) - rank(b));
}

/**
 * Цвет кружка значения: заданный продавцом у варианта поля, а без него — узнанный по названию.
 * Раньше брался только по названию, и «Изумрудный» превращал всю ось в текстовые кнопки.
 */
export function swatchOf(axis: Axis, option: string): string | undefined {
  return axis.hexes?.[option] ?? colourOf(option);
}

/** Кружками ли рисовать ось: цвет, и у каждого значения есть цвет кружка. */
export function swatchesOf(axis: Axis): boolean {
  return axis.colour && axis.options.every((option) => swatchOf(axis, option));
}

/**
 * Какой вариант выбрать, когда по оси `axis` нажали `option`.
 *
 * Остальные поля по возможности сохраняются: выбрав другой цвет, человек
 * ждёт тот же размер, а не первый попавшийся. Общее у карточки товара
 * и плитки витрины — иначе одно и то же нажатие приводило бы в разные места.
 */
export function pickVariant(
  variants: ShowcaseVariantDto[],
  axes: Axis[],
  current: ShowcaseVariantDto,
  axis: Axis,
  option: string,
): ShowcaseVariantDto | undefined {
  const mine = valuesOf(current);
  const matches = variants.filter((variant) => valuesOf(variant).get(axis.code)?.text === option);
  return matches.find((variant) => {
    const values = valuesOf(variant);
    return axes.every((other) => other.code === axis.code || values.get(other.code)?.text === mine.get(other.code)?.text);
  }) ?? matches[0];
}

/**
 * Выбор варианта — цвет кружками, размер и прочее плашками, как в макете
 * «Карточка товара v2». Вариант — это отдельная позиция продавца, поэтому
 * выбор открывает её карточку: цена, наличие и корзина у каждой свои.
 *
 * При смене одного поля остальные по возможности сохраняются: выбрав другой
 * цвет, человек ждёт тот же размер, а не первый попавшийся.
 *
 * `sizeAction` встаёт справа от подписи размера — «Как подобрать размер».
 * Слотом, а не внутри выбора: подсказка ведёт к вопросу продавцу, а форма
 * вопроса живёт в карточке, не здесь.
 */
export function VariantPicker({
  itemId,
  variants,
  sizeAction,
}: {
  itemId: string;
  variants: ShowcaseVariantDto[];
  sizeAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const axes = axesOf(variants);
  const current = variants.find((variant) => variant.itemId === itemId);
  if (axes.length === 0 || !current) return null;
  const mine = valuesOf(current);

  function pick(from: ShowcaseVariantDto, axis: Axis, option: string) {
    const best = pickVariant(variants, axes, from, axis, option);
    if (best && best.itemId !== itemId) navigate(`/catalog/${best.itemId}`, { replace: true });
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {axes.map((axis) => {
        const chosen = mine.get(axis.code)?.text;
        const swatches = swatchesOf(axis);
        const size = !axis.colour && (SIZE.test(axis.name) || SIZE.test(axis.code));
        return (
          <div key={axis.code} role="group" aria-label={axis.name} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-body text-ink-muted">
                {axis.name}: <b className="text-ink">{chosen ?? '—'}</b>
              </span>
              {size && sizeAction}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {axis.options.map((option) => {
                const on = option === chosen;
                return swatches ? (
                  <button
                    key={option}
                    type="button"
                    title={option}
                    aria-label={t('item.variantOption', { name: axis.name, value: option })}
                    aria-pressed={on}
                    onClick={() => pick(current, axis, option)}
                    style={{ background: swatchOf(axis, option) }}
                    className={cn(
                      'size-10 rounded-full border-[3px] border-surface transition-shadow duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                      on ? 'shadow-[0_0_0_2.5px_var(--color-accent)]' : 'shadow-[0_0_0_1.5px_var(--color-line)]',
                    )}
                  />
                ) : (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(current, axis, option)}
                    className={cn(
                      'h-[46px] min-w-[54px] rounded-[var(--radius-control)] border px-3.5 text-body font-bold transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-ink/50',
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div aria-hidden="true" className="h-px bg-hairline" />
    </div>
  );
}
