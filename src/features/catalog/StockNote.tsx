import { cn } from '../../ui/cn';
import { money } from '../../shared/format';

/**
 * Наличие в том виде, который выбрал поставщик.
 *
 * «Наличие уточняется» — это не «нет в наличии»: система не знает, что товара
 * нет, она знает, что не может подтвердить. Обещать за поставщика нельзя.
 */
export function StockNote({
  stock,
  available,
  className,
}: {
  stock?: string;
  available?: number | null;
  className?: string;
}) {
  // Сравнение с null обязательно, а не только с undefined: при наличии флагом
  // сервер присылает поле со значением null, и проверка на одно лишь undefined
  // рисовала бы «Свободно: 0» там, где остаток есть, но числом не показывается.
  if (available !== undefined && available !== null) {
    return (
      <StockLine tone={available > 0 ? 'in-stock' : 'subtle'} className={className}>
        Свободно: {money(available)}
      </StockLine>
    );
  }
  if (stock === 'IN_STOCK') return <StockLine tone="in-stock" className={className}>В наличии</StockLine>;
  if (stock === 'UNKNOWN') {
    return <StockLine tone="unclear" className={className}>Наличие уточняется</StockLine>;
  }
  return null;
}

/**
 * Строка наличия.
 *
 * Размер и отступ приходят снаружи: в строке витрины она делит место с
 * действием и набрана мелким, в карточке стоит отдельным абзацем. Развести
 * это двумя компонентами значило бы однажды поправить цвет в одном из них.
 */
function StockLine({
  tone,
  className,
  children,
}: {
  tone: 'in-stock' | 'unclear' | 'subtle';
  className?: string;
  children: React.ReactNode;
}) {
  const color = {
    'in-stock': 'text-in-stock',
    unclear: 'text-unclear',
    subtle: 'text-ink-subtle',
  }[tone];

  return (
    <span className={cn('mt-1 inline-flex items-center gap-1.5 text-sm', color, className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
