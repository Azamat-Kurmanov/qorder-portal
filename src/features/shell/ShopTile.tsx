import { useState } from 'react';
import type { PortalSupplierDto } from '../../api/generated';
import { cn } from '../../ui/cn';
import { readableOn } from '../../supplier/supplierTheme';

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Буква на плитке: первая буква имени в кавычках, а не «И» от «ИП». */
function shopLetter(name: string): string {
  const quoted = name.match(/[«"„]\s*(\p{L})/u);
  const first = name.match(/\p{L}/u);
  return (quoted?.[1] ?? first?.[0] ?? '?').toUpperCase();
}

/**
 * Две буквы знака в шапке шаблона — первые буквы двух первых слов без
 * кавычек, как в макете: «ИП «Мухамедиева»» → «ИМ». В списках магазинов
 * остаётся одна буква (`shopLetter`): там рядом стоит имя, и «И» от «ИП»
 * у десятка магазинов одинаково.
 */
function shopInitials(name: string): string {
  const words = name.replace(/[«»"„“”']/g, ' ').split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word.match(/\p{L}|\p{N}/u)?.[0] ?? '').join('');
  return (letters || shopLetter(name)).toUpperCase();
}

/**
 * Знак магазина: его картинка, а без неё — буква на его фирменном цвете.
 *
 * Буква, а не пустое место: у клиента с десятком магазинов список без
 * знаков читается как столбец одинаковых строк. Цвет — тот, что выбрал
 * продавец; не выбрал — цвет платформы. Картинка не загрузилась (ссылки
 * Google Диска изредка не отвечают) — тоже буква, а не значок битой картинки.
 */
export function ShopTile({
  supplier,
  alt = '',
  className,
  initials = false,
}: {
  supplier: Pick<PortalSupplierDto, 'name' | 'logoUrl' | 'brandColor'>;
  /** Две буквы вместо одной — знак в шапке шаблона. */
  initials?: boolean;
  /** Подпись картинки: в шапке знак называет магазин, в списках рядом и так стоит имя. */
  alt?: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (supplier.logoUrl && supplier.logoUrl !== failedUrl) {
    // Подложка логотипа белая и ночью: логотипы рисуют под светлый фон, и прозрачный
    // логотип с тёмными буквами на тёмной карточке пропадал.
    return (
      <img
        src={supplier.logoUrl}
        alt={alt}
        onError={() => setFailedUrl(supplier.logoUrl ?? null)}
        className={cn('shrink-0 rounded-[10px] border border-hairline bg-white object-contain', className)}
      />
    );
  }

  const color = supplier.brandColor && HEX.test(supplier.brandColor) ? supplier.brandColor : undefined;
  return (
    <span
      aria-hidden="true"
      // Надпись — по цвету этого магазина: `on-brand` посчитан для открытого магазина,
      // и на чужом цвете буква сливалась (белая на жёлтом — 1,6:1).
      style={color ? { backgroundColor: color, color: readableOn(color) } : undefined}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[10px] bg-banner font-extrabold text-on-brand',
        className,
      )}
    >
      {initials ? shopInitials(supplier.name) : shopLetter(supplier.name)}
    </span>
  );
}
