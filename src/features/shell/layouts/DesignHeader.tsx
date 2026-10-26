import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Search } from '../../../ui/icons';
import { cn } from '../../../ui/cn';
import { ViewerBadge } from '../ViewerBadge';
import { useWideScreen } from '../../../ui/useWideScreen';
import {
  CartButton,
  DesignShopButton,
  HeaderTools,
  ICON_BUTTON,
  SearchField,
  ShopStatusStrip,
  useHeaderSearch,
  useShopInfo,
} from './headerParts';

/**
 * Шапка кабинета с опубликованным дизайном — по макету «Дизайн кабинета
 * клиента»: одна панель 68 точек на цвете панели, под ней мягкая полоса
 * графика работы, ниже — строка разделов у «меню сверху» и «нижнего меню»
 * или вкладки рубрик у «вкладок».
 *
 * В панели — знак и имя магазина (переключение магазинов), поиск во всю
 * оставшуюся ширину, корзина с числом и суммой и чип вошедшего. Тема
 * и уведомления (точкой) — компактными значками рядом; звонок, WhatsApp,
 * язык и «Aa Обычный шрифт» — справа в полосе графика, как в макете.
 *
 * На телефоне — панель 62 точки: знак, имя с графиком под ним, кнопка
 * поиска, колокольчик и звонок. Язык, тема и шрифт — в листе «Ещё»
 * нижнего меню. Телефонная шапка одна у всех раскладок: на телефоне
 * шаблон меняет витрину, а не то, где искать и звонить.
 */
export function DesignHeader({
  activated,
  ready,
  othersUnread,
  onOpenSections,
  onOpenShops,
  below,
  wideStatus = true,
}: {
  activated: boolean;
  ready: boolean;
  othersUnread: number;
  onOpenSections: () => void;
  onOpenShops: () => void;
  /** Строка под шапкой на мониторе: разделы или вкладки рубрик. */
  below?: ReactNode;
  /** Полоса графика на мониторе; у раскладок со своей полосой её нет. */
  wideStatus?: boolean;
}) {
  const { t } = useTranslation();
  const { query, setQuery, search } = useHeaderSearch();
  const wide = useWideScreen();
  const { hours, closedToday, live } = useShopInfo(ready);

  return (
    <header data-testid="design-header" data-shell-header className="sticky top-0 z-20">
      <div className="bg-surface lg:border-b lg:border-hairline">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-[1440px] items-center gap-2.5 px-4 lg:h-[4.25rem] lg:gap-3 lg:px-[22px]">
          {/*
            Меню — только на мониторе: складывает колонку или открывает лист
            всех разделов. На телефоне тот же лист открывает «Ещё» нижнего меню.
          */}
          <button
            type="button"
            aria-label={t('shell.menu')}
            onClick={onOpenSections}
            className={cn(ICON_BUTTON, 'hidden border-transparent lg:flex')}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <DesignShopButton onOpen={onOpenShops} othersUnread={othersUnread} closedToday={closedToday} hours={hours} status={live} />

          {wide && <SearchField />}

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {wide && <CartButton ready={ready} />}

            {/*
              На телефоне, как в макете К1, — один колокольчик: справка, звонок
              и точка самовывоза — в листе «Ещё», вошедший — в «Профиле».
            */}
            <HeaderTools activated={activated} ready={ready} chip={false} phone={!wide} />

            {wide && <ViewerBadge active={ready} chip />}
          </div>
        </div>
      </div>

      {wide && wideStatus ? <ShopStatusStrip ready={ready} /> : null}

      {/* Поиск на телефоне — всегда строкой под панелью, как в макете К1. */}
      {!wide && (
        <div className="bg-surface px-4 pb-3.5 shadow-[0_4px_16px_rgba(58,48,30,.06)]">
          <form
            role="search"
            onSubmit={search}
            className={cn(
              'flex h-[2.875rem] min-w-0 cursor-text items-center gap-2.5 rounded-[0.875rem] bg-canvas px-3.5 text-ink-muted',
              'transition-shadow duration-200 focus-within:ring-2 focus-within:ring-accent',
            )}
          >
            <Search className="size-5 shrink-0" aria-hidden="true" />
            <input
              type="search"
              aria-label={t('catalog.search')}
              placeholder={t('catalog.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] font-medium text-ink outline-none placeholder:text-ink-muted"
            />
          </form>
        </div>
      )}

      {below}
    </header>
  );
}
