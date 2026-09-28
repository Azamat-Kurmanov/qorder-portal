import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * «Что значит статус» — рядом со списком заявок, как в макете.
 *
 * Статусы названы словами продавца, а покупатель видит их впервые:
 * «Принята» и «Можно забирать» для него звучат одинаково. Четыре строки
 * рядом со списком снимают вопрос раньше, чем он уйдёт звонком в магазин.
 */
const ITEMS = ['checking', 'answer', 'accepted', 'ready'] as const;

export function StatusHelp() {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <aside aria-labelledby={titleId} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5 shadow-[0_0_0_1px_var(--color-hairline)]">
      <h2 id={titleId} className="m-0 text-base font-extrabold text-ink">{t('orders.help.title')}</h2>
      <dl className="m-0 flex flex-col gap-3">
        {ITEMS.map((item) => (
          <div key={item} className="flex flex-col gap-0.5">
            <dt className="text-sm font-bold text-ink">{t(`orders.help.${item}.title`)}</dt>
            <dd className="m-0 text-caption leading-normal text-ink-muted">{t(`orders.help.${item}.text`)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
