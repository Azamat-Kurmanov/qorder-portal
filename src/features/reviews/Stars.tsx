import { useTranslation } from 'react-i18next';
/**
 * Звёзды оценки: одна и та же фигура и в списке, и в форме.
 *
 * Отдельным модулем, а не по месту: нарисованная дважды звезда через месяц
 * оказывается двумя разными звёздами — и та, что в форме, перестаёт совпадать
 * с той, что в отзыве.
 */
export function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
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
export function Stars({ value }: { value: number }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-0.5 text-accent"
      aria-label={t('reviews.stars', { value })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} filled={star <= Math.round(value)} />
      ))}
    </span>
  );
}
