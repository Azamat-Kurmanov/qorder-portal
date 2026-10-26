import { useTranslation } from 'react-i18next';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { PriceLook } from '../../../supplier/templateLook';
import { priceClass } from '../../../supplier/templateLook';
import { money } from '../../../shared/format';
import { useSupplierCurrency } from '../../../supplier/SupplierCurrency';
import { quantityWithUnit, unitPer } from '../../../shared/units';
import { cn } from '../../../ui/cn';

/** Кегль цены в плитке шаблона: как в макете — 16, 18, 20 и 22 точки. */
const SIZES = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-[1.375rem]',
} as const;

/**
 * Цена в характере шаблона: крупной цифрой, ценником второго цвета или
 * моноширинно (`priceClass`). Старая цена — зачёркнутой рядом, единица —
 * мелко: «за мешок» читается раньше, чем человек умножит не на то.
 */
export function TemplatePrice({
  item,
  look,
  size = 'md',
  onImage = false,
  unit = true,
  className,
}: {
  item: Pick<ShowcaseItemDto, 'price' | 'oldPrice' | 'unit' | 'wholesale'> & Partial<Pick<ShowcaseItemDto, 'yourPrice'>>;
  look: PriceLook;
  size?: keyof typeof SIZES;
  /** Поверх снимка: цифры белые, старая цена — светлая. */
  onImage?: boolean;
  /** Подпись «за шт» рядом; в тесной строке с кнопкой её можно убрать. */
  unit?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const sale = item.oldPrice !== undefined;
  return (
    <span className={cn('flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5', className)}>
      <b className={cn('whitespace-nowrap font-extrabold tabular-nums', SIZES[size], priceClass(look, sale, onImage))}>
        {money(item.price, currency)}
      </b>
      {sale && (
        <s className={cn('whitespace-nowrap text-xs font-medium tabular-nums', onImage ? 'text-white/70' : 'text-ink-muted')}>
          {money(item.oldPrice!, currency)}
        </s>
      )}
      {unit && (
        <span className={cn('whitespace-nowrap text-xs font-semibold', onImage ? 'text-white/80' : 'text-ink-muted')}>
          {t('catalog.priceNote.perUnit', { unit: unitPer(item.unit) })}
        </span>
      )}
      {item.yourPrice ? (
        <span data-testid="your-price" className={cn('whitespace-nowrap text-xs font-bold', onImage ? 'text-white' : 'text-accent')}>
          {t('catalog.yourPrice')}
        </span>
      ) : (
        // Опт к цене по договорённости не применяется: подсказка о нём сбивала бы с толку.
        <WholesaleNote item={item} className={onImage ? 'text-white/80' : undefined} />
      )}
    </span>
  );
}

/**
 * Опт на плитке — условие и выгода одной строкой: «Опт: 85 за мешок — упаковками
 * по 20 мешков» (цена за штуку на лучшей ступени). Все ступени — в карточке. Товар «только опт» уже
 * показан ценой упаковки, и ему — вложение: «по 20 мешков».
 */
export function WholesaleNote({ item, className }: { item: Pick<ShowcaseItemDto, 'wholesale'>; className?: string }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const wholesale = item.wholesale;
  if (!wholesale) return null;
  const best = Math.min(...wholesale.tiers.map((tier) => tier.price));
  return (
    // Ширина, а не `basis-full`: в строке цены переносит на свою строку так же, а в столбике
    // карточки телефона `basis-full` означал всю высоту — имя схлопывалось, под оптом зияла пустота.
    <span data-testid="wholesale-note" className={cn('w-full text-xs font-semibold text-ink-muted', className)}>
      {wholesale.retail
        ? t('catalog.wholesale.from', {
          price: money(Math.round(best / wholesale.packQty), currency),
          unit: unitPer(wholesale.pieceUnit),
          amount: quantityWithUnit(wholesale.packQty, wholesale.pieceUnit),
        })
        : t('cart.wholesale.pack', { amount: quantityWithUnit(wholesale.packQty, wholesale.pieceUnit) })}
    </span>
  );
}
