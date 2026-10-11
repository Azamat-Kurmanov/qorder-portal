import { cn } from '../ui/cn';
import type { TemplateStyle } from './cabinetDesign';

/**
 * Классы вариантов вёрстки по характеру шаблона — пункт меню, чип рубрики,
 * ценник. Формулы те же, что у предпросмотра продавца
 * (`front/src/features/cabinetDesign/CabinetPreview.tsx`: `navItem`, `Chips`,
 * `Price`), только цвета — токенами кабинета, а не числами: в тёмной теме
 * их перекрашивает таблица стилей поставщика.
 *
 * Классы литералами: Tailwind находит их по тексту исходника.
 */

export type NavLook = TemplateStyle['nav'];

/**
 * Пункт меню: мягкая подложка (`pill`), подчёркивание (`underline`) или
 * полоса у края (`bar`). `vertical` — колонка: у полосы край слева, в строке —
 * снизу.
 */
export function navItemClass(nav: NavLook, active: boolean, vertical: boolean): string {
  if (nav === 'underline') {
    return cn(
      'rounded-none bg-transparent',
      active ? 'font-bold text-ink shadow-[inset_0_-2px_0_var(--color-ink)]' : 'font-medium text-ink-muted hover:text-ink',
    );
  }
  if (nav === 'bar') {
    return cn(
      'rounded-[min(var(--radius-small),6px)]',
      active
        ? cn('bg-accent-soft font-bold text-accent-ink', vertical
          ? 'shadow-[inset_3px_0_0_var(--color-shop)]'
          : 'shadow-[inset_0_-3px_0_var(--color-shop)]')
        : 'font-medium text-ink-muted hover:bg-ink/5 hover:text-ink',
    );
  }
  return cn(
    'rounded-[var(--radius-small)]',
    active ? 'bg-accent-soft font-bold text-accent-ink' : 'font-medium text-ink-muted hover:bg-ink/5 hover:text-ink',
  );
}

export type ChipLook = TemplateStyle['chip'];

/**
 * Чип рубрики: заливка цветом магазина (`pill`), рамка с мягкой подложкой
 * (`outline`) или подчёркивание (`underline`). `sale` — чип «Со скидкой»
 * в тонах скидки, пока он не выбран.
 */
export function chipClass(chip: ChipLook, selected: boolean, sale = false): string {
  if (chip === 'underline') {
    return cn(
      'h-[2.375rem] rounded-none border-0 border-b-2 px-0.5',
      selected ? 'border-ink font-bold text-ink' : cn('border-transparent hover:text-ink', sale ? 'text-sale-ink' : 'text-ink-muted'),
    );
  }
  if (chip === 'outline') {
    return cn(
      'h-[2.375rem] rounded-[min(var(--radius-small),6px)] border px-3.5',
      selected
        ? 'border-shop bg-accent-soft text-accent-ink'
        : sale ? 'border-sale-line bg-sale-soft text-sale-ink hover:border-sale' : 'border-hairline bg-surface text-ink hover:border-ink',
    );
  }
  return cn(
    'h-[2.375rem] rounded-[var(--radius-chip)] border px-4',
    selected
      ? 'border-accent bg-accent text-on-accent shadow-[0_8px_16px_-12px_var(--color-brand-deep)]'
      : sale ? 'border-sale-line bg-sale-soft text-sale-ink hover:border-sale' : 'border-hairline bg-surface text-ink hover:border-ink',
  );
}

export type PriceLook = TemplateStyle['price'];

/**
 * Цифра цены: крупно (`plain`), ценником второго цвета (`tag`),
 * моноширинно (`mono`) или от руки (`hand`). `sale` — цена со скидкой, `onImage` — поверх снимка.
 */
export function priceClass(price: PriceLook, sale: boolean, onImage = false): string {
  if (price === 'tag') {
    return cn(
      'rounded-[var(--radius-chip)] px-[0.45em] py-[0.15em] leading-[1.2]',
      sale ? 'bg-accent2 text-accent2-ink' : 'bg-accent-soft text-accent-ink',
    );
  }
  if (price === 'hand') {
    // Цена маркером — как на рыночной картонке: рукописная, крупнее цифры набором.
    return cn('text-[1.4em] font-bold leading-none [font-family:var(--font-hand)]', onImage ? 'text-white' : sale ? 'text-sale' : 'text-ink');
  }
  return cn(
    'tracking-[-0.02em]',
    price === 'mono' && 'font-mono',
    onImage ? 'text-white' : sale ? 'text-sale' : 'text-ink',
  );
}
