import { dayMonth } from '../../shared/format';
import { useTranslation } from 'react-i18next';
import type { WhatsappArchiveMessageDto } from '../../api/generated';
import { intlLocale } from '../../i18n';

/**
 * Архив переписки с магазином в WhatsApp — только для чтения.
 *
 * Нужен на случай, когда в телефоне переписка пропала (сменили телефон,
 * случайно удалили чат): здесь лежит всё, что клиент и магазин писали друг
 * другу. Отвечать отсюда нельзя — это архив, а не чат: ответ ушёл бы не туда,
 * где клиент его ждёт.
 *
 * Пузыри — те же, что во вкладке вопросов: своё справа и тёмное, магазина —
 * слева и светлое. Сообщения разбиты по дням: «что писали 3-го» ищут по дате.
 */
export function WhatsappArchive({ messages }: { messages: WhatsappArchiveMessageDto[] }) {
  const { t } = useTranslation();
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' });

  let lastDay = '';
  return (
    <section aria-label={t('questions.archive.title')} className="flex flex-col gap-4">
      <p className="rounded-[var(--radius-card)] border border-hairline bg-sunk px-4 py-3 text-caption leading-relaxed text-ink-muted">
        {t('questions.archive.note')}
      </p>
      <ol className="flex flex-col gap-2">
        {messages.map((message, index) => {
          const date = new Date(message.at);
          const dayLabel = dayMonth(date, true);
          const showDay = dayLabel !== lastDay;
          lastDay = dayLabel;
          const mine = !message.fromShop;
          return (
            <li key={`${message.at}-${index}`} className="flex flex-col gap-2">
              {showDay ? (
                <div className="mt-2 flex justify-center">
                  <span className="rounded-[var(--radius-pill)] bg-sunk px-3 py-1 text-2xs text-ink-subtle">{dayLabel}</span>
                </div>
              ) : null}
              <div className={mine ? 'flex max-w-[82%] flex-col items-end gap-1 self-end' : 'flex max-w-[86%] flex-col items-start gap-1 self-start'}>
                <div
                  className={
                    mine
                      ? 'whitespace-pre-wrap [overflow-wrap:anywhere] rounded-[16px_16px_4px_16px] bg-ink px-3.5 py-2.5 text-[0.875rem] leading-[1.45] text-on-ink'
                      : 'whitespace-pre-wrap [overflow-wrap:anywhere] rounded-[16px_16px_16px_4px] border border-hairline bg-surface px-3.5 py-2.5 text-[0.875rem] leading-[1.45] text-ink'
                  }
                >
                  {message.text}
                </div>
                <span className="text-2xs text-ink-faint">
                  {mine ? t('questions.archive.you') : t('questions.archive.shop')} · {time.format(date)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
