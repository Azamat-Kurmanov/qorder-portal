import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
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
function initialsOf(name: string): string {
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
export function ViewerBadge({ active = true }: { active?: boolean }) {
  const { t } = useTranslation();
  const { phone: viewerPhone } = useAuth();
  const profile = useGetPortalProfile({ query: { enabled: active } });

  const account = profile.data?.status === 200 ? profile.data.data : undefined;
  const name = account?.customerName;
  // Номер берётся из токена, а не из ответа: он известен с первого кадра,
  // и плашка не переставляется в тот момент, когда ответ наконец дошёл.
  const number = viewerPhone ? formatPhone(viewerPhone) : null;
  const initials = name ? initialsOf(name) : '';

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
        'flex shrink-0 items-center gap-2 rounded-full',
        'transition-all duration-300 active:scale-95',
        'lg:h-12 lg:gap-2.5 lg:rounded-[var(--radius-control)] lg:border lg:border-hairline',
        'lg:bg-sunk lg:pl-1.5 lg:pr-3 lg:hover:border-ink/20',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full lg:size-9',
          'bg-accent-soft text-accent',
        )}
      >
        {initials ? (
          <span data-testid="viewer-initials" className="text-[13px] font-semibold leading-none">
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
          <span className="truncate text-[13px] font-semibold leading-4 text-ink">{name}</span>
        )}
        {number && (
          <span
            className={cn(
              'truncate leading-[13px] text-ink-subtle',
              name ? 'text-[11px]' : 'text-[13px] font-medium',
            )}
          >
            {number}
          </span>
        )}
      </span>
    </Link>
  );
}
