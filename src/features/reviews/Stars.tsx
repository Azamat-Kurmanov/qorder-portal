import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n';
/**
 * Звёзды оценки: одна и та же фигура и в списке, и в форме.
 *
 * Отдельным модулем, а не по месту: нарисованная дважды звезда через месяц
 * оказывается двумя разными звёздами — и та, что в форме, перестаёт совпадать
 * с той, что в отзыве.
 */
export function Star({ filled, className = 'size-5' }: { filled: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="m12 4 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 4Z" />
    </svg>
  );
}

/**
 * Оценка звёздами — только для чтения.
 *
 * Подпись читается вслух числом: пять одинаковых фигур подряд озвучиванию
 * ничего не сообщают.
 */
export function Stars({ value, size, label }: {
  value: number;
  /** Класс размера звезды, по умолчанию 20 точек. */
  size?: string;
  /** Подпись для диктора вместо «Оценка N из 5» — например, «Пока нет оценок». */
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-0.5 text-accent"
      // Средняя вроде 4,333… читается вслух одним знаком и в записи языка: «4,3».
      aria-label={label ?? t('reviews.stars', { value: value.toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} filled={star <= Math.round(value)} className={size} />
      ))}
    </span>
  );
}
