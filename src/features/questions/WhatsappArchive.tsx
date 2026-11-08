import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { dayMonth } from '../../shared/format';
import type { WhatsappArchiveMessageDto } from '../../api/generated';
import { intlLocale } from '../../i18n';
import { cn } from '../../ui/cn';
import { ArrowDown, ChevronDown, Info, Search } from '../../ui/icons';
import { useShops } from '../shell/Shops';
import { ItemThumb } from '../catalog/ItemThumb';

/** Длиннее — сообщение свёрнуто до нескольких строк: «Ваш заказ» с реквизитами занимал экран. */
const LONG = 280;

/**
 * Архив переписки с магазином в WhatsApp — только для чтения.
 *
 * Нужен на случай, когда в телефоне переписка пропала (сменили телефон,
 * случайно удалили чат): здесь лежит всё, что клиент и магазин писали друг
 * другу. Отвечать отсюда нельзя — это архив, а не чат: ответ ушёл бы не туда,
 * где клиент его ждёт.
 *
 * Выглядит как чат мессенджера (просьба владельца 2026-11-06): своё справа зелёным, магазина —
 * слева белым, над каждой группой подряд — кто писал, время внутри пузыря, дата дня закреплена
 * сверху. Фото товаров, присланные магазином, — карточкой товара. Открывается на последних
 * сообщениях, как WhatsApp.
 *
 * Поиск — как в мессенджере: переписка остаётся целиком, найденное закрашено жёлтым, стрелки
 * и Enter переходят от совпадения к совпадению, рядом — «3 из 12».
 */
export function WhatsappArchive({ messages }: { messages: WhatsappArchiveMessageDto[] }) {
  const { t } = useTranslation();
  const shopName = useShops().current?.name ?? t('questions.archive.shop');
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' });
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const panel = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [current, setCurrent] = useState(0);

  // Номер первого совпадения в каждом сообщении — сквозная нумерация для стрелок.
  const firstHit: number[] = [];
  let total = 0;
  for (const message of messages) {
    firstHit.push(total);
    total += needle ? occurrences(message.text, needle) : 0;
  }

  // Новый поиск — с первого совпадения.
  useEffect(() => setCurrent(0), [needle]);

  // Текущее совпадение — в середину окна.
  useEffect(() => {
    if (!needle || total === 0) return;
    const mark = panel.current?.querySelector<HTMLElement>(`[data-hit="${current}"]`);
    // По центру экрана — ниже «прилипшей» строки поиска, а не под ней.
    mark?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [current, needle, total]);

  // Как мессенджер — на последних сообщениях. На мониторе прокручивается окно чата, на телефоне — страница.
  useLayoutEffect(() => {
    const box = panel.current;
    if (box && box.scrollHeight > box.clientHeight) box.scrollTop = box.scrollHeight;
    else end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    const box = panel.current;
    if (!box) return undefined;
    const check = () => setAway(box.scrollHeight - box.scrollTop - box.clientHeight > 240);
    check();
    box.addEventListener('scroll', check, { passive: true });
    return () => box.removeEventListener('scroll', check);
  }, []);

  const step = (by: number) => {
    if (total === 0) return;
    setCurrent((was) => (was + by + total) % total);
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    step(event.shiftKey ? -1 : 1);
  };

  let lastDay = '';
  let lastSide: boolean | null = null;
  return (
    // Запас снизу на телефоне — под нижнее меню: последнее сообщение уходило под него, и до него было не долистать.
    <section aria-label={t('questions.archive.title')} className="flex flex-col gap-3 max-lg:pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <p className="m-0 flex items-start gap-2 text-caption leading-snug text-ink-muted lg:max-w-2xl">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
        {t('questions.archive.note')}
      </p>
      {/*
        Поиск со стрелками «прилипает» к верху экрана, пока листают найденное, и встаёт на место,
        когда возвращаются наверх (просьба владельца 2026-11-06). На мониторе — под шапкой кабинета.
      */}
      <div data-testid="archive-search" className="sticky top-0 z-20 -mx-1 bg-canvas/95 px-1 py-2 backdrop-blur lg:top-16">
        <div className="flex w-full items-center gap-1.5 lg:max-w-xl">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border-2 border-hairline bg-surface px-3 focus-within:border-accent lg:w-80 lg:flex-none">
            <Search aria-hidden="true" className="size-[18px] shrink-0 text-ink-muted" />
            <span className="sr-only">{t('questions.archive.search')}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={onKey}
              placeholder={t('questions.archive.search')}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            {needle ? (
              <span role="status" className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
                {total === 0 ? t('questions.archive.nothing') : t('questions.archive.position', { at: current + 1, total })}
              </span>
            ) : null}
          </label>
          {/* Стрелки — по найденному: вверх к предыдущему, вниз к следующему. */}
          <button type="button" aria-label={t('questions.archive.prev')} disabled={total === 0} onClick={() => step(-1)} className={ARROW}>
            <ChevronDown aria-hidden="true" className="size-5 rotate-180" />
          </button>
          <button type="button" aria-label={t('questions.archive.next')} disabled={total === 0} onClick={() => step(1)} className={ARROW}>
            <ChevronDown aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={panel}
          className={cn(
            'rounded-[var(--radius-card)] border-2 border-hairline bg-sunk px-2.5 pb-4 sm:px-5',
            // На мониторе — окно чата со своей прокруткой; на телефоне листается вся страница.
            'lg:max-h-[calc(100dvh-17rem)] lg:overflow-y-auto',
          )}
        >
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {messages.map((message, index) => {
              const date = new Date(message.at);
              const dayLabel = dayMonth(date, true);
              const showDay = dayLabel !== lastDay;
              lastDay = dayLabel;
              const mine = !message.fromShop;
              // Кто писал — над каждой группой подряд одной стороны и заново с нового дня.
              const showWho = showDay || lastSide !== mine;
              lastSide = mine;
              return (
                <li key={`${message.at}-${index}`} className="flex flex-col gap-1">
                  {showDay ? (
                    // Дата дня — под строкой поиска на телефоне (листается страница), вверху окна чата — на мониторе.
                    <div className="sticky top-[3.75rem] z-10 flex justify-center pt-3 pb-1 lg:top-0">
                      <span className="rounded-[var(--radius-pill)] bg-surface/95 px-3 py-1 text-xs font-semibold text-ink-muted shadow-sm">
                        {dayLabel}
                      </span>
                    </div>
                  ) : null}
                  {showWho ? (
                    <span className={cn('mt-2 px-1 text-xs font-bold', mine ? 'self-end text-accent-ink' : 'self-start text-ink-muted')}>
                      {mine ? t('questions.archive.you') : shopName}
                    </span>
                  ) : null}
                  <Bubble message={message} mine={mine} at={time.format(date)} needle={needle}
                    firstHit={firstHit[index]} current={current} />
                </li>
              );
            })}
          </ol>
          <div ref={end} />
        </div>
        {away && !needle ? (
          <button
            type="button"
            onClick={() => panel.current?.scrollTo({ top: panel.current.scrollHeight, behavior: 'smooth' })}
            className="absolute bottom-4 right-4 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-accent px-4 text-sm font-bold text-on-accent shadow-lift hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ArrowDown aria-hidden="true" className="size-4" />
            {t('questions.archive.toLatest')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

const ARROW = cn(
  'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border-2 border-hairline bg-surface text-ink',
  'hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-40',
);

function Bubble({ message, mine, at, needle, firstHit, current }: {
  message: WhatsappArchiveMessageDto;
  mine: boolean;
  at: string;
  needle: string;
  /** Сквозной номер первого совпадения в этом сообщении. */
  firstHit: number;
  current: number;
}) {
  const { t } = useTranslation();
  const text = message.text;
  const long = text.length > LONG;
  const hits = needle ? occurrences(text, needle) : 0;
  const [open, setOpen] = useState(false);
  // Найденное в длинном сообщении должно быть видно — с совпадением оно раскрыто.
  const expanded = open || !long || hits > 0;
  return (
    <div className={cn('flex max-w-[88%] flex-col sm:max-w-[72%]', mine ? 'items-end self-end' : 'items-start self-start')}>
      <div
        className={cn(
          'relative whitespace-pre-wrap px-3.5 pt-2 pb-1.5 text-body leading-[1.45] text-ink shadow-sm [overflow-wrap:anywhere]',
          mine ? 'rounded-[16px_16px_4px_16px] bg-accent-soft' : 'rounded-[16px_16px_16px_4px] bg-surface',
        )}
      >
        {/* Фото товара, присланное магазином, — его нынешнее фото и ссылка в карточку. */}
        {message.itemId ? (
          <Link to={`/catalog/${message.itemId}`} className="mb-1.5 block overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <ItemThumb itemId={message.itemId} src={message.photoUrl} className="aspect-square w-56 max-w-full rounded-xl" />
          </Link>
        ) : null}
        <span className={cn(!expanded && 'line-clamp-6')}>{highlight(text, needle, firstHit, current)}</span>
        {long && hits === 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setOpen((was) => !was)}
            className="mt-1 block cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-accent-ink hover:underline"
          >
            {t(expanded ? 'questions.archive.collapse' : 'questions.archive.expand')}
          </button>
        ) : null}
        <span className="mt-0.5 block text-right text-2xs text-ink-subtle">{at}</span>
      </div>
    </div>
  );
}

/** Сколько раз встречается найденное; регистр не важен. */
function occurrences(text: string, needle: string): number {
  const lower = text.toLocaleLowerCase();
  let count = 0;
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) count++;
  return count;
}

/** Найденное — жёлтым, текущее совпадение — ярче; у каждой метки сквозной номер для стрелок. */
function highlight(text: string, needle: string, firstHit: number, current: number): ReactNode {
  if (!needle) return text;
  const lower = text.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let hit = firstHit;
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, from)) {
    parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} data-hit={hit} aria-current={hit === current ? 'true' : undefined}
        className={cn('rounded px-0.5 text-on-mark', hit === current ? 'bg-mark-current' : 'bg-mark')}>
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    hit++;
    from = at + needle.length;
  }
  parts.push(text.slice(from));
  return parts;
}
