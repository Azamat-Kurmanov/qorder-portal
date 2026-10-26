import { SectionHead } from '../shell/SectionHead';
import { ItemThumb } from '../catalog/ItemThumb';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  useGetPortalCatalogItem,
  useGetPortalQuestion,
  useGetPortalQuestions,
  useGetWhatsappArchive,
  type QuestionThreadDto,
  type QuestionThreadSummaryDto,
} from '../../api/generated';
import { useSetCartLine } from '../cart/useCart';
import { MessageComposer } from './MessageComposer';
import { WhatsappArchive } from './WhatsappArchive';
import { shortDate, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Button } from '../../ui/Button';
import { MessageCircle } from '../../ui/icons';

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
 * Над разговором стоят дата и номер, а позиция — у того сообщения, к которому
 * её прикрепили: переписка о трёх товарах идёт одной лентой, и общий заголовок
 * с позицией превратил бы ответ про доставку в ответ про цемент.
 */
export function QuestionsPage() {
  const { t } = useTranslation();
  const { threadId } = useParams<{ threadId?: string }>();
  const archive = useGetWhatsappArchive();
  const archived = archive.data?.status === 200 ? archive.data.data : [];
  // Вкладка архива — только тем, кто писал магазину в WhatsApp: остальным пустая вкладка ни к чему.
  const [tab, setTab] = useState<'questions' | 'archive'>('questions');
  const showArchive = archived.length > 0;
  const current = showArchive ? tab : 'questions';

  // Открытая ветка — своим экраном (макет К2.14): список не мешает читать разговор.
  if (threadId) return <ThreadScreen threadId={threadId} />;

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5">
      <SectionHead title={t('questions.title')} subtitle={t('questions.subtitleThreads')} />

      {showArchive ? (
        <div role="tablist" aria-label={t('questions.title')} className="flex gap-1 rounded-[0.875rem] bg-sunk p-1 lg:inline-flex lg:self-start">
          {(['questions', 'archive'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={current === key}
              onClick={() => setTab(key)}
              className={
                current === key
                  ? 'h-10 flex-1 cursor-pointer rounded-[0.6875rem] border-0 bg-surface px-4 text-sm font-bold text-ink shadow-sm'
                  : 'h-10 flex-1 cursor-pointer rounded-[0.6875rem] border-0 bg-transparent px-4 text-sm font-bold text-ink-muted hover:text-ink'
              }
            >
              {key === 'questions' ? t('questions.tabQuestions') : t('questions.archive.title')}
            </button>
          ))}
        </div>
      ) : null}

      {current === 'archive' ? <WhatsappArchive messages={archived} /> : <>
        <ThreadList />
        {/* Новый вопрос — новая ветка: у продавца это отдельное обращение со своим номером. */}
        <MessageComposer />
      </>}
    </div>
  );
}

/** Список веток: о чём, последнее сообщение, когда и ждёт ли ответа. */
function ThreadList() {
  const { t } = useTranslation();
  const questions = useGetPortalQuestions();
  const threads: QuestionThreadSummaryDto[] = questions.data?.status === 200 ? questions.data.data : [];

  if (questions.isPending) {
    return <div data-testid="questions-skeleton" className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk" />;
  }
  if (threads.length === 0) {
    return <p className="text-body leading-relaxed text-ink-subtle">{t('questions.empty')}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-[1.25rem] bg-surface">
      {threads.map((thread) => {
        const last = thread.lastMessage;
        const mine = last?.author === 'CUSTOMER';
        return (
          <li key={thread.id}>
            <Link
              to={`/questions/${thread.id}`}
              data-testid={`thread-${thread.id}`}
              className="flex items-start gap-3 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              {thread.itemId ? (
                <ItemThumb itemId={thread.itemId} className="size-12 shrink-0 rounded-[0.875rem]" />
              ) : (
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-accent-soft text-accent-ink">
                  <MessageCircle className="size-6" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <b className="truncate text-[0.9375rem] font-bold text-ink">{thread.itemName ?? t('questions.general')}</b>
                  <span className="shrink-0 text-xs text-ink-subtle">{last ? shortDate(last.createdAt) : ''}</span>
                </span>
                {last ? (
                  <span className="line-clamp-2 text-sm text-ink-muted">
                    {mine ? t('questions.you') : t('questions.seller')}: {last.text}
                  </span>
                ) : null}
                <span className="flex items-center gap-2">
                  <span className={thread.awaitingAnswer
                    ? 'rounded-full bg-sunk px-2.5 py-0.5 text-xs font-bold text-ink-muted'
                    : 'rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok-ink'}
                  >
                    {thread.awaitingAnswer ? t('questions.waitingShort') : t('questions.answered')}
                  </span>
                  {thread.unreadAnswers > 0 ? (
                    <span role="img" aria-label={t('questions.unread', { count: thread.unreadAnswers })}
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sale px-1.5 text-xs font-extrabold text-white">
                      {thread.unreadAnswers}
                    </span>
                  ) : null}
                  <span className="text-xs text-ink-faint">{thread.number}</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Одна ветка: разговор целиком и поле, которое пишет в неё же. */
function ThreadScreen({ threadId }: { threadId: string }) {
  const { t } = useTranslation();
  const thread = useGetPortalQuestion(threadId);
  const data = thread.data?.status === 200 ? thread.data.data : undefined;
  const subject = data?.messages.find((message) => message.itemName)?.itemName;
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5">
      <SectionHead back="/questions" title={subject ?? t('questions.general')} subtitle={data?.number} />
      {thread.isPending ? (
        <div data-testid="questions-skeleton" className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk" />
      ) : data ? <Thread thread={data} /> : (
        <p className="text-body text-ink-subtle">{t('questions.notFound')}</p>
      )}
      {data ? <MessageComposer threadId={threadId} /> : null}
    </div>
  );
}

function Thread({ thread }: { thread: QuestionThreadDto }) {
  const { t } = useTranslation();
  const messages = thread.messages ?? [];
  /*
    Позиция под лентой — та, о которой говорили последней: разговор
    возвращается к решению «беру», а решают по цене того товара, про который
    только что спросили, а не первого за всю переписку.
  */
  const withItem = messages.filter((message) => message.itemId);
  const discussed = withItem[withItem.length - 1];

  return (
    // Как в макете: разговор — карточкой, сверху о чём и когда, справа — ждёт ли он ответа.
    <article
      data-testid={`thread-${thread.id}`}
      className="flex flex-col gap-2 rounded-[1.375rem] bg-surface p-3.5 shadow-[2px_3px_6px_rgba(58,48,30,.07)]"
    >
      <div data-testid={`thread-subject-${thread.id}`} className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-ink-muted">
          {/* Товар назван у самого сообщения — здесь только когда и какое обращение. */}
          {/* Номер обращения — в заголовке экрана ветки; здесь — когда начат разговор. */}
          <span className="shrink-0">{shortDate(messages[0]?.createdAt)}</span>
        </span>
        {/*
          «Ждёт ответа» — не украшение: без него человек не знает, дошло ли
          сообщение вообще, и пишет второй раз.
        */}
        <span
          className={
            thread.awaitingAnswer
              ? 'shrink-0 rounded-full bg-sale-soft px-2.5 py-1 text-xs font-bold text-sale-ink'
              : 'shrink-0 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok-ink'
          }
        >
          {thread.awaitingAnswer ? t('questions.waitingShort') : t('questions.answered')}
        </span>
      </div>

      {messages.map((message) => {
        const mine = message.author === 'CUSTOMER';
        return (
          <div
            key={message.id}
            data-testid={`message-${message.id}`}
            className={
              mine
                ? 'flex max-w-[82%] flex-col items-end gap-1 self-end'
                : 'flex max-w-[86%] flex-col items-start gap-1 self-start'
            }
          >
            {/*
              Позиция висит на своём сообщении, а не общей плашкой сверху:
              переписка о трёх товарах идёт одной лентой, и общий заголовок
              превратил бы ответ про доставку в ответ про цемент.
            */}
            {message.itemName && (
              <span className="max-w-full truncate rounded-[var(--radius-pill)] bg-sunk px-2.5 py-1 text-[0.75rem] text-ink-muted">
                {message.itemName}
              </span>
            )}
            <p
              className={
                mine
                  ? 'rounded-[16px_16px_4px_16px] bg-accent px-3.5 py-2.5 text-[0.9375rem] leading-[1.45] text-on-accent'
                  : 'rounded-[16px_16px_16px_4px] bg-canvas px-3.5 py-2.5 text-[0.9375rem] leading-[1.45] text-ink'
              }
            >
              {message.text}
            </p>
            {/*
              Подпись говорит ровно то, что известно: имени менеджера в ответе
              сервера нет, и придуманное имя однажды окажется чужим.
            */}
            <span className="text-2xs text-ink-subtle">
              {mine
                ? atTime(message.createdAt)
                : `${t('questions.sellerAnswer')} · ${atTime(message.createdAt)}`}
            </span>
          </div>
        );
      })}

      {discussed?.itemId && <DiscussedItem itemId={discussed.itemId} />}
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
 * Первое фото карточки стоит рядом с названием: о чём спрашивали, узнаётся
 * по снимку быстрее, чем по имени. Без фото — тот же заполнитель, что в витрине.
 *
 * Ничего не показывается, пока карточка не пришла или не открылась: позицию
 * могли снять с продажи, и карточка с кнопкой «в заявку» обещала бы то, чего
 * сервер уже не примет. О чём шёл разговор, сказано выше названием.
 */
function DiscussedItem({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const card = useGetPortalCatalogItem(itemId);
  const setLine = useSetCartLine();

  if (card.data?.status !== 200) return null;
  const item = card.data.data;
  const photo = item.media?.find((media) => media.kind === 'PHOTO')?.url;

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-[1rem] bg-canvas p-3">
      <div className="flex items-center gap-3">
        <ItemThumb itemId={item.id} src={photo} className="size-14 rounded-[10px]" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            to={`/catalog/${item.id}`}
            className="text-caption font-medium text-ink transition-all duration-300 hover:text-accent"
          >
            {item.name}
          </Link>
          <p className="text-caption font-semibold tabular-nums text-ink">
            {money(item.price, currency)}
            <span className="font-normal text-ink-subtle"> · {item.unit}</span>
          </p>
        </div>
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
        {setLine.isSuccess ? t('questions.inRequest') : t('questions.addToRequest')}
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
