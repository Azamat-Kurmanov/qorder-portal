import { Bump } from '../../../ui/Bump';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, MapPin, MessageCircle, MessageCircleQuestion, Phone, Search, Store, Truck } from '../../../ui/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGetPortalDeliveryOptions } from '../../../api/generated';
import { toggleCart, useCartDrawer } from '../../cart/cartDrawer';
import { cartOf, useCart } from '../../cart/useCart';
import { money, phone as formatPhone } from '../../../shared/format';
import { useSupplierCurrency } from '../../../supplier/SupplierCurrency';
import { CART_TARGET } from '../../../ui/flyToCart';
import { cn } from '../../../ui/cn';
import { FontScalePicker } from '../FontScale';
import { usePendingInvitations } from '../Invitations';
import { LanguagePicker } from '../LanguagePicker';
import { ShopTile, useShops } from '../Shops';
import { hoursNow, hoursText, telLink, whatsappLink, type HoursNow } from '../shopHours';
import { useSupplier } from '../../../supplier/useSupplier';

/*
 * Части шапки кабинета с опубликованным дизайном: поиск, корзина, значки,
 * знак магазина и полоса графика. Из них собраны все раскладки шаблона —
 * обычная шапка, плавающая панель, шапка дока, шапка по центру и колонка
 * «разворота»: что бы ни нарисовал шаблон, поиск, корзина, уведомления,
 * язык, тема, размер шрифта, магазины и график работы остаются на месте.
 */

/**
 * Поиск шапки: запрос, переход и «/» для курсора в поле.
 *
 * Общий у прежней шапки и шапки шаблона: вести себя по-разному им незачем.
 */
export function useHeaderSearch() {
  const navigate = useNavigate();
  const { pathname, search: addressSearch } = useLocation();
  // Запрос витрины живёт в адресе (`/catalog?q=…`). Витрина снимает его
  // сама — кнопкой баннера, «Показать все товары», — и поле шапки идёт
  // следом, иначе в нём остался бы запрос, которого на витрине уже нет.
  // Другие экраны (карточка товара) адрес витрины не трогают.
  const addressQuery = pathname === '/catalog' ? (new URLSearchParams(addressSearch).get('q') ?? '') : undefined;
  const [query, setQuery] = useState(addressQuery ?? '');
  const [seenAddress, setSeenAddress] = useState(addressQuery);
  if (addressQuery !== undefined && addressQuery !== seenAddress) {
    setSeenAddress(addressQuery);
    setQuery(addressQuery);
  }
  const searchRef = useRef<HTMLInputElement>(null);
  const { supplierId } = useSupplier();
  const [searchedIn, setSearchedIn] = useState(supplierId);

  // Набранное в поиске относится к витрине прежнего магазина: в другом
  // поле начинается пустым, а не с чужим запросом.
  if (searchedIn !== supplierId) {
    setSearchedIn(supplierId);
    setQuery('');
  }

  // «/» ставит курсор в поиск, как подсказывает значок в поле: закупщик
  // с клавиатуры ищет, не беря мышь. Нажатия внутри полей ввода не трогаем.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    // Запрос уезжает адресом, а не поднятым в оболочку состоянием: найденное
    // отправляют ссылкой коллеге и открывают в соседней вкладке.
    navigate(trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : '/catalog');
  }

  return { query, setQuery, search, searchRef };
}

/** Текущее время, обновляемое раз в минуту — для «открыто до …». */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Магазин и его график на эту минуту: адрес, часы, телефоны, самовывоз.
 *
 * «Открыто до 18:00» устаревает с каждой минутой — сверяемся с часами
 * раз в минуту, иначе вкладка, оставленная открытой, врала бы до обновления.
 */
export function useShopInfo(ready: boolean) {
  const { t } = useTranslation();
  const { current: shop } = useShops();
  // Режим доставки спрашивается только когда кабинет открыт: до этого
  // запрос за условиями поставщика всё равно вернул бы отказ.
  const delivery = useGetPortalDeliveryOptions({ query: { enabled: ready } });
  const pickupOnly = delivery.data?.status === 200 && delivery.data.data.mode === 'PICKUP_ONLY';
  const hours = hoursText(shop?.hours, t);
  const closedToday = hours === t('shop.hours.closedToday');
  const now = useMinute();
  const live = hoursNow(shop?.hours, t, now);
  return {
    shop,
    hours,
    closedToday,
    live,
    pickupOnly,
    tel: telLink(shop?.phone),
    wa: whatsappLink(shop?.whatsapp),
  };
}

/** Кнопка-значок шапки шаблона: малое скругление, тонкая рамка. */
export const ICON_BUTTON = cn(
  'flex size-[2.625rem] shrink-0 items-center justify-center rounded-[var(--radius-small)] border border-line text-ink-muted',
  'transition-colors duration-200 hover:border-accent hover:text-ink',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

/**
 * Поле поиска шапки шаблона. `grow` — во всю оставшуюся ширину; иначе
 * фиксированной ширины, как у шапки дока и колонки «разворота».
 */
export function SearchField({ grow = true, className, bare = false, autoFocus = false, placeholder, hint = true }: {
  grow?: boolean;
  /** Своя подсказка — короткая на телефоне: длинная обрезалась в узком поле. */
  placeholder?: string;
  /** Значок клавиши «/» — подсказка для клавиатуры; на телефоне её нет. */
  hint?: boolean;
  className?: string;
  /** Поле раскрыто нажатием на значок — курсор сразу в нём. */
  autoFocus?: boolean;
  /** Без рамки и подложки — в шапке по центру поиск стоит словом со значком. */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const { query, setQuery, search, searchRef } = useHeaderSearch();
  return (
    <form
      role="search"
      onSubmit={search}
      className={cn(
        'flex h-[2.625rem] min-w-0 cursor-text items-center gap-2.5',
        bare
          ? 'border-b border-transparent px-0 focus-within:border-accent'
          : 'rounded-[var(--radius-small)] border border-line bg-canvas pl-3.5 pr-1.5 transition-colors duration-200 focus-within:border-accent',
        grow ? 'flex-1' : 'w-[17.5rem] shrink-0',
        className,
      )}
    >
      <Search className="size-[18px] shrink-0 text-ink-muted" aria-hidden="true" />
      <input
        ref={searchRef}
        type="search"
        autoFocus={autoFocus}
        aria-label={t('shell.search')}
        aria-keyshortcuts="/"
        placeholder={placeholder ?? (bare ? t('shell.search') : t('shell.searchPlaceholder'))}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      {bare || !hint ? null : (
        <kbd
          aria-hidden="true"
          className="flex h-6 items-center rounded-[var(--radius-small)] border border-line px-2 font-sans text-xs font-semibold text-ink-subtle"
        >
          /
        </kbd>
      )}
    </form>
  );
}

/**
 * Корзина шапки шаблона: число позиций кружком и сумма, как в макете.
 * Открывает выдвижную корзину, открытая перекрашивает кнопку.
 */
export function CartButton({ ready, className, label = true }: { ready: boolean; className?: string; label?: boolean }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const headerCart = cartOf(useCart(ready).data);
  const lines = headerCart?.lines.length ?? 0;
  const cartTotal = headerCart?.total ?? 0;
  const drawer = useCartDrawer();
  return (
    <button
      type="button"
      aria-expanded={drawer.open}
      aria-haspopup="dialog"
      aria-label={label ? undefined : t('shell.cart')}
      onClick={toggleCart}
      {...{ [CART_TARGET]: '' }}
      className={cn(
        'flex h-[2.625rem] shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-small)] pl-4 pr-2',
        'text-sm font-bold transition-colors duration-200 shadow-[0_10px_18px_-12px_var(--color-brand-deep)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        drawer.open ? 'bg-ink text-on-ink' : 'bg-accent text-on-accent hover:bg-accent-hover',
        className,
      )}
    >
      {label ? t('shell.cart') : null}
      {/*
        Как в макете: кружок с числом позиций и сумма. Число видно
        глазом, а диктору названо словами — голую цифру он прочёл бы
        без смысла.
      */}
      {lines > 0 ? (
        <>
          <span
            data-testid="header-cart-count"
            aria-hidden="true"
            className={cn(
              'flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold tabular-nums',
              drawer.open ? 'bg-on-ink text-ink' : 'bg-on-accent text-accent-ink',
            )}
          >
            <Bump value={lines}>{lines}</Bump>
          </span>
          <span className="flex h-7 items-center rounded-[8px] bg-black/15 px-2.5 tabular-nums">
            <span className="sr-only">{t('shell.inCart', { count: lines })}, </span>
            {money(cartTotal, currency)}
          </span>
        </>
      ) : (
        <span aria-hidden="true" className="w-1" />
      )}
    </button>
  );
}

/**
 * Знак и имя магазина в шапке шаблона — кнопкой, открывающей «Мои магазины».
 *
 * Знак 42 точки (на телефоне 36) малым скруглением шаблона. Под именем на
 * мониторе — «Сменить магазин · N», на телефоне — график: полосы графика
 * там нет. `large` — крупное имя по центру шапки («лента по центру»).
 */
export function DesignShopButton({
  onOpen,
  othersUnread,
  closedToday,
  hours,
  status,
  className,
  plain = false,
}: {
  onOpen: () => void;
  othersUnread: number;
  closedToday: boolean;
  hours: string | null;
  /** Состояние на эту минуту; пусто — часы неизвестны или пояс не признан. */
  status: HoursNow | null;
  className?: string;
  /** Без подписи под именем — у плавающей панели и шапки дока. */
  plain?: boolean;
}) {
  const { t } = useTranslation();
  const { list, current } = useShops();
  const invites = usePendingInvitations().length;
  // Под именем на мониторе — «Сменить магазин · N», как в макете: кнопка
  // говорит, что она делает. Телефон магазина стоит в строке статуса, адрес
  // — там же, подпись магазина — в окне «Мои магазины».
  const switchText = list.length > 0 ? t('shell.switchShop', { count: list.length }) : t('shell.supplierChoose');
  const phoneNote = status?.short ?? (closedToday ? t('shell.closedShort') : (hours ?? current?.address ?? switchText));

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-small)] text-left lg:flex-none lg:gap-3',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className,
      )}
    >
      {current && (
        <ShopTile
          supplier={{ name: current.name, logoUrl: current.logoUrl }}
          alt={current.name}
          initials
          className="size-11 rounded-[0.875rem] text-base shadow-[0_6px_14px_-8px_var(--color-brand-deep)] lg:size-[2.625rem] lg:rounded-[var(--radius-small)]"
        />
      )}
      <span className={cn('flex min-w-0 flex-1 flex-col gap-0.5', !plain && 'lg:w-[11.5rem] lg:flex-none xl:w-[14.375rem]')}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-heading text-lead font-extrabold text-ink lg:text-body lg:font-bold">
            {current?.name ?? t('shell.supplier')}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          {/* Новости у других магазинов и новые приглашения — точкой, как в прежней шапке. */}
          {othersUnread > 0 && (
            <span role="img" aria-label={t('shell.othersHaveNews')} className="size-2.5 shrink-0 rounded-full bg-accent" />
          )}
          {invites > 0 && othersUnread === 0 && (
            <span role="img" aria-label={t('shops.invites.badge')} className="size-2.5 shrink-0 rounded-full bg-accent" />
          )}
        </span>
        {plain ? null : <span className="truncate text-xs text-ink-muted max-lg:hidden">{switchText}</span>}
        <span className={cn('truncate text-caption font-semibold lg:hidden', status?.open ? 'text-in-stock' : 'text-ink-muted')}>{phoneNote}</span>
      </span>
    </button>
  );
}

/** Точка и текст состояния: открыто, откроется, закрыто — или адрес, если часов нет. */
export function StatusText({ ready, short = false, onColor = false }: { ready: boolean; short?: boolean; onColor?: boolean }) {
  const { t } = useTranslation();
  const { shop, hours, closedToday, live } = useShopInfo(ready);
  const dot = (open: boolean) => (
    <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', open ? 'bg-in-stock' : 'bg-unclear')} />
  );
  if (live) {
    return <>{dot(live.open)}<span className="truncate">{short ? live.short : live.text}</span></>;
  }
  if (hours) {
    return <>{dot(!closedToday)}<span className="truncate">{closedToday ? t(short ? 'shell.closedShort' : 'shell.closedNote') : hours}</span></>;
  }
  if (shop?.address) {
    return (
      <Link to="/delivery" className="flex min-w-0 items-center gap-1.5 hover:underline">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{shop.address}</span>
      </Link>
    );
  }
  return (
    <>
      <Link to="/delivery" className={cn('flex items-center gap-1.5 hover:underline', onColor && 'text-white')}>
        <Truck aria-hidden="true" className="size-3.5" />
        {t('shell.sections.delivery')}
      </Link>
      <Link to="/questions" className={cn('ml-3 flex items-center gap-1.5 hover:underline', onColor && 'text-white')}>
        <MessageCircleQuestion aria-hidden="true" className="size-3.5" />
        {t('shell.sections.questions')}
      </Link>
    </>
  );
}

/**
 * Как связаться и настройки: адрес (когда слева часы), самовывоз, телефон,
 * WhatsApp, язык и «Aa Обычный шрифт». `onBrand` — белым на цвете магазина
 * (колонка «разворота»).
 */
export function StatusDetails({ ready, onBrand = false, className }: { ready: boolean; onBrand?: boolean; className?: string }) {
  const { t } = useTranslation();
  const { shop, hours, live, pickupOnly, tel, wa } = useShopInfo(ready);
  return (
    <div className={cn('flex shrink-0 items-center gap-4', className)}>
      {/*
        Адрес — здесь, когда слева стоят часы: из-под имени магазина он
        ушёл ради «Сменить магазин · N», как в макете, а терять его
        на мониторе нельзя — за ним едут на самовывоз.
      */}
      {(live || hours) && shop?.address && (
        <Link to="/delivery" className="flex min-w-0 max-w-[16rem] items-center gap-1.5 hover:underline">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{shop.address}</span>
        </Link>
      )}
      {pickupOnly && (
        <span className="flex items-center gap-1.5">
          <Store aria-hidden="true" className="size-3.5" />
          {t('shop.pickup')}
        </span>
      )}
      {tel && (
        <a href={tel} className="flex items-center gap-1.5 hover:underline">
          <Phone aria-hidden="true" className="size-3.5" />
          {shop?.phone && formatPhone(shop.phone)}
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline">
          <MessageCircle aria-hidden="true" className="size-3.5" />
          {t('shop.whatsapp')}
        </a>
      )}
      {/* Язык, разделитель, «Aa Обычный шрифт» — как в макете. */}
      <div data-testid="status-settings" className="-mr-2 flex items-center gap-1">
        {onBrand ? <LanguagePicker onBrand /> : <LanguagePicker strip />}
        <span aria-hidden="true" className={cn('h-3.5 w-px', onBrand ? 'bg-white/30' : 'bg-accent-ink/25')} />
        {onBrand ? <FontScalePicker onBrand /> : <FontScalePicker strip />}
      </div>
    </div>
  );
}

/**
 * Полоса графика — мягкой подложкой под панелью, как в макете: точка
 * состояния и то, чего ждать от заявки сегодня. Справа — как связаться.
 * Без часов у магазина полоса держит адрес или прежние ссылки на
 * доставку и вопросы: пустая полоса читалась бы как недогрузка.
 */
export function ShopStatusStrip({ ready }: { ready: boolean }) {
  return (
    <div data-testid="shop-status" className="hidden bg-accent-soft text-accent-ink lg:block">
      <div className="mx-auto flex h-[2.125rem] w-full max-w-[1440px] items-center gap-2 px-[22px] text-caption font-semibold">
        <StatusText ready={ready} />
        <StatusDetails ready={ready} className="ml-auto" />
      </div>
    </div>
  );
}

/**
 * Полоса графика пилюлей по центру — у плавающей панели и дока, как
 * в макете: сплошная полоса под стеклянной панелью спорила бы с ней.
 */
export function ShopStatusPill({ ready }: { ready: boolean }) {
  return (
    <div data-testid="shop-status" className="hidden justify-center px-4 pt-4 lg:flex">
      <div className="flex max-w-full items-center gap-2 rounded-full bg-accent-soft py-1.5 pl-3.5 pr-4 text-xs font-semibold text-accent-ink">
        <StatusText ready={ready} />
        <span aria-hidden="true" className="mx-1 h-3.5 w-px bg-accent-ink/25" />
        <StatusDetails ready={ready} className="gap-3.5" />
      </div>
    </div>
  );
}
