import { useTranslation } from 'react-i18next';
import type { ShowcaseItemDto } from '../../../api/generated';
import type { PriceLook } from '../../../supplier/templateLook';
import { priceClass } from '../../../supplier/templateLook';
import { money } from '../../../shared/format';
import { useSupplierCurrency } from '../../../supplier/SupplierCurrency';
import { quantityWithUnit, unitPer } from '../../../shared/units';
import { cn } from '../../../ui/cn';
import { perUnitNote, saleChannel } from '../itemParts';

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
      <b className={cn('whitespace-nowrap font-extrabold tabular-nums', SIZES[size], priceClass(look, sale, onImage),
        // Цена упаковки у товара «только опт» — цветом опта, чтобы её не приняли за розничную.
        !sale && !onImage && saleChannel(item) === 'wholesale' && 'text-wholesale')}>
        {money(item.price, currency)}
      </b>
      {sale && (
        <s className={cn('whitespace-nowrap text-xs font-medium tabular-nums', onImage ? 'text-white/70' : 'text-ink-muted')}>
          {money(item.oldPrice!, currency)}
        </s>
      )}
      {unit && (
        <span className={cn('whitespace-nowrap text-xs font-semibold', onImage ? 'text-white/80' : 'text-ink-muted')}>
          {perUnitNote(item, t)}
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
 * Опт на плитке — цена упаковки и вложение в скобках: «Оптом: от 11 000 за упаковку (10 кг)»
 * (решение владельца 2026-10-28: опт покупают упаковкой, и цену называют её). «от» — когда
 * ступеней несколько: дешевле всего на последней. Все ступени — в карточке. Товар «только опт»
 * уже показан ценой упаковки, и ему — одно вложение: «(10 кг)».
 */
export function WholesaleNote({ item, className }: { item: Pick<ShowcaseItemDto, 'wholesale'>; className?: string }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const wholesale = item.wholesale;
  if (!wholesale) return null;
  const best = Math.min(...wholesale.tiers.map((tier) => tier.price));
  const contents = quantityWithUnit(wholesale.packQty, wholesale.pieceUnit);
  return (
    // Ширина, а не `basis-full`: в строке цены переносит на свою строку так же, а в столбике
    // карточки телефона `basis-full` означал всю высоту — имя схлопывалось, под оптом зияла пустота.
    // Цветом опта: это цена не за штуку, и её не должны принять за розничную.
    <span data-testid="wholesale-note" className={cn('w-full text-xs font-semibold text-wholesale', className)}>
      {wholesale.retail && wholesale.packQty === 1
        // Поштучный опт: «упаковка (1 шт.)» читалось как бессмыслица — называем порог.
        ? t('catalog.wholesale.fromPieces', {
          price: money(best, currency),
          unit: unitPer(wholesale.pieceUnit),
          amount: quantityWithUnit(Math.min(...wholesale.tiers.map((tier) => tier.from)), wholesale.pieceUnit),
        })
        : wholesale.retail
        ? t(wholesale.tiers.length > 1 ? 'catalog.wholesale.packFrom' : 'catalog.wholesale.pack', {
          price: money(best, currency),
          unit: unitPer(wholesale.unit),
          amount: contents,
        })
        : t('catalog.wholesale.contents', { amount: contents })}
    </span>
  );
}
