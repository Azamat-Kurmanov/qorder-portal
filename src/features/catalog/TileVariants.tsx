import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ShowcaseItemDto } from '../../api/generated';
import { axesOf, swatchOf, pickVariant, swatchesOf, valuesOf, type Axis } from './VariantPicker';
import { cn } from '../../ui/cn';

/** Больше значений плитка не показывает: остальные — «+N» в карточке товара. */
const VISIBLE = 5;

/**
 * Выбор варианта прямо на плитке витрины — макет «Каталог v1».
 *
 * Вариант — отдельная позиция продавца с тем же названием и разделом, и
 * плитка, выбрав его, становится плиткой этой позиции: её цена, наличие
 * и свободный остаток,
 * её строка в корзине и её карточка по ссылке. Снимок, сердечко и метки
 * условий остаются от показанной позиции: у варианта их в ответе витрины нет,
 * а выдумывать их нельзя. Старая цена и скидка распродажи — свои у каждого
 * варианта (продавец ставит в распродажу позицию, а не название): у выбранного
 * варианта показываются его собственные.
 *
 * Выбор — по одной оси, той, что первая у карточки товара (`axesOf`): цвет,
 * если он различается, иначе размер или фасовка. Две строки выбора на плитке
 * шириной в полтелефона не помещаются; остальное выбирают в карточке.
 */
export function useTileVariant(item: ShowcaseItemDto) {
  const [chosenId, setChosenId] = useState(item.id);
  const variants = item.variants ?? [];
  const axes = variants.length >= 2 ? axesOf(variants) : [];
  const axis = axes[0] as Axis | undefined;
  const chosen = variants.find((variant) => variant.itemId === chosenId)
    ?? variants.find((variant) => variant.itemId === item.id);

  const shown: ShowcaseItemDto = !chosen || chosen.itemId === item.id
    ? item
    : {
      ...item,
      id: chosen.itemId,
      price: chosen.price,
      stock: chosen.stock,
      oldPrice: chosen.oldPrice,
      discountPercent: chosen.discountPercent,
      // Свободный остаток — свой у варианта: «Свободно: N», ноль — серым,
      // пусто — остаток у позиции не ведётся. Артикула про вариант ответ
      // витрины не несёт.
      available: chosen.available,
      sku: undefined,
    };

  const choice = axis && chosen ? (
    <TileVariantChoice
      axis={axis}
      chosen={valuesOf(chosen).get(axis.code)?.text}
      cardId={shown.id}
      onPick={(option) => {
        const best = pickVariant(variants, axes, chosen, axis, option);
        if (best) setChosenId(best.itemId);
      }}
    />
  ) : null;

  // Выбор цвета уже показывает цвета — метка «4 цвета» на фото его бы повторяла.
  return { shown, choice, colour: !!axis?.colour };
}

/**
 * Кружки цветов или кнопки значений — группой переключателей: выбран всегда
 * ровно один, и экранный диктор так и читает — «Цвет, белый, выбран, 1 из 2».
 * Стрелки ходят по значениям, в группу Tab попадает один раз.
 *
 * Цель касания — 36 точек даже у кружка: сам кружок меньше, а вокруг него
 * прозрачное поле. На узкой плитке ряд переносится, а не вылезает за край.
 */
function TileVariantChoice({
  axis,
  chosen,
  cardId,
  onPick,
}: {
  axis: Axis;
  chosen: string | undefined;
  cardId: string;
  onPick: (option: string) => void;
}) {
  const { t } = useTranslation();
  const group = useRef<HTMLDivElement>(null);
  const swatches = swatchesOf(axis);
  let visible = axis.options.slice(0, VISIBLE);
  // Выбранное значение видно всегда, даже когда по порядку оно за «+N».
  if (chosen && !visible.includes(chosen)) visible = [...visible.slice(0, VISIBLE - 1), chosen];
  const hidden = axis.options.length - visible.length;

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + visible.length) % visible.length;
    onPick(visible[next]);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <div ref={group} role="radiogroup" aria-label={axis.name} className="flex flex-wrap items-center gap-1">
        {visible.map((option, index) => {
          const on = option === chosen;
          const label = t('item.variantOption', { name: axis.name, value: option });
          return swatches ? (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              title={option}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(option)}
              onKeyDown={(event) => move(event, index)}
              className="group/swatch flex size-9 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:size-8"
            >
              <span
                aria-hidden="true"
                style={{ background: swatchOf(axis, option) }}
                className={cn(
                  'size-6 rounded-full border-2 border-surface transition-shadow duration-150',
                  on ? 'shadow-[0_0_0_2px_var(--color-accent)]' : 'shadow-[0_0_0_1px_var(--color-line)] group-hover/swatch:shadow-[0_0_0_1.5px_var(--color-ink-muted)]',
                )}
              />
            </button>
          ) : (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(option)}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                'h-9 min-w-9 cursor-pointer rounded-[var(--radius-control)] border px-2 text-caption font-semibold transition-colors duration-150 sm:h-8',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-ink/50',
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {hidden > 0 && (
        <Link
          to={`/catalog/${cardId}`}
          aria-label={t('catalog.variantsMore', { count: hidden })}
          className="qo-hit flex h-9 items-center px-1.5 text-caption font-semibold text-ink-muted hover:text-accent sm:h-8"
        >
          +{hidden}
        </Link>
      )}
    </div>
  );
}
