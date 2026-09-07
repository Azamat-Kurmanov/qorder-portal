import { cn } from './cn';
import logo from '../assets/logo.png';

/** Имя системы — оно же подпись знака для экранного читателя; не переводится. */
export const PRODUCT_NAME = 'FastOrders';

/**
 * Знак продукта: отвечает на вопрос «чья это система» в углу каждого экрана.
 *
 * Изображение одно: палитра у кабинета одна (src/index.css — тёмную владелец
 * пробовал и отложил), и второй файл под тёмное полотно был бы мёртвым кодом.
 * Понадобится тёмная — рядом ляжет вариант со светлым знаком, как в рабочем
 * месте менеджера.
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
  return (
    <img
      src={logo}
      alt={decorative ? '' : PRODUCT_NAME}
      aria-hidden={decorative || undefined}
      style={height === undefined ? undefined : { height, width: 'auto' }}
      className={cn('w-auto shrink-0', height === undefined && 'h-6', className)}
    />
  );
}
