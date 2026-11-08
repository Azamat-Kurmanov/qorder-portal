import { SectionHead } from '../shell/SectionHead';
import { ItemThumb } from '../catalog/ItemThumb';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import { ChevronRight, MessageCircle, MessageCircleQuestion } from '../../ui/icons';
import { cn } from '../../ui/cn';
import { useWideScreen } from '../../ui/useWideScreen';

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
  // Пришли из карточки товара: новый вопрос — о нём, а в списке — прежние переписки о нём.
  const [params] = useSearchParams();
  const itemId = params.get('item') ?? undefined;
  const item = useGetPortalCatalogItem(itemId ?? '', { query: { enabled: Boolean(itemId) } });
  const itemName = item.data?.status === 200 ? item.data.data.name : undefined;
  const archive = useGetWhatsappArchive();
  const archived = archive.data?.status === 200 ? archive.data.data : [];
  // Вкладка архива — только тем, кто писал магазину в WhatsApp: остальным пустая вкладка ни к чему.
  const [tab, setTab] = useState<'questions' | 'archive'>('questions');
  const showArchive = archived.length > 0;
  const current = showArchive ? tab : 'questions';
  // Тот же запрос и кеш, что у списка ниже: число на вкладке лишнего похода не стоит.
  const list = useGetPortalQuestions();
  const threadCount = list.data?.status === 200 && Array.isArray(list.data.data) ? list.data.data.length : 0;

  // Открытая ветка — своим экраном (макет К2.14): список не мешает читать разговор.
  if (threadId) return <ThreadScreen threadId={threadId} />;

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5">
      <SectionHead title={t('questions.title')} subtitle={t('questions.subtitleThreads')} />

      {showArchive ? (
        // Две вкладки — крупными кнопками со значком и пояснением: серый переключатель в одну строку
        // не говорил, что во второй вкладке и что там можно делать (просьба владельца 2026-11-06).
        <div role="tablist" aria-label={t('questions.title')} className="grid grid-cols-2 gap-2.5 lg:inline-grid lg:w-auto lg:self-start lg:grid-cols-[repeat(2,minmax(15rem,auto))]">
          {(['questions', 'archive'] as const).map((key) => {
            const on = current === key;
            // Архив — переписка, а не звонки: значок сообщения (просьба владельца 2026-11-06).
            const Icon = key === 'questions' ? MessageCircleQuestion : MessageCircle;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className={cn(
                  'flex min-h-14 min-w-0 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border-2 px-2.5 py-2 text-left lg:min-h-16 lg:gap-3 lg:px-3.5 lg:py-2.5',
                  'transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  on ? 'border-accent bg-accent-soft shadow-soft' : 'border-hairline bg-surface hover:border-line',
                )}
              >
                <span aria-hidden="true" className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg lg:size-10 lg:rounded-xl',
                  on ? 'bg-accent text-on-accent' : 'bg-sunk text-ink-muted',
                )}>
                  <Icon className="size-4 lg:size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={cn('text-caption font-extrabold leading-tight lg:truncate lg:text-body', on ? 'text-accent-ink' : 'text-ink')}>
                    {key === 'questions' ? t('questions.tabQuestions') : t('questions.archive.title')}
                  </span>
                  <span className="text-xs leading-snug text-ink-muted lg:truncate">
                    {key === 'questions'
                      ? t('questions.tabQuestionsNote', { count: threadCount })
                      : t('questions.archive.tabNote', { count: archived.length })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {current === 'archive' ? <WhatsappArchive messages={archived} /> : (
        // Новый вопрос — карточкой первым делом, а на мониторе — колонкой слева, рядом со списком:
        // внизу пустой страницы поле стояло далеко от всего (просьба владельца 2026-11-06).
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-6">
          {/* Колонка на телефоне — не шире экрана: ряд тем листается вбок и раздвигал сетку за край. */}
          <div className="lg:sticky lg:top-24">
            {/* Новый вопрос — новая ветка: у продавца это отдельное обращение со своим номером. */}
            <MessageComposer card itemName={itemName} />
          </div>
          <ThreadList itemId={itemId} />
        </div>
      )}
    </div>
  );
}

type ThreadFilter = 'all' | 'waiting' | 'answered';

/**
 * Список веток: о чём, последнее сообщение, когда и ждёт ли ответа.
 *
 * Ветки с новым ответом — первыми и выделены: ради ответа сюда и возвращаются. Отбор «ждут
 * ответа / с ответом» — когда веток больше трёх: на двух-трёх он только занимает место.
 */
function ThreadList({ itemId }: { itemId?: string }) {
  const { t } = useTranslation();
  const questions = useGetPortalQuestions();
  const all: QuestionThreadSummaryDto[] = questions.data?.status === 200 ? questions.data.data : [];
  // Из карточки товара — только переписки о нём, чтобы вернуться в нужную; нет таких — все.
  const about = itemId ? all.filter((thread) => thread.itemId === itemId) : [];
  const threads = about.length > 0 ? about : all;
  const [filter, setFilter] = useState<ThreadFilter>('all');

  if (questions.isPending) {
    return <div data-testid="questions-skeleton" className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk" />;
  }
  if (threads.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-line px-6 py-10 text-center">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
          <MessageCircle className="size-7" />
        </span>
        <h2 className="m-0 text-lg font-extrabold text-ink">{t('questions.emptyTitle')}</h2>
        <p className="m-0 max-w-md text-body leading-relaxed text-ink-muted">{t('questions.empty')}</p>
      </section>
    );
  }

  const waiting = threads.filter((thread) => thread.awaitingAnswer).length;
  const counts: Record<ThreadFilter, number> = { all: threads.length, waiting, answered: threads.length - waiting };
  const shown = threads
    .filter((thread) => filter === 'all' || (filter === 'waiting') === thread.awaitingAnswer)
    // Новые ответы — наверх; дальше порядок сервера (свежие первыми).
    .map((thread, index) => ({ thread, index }))
    .sort((a, b) => Number(b.thread.unreadAnswers > 0) - Number(a.thread.unreadAnswers > 0) || a.index - b.index)
    .map(({ thread }) => thread);

  return (
    <section aria-labelledby="threads-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="threads-title" className="m-0 text-lg font-extrabold text-ink">
          {about.length > 0 ? t('questions.aboutItemList') : t('questions.listTitle')}
        </h2>
        {about.length > 0 && (
          <Link to="/questions" className="text-sm font-bold text-accent-ink hover:underline">{t('questions.allThreads')}</Link>
        )}
        {threads.length > 3 && (
          <div role="group" aria-label={t('questions.filterLabel')} className="flex gap-1 rounded-[0.875rem] bg-sunk p-1">
            {(['all', 'waiting', 'answered'] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  'h-9 cursor-pointer rounded-[0.6875rem] border-0 px-3 text-sm font-bold',
                  filter === key ? 'bg-surface text-ink shadow-sm' : 'bg-transparent text-ink-muted hover:text-ink',
                )}
              >
                {t(`questions.filter.${key}`)} <span className="font-medium opacity-60">{counts[key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {shown.map((thread) => {
        const last = thread.lastMessage;
        const mine = last?.author === 'CUSTOMER';
        const fresh = thread.unreadAnswers > 0;
        return (
          <li key={thread.id}>
            <Link
              to={`/questions/${thread.id}`}
              data-testid={`thread-${thread.id}`}
              className={cn(
                'group flex items-start gap-3 rounded-[var(--radius-card)] border-2 border-solid bg-surface p-3 text-ink no-underline lg:gap-3.5 lg:p-4',
                'transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-soft',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                fresh ? 'border-accent/50 bg-accent-soft/40' : 'border-hairline hover:border-line',
              )}
            >
              {thread.itemId ? (
                <ItemThumb itemId={thread.itemId} className="size-12 shrink-0 rounded-[0.875rem] lg:size-14" />
              ) : (
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-accent-soft text-accent-ink lg:size-14">
                  <MessageCircle className="size-6" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-2">
                  <b className={cn('truncate text-base text-ink', fresh ? 'font-extrabold' : 'font-bold')}>
                    {thread.itemName ?? t('questions.general')}
                  </b>
                  <span className="shrink-0 text-xs text-ink-subtle">{last ? shortDate(last.createdAt) : ''}</span>
                </span>
                {last ? (
                  <span className={cn('line-clamp-2 text-sm', fresh ? 'text-ink' : 'text-ink-muted')}>
                    <span className="font-semibold">{mine ? t('questions.you') : t('questions.seller')}:</span> {last.text}
                  </span>
                ) : null}
                <span className="flex flex-wrap items-center gap-2">
                  {/* «Ждёт ответа» — не украшение: без него человек не знает, дошло ли сообщение, и пишет второй раз. */}
                  <span className={thread.awaitingAnswer
                    ? 'rounded-full bg-sale-soft px-2.5 py-0.5 text-xs font-bold text-sale-ink'
                    : 'rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok-ink'}
                  >
                    {thread.awaitingAnswer ? t('questions.waitingShort') : t('questions.answered')}
                  </span>
                  {fresh ? (
                    <span role="img" aria-label={t('questions.unread', { count: thread.unreadAnswers })}
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sale px-1.5 text-xs font-extrabold text-on-sale">
                      {thread.unreadAnswers}
                    </span>
                  ) : null}
                  <span className="text-xs text-ink-faint">{thread.number}</span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="mt-3.5 size-5 shrink-0 max-sm:hidden text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
      </ul>
      {shown.length === 0 && (
        <p className="m-0 rounded-[var(--radius-card)] border-2 border-dashed border-line px-4 py-6 text-center text-body text-ink-muted">
          {t('questions.filterEmpty')}
        </p>
      )}
    </section>
  );
}

/** Одна ветка: разговор целиком и поле, которое пишет в неё же. */
function ThreadScreen({ threadId }: { threadId: string }) {
  const { t } = useTranslation();
  const thread = useGetPortalQuestion(threadId);
  const data = thread.data?.status === 200 ? thread.data.data : undefined;
  const subject = data?.messages.find((message) => message.itemName)?.itemName;
  const withItem = (data?.messages ?? []).filter((message) => message.itemId);
  const discussed = withItem[withItem.length - 1]?.itemId;
  // Одна карточка товара, а не две спрятанные стилями: на мониторе — сбоку, на телефоне — под разговором.
  const wide = useWideScreen();
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-5">
      <SectionHead back="/questions" title={subject ?? t('questions.general')} subtitle={data?.number} />
      {/*
        На мониторе — разговор узкой колонкой, как в мессенджере, а товар, о котором спрашивали, —
        карточкой сбоку (просьба владельца 2026-11-06): во всю ширину короткие сообщения терялись
        по краям, а кнопка «Добавить в заявку» тянулась на метр.
      */}
      <div className="flex flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,48rem)_minmax(0,20rem)] lg:items-start lg:justify-center lg:gap-6">
        <div className="flex min-h-full flex-1 flex-col gap-5 lg:min-h-[calc(100dvh-14rem)]">
          {thread.isPending ? (
            <div data-testid="questions-skeleton" className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk" />
          ) : data ? <Thread thread={data} itemBelow={!wide} /> : (
            <p className="text-body text-ink-subtle">{t('questions.notFound')}</p>
          )}
          {data ? <MessageComposer threadId={threadId} /> : null}
        </div>
        {discussed && wide ? (
          <aside aria-label={t('questions.discussedItem')} className="lg:sticky lg:top-24">
            <DiscussedItem itemId={discussed} side />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function Thread({ thread, itemBelow = true }: { thread: QuestionThreadDto; itemBelow?: boolean }) {
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
      className="flex flex-col gap-2 rounded-[1.375rem] bg-surface p-3.5 border-2 border-solid border-hairline lg:gap-3 lg:p-6"
    >
      <div data-testid={`thread-subject-${thread.id}`} className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-ink-muted lg:text-sm">
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
              <span className="max-w-full truncate rounded-[var(--radius-pill)] bg-sunk px-2.5 py-1 text-caption text-ink-muted">
                {message.itemName}
              </span>
            )}
            <p
              className={
                mine
                  ? 'whitespace-pre-wrap rounded-[16px_16px_4px_16px] bg-accent px-3.5 py-2.5 text-body leading-[1.45] text-on-accent lg:px-4 lg:py-3 lg:text-base'
                  : 'whitespace-pre-wrap rounded-[16px_16px_16px_4px] bg-canvas px-3.5 py-2.5 text-body leading-[1.45] text-ink lg:px-4 lg:py-3 lg:text-base'
              }
            >
              {message.text}
            </p>
            {/*
              Подпись говорит ровно то, что известно: имени менеджера в ответе
              сервера нет, и придуманное имя однажды окажется чужим.
            */}
            <span className="text-2xs text-ink-subtle lg:text-xs">
              {mine
                ? atTime(message.createdAt)
                : `${t('questions.sellerAnswer')} · ${atTime(message.createdAt)}`}
            </span>
          </div>
        );
      })}

      {/* На телефоне товар — под разговором; на мониторе он карточкой сбоку. */}
      {itemBelow && discussed?.itemId && <DiscussedItem itemId={discussed.itemId} />}
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
function DiscussedItem({ itemId, side = false }: {
  itemId: string;
  /** Карточкой сбоку от разговора на мониторе: крупное фото сверху, кнопка обычной ширины. */
  side?: boolean;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const card = useGetPortalCatalogItem(itemId);
  const setLine = useSetCartLine();

  if (card.data?.status !== 200) return null;
  const item = card.data.data;
  const photo = item.media?.find((media) => media.kind === 'PHOTO')?.url;

  if (side) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-hairline bg-surface p-4">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-subtle">{t('questions.discussedItem')}</span>
        <Link to={`/catalog/${item.id}`} className="block overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <ItemThumb itemId={item.id} src={photo} className="aspect-square w-full rounded-xl" />
        </Link>
        <div className="flex flex-col gap-0.5">
          <Link to={`/catalog/${item.id}`} className="text-base font-bold text-ink no-underline hover:text-accent">
            {item.name}
          </Link>
          <p className="m-0 text-lg font-extrabold tabular-nums text-ink">
            {money(item.price, currency)}
            <span className="text-sm font-normal text-ink-subtle"> · {item.unit}</span>
          </p>
        </div>
        <Button type="button" variant="accent" disabled={setLine.isPending}
          onClick={() => setLine.mutate({ itemId: item.id, data: { quantity: 1 } })}>
          {setLine.isSuccess ? t('questions.inRequest') : t('questions.addToRequest')}
        </Button>
      </div>
    );
  }

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
