import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { User } from '../../ui/icons';
import { useGetPortalProfile } from '../../api/generated';
import { useAuth } from '../../auth/useAuth';
import { phone as formatPhone } from '../../shared/format';
import { cn } from '../../ui/cn';

/**
 * Инициалы — из первых двух слов имени.
 *
 * Два, а не три: «Асхат Каримов Мухтарович» на кружке в 40 точек тремя
 * буквами уже не читается, а фамилия с именем узнаются и вдвоём. Слова
 * с небуквенным началом («ТОО», кавычки, дефисы) отсеиваются: кавычка
 * на кружке выглядит опечаткой, а не знаком.
 */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/**
 * Кто вошёл — плашкой в правом углу верхней полосы.
 *
 * Раньше здесь стоял пустой кружок со значком человека: имени вошедшего
 * кабинет не знал. Оно есть — `GET /api/portal/me` отдаёт `customerName`,
 * название клиента, каким его знает модуль заявок. Из токена его не взять:
 * в realm клиентов вход по номеру, и имени в нём нет.
 *
 * Вопрос, на который отвечает плашка, тот же, что и у соседнего экрана входа
 * на общем компьютере: тем ли ты вошёл. У поставщика на складе один браузер
 * на смену, и заявка, отправленная из-под чужой учётной записи, уходит
 * с чужим адресом доставки.
 *
 * `active` выключает запрос, пока неизвестно, есть ли у клиента поставщик, —
 * тот же порядок, что у колокольчика: заголовок `X-Supplier-Id` уходит
 * из сохранённого выбора, который до ответа может указывать в никуда, и
 * ответом на такой запрос будет отказ.
 */
export function ViewerBadge({
  active = true,
  chip = false,
  initialsOnly = false,
}: {
  active?: boolean;
  /** Чип без имени на виду — в плавающей панели и доке, где ширина нужна разделам. */
  initialsOnly?: boolean;
  /**
   * Чип шапки шаблона продавца, как в макете: квадрат с инициалами на мягкой
   * подложке и имя одной строкой (номер — подсказкой). Имя — от широкого
   * монитора: на 1024 точках его ширина нужнее полю поиска.
   */
  chip?: boolean;
}) {
  const { t } = useTranslation();
  const { phone: viewerPhone } = useAuth();
  const profile = useGetPortalProfile({ query: { enabled: active } });

  const account = profile.data?.status === 200 ? profile.data.data : undefined;
  const name = account?.customerName;
  // Номер берётся из токена, а не из ответа: он известен с первого кадра,
  // и плашка не переставляется в тот момент, когда ответ наконец дошёл.
  const number = viewerPhone ? formatPhone(viewerPhone) : null;
  const initials = name ? initialsOf(name) : '';

  if (chip) {
    return (
      <Link
        to="/profile"
        aria-label={name ? undefined : t('shell.profile')}
        title={number ?? undefined}
        className={cn(
          'hidden h-[2.625rem] shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-small)] border border-line pl-1.5 pr-1.5 lg:flex',
          !initialsOnly && 'xl:pr-3',
          'transition-colors duration-200 hover:border-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent-soft text-accent-ink">
          {initials ? (
            <span data-testid="viewer-initials" className="text-xs font-extrabold leading-none">{initials}</span>
          ) : (
            <User className="size-4" aria-hidden="true" />
          )}
        </span>
        {name && (
          // Имя остаётся в дереве и на 1024 точках — для диктора, но видно
          // только там, где ему есть место.
          <span className={cn('max-w-[160px] truncate text-caption font-semibold text-ink', initialsOnly ? 'sr-only' : 'max-xl:sr-only')}>{name}</span>
        )}
      </Link>
    );
  }

  return (
    <Link
      to="/profile"
      /*
        Подпись стоит только там, где читать нечего: имя и номер названы
        текстом, и подпись «Профиль» поверх них заставила бы диктора
        промолчать ровно о том, ради чего плашку и заводили.
      */
      aria-label={name ? undefined : t('shell.profile')}
      className={cn(
        // На телефоне плашки в шапке нет: полоса поделена между магазином
        // и колокольчиком, а профиль открывается из меню.
        'hidden shrink-0 items-center gap-2 rounded-full lg:flex',
        'transition-all duration-300 active:scale-95',
        'lg:h-13 lg:gap-2.5 lg:rounded-[var(--radius-tile)] lg:border-[1.5px] lg:border-bar-line',
        'lg:bg-surface lg:pl-1.5 lg:pr-3.5 lg:hover:border-accent',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          'bg-accent-soft text-accent-ink',
        )}
      >
        {initials ? (
          <span data-testid="viewer-initials" className="text-caption font-semibold leading-none">
            {initials}
          </span>
        ) : (
          <User className="size-[18px]" aria-hidden="true" />
        )}
      </span>

      {/*
        Текст — только на мониторе. На телефоне полоса поделена между именем
        поставщика и значками, и две строки отняли бы ширину у имени, ради
        которого шапку и переделывали; кружок с инициалами отвечает на тот же
        вопрос и там.
      */}
      <span className="hidden min-w-0 max-w-[160px] flex-col lg:flex">
        {name && (
          <span className="truncate text-body font-bold leading-5 text-ink">{name}</span>
        )}
        {number && (
          <span
            className={cn(
              'truncate leading-[13px] text-ink-subtle',
              name ? 'text-caption' : 'text-caption font-medium',
            )}
          >
            {number}
          </span>
        )}
      </span>
    </Link>
  );
}
