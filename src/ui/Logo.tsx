import { cn } from './cn';
import logoLight from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';

/** Имя системы — оно же подпись знака для экранного читателя; не переводится. */
export const PRODUCT_NAME = 'FastOrders';

/**
 * Знак продукта: отвечает на вопрос «чья это система» в углу каждого экрана.
 *
 * Изображений два: у знака светлая заливка, и на тёмном полотне она светится
 * пятном. Своей тёмной темы у кабинета нет, поэтому вариант выбирает не она,
 * а настройка браузера — `prefers-color-scheme` в src/index.css. Переключает
 * CSS, а не React-состояние: знак стоит и на экранах входа, которые рисуются
 * вне провайдеров, и хук темы там упал бы на отсутствующем контексте.
 *
 * Скрытый вариант убран `display: none`, а не прозрачностью: так он выпадает
 * и из дерева доступности — одинаковая подпись обоих изображений не читается
 * экранным читателем дважды.
 *
 * Рядом с надписью «FastOrders» знак ставится как `decorative`: имя системы
 * экранный читатель обязан услышать один раз, а не дважды подряд.
 */
export function Logo({
  height,
  decorative = false,
  className,
}: {
  /**
   * Высота в точках. Без неё высоту задаёт `className` — так шапка кабинета
   * держит знак крупнее на мониторе, чем на телефоне, где ширину у него
   * оспаривает имя поставщика. Числом её задать нельзя: одно значение
   * на обе ширины и есть та самая уступка, ради которой всё это писалось.
   */
  height?: number;
  decorative?: boolean;
  className?: string;
}) {
  const common = {
    alt: decorative ? '' : PRODUCT_NAME,
    'aria-hidden': decorative || undefined,
    style: height === undefined ? undefined : { height, width: 'auto' },
    className: cn('w-auto shrink-0', height === undefined && 'h-6', className),
  };

  return (
    <>
      <img data-fo-logo="light" src={logoLight} {...common} />
      <img data-fo-logo="dark" src={logoDark} {...common} />
    </>
  );
}
