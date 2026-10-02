import { ItemThumb } from '../catalog/ItemThumb';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  useGetPortalCatalogItem,
  useGetPortalQuestions,
  useGetWhatsappArchive,
  type QuestionThreadDto,
} from '../../api/generated';
import { useSetCartLine } from '../cart/useCart';
import { MessageComposer } from './MessageComposer';
import { WhatsappArchive } from './WhatsappArchive';
import { shortDate, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
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
 * Над разговором стоят дата и номер, а позиция — у того сообщения, к которому
 * её прикрепили: переписка о трёх товарах идёт одной лентой, и общий заголовок
 * с позицией превратил бы ответ про доставку в ответ про цемент.
 */
export function QuestionsPage() {
  const { t } = useTranslation();
  const questions = useGetPortalQuestions();
  const threads = questions.data?.status === 200 ? questions.data.data : [];
  const archive = useGetWhatsappArchive();
  const archived = archive.data?.status === 200 ? archive.data.data : [];
  // Вкладка архива — только тем, кто писал магазину в WhatsApp: остальным пустая вкладка ни к чему.
  const [tab, setTab] = useState<'questions' | 'archive'>('questions');
  const showArchive = archived.length > 0;
  const current = showArchive ? tab : 'questions';

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        <h1 className="qo-page-title">{t('questions.title')}</h1>
        <p className="text-caption text-ink-subtle">{t('questions.subtitle')}</p>
      </header>

      {showArchive ? (
        <div role="tablist" aria-label={t('questions.title')} className="inline-flex self-start gap-1 rounded-[var(--radius-pill)] bg-sunk p-1">
          {(['questions', 'archive'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={current === key}
              onClick={() => setTab(key)}
              className={
                current === key
                  ? 'h-9 cursor-pointer rounded-[var(--radius-pill)] border-0 bg-surface px-4 text-[0.875rem] font-semibold text-ink shadow-sm'
                  : 'h-9 cursor-pointer rounded-[var(--radius-pill)] border-0 bg-transparent px-4 text-[0.875rem] text-ink-muted hover:text-ink'
              }
            >
              {key === 'questions' ? t('questions.tabQuestions') : t('questions.archive.title')}
            </button>
          ))}
        </div>
      ) : null}

      {current === 'archive' ? <WhatsappArchive messages={archived} /> : <>

      {questions.isPending ? (
        <div
          data-testid="questions-skeleton"
          className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk"
        />
      ) : threads.length === 0 ? (
        <p className="text-body leading-relaxed text-ink-subtle">
          {t('questions.empty')}
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
      </>}
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
    <article data-testid={`thread-${thread.id}`} className="flex flex-col gap-2">
      <div
        data-testid={`thread-subject-${thread.id}`}
        className="flex items-center justify-center gap-1.5 text-2xs text-ink-subtle"
      >
        <span>{shortDate(messages[0]?.createdAt)}</span>
        <span aria-hidden="true">·</span>
        {/* Номер обращения — то, чем клиент назовёт разговор по телефону. */}
        <span className="text-ink-faint">{thread.number}</span>
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
                  ? 'rounded-[16px_16px_4px_16px] bg-ink px-3.5 py-2.5 text-[0.875rem] leading-[1.45] text-on-ink'
                  : 'rounded-[16px_16px_16px_4px] border border-hairline bg-surface px-3.5 py-2.5 text-[0.875rem] leading-[1.45] text-ink'
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

      {/*
        «Ждёт ответа» — не украшение: без него человек не знает, дошло ли
        сообщение вообще, и пишет второй раз.
      */}
      {thread.awaitingAnswer && (
        <p className="self-start text-sm text-unclear-ink">{t('questions.waiting')}</p>
      )}

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
    <div className="flex w-full max-w-[86%] flex-col gap-2.5 self-start rounded-[16px_16px_16px_4px] border border-hairline bg-surface p-3">
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
