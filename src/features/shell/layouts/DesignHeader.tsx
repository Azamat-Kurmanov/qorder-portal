import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Phone, Search } from 'lucide-react';
import { cn } from '../../../ui/cn';
import { ViewerBadge } from '../ViewerBadge';
import { phone as formatPhone } from '../../../shared/format';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const { shop, hours, closedToday, live, tel } = useShopInfo(ready);

  return (
    <header data-testid="design-header" data-shell-header className="sticky top-0 z-20">
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-[3.875rem] w-full max-w-[1440px] items-center gap-2.5 px-4 lg:h-[4.25rem] lg:gap-3 lg:px-[22px]">
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

          <SearchField className="hidden lg:flex" />

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {/* Поиск на телефоне — кнопкой, как в макете: поле раскрывается строкой под панелью. */}
            <button
              type="button"
              aria-label={t('shell.search')}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
              className={cn(ICON_BUTTON, 'size-10 lg:hidden', searchOpen && 'border-accent text-ink')}
            >
              <Search className="size-[18px]" aria-hidden="true" />
            </button>

            <CartButton ready={ready} className="hidden lg:flex" />

            <HeaderTools activated={activated} ready={ready} chip={false} />

            {/* Звонок на телефоне — значком; на мониторе он в полосе графика. */}
            {tel && (
              <a
                href={tel}
                aria-label={`${t('shop.call')} ${shop?.phone ? formatPhone(shop.phone) : ''}`.trim()}
                className={cn(ICON_BUTTON, 'size-10 text-accent-ink lg:hidden')}
              >
                <Phone aria-hidden="true" className="size-[18px]" />
              </a>
            )}

            <ViewerBadge active={ready} chip />
          </div>
        </div>
      </div>

      {wideStatus ? <ShopStatusStrip ready={ready} /> : null}

      {searchOpen && (
        <div className="border-b border-hairline bg-surface px-4 pb-3 lg:hidden">
          <form
            role="search"
            onSubmit={(event) => { search(event); setSearchOpen(false); }}
            className={cn(
              'flex h-11 min-w-0 cursor-text items-center gap-2.5 rounded-[var(--radius-small)] border border-line bg-canvas px-3.5',
              'transition-colors duration-200 focus-within:border-accent',
            )}
          >
            <Search className="size-[18px] shrink-0 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              // Поле появилось по нажатию «Поиск» — курсор сразу в нём.
              autoFocus
              aria-label={t('catalog.search')}
              placeholder={t('catalog.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
            />
          </form>
        </div>
      )}

      {below}
    </header>
  );
}
