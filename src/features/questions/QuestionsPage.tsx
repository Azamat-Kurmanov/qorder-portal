import { Link } from 'react-router-dom';
import {
  useGetPortalCatalogItem,
  useGetPortalQuestions,
  type QuestionThreadDto,
} from '../../api/generated';
import { useSetCartLine } from '../cart/useCart';
import { MessageComposer } from './MessageComposer';
import { shortDate, tenge } from '../../shared/format';
import { Button } from '../../ui/Button';
import { Reveal } from '../../ui/Reveal';

/**
 * Переписка с продавцом.
 *
 * Отдельной вкладкой, а не веткой в заявках: вопрос «когда будет М500» ничего
 * не заказывает, и, попав в очередь заявок, он либо потеряется, либо запутает
 * менеджера. На стороне продавца это обращение со своим номером — его клиент
 * и назовёт по телефону.
 *
 * Разговор идёт пузырями, а не абзацами: вопрос и ответ на одной поверхности
 * читаются как один текст, и через день человек уже не помнит, что сказал он,
 * а что — продавец. Сторона и фон отвечают на это без единого слова.
 *
 * Над каждым разговором стоит позиция и дата: переписка о трёх товарах идёт
 * одной лентой, и без заголовка ответ про доставку читается как ответ
 * про цемент.
 */
export function QuestionsPage() {
  const questions = useGetPortalQuestions();
  const threads = questions.data?.status === 200 ? questions.data.data : [];

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">Вопросы продавцу</h1>
        <p className="text-[13px] text-ink-subtle">Переписка о товаре, сроках и доставке</p>
      </header>

      {questions.isPending ? (
        <div
          data-testid="questions-skeleton"
          className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk"
        />
      ) : threads.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-ink-subtle">
          Здесь вы спрашиваете продавца о товаре, сроках и доставке, а он отвечает.
          Переписка не мешается с заявками: вопрос ничего не заказывает.
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {threads.map((thread, index) => (
            <li key={thread.id}>
              <Reveal delay={Math.min(index, 3) * 0.04}>
                <Thread thread={thread} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      <MessageComposer />
    </div>
  );
}

function Thread({ thread }: { thread: QuestionThreadDto }) {
  return (
    <article data-testid={`thread-${thread.id}`} className="flex flex-col gap-2">
      <div data-testid={`thread-subject-${thread.id}`} className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <span>{shortDate(thread.askedAt)}</span>
          <span aria-hidden="true">·</span>
          {/* Номер обращения — то, чем клиент назовёт разговор по телефону. */}
          <span className="text-ink-faint">{thread.number}</span>
        </div>
        {thread.itemName && (
          <span className="max-w-full truncate rounded-full bg-sunk px-2.5 py-1 text-[12px] text-ink-muted">
            {thread.itemName}
          </span>
        )}
      </div>

      <div className="flex max-w-[82%] flex-col items-end gap-1 self-end">
        <p className="rounded-[16px_16px_4px_16px] bg-ink px-3.5 py-2.5 text-[14px] leading-[1.45] text-white">
          {thread.question}
        </p>
        <span className="text-[11px] text-ink-subtle">{atTime(thread.askedAt)}</span>
      </div>

      {thread.answered && thread.answer ? (
        <div className="flex max-w-[86%] flex-col items-start gap-1 self-start">
          <p className="rounded-[16px_16px_16px_4px] border border-hairline bg-surface px-3.5 py-2.5 text-[14px] leading-[1.45] text-ink">
            {thread.answer}
          </p>
          {/*
            Подпись говорит ровно то, что известно: имени менеджера в ответе
            сервера нет, и придуманное имя однажды окажется чужим.
          */}
          <span className="text-[11px] text-ink-subtle">
            Ответ продавца{thread.answeredAt ? ` · ${atTime(thread.answeredAt)}` : ''}
          </span>
        </div>
      ) : (
        // «Ждёт ответа» — не украшение: без него человек не знает, дошёл ли
        // вопрос вообще, и спрашивает второй раз.
        <p className="self-start text-sm text-unclear">Ждёт ответа продавца</p>
      )}

      {thread.itemId && <DiscussedItem itemId={thread.itemId} />}
    </article>
  );
}

/**
 * Позиция, о которой шёл разговор, — прямо под ним.
 *
 * Цена и единица приходят из карточки, а не из переписки: в самом обращении
 * их нет, а решение принимают по ним. Заодно цена оказывается сегодняшней —
 * ответ продавца мог быть написан неделю назад.
 *
 * Ничего не показывается, пока карточка не пришла или не открылась: позицию
 * могли снять с продажи, и карточка с кнопкой «в заявку» обещала бы то, чего
 * сервер уже не примет. О чём шёл разговор, сказано выше названием.
 */
function DiscussedItem({ itemId }: { itemId: string }) {
  const card = useGetPortalCatalogItem(itemId);
  const setLine = useSetCartLine();

  if (card.data?.status !== 200) return null;
  const item = card.data.data;

  return (
    <div className="flex w-full max-w-[86%] flex-col gap-2.5 self-start rounded-[16px_16px_16px_4px] border border-hairline bg-surface p-3">
      <div className="flex flex-col gap-0.5">
        <Link
          to={`/catalog/${item.id}`}
          className="text-[13px] font-medium text-ink transition-all duration-300 hover:text-accent"
        >
          {item.name}
        </Link>
        <p className="text-[13px] font-semibold tabular-nums text-ink">
          {tenge(item.price)}
          <span className="font-normal text-ink-subtle"> · {item.unit}</span>
        </p>
      </div>

      {/*
        Одна единица, а не выбор количества: из переписки возвращаются
        к решению «беру», а сколько — набирают в заявке, где видна сумма.
      */}
      <Button
        type="button"
        variant="soft"
        className="w-full"
        disabled={setLine.isPending}
        onClick={() => setLine.mutate({ itemId: item.id, data: { quantity: 1 } })}
      >
        {setLine.isSuccess ? 'В заявке' : 'Добавить в заявку'}
      </Button>
    </div>
  );
}

/** Время без даты: дата стоит над разговором, и повторять её у каждой реплики нечего. */
function atTime(iso: string): string {
  const moment = new Date(iso);
  return Number.isNaN(moment.getTime())
    ? ''
    : new Intl.DateTimeFormat('ru-KZ', { hour: '2-digit', minute: '2-digit' }).format(moment);
}
