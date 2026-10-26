import { WholesaleNote } from './tiles/TemplatePrice';
import { LoadFailed } from '../../ui/LoadFailed';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData } from '@tanstack/react-query';
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, Zap } from '../../ui/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useGetPortalCatalog,
  useGetPortalCatalogCounts,
  useGetPortalCategories,
  useGetPortalPromotions,
  type GetPortalCatalogChannel,
  type GetPortalCatalogSort,
  type ShowcaseBannerDto,
  type ShowcaseCounts,
  type ShowcaseItemDto,
} from '../../api/generated';
import { cartOf, useCart } from '../cart/useCart';
import { QuickInput } from './QuickInput';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { ItemThumb } from './ItemThumb';
import { ColourCountBadge } from './ColourCountBadge';
import { useTileVariant } from './TileVariants';
import { StockNote } from './StockNote';
import { CartBar } from '../cart/CartBar';
import { BannerCarousel } from '../banners/BannerCarousel';
import { decimal, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { quantityWithUnit, unitPer } from '../../shared/units';
import { Button } from '../../ui/Button';
import { Reveal } from '../../ui/Reveal';
import { Pagination } from '../../ui/Pagination';
import { Skeleton } from '../../ui/Skeleton';
import { cn } from '../../ui/cn';
import { useColumnWidth } from '../../ui/useColumnWidth';
import { useWideScreen } from '../../ui/useWideScreen';
import { useCabinetDesign, type CatalogView, type MotionStyle } from '../../supplier/cabinetDesign';
import { chipClass, type ChipLook } from '../../supplier/templateLook';
import { CartAction, ItemBadges, ItemFacts, RatingBadge, priceNote, useOpenCard } from './itemParts';
import { GridView } from './views/GridView';
import { BentoView } from './views/BentoView';
import { RowsView } from './views/RowsView';
import { MasonryView } from './views/MasonryView';
import { ArrivalsStrip } from '../arrivals/ArrivalsStrip';
import { VolumeHint } from './views/VolumeHint';

// Метки и условия продажи живут в `itemParts`; карточка товара берёт их отсюда.
export { ItemBadges, ItemFacts };

/**
 * С какой ширины СВОЕЙ КОЛОНКИ витрина встаёт в три карточки в ряд.
 *
 * Считано по содержимому: три карточки не уже 240 точек с промежутками
 * по 20. Уже этого карточка отнимает буквы у самой себя: крупная цена
 * отрывается от единицы, а «В корзину» перестаёт помещаться в кнопку.
 *
 * Порог меряется по колонке, а не по окну: на планшете окно широкое,
 * а колонке витрины оболочка оставляет меньше половины.
 */
const THREE_FROM = 780;
/**
 * Сколько карточек на странице витрины. Кратно и двум, и трём, и четырём
 * колонкам — последний ряд страницы не остаётся с одной карточкой.
 */
const CATALOG_SIZES = [24, 48, 96];

/**
 * С какой ширины колонки — четыре карточки: корзина теперь выдвижная,
 * и витрине на мониторе достаётся вся ширина между меню и краем.
 */
const FOUR_FROM = 1040;

/** Классы колонок литералами: Tailwind находит классы по тексту исходника. */
const GRID_COLUMNS: Record<number, string> = {
  2: 'grid-cols-2 gap-3',
  3: 'grid-cols-3 gap-5',
  4: 'grid-cols-4 gap-5',
  5: 'grid-cols-5 gap-4',
};

/**
 * Сколько карточек в ряд — по ширине колонки и виду витрины из шаблона.
 *
 * «Крупные фото» — на колонку меньше: снимок выше и шире, ради него шаблон
 * и выбран. «Мелкая сетка» — на колонку больше, но не на телефоне: две
 * карточки в ряд там и так предел, при трёх цена перестаёт помещаться.
 */
function columnsOf(view: CatalogView, three: boolean, four: boolean): number {
  const base = four ? 4 : three ? 3 : 2;
  if (view === 'big') return Math.max(2, base - 1);
  if (view === 'grid4') return three ? base + 1 : base;
  return base;
}

/**
 * Главный экран кабинета: заголовок, рубрики и витрина карточками.
 *
 * Карточками на любой ширине — на телефоне в две колонки, на мониторе
 * в три: товар выбирают глазами, и снимок с крупной ценой читается быстрее
 * строки. Закупщику, который знает, что берёт, остаётся быстрый ввод над
 * витриной — он собирает заявку, не листая карточки вовсе.
 *
 * Рубрики — строкой чипов над витриной, а не колонкой сбоку: колонка
 * отнимала у витрины ровно ту ширину, которой не хватало третьей карточке.
 *
 * Фильтрация идёт на сервере, а не в браузере: каталог поставщика не
 * помещается в память телефона, и «поиск по загруженному» нашёл бы только
 * первую страницу.
 */
export function CatalogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  /*
   * Где живёт поисковый запрос.
   *
   * Поиск стоит в шапке оболочки на любой ширине и отправляет запрос
   * адресом — `/catalog?q=…`; своё поле витрина не рисует, иначе два поля
   * «Поиск» отвечали бы на один вопрос по-разному.
   */
  const [searchParams] = useSearchParams();
  const address = searchParams.get('q') ?? '';
  // Рубрика приходит и адресом: на неё ведёт «Все товары рубрики» из карточки.
  const categoryInAddress = searchParams.get('category') ?? undefined;
  const [categoryId, setCategoryId] = useState<string | undefined>(categoryInAddress);
  // Адрес ведёт и обратно: вкладка «Все товары» шаблона уводит на `/catalog`,
  // и рубрика, выбранная адресом, снимается вместе с ним.
  useEffect(() => {
    setCategoryId(categoryInAddress);
  }, [categoryInAddress]);
  // «Новинки» — чип рядом с «Со скидкой»: отбор по метке продавца, а не рубрика.
  // Приходит и адресом: на него ведёт вкладка «Новинки» раскладки «вкладки».
  const noveltyInAddress = searchParams.get('novelty') === '1';
  const [novelty, setNovelty] = useState(noveltyInAddress);
  // Порядок по умолчанию — «сначала популярные», как в макете: хиты
  // и новинки, которые продавец сам вынес вперёд, стоят первыми.
  const [sort, setSort] = useState<GetPortalCatalogSort>('POPULAR');
  // «Розница / Опт»: розница — что продаётся штуками (и то, что ещё и оптом), опт — всё с оптом.
  // Пусто — все товары.
  const [channel, setChannel] = useState<GetPortalCatalogChannel | undefined>(undefined);
  // «Со скидкой» — такой же чип, как рубрика, но из адреса тоже: на него
  // ведут экран акций и кнопка баннера.
  const saleInAddress = searchParams.get('sale') === '1';
  const [onSale, setOnSale] = useState(saleInAddress);
  // Снятый из адреса отбор снимается и с витрины: вкладка «Все товары»
  // шаблона уводит со `/catalog?sale=1` на `/catalog`.
  const saleWasInAddress = useRef(saleInAddress);
  useEffect(() => {
    if (saleInAddress) {
      setOnSale(true);
      setNovelty(false);
      setCategoryId(undefined);
    } else if (saleWasInAddress.current) {
      setOnSale(false);
    }
    saleWasInAddress.current = saleInAddress;
  }, [saleInAddress]);
  const noveltyWasInAddress = useRef(noveltyInAddress);
  useEffect(() => {
    if (noveltyInAddress) {
      setNovelty(true);
      setOnSale(false);
      setCategoryId(undefined);
    } else if (noveltyWasInAddress.current) {
      setNovelty(false);
    }
    noveltyWasInAddress.current = noveltyInAddress;
  }, [noveltyInAddress]);
  const promotions = useGetPortalPromotions();
  const dealCount = promotions.data?.status === 200 ? promotions.data.data.dealCount : 0;
  // «Сначала со скидкой» — только пока распродажа идёт: без неё порядок
  // ничем не отличался бы от «сначала популярных».
  const sorts = dealCount > 0 ? [...SORTS, 'DISCOUNT' as const] : SORTS;
  // Распродажа кончилась, а порядок остался — возвращается к умолчанию.
  const sortShown: GetPortalCatalogSort = sort === 'DISCOUNT' && dealCount === 0 ? 'POPULAR' : sort;
  const [columnRef, columnWidth] = useColumnWidth<HTMLDivElement>();
  // Телефон — по макету каталога клиента: заголовок рубрики, чипы, карточки.
  const phone = !useWideScreen();
  const three = columnWidth >= THREE_FROM;
  const four = columnWidth >= FOUR_FROM;
  // Вид витрины выбирает продавец шаблоном: карточки, крупные, мелкие,
  // таблица, бенто, лента, строки, мозаика или полки.
  const { view, style, layout } = useCabinetDesign();
  // Опубликованный дизайн — своя витрина шаблона; без него — прежняя.
  const designed = style !== null;
  // Без шаблона на мониторе — по макету ПК-К2: колонка рубрик слева, справа
  // четыре карточки в ряд, пока каждой хватает ширины.
  const columns = phone ? 2 : designed ? columnsOf(view, three, four) : columnWidth >= 900 ? 4 : three ? 3 : 2;
  // Карточка по макетам кабинета клиента — на телефоне и на мониторе без шаблона.
  const plainTile = phone || !designed;
  // Просторная карточка — там, где у неё есть ширина: в мелкой сетке
  // четыре-пять карточек в ряд набраны плотнее, как на телефоне.
  const roomy = three && view !== 'grid4';
  const photo = view === 'big' ? 'big' : view === 'grid4' ? 'small' : undefined;
  // «Быстрый заказ» — за кнопкой, как в макете: тот, кто знает, что берёт,
  // откроет его сам, а остальным поле ввода над витриной только мешает.
  const [quickOpen, setQuickOpen] = useState(false);
  // Пустые рубрики свёрнуты в один чип: восемь чипов с нулём отнимают строку
  // у товаров и ведут в пустоту.
  const [showEmpty, setShowEmpty] = useState(false);
  // Поиск на любой ширине стоит в шапке оболочки и уходит адресом
  // (`/catalog?q=…`): на телефоне — строкой под шапкой, как в макете.
  const query = address;
  // Витрина листается страницами, а не «первые пятьдесят»: у продавца
  // сотни позиций, и остальные были бы видны только поиском.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(48);
  // Любой другой отбор — другой список, и он начинается с первой страницы:
  // пятая страница узкой рубрики показала бы «ничего не нашли» там, где
  // товары есть. Сброс — прямо при отрисовке, а не эффектом: эффект успел бы
  // отправить запрос новой рубрики со старым номером страницы.
  const listKey = JSON.stringify([query, categoryId, onSale, novelty, sortShown, size, channel]);
  const [pagedKey, setPagedKey] = useState(listKey);
  if (pagedKey !== listKey) {
    setPagedKey(listKey);
    setPage(0);
  }

  const categories = useGetPortalCategories();
  const categoryList = categories.data?.status === 200 ? categories.data.data : [];
  // Рубрика, в которой человек сейчас, — для её баннеров; в новинках рубрики нет.
  const openCategory = novelty ? undefined : categoryList.find((category) => category.id === categoryId);
  const catalog = useGetPortalCatalog({
    // Поиск действует и в распродаже: чип сужает найденное, а не подменяет его.
    query: query.trim() || undefined,
    // Распродажа учитывает рубрику, если она выбрана вместе с чипом;
    // новинки — отбор поперёк рубрик.
    categoryId: novelty ? undefined : categoryId,
    page,
    size,
    onSale: onSale || undefined,
    // Распродажа идёт своим порядком — сначала с большей скидкой, — и выбор
    // порядка к ней не относится.
    sort: onSale ? undefined : sortShown,
    novelty: novelty || undefined,
    // Распродажа «Розницу / Опт» пока не учитывает (сервер) — там переключателя и нет.
    channel: onSale ? undefined : channel,
  });
  // Числа у чипов — с тем же поиском, что и страница: число обещает, сколько
  // человек увидит, нажав чип.
  // Прежние числа держатся, пока идут новые: иначе переключатель «Розница / Опт» мигал бы при каждом выборе.
  const counts = useGetPortalCatalogCounts({ query: query.trim() || undefined, channel }, { query: { placeholderData: keepPreviousData } });
  const count = counts.data?.status === 200 && isCounts(counts.data.data) ? counts.data.data : undefined;
  const isEmpty = (id: string) => !!count && (count.byCategory[id] ?? 0) === 0;
  const emptyCount = categoryList.filter((category) => isEmpty(category.id) && category.id !== categoryId).length;

  const total = catalog.data?.status === 200 ? catalog.data.data.totalElements : undefined;
  const items = useMemo(
    () => (catalog.data?.status === 200 ? (catalog.data.data.items ?? []) : []),
    [catalog.data],
  );

  // Корзина спрашивается один раз на экран, а не карточкой: пятьдесят
  // подписок ради вопроса «эта позиция уже взята?» означали бы пятьдесят
  // перерисовок на каждое нажатие «плюс».
  const cart = cartOf(useCart().data);
  const taken = useMemo(
    () => new Set((cart?.lines ?? []).map((line) => line.itemId)),
    [cart],
  );

  /** «Показать все товары»: снять и запрос, и рубрику. */
  function showAll() {
    setCategoryId(undefined);
    setOnSale(false);
    setNovelty(false);
    if (address || saleInAddress || categoryInAddress || noveltyInAddress) navigate('/catalog');
  }

  // Выбран ли раздел или отбор: только тогда пустой ответ можно поправить
  // «Сбросить раздел». Без них кнопка ничего бы не меняла.
  const filtered = onSale || novelty || categoryId !== undefined;

  // Ставка НДС в подзаголовке — из самих товаров и только когда она у всех
  // одна: назвать одну ставку при разных значило бы соврать о части цен.
  const rates = new Set(items.map((item) => item.vatRate));
  const vatRate = items.length > 0 && rates.size === 1 ? items[0].vatRate : undefined;

  /**
   * «Сбросить раздел»: снять рубрику и отборы, но оставить набранный
   * запрос — человек искал слово, а мешал ему раздел.
   */
  function resetSection() {
    setCategoryId(undefined);
    setOnSale(false);
    setNovelty(false);
    if (saleInAddress || categoryInAddress || noveltyInAddress) {
      navigate(address ? `/catalog?q=${encodeURIComponent(address)}` : '/catalog');
    }
  }

  /** Рубрика или «все»: чип «Со скидкой» при этом гаснет. */
  function pickCategory(id: string | undefined) {
    setOnSale(false);
    setNovelty(false);
    setCategoryId(id);
    // Рубрика из адреса уступает выбранной — тоже адресом, иначе снятый
    // адрес тут же снял бы и новый выбор.
    if (saleInAddress || categoryInAddress || noveltyInAddress) navigate(id ? `/catalog?category=${encodeURIComponent(id)}` : '/catalog');
  }

  const gridStart = useRef<HTMLDivElement>(null);
  const pager = total !== undefined ? (
    <Pagination
      page={page}
      size={size}
      total={total}
      sizes={CATALOG_SIZES}
      onPage={(next) => {
        setPage(next);
        gridStart.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }}
      onSize={setSize}
      label={t('pager.nav')}
    />
  ) : null;

  /**
   * Кнопка баннера: карточка товара и экран акций — переходом, рубрика,
   * отборы «Со скидкой» и «Новинки» и весь каталог — на этой же витрине,
   * прокруткой к товарам. Уводить со страницы ради того, что лежит на ней
   * же, незачем.
   */
  function openBanner(slide: ShowcaseBannerDto) {
    if (slide.target === 'ITEM' && slide.targetItemId) {
      navigate(`/catalog/${slide.targetItemId}`);
      return;
    }
    if (slide.target === 'PROMOTIONS') {
      navigate('/promotions');
      return;
    }
    if (slide.target === 'SALE') {
      openSale();
      return;
    }
    if (slide.target === 'NOVELTY') {
      // Отбор новинок — адресом, как у вкладки «Новинки»: его можно
      // переслать, и «Назад» снимает его вместе с адресом.
      navigate('/catalog?novelty=1');
    } else if (slide.target === 'CATEGORY' && slide.targetCategoryId) {
      if (address) navigate('/catalog');
      pickCategory(slide.targetCategoryId);
    } else {
      showAll();
    }
    gridStart.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  /** Кнопка баннера распродажи: витрина переходит на товары со скидкой. */
  function openSale() {
    setOnSale(true);
    setNovelty(false);
    setCategoryId(undefined);
    // Новинки или рубрика в адресе уступают распродаже — тоже адресом,
    // иначе снятый адрес тут же снял бы и новый отбор.
    if (noveltyInAddress || categoryInAddress) navigate('/catalog?sale=1');
    gridStart.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  // На телефоне чипы — по макету у любого магазина, а не по шаблону.
  const chipLook = phone ? undefined : style?.chip;
  /*
    На мониторе чипы переносятся строками: рубрик у поставщика бывает
    десяток, и все они на виду. На телефоне — одной строкой, которая
    листается пальцем: сетка чипов отняла бы пол-экрана у товаров.
  */
  const chips = (categoryList.length > 0 || dealCount > 0 || (count?.novelty ?? 0) > 0 || novelty) ? (
    <div
      role="group"
      aria-label={t('catalog.rubrics')}
      className={cn(
        'flex',
        'gap-2.5',
        three
          ? cn('flex-wrap', designed && layout === 'center' && 'justify-center')
          : '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      <CategoryChip
        selected={!onSale && !novelty && categoryId === undefined}
        count={count?.all}
        phone={phone}
        look={chipLook}
        onSelect={() => pickCategory(undefined)}
      >
        {t('catalog.all')}
      </CategoryChip>
      {dealCount > 0 ? (
        <CategoryChip
          selected={onSale}
          count={count?.sale}
          tone="sale"
          phone={phone}
        look={chipLook}
          onSelect={() => { setOnSale(true); setNovelty(false); setCategoryId(undefined); if (noveltyInAddress) navigate('/catalog?sale=1'); }}
        >
          {t('catalog.onSale')}
        </CategoryChip>
      ) : null}
      {(count?.novelty ?? 0) > 0 || novelty ? (
        <CategoryChip
          selected={novelty}
          count={count?.novelty}
          phone={phone}
        look={chipLook}
          onSelect={() => { setNovelty(true); setOnSale(false); setCategoryId(undefined); if (saleInAddress || categoryInAddress) navigate('/catalog?novelty=1'); }}
        >
          {t('catalog.novelty')}
        </CategoryChip>
      ) : null}
      {categoryList
        // Рубрика без единого товара — чип, который ведёт в пустоту; такие
        // свёрнуты в «Пустые разделы». Выбранная остаётся, чтобы её можно
        // было снять.
        .filter((category) => showEmpty || !isEmpty(category.id) || categoryId === category.id)
        .map((category) => (
        <CategoryChip
          key={category.id}
          selected={!onSale && !novelty && categoryId === category.id}
          count={count ? (count.byCategory[category.id] ?? 0) : undefined}
          phone={phone}
        look={chipLook}
          onSelect={() => pickCategory(category.id)}
        >
          {category.name}
        </CategoryChip>
      ))}
      {emptyCount > 0 && (
        <button
          type="button"
          aria-expanded={showEmpty}
          onClick={() => setShowEmpty((shown) => !shown)}
          className={cn(
            'flex shrink-0 items-center gap-2 whitespace-nowrap border-[1.5px] border-dashed border-line px-4 font-semibold text-ink-muted',
            designed ? 'h-[2.375rem] rounded-[var(--radius-chip)] text-caption' : 'h-11 rounded-[var(--radius-pill)] text-body',
            'transition-colors duration-200 hover:border-ink hover:text-ink',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {t('catalog.emptyRubrics', { count: emptyCount })}
          <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', showEmpty && 'rotate-180')} />
        </button>
      )}
    </div>
  ) : null;

  /*
    Порядок витрины — обычным списком выбора: четыре варианта, и каждый
    читается целиком. У распродажи свой порядок, и выбор там не нужен.
    «Быстрый заказ» — только на мониторе: на телефоне макет отдаёт место
    витрине.
  */
  // Переключатель нужен, только когда выбор что-то меняет: есть и штучные, и оптовые товары,
  // и не все они продаются обоими способами (тогда «Розница» и «Опт» показали бы одно и то же).
  const retail = count?.retail ?? 0;
  const wholesale = count?.wholesale ?? 0;
  const mixed = !!count && retail > 0 && wholesale > 0
    && (channel !== undefined || !(retail === count.all && wholesale === count.all));
  const channels = mixed && !onSale ? (
    <div role="group" aria-label={t('catalog.channel.label')}
      className="inline-flex shrink-0 self-start rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface p-0.5">
      {([undefined, 'RETAIL', 'WHOLESALE'] as const).map((value) => (
        <button key={value ?? 'ALL'} type="button" aria-pressed={channel === value}
          onClick={() => setChannel(value)}
          className={cn(
            'h-9 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-semibold transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            channel === value ? 'bg-accent text-on-accent' : 'text-ink-muted hover:text-ink',
          )}>
          {t(`catalog.channel.${value ?? 'ALL'}`)}
        </button>
      ))}
    </div>
  ) : null;

  const tools = (
    <div className="hidden flex-wrap items-center gap-2.5 lg:flex">
      {channels}
      <button
        type="button"
        aria-expanded={quickOpen}
        // У шаблона — значком, как в макете: строка «Каталог» отдана рубрикам.
        aria-label={designed ? t('catalog.quickOrder') : undefined}
        title={designed ? t('catalog.quickOrder') : undefined}
        onClick={() => setQuickOpen((open) => !open)}
        className={cn(
          'flex items-center gap-2 border-[1.5px] text-sm font-semibold',
          designed ? 'size-[2.375rem] justify-center rounded-[var(--radius-small)]' : 'h-11 rounded-[var(--radius-control)] px-3.5',
          'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          quickOpen ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink hover:border-ink',
        )}
      >
        <Zap aria-hidden="true" className="size-[18px]" />
        {designed ? null : t('catalog.quickOrder')}
      </button>
      {!onSale && (
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <span className={designed ? 'sr-only' : undefined}>{t('catalog.sort.label')}</span>
          <select
            value={sortShown}
            onChange={(event) => setSort(event.currentTarget.value as GetPortalCatalogSort)}
            className={cn(
              'font-semibold',
              designed
                ? 'h-[2.375rem] cursor-pointer rounded-[var(--radius-small)] border-0 bg-transparent pr-1 text-caption text-ink-muted hover:text-ink'
                : 'h-11 rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface px-3 text-body text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            {sorts.map((key) => (
              <option key={key} value={key}>{t(`catalog.sort.${key}`)}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );

  const quick = quickOpen ? (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-[0_0_0_1px_var(--color-hairline)]">
      <p className="text-sm font-semibold text-ink-muted">{t('catalog.quickOrderHint')}</p>
      <QuickInput />
    </div>
  ) : null;

  let results: ReactNode;
  if (catalog.isPending) {
    results = <Skeletons columns={view === 'list' ? 1 : columns} />;
  } else if (catalog.isError) {
    results = <LoadFailed onRetry={() => void catalog.refetch()} />;
  } else if (items.length === 0) {
    results = (
      <div className="flex flex-col items-center gap-3.5 rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center shadow-[0_0_0_1px_var(--color-hairline)]">
        {/* Одной строкой, как в макете: что случилось и что с этим делать. */}
        <p className="max-w-[28rem] text-base leading-normal text-ink-muted">{t('catalog.nothingFound')}</p>
        {/* «Сбросьте раздел» — эта кнопка; без выбранного раздела сбрасывать нечего. */}
        {filtered && <Button size="lg" onClick={resetSection}>{t('catalog.resetSection')}</Button>}
      </div>
    );
  } else if (view === 'list' && !phone) {
    results = <ItemRows items={items} taken={taken} wide={three} designed={designed} />;
  } else if (style && !phone) {
    results = (
      <TemplateCatalog
        view={view}
        style={style}
        items={items}
        taken={taken}
        width={columnWidth}
      />
    );
  } else {
    results = (
      // Карточки в ряду тянутся до общей высоты — оттого действие и стоит
      // у них по нижнему краю: разъехавшиеся кнопки читаются как разные
      // состояния, а не как разной длины имена.
      <div
        data-testid="item-grid"
        className={cn('grid content-start', GRID_COLUMNS[columns])}
      >
        {items.map((item, index) => (
          <Reveal key={item.id} index={index}>
            <ItemTile item={item} taken={taken} roomy={roomy} photo={photo} phone={plainTile} />
          </Reveal>
        ))}
      </div>
    );
  }

  // Отбор (рубрика, скидки, новинки, поиск) — «назад» ко всему каталогу, без баннеров.
  const narrowed = Boolean(onSale || novelty || openCategory || query.trim());
  const title = onSale
    ? t('catalog.onSale')
    : novelty ? t('catalog.novelty') : openCategory?.name ?? (query.trim() ? `«${query.trim()}»` : t('catalog.title'));
  if (phone) {
    return (
      <div ref={columnRef} data-testid="catalog-phone" className="flex flex-col gap-3 pb-20">
        {/* Каталог — вкладка нижнего меню (макеты «Кабинет клиента 2.0»): весь
            каталог открывается баннерами магазина, отбор — кнопкой «назад». */}
        {narrowed ? null : <BannerCarousel width={columnWidth} onAction={openBanner} onSale={openSale} />}
        <div className="flex items-center gap-3">
          {narrowed ? (
            <Link
              to="/catalog"
              aria-label={t('catalog.back')}
              className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft aria-hidden="true" className="size-[1.375rem]" />
            </Link>
          ) : null}
          <h1 className="min-w-0 flex-1 truncate text-[1.375rem] font-black tracking-[-0.02em] text-ink">
            {title}
            {total !== undefined && <span className="font-bold text-ink-muted"> · {total}</span>}
          </h1>
          {/* Порядок — одной кнопкой справа (макет К2.2), а не чипом среди рубрик. */}
          {onSale ? null : (
            <label className="relative flex h-11 shrink-0 items-center gap-1.5 text-sm font-bold text-ink">
              <ArrowUpDown aria-hidden="true" className="size-[18px]" />
              <span className="sr-only">{t('catalog.sort.label')}</span>
              <select
                value={sortShown}
                onChange={(event) => setSort(event.currentTarget.value as GetPortalCatalogSort)}
                className="cursor-pointer appearance-none border-0 bg-transparent pr-4 text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {sorts.map((key) => <option key={key} value={key}>{t(`catalog.sortShort.${key}`)}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 size-3.5 text-ink-muted" />
            </label>
          )}
        </div>
        {channels}
        {chips}
        <div ref={gridStart} aria-hidden="true" />
        {results}
        {pager}
        <CartBar />
      </div>
    );
  }

  if (designed) {
    // Витрина шаблона — в порядке предпросмотра продавца: главный баннер,
    // подсказка скидки за объём, строка «Каталог» с рубриками и порядком,
    // затем товары. У раскладки «вкладки» рубрики стоят вкладками в шапке.
    const centered = layout === 'center';
    return (
      <div ref={columnRef} data-testid="catalog-designed" className="flex flex-col gap-5 pb-20 lg:gap-6 lg:pb-0">
        <BannerCarousel width={columnWidth} category={openCategory} onAction={openBanner} onSale={openSale} />
        {novelty ? null : <ArrivalsStrip count={count?.novelty ?? 0} />}
        <VolumeHint data={promotions.data?.status === 200 ? promotions.data.data : undefined} compact={!three} />
        <div className={cn('flex gap-x-3 gap-y-3', centered ? 'flex-col items-center' : 'flex-wrap items-center')}>
          <h1 className={cn('qo-heading qo-display mr-3 text-[1.625rem] text-ink', centered ? 'mr-0 lg:text-[2.125rem]' : 'lg:text-[1.625rem]')}>
            {t('catalog.title')}
          </h1>
          {/* У раскладки «вкладки» рубрики на мониторе — вкладками под шапкой,
              а ниже монитора вкладок нет, и рубрики остаются чипами. */}
          <div className={cn('min-w-0', centered ? 'w-full' : 'order-last basis-full xl:order-none xl:basis-auto xl:flex-1', layout === 'tabs' && 'lg:hidden')}>{chips}</div>
          <div className={cn('flex items-center gap-2.5', centered ? '' : 'ml-auto')}>
            {tools}
          </div>
        </div>
        {quick}
        <div ref={gridStart} aria-hidden="true" className="-mb-5 lg:-mb-6" />
        {results}
        {pager}
        <CartBar />
      </div>
    );
  }

  /** Строка колонки рубрик: имя и число товаров, выбранная — мягкой подложкой. */
  const rubric = (key: string, label: string, selected: boolean, number: number | undefined, onSelect: () => void) => (
    <button
      key={key}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected ? 'bg-accent-soft font-extrabold text-accent-ink' : 'text-ink hover:bg-canvas',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {number !== undefined && <span className="text-xs font-semibold text-ink-muted">{number}</span>}
    </button>
  );
  /** Отбор «Показать» — флажком, как в макете; нажимается как кнопка. */
  const toggle = (label: string, on: boolean, onSelect: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onSelect}
      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span aria-hidden="true" className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border-2', on ? 'border-accent bg-accent text-on-accent' : 'border-line')}>
        {on && <Check className="size-3.5" />}
      </span>
      {label}
    </button>
  );
  const CARD = 'rounded-[1.5rem] bg-surface p-2.5 shadow-[2px_3px_6px_rgba(58,48,30,.07)]';

  return (
    // Монитор без шаблона — по макету ПК-К2: рубрики и отборы колонкой слева;
    // весь каталог открывается баннерами магазина во всю ширину.
    <div className="flex flex-col gap-6">
    {narrowed ? null : <BannerCarousel width={columnWidth} onAction={openBanner} onSale={openSale} />}
    <div data-testid="catalog-plain" className="flex items-start gap-6 pb-20 lg:pb-0">
      <aside className="sticky top-[calc(var(--header-h)+1.5rem)] flex w-60 shrink-0 flex-col gap-4">
        <div role="group" aria-label={t('catalog.rubrics')} className={CARD}>
          {rubric('all', t('catalog.all'), !onSale && !novelty && categoryId === undefined, count?.all, () => pickCategory(undefined))}
          {categoryList
            .filter((category) => showEmpty || !isEmpty(category.id) || categoryId === category.id)
            .map((category) => rubric(
              category.id,
              category.name,
              !onSale && !novelty && categoryId === category.id,
              count ? (count.byCategory[category.id] ?? 0) : undefined,
              () => pickCategory(category.id),
            ))}
          {emptyCount > 0 && (
            <button
              type="button"
              aria-expanded={showEmpty}
              onClick={() => setShowEmpty((shown) => !shown)}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-sm font-semibold text-ink-muted hover:text-ink"
            >
              {t('catalog.emptyRubrics', { count: emptyCount })}
              <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', showEmpty && 'rotate-180')} />
            </button>
          )}
        </div>
        {dealCount > 0 || (count?.novelty ?? 0) > 0 || novelty ? (
          <div className={cn(CARD, 'px-3.5 py-3')}>
            <p className="px-2 pb-1 text-xs font-bold text-ink-muted">{t('catalog.show')}</p>
            {dealCount > 0 && toggle(t('catalog.onSale'), onSale, () => (onSale ? resetSection() : openSale()))}
            {((count?.novelty ?? 0) > 0 || novelty) && toggle(t('catalog.novelty'), novelty, () => {
              if (novelty) { resetSection(); return; }
              setNovelty(true); setOnSale(false); setCategoryId(undefined);
              if (saleInAddress || categoryInAddress) navigate('/catalog?novelty=1');
            })}
          </div>
        ) : null}
      </aside>

      <div ref={columnRef} className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 flex-1 truncate text-[1.75rem] font-black tracking-[-0.02em] text-ink">
            {title}
            {total !== undefined && <span className="font-bold text-ink-muted"> · {total}</span>}
          </h1>
          <button
            type="button"
            aria-expanded={quickOpen}
            onClick={() => setQuickOpen((open) => !open)}
            className={cn(
              'flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold',
              'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              quickOpen ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <Zap aria-hidden="true" className="size-[18px]" />
            {t('catalog.quickOrder')}
          </button>
          {channels}
          {!onSale && (
            <div role="group" aria-label={t('catalog.sort.label')} className="flex items-center gap-1">
              {sorts.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sortShown === key}
                  onClick={() => setSort(key)}
                  className={cn(
                    'h-9 rounded-xl px-4 text-[0.8125rem] font-bold',
                    'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    sortShown === key ? 'bg-surface font-extrabold text-ink shadow-[2px_3px_6px_rgba(58,48,30,.07)]' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {t(`catalog.sortShort.${key}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        {quick}
        <p className="-mt-2 text-sm text-ink-muted">
          {vatRate !== undefined ? t(items[0].vatIncluded ? 'catalog.leadVatIncluded' : 'catalog.leadVat', { rate: decimal(vatRate) }) : t('catalog.lead')}
        </p>
        {/* Выгода за объём — на «Главной» и в оформлении (макеты «Кабинет клиента 2.0»), не над сеткой. */}
        <div ref={gridStart} aria-hidden="true" className="-mb-4" />
        {results}
        {pager}
        <CartBar />
      </div>
    </div>
    </div>
  );
}

/**
 * Карточка товара на витрине.
 *
 * Снимок сверху, потому что выбирают глазами: имя и цена читаются вторыми.
 * Сердечко лежит поверх снимка — единственное место, где оно не отнимает
 * ширину у имени. Цена крупная и рядом с ней написано, за что она: «за мешок»
 * читается раньше, чем человек успеет умножить не на то.
 *
 * Нажимается карточка целиком: снимок крупнее имени, и целиться в две строки
 * текста под ним человек не обязан. Ссылка на имени остаётся настоящей
 * ссылкой — см. `useOpenCard`.
 */
export function ItemTile({
  item,
  taken,
  roomy,
  photo,
  phone = false,
}: {
  item: ShowcaseItemDto;
  /** Карточка телефона по макету каталога клиента: снимок, цена, опт, имя, рейтинг, кнопка. */
  phone?: boolean;
  /** Взятые позиции: плитка сама смотрит, взят ли выбранный на ней вариант. */
  taken: ReadonlySet<string>;
  roomy: boolean;
  /** Высота снимка по виду витрины: крупные фото выше, мелкая сетка ниже. */
  photo?: 'big' | 'small';
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  // Выбранный на плитке вариант — её цена, наличие, корзина и карточка.
  const { shown, choice, colour } = useTileVariant(item);
  const openCard = useOpenCard(shown.id);

  if (phone) {
    // Карточка «Кабинета клиента 2.0»: снимок, имя и цена с круглой «+».
    // Цена «без НДС» сказана раз над сеткой, наличие — только когда товара
    // нет или он со склада подальше: «Уточняется» у каждой позиции было шумом.
    const taken_ = taken.has(shown.id);
    const counted = shown.available !== undefined && shown.available !== null;
    const telling = counted || shown.stock === 'OUT_OF_STOCK' || shown.stock === 'FROM_OTHER_WAREHOUSE';
    return (
      <article data-testid="item-tile" onClick={openCard} className="flex h-full cursor-pointer flex-col gap-2">
        {/* shrink-0: с `overflow-hidden` блок снимка сжимается первым, и у карточки с длинными
            условиями (опт, шаг продажи, размеры) фото схлопывалось в полоску. */}
        <div className="relative shrink-0 overflow-hidden rounded-[1.125rem]">
          <ItemThumb itemId={item.id} src={item.thumbnailUrl} flight className="h-[10.5rem] w-full lg:h-[13rem]" />
          <ItemBadges item={shown} className="absolute left-2 top-2" />
          <FavoriteButton
            itemId={item.id}
            favorite={item.favorite}
            className="absolute right-1.5 top-1.5 rounded-full border-transparent bg-surface/90 shadow-soft backdrop-blur-sm"
          />
        </div>
        <Link to={`/catalog/${shown.id}`} className="line-clamp-2 text-sm font-semibold leading-[1.3] text-ink">
          {item.name}
        </Link>
        <WholesaleNote item={item} />
        <ItemFacts item={item} />
        {choice}
        {/* Наличие — когда оно что-то говорит: остаток числом, «нет», «с другого склада».
            «В наличии» и «Уточняется» у каждой позиции были шумом. */}
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted empty:hidden">
          <RatingBadge rating={item.rating} reviewCount={item.reviewCount} />
          {telling ? <StockNote stock={shown.stock} available={shown.available} short className="mt-0 text-xs" /> : null}
        </span>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex min-h-10 items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col">
              <span className={cn('whitespace-nowrap text-[1.0625rem] font-extrabold tabular-nums lg:text-lg', shown.oldPrice !== undefined ? 'text-sale-text' : 'text-ink')}>
                {money(shown.price, currency)}
                <span className="ml-1 text-xs font-semibold text-ink-muted">{t('catalog.priceNote.perUnit', { unit: unitPer(item.unit) })}</span>
              </span>
              {shown.oldPrice !== undefined && (
                <s className="whitespace-nowrap text-xs tabular-nums text-ink-faint">{money(shown.oldPrice, currency)}</s>
              )}
              {/* Налог и дата цены — мелко: без даты цена стала бы бессрочным обещанием. */}
              <span className="text-[0.6875rem] leading-tight text-ink-subtle">{priceNote(shown, t)}</span>
            </span>
            {taken_ ? null : <CartAction item={shown} taken={false} roomy={false} look="round" className="size-10 shrink-0 !rounded-full bg-accent text-on-accent" />}
          </div>
          {taken_ ? <CartAction item={shown} taken roomy={false} look="round" /> : null}
        </div>
      </article>
    );
  }

  return (
    <article
      data-testid="item-tile"
      onClick={openCard}
      /*
        `group/tile` — имя для наведения: снимок внутри наезжает на зрителя,
        когда курсор попал в любое место карточки.
      */
      className={cn(
        'group/tile flex h-full cursor-pointer flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface',
        // Край и тень плитки — из шаблона продавца (`qo-tile` в index.css).
        'qo-tile',
      )}
    >
      <div className="relative">
        {/* Высота снимка в `rem`: при крупном шрифте карточка растёт целиком. */}
        <ItemThumb
          itemId={item.id}
          src={item.thumbnailUrl}
          second={item.secondThumbnailUrl}
          flight
          className={cn('w-full', thumbHeight(roomy, photo))}
        />
        <ItemBadges item={shown} className="absolute left-3 top-3" />
        <FavoriteButton
          itemId={item.id}
          favorite={item.favorite}
          // Размытие под сердечком: на пёстром снимке полупрозрачная белая
          // подложка без него сливается с кадром.
          className="absolute right-2.5 top-2.5 rounded-full border-transparent bg-surface/90 shadow-soft backdrop-blur-sm"
        />
        {/* Внизу слева: верх снимка уже занят метками и сердечком. */}
        <ColourCountBadge count={colour ? undefined : item.colorCount} className="absolute bottom-2.5 left-2.5" />
      </div>

      <div className={cn('flex flex-1 flex-col', roomy ? 'gap-3 px-[1.125rem] pb-[1.125rem] pt-4' : 'gap-2 p-3')}>
        <Link
          to={`/catalog/${shown.id}`}
          className={cn(
            'font-semibold leading-[1.3] text-ink transition-colors duration-300 hover:text-accent',
            roomy ? 'min-h-11 text-lead' : 'text-body',
          )}
        >
          {item.name}
        </Link>

        <RatingBadge rating={item.rating} reviewCount={item.reviewCount} />

        {choice}

        <div className="flex flex-col gap-0.5">
          {shown.oldPrice !== undefined ? (
            <div className="flex flex-wrap items-center gap-x-2">
              <s className="text-body tabular-nums text-ink-faint">{money(shown.oldPrice, currency)}</s>
              <span className="text-sm font-bold text-sale-ink">
                {t('catalog.saving', { amount: money(shown.oldPrice - shown.price, currency) })}
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={cn(
                'whitespace-nowrap font-extrabold tracking-[-0.02em] tabular-nums',
                shown.oldPrice !== undefined ? 'text-sale' : 'text-ink',
                roomy ? 'text-[1.625rem]' : 'text-xl',
              )}
            >
              {money(shown.price, currency)}
            </span>
            <span className={cn('font-semibold text-ink-muted', roomy ? 'text-body' : 'text-caption')}>
              {t('catalog.priceNote.perUnit', { unit: unitPer(item.unit) })}
            </span>
          </div>
          <span className="text-xs text-ink-subtle">{priceNote(shown, t)}</span>
          <WholesaleNote item={item} />
        </div>

        <StockNote stock={shown.stock} available={shown.available} short className="mt-0 text-sm" />

        <ItemFacts item={item} />
        {item.packSize ? (
          <span data-testid="pack-size" className="text-caption font-semibold text-ink-muted">
            {t('pack.size', { amount: quantityWithUnit(item.packSize, 'шт') })}
          </span>
        ) : null}

        {/* Действие прижато к низу: у карточек разной высоты кнопки стоят в ряд. */}
        <div className="mt-auto pt-1">
          <CartAction item={shown} taken={taken.has(shown.id)} roomy={roomy} />
        </div>
      </div>
    </article>
  );
}

/** Высота снимка в `rem`: при крупном шрифте карточка растёт целиком. */
function thumbHeight(roomy: boolean, photo?: 'big' | 'small'): string {
  if (photo === 'big') return roomy ? 'h-[17.5rem]' : 'h-[12rem]';
  if (photo === 'small') return roomy ? 'h-[11rem]' : 'h-[9.5rem]';
  return roomy ? 'h-[13.25rem]' : 'h-[9.5rem]';
}

/** Колонки строки таблицы на мониторе: снимок, товар, артикул, единица, цена, действие. */
const ROW_COLUMNS = 'grid-cols-[3.5rem_minmax(0,1fr)_9rem_9.5rem_9rem_12.5rem]';

/**
 * Витрина таблицей — шаблоны для опта («Компакт», «Склад», «Строгий»).
 *
 * Оптовик знает, что берёт, и ищет глазами артикул и цену, а не снимок:
 * в строку помещается втрое больше позиций, чем в карточки. Артикул набран
 * моноширинным шрифтом — коды одной длины встают ровным столбцом, и
 * «LOW-ELE-001» сверяется с накладной по знакам.
 *
 * На телефоне столбцов нет — только снимок, имя с артикулом и ценой под ним
 * и действие во всю ширину: шесть колонок в 360 точек не помещаются.
 * Действие то же, что у карточки (`CartAction`), — кнопка и счётчик.
 */
function ItemRows({ items, taken, wide, designed = false }: {
  items: ShowcaseItemDto[];
  taken: Set<string>;
  wide: boolean;
  /**
   * Таблица шаблона — как в макете: шапка цветом магазина белыми прописными,
   * строки через одну чуть темнее, скругление самого шаблона.
   */
  designed?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="item-list"
      className={cn(
        'qo-card overflow-hidden bg-surface',
        designed ? 'rounded-[var(--radius-template)] [&_li:nth-child(even)]:bg-[color-mix(in_srgb,var(--color-surface)_55%,var(--color-canvas))]' : 'rounded-[var(--radius-card)]',
      )}
    >
      {wide && (
        <div
          aria-hidden="true"
          className={cn(
            'grid items-center gap-4 px-4 py-2.5 text-xs font-bold uppercase',
            designed
              ? 'bg-shop tracking-[0.08em] text-on-shop'
              : 'border-b border-hairline bg-sunk tracking-[0.06em] text-ink-subtle',
            ROW_COLUMNS,
          )}
        >
          <span />
          <span>{t('catalog.list.item')}</span>
          <span>{t('catalog.list.sku')}</span>
          <span>{t('catalog.list.unit')}</span>
          <span className="text-right">{t('catalog.list.price')}</span>
          <span />
        </div>
      )}
      <ul>
        {items.map((item) => (
          <li key={item.id} className="border-b border-hairline last:border-b-0">
            <ItemRow item={item} taken={taken.has(item.id)} wide={wide} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Строка таблицы: нажимается целиком, как карточка (см. `useOpenCard`). */
function ItemRow({ item, taken, wide }: { item: ShowcaseItemDto; taken: boolean; wide: boolean }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const openCard = useOpenCard(item.id);
  const sale = item.oldPrice !== undefined;
  const sku = (
    <span className="font-mono text-caption text-ink-muted">
      {item.sku ?? <span className="font-sans text-ink-faint">{t('catalog.list.noSku')}</span>}
    </span>
  );
  // Цена столбцом, как в макете: новая крупно, прежняя зачёркнутой под ней.
  const price = (
    <span className={cn('flex flex-col', wide ? 'items-end' : 'items-start')}>
      <span className={cn('whitespace-nowrap text-lg font-extrabold tabular-nums', sale ? 'text-sale' : 'text-ink')}>
        {money(item.price, currency)}
      </span>
      {sale && <s className="text-xs tabular-nums text-ink-muted">{money(item.oldPrice!, currency)}</s>}
    </span>
  );

  return (
    <article
      data-testid="item-row"
      onClick={openCard}
      className={cn(
        'grid cursor-pointer items-center gap-x-4 gap-y-2.5 px-4 py-3 transition-colors duration-200 hover:bg-sunk',
        wide ? ROW_COLUMNS : 'grid-cols-[3.5rem_minmax(0,1fr)]',
      )}
    >
      <ItemThumb itemId={item.id} src={item.thumbnailUrl} width={64} className="size-14 rounded-[var(--radius-control)]" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {/*
          Метки «Хит» и «Новинка» — рядом с названием, как на карточке:
          в таблице снимок мал, и метка на нём не читалась бы.
        */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={`/catalog/${item.id}`}
            className="min-w-0 font-semibold leading-[1.3] text-ink transition-colors duration-300 hover:text-accent"
          >
            {item.name}
          </Link>
          <RowBadges item={item} />
        </span>
        {/* Скидка — строкой под именем цветом скидки, как в макете таблицы. */}
        {item.discountPercent ? (
          <span className="text-[0.7188rem] font-bold text-sale">
            {t('catalog.list.discount', { percent: item.discountPercent })}
          </span>
        ) : null}
        <RatingBadge rating={item.rating} reviewCount={item.reviewCount} className="text-xs" />
        {!wide && sku}
        {!wide && (
          <span className="flex flex-wrap items-baseline gap-x-2">
            {price}
            <span className="text-caption font-semibold text-ink-muted">
              {t('catalog.priceNote.perUnit', { unit: unitPer(item.unit) })}
            </span>
            <WholesaleNote item={item} />
          </span>
        )}
      </div>
      {wide && sku}
      {wide && (
        <div className="flex min-w-0 flex-col gap-0.5 text-sm">
          <span className="font-semibold text-ink">{item.unit}</span>
          <StockNote stock={item.stock} available={item.available} short className="mt-0 text-caption" />
        </div>
      )}
      {wide && price}
      <div className={cn(!wide && 'col-span-2')}>
        <CartAction item={item} taken={taken} roomy={false} />
      </div>
    </article>
  );
}

/**
 * Метки продавца в строке таблицы — те же 21+, «Хит продаж» и «Новинка»,
 * что на карточке, только мельче. 21+ — первой: это условие, а не выгода.
 */
function RowBadges({ item }: { item: Pick<ShowcaseItemDto, 'terms'> }) {
  const { t } = useTranslation();
  const terms = item.terms;
  if (!terms?.hit && !terms?.novelty && !terms?.ageRestricted) return null;
  const pill = 'inline-flex h-[22px] shrink-0 items-center rounded-[var(--radius-pill)] px-2 text-[0.7188rem] font-extrabold';
  return (
    <>
      {terms.ageRestricted && <span className={cn(pill, 'bg-adult text-white')}>{t('catalog.badge.adult')}</span>}
      {terms.hit && <span className={cn(pill, 'bg-night text-white')}>{t('catalog.badge.hit')}</span>}
      {terms.novelty && (
        <span className={cn(pill, 'bg-surface text-ok-ink shadow-[0_0_0_1px_var(--color-hairline)]')}>
          {t('catalog.badge.new')}
        </span>
      )}
    </>
  );
}

/**
 * Рубрика как чип.
 *
 * Кнопкой, а не ссылкой: рубрика — фильтр открытого экрана, а не отдельная
 * страница. Выбранная залита цветом магазина и названа выбранной
 * (`aria-pressed`): цвет читает не всякий.
 *
 * Число товаров стоит рядом с названием, как в макете: сервер считает его
 * тем же поиском, что и страницу (`/catalog/counts`).
 */
function CategoryChip({
  selected,
  onSelect,
  count,
  tone,
  look,
  phone = false,
  children,
}: {
  /** Чип телефона по макету: таблетка, выбранный — тёмный. */
  phone?: boolean;
  selected: boolean;
  onSelect: () => void;
  /** Сколько товаров под чипом; пусто — числа ещё нет, и ноль не выдумывается. */
  count?: number;
  /** `sale` — чип «Со скидкой» в тонах скидки, как в макете. */
  tone?: 'sale';
  /** Вид чипа по шаблону продавца; пусто — прежний чип. */
  look?: ChipLook;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold',
        'transition-all duration-200 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        phone
          ? cn(
            'h-[2.375rem] rounded-[var(--radius-pill)] px-3.5 text-sm',
            selected ? 'bg-ink text-on-ink' : tone === 'sale' ? 'bg-sale-soft text-sale-ink' : 'bg-surface text-ink',
          )
          : look
          ? cn('text-caption', chipClass(look, selected, tone === 'sale'))
          : cn(
            'h-11 rounded-[var(--radius-pill)] border-[1.5px] px-[1.125rem] text-body',
            selected
              ? 'border-accent bg-accent text-on-accent'
              : tone === 'sale'
                ? 'border-sale-line bg-sale-soft text-sale-ink hover:border-sale'
                : 'border-line bg-surface text-ink-muted hover:border-ink hover:text-ink',
          ),
      )}
    >
      {children}
      {/* Пробел — для имени кнопки: без него диктор читает «Все товары12». */}
      {count !== undefined && <>{' '}<span className="font-medium opacity-70">{look ? `· ${count}` : count}</span></>}
    </button>
  );
}

/** Витрина шаблона — вид из опубликованного дизайна: плитка сеткой, бенто, строки или мозаика. */
function TemplateCatalog({
  view,
  style,
  items,
  taken,
  width,
}: {
  view: CatalogView;
  style: MotionStyle;
  items: ShowcaseItemDto[];
  taken: Set<string>;
  width: number;
}) {
  const props = { items, taken, style, width };
  switch (view) {
    case 'bento':
      return <BentoView {...props} />;
    case 'rows':
      return <RowsView {...props} />;
    case 'masonry':
      return <MasonryView {...props} />;
    default:
      return <GridView {...props} view={view} />;
  }
}

/**
 * Похож ли ответ на числа разделов. Сервер старше этого экрана о них не знает,
 * и число, собранное из чужого ответа, было бы выдумкой — лучше без чисел.
 */
export function isCounts(value: unknown): value is ShowcaseCounts {
  const candidate = value as Partial<ShowcaseCounts> | undefined;
  return typeof candidate?.all === 'number' && typeof candidate.byCategory === 'object' && candidate.byCategory !== null;
}

/** Порядки витрины в том порядке, в каком их предлагает список «Показать». */
const SORTS: GetPortalCatalogSort[] = ['POPULAR', 'CHEAPEST', 'DEAREST', 'NAME'];

/**
 * Ожидание в форме будущего содержимого: подмена высоты не даёт витрине прыгнуть.
 *
 * Число колонок приходит то же, что и у витрины: заглушка в три колонки
 * перед витриной в две — это прыжок, ради предотвращения которого её и рисуют.
 */
function Skeletons({ columns }: { columns: number }) {
  // Таблица ждёт строками: столбик высоких карточек перед ней был бы прыжком.
  if (columns === 1) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((cell) => (
          <Skeleton key={cell} data-testid="item-skeleton" className="h-20" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn('grid', GRID_COLUMNS[columns])}>
      {Array.from({ length: columns * 2 }, (_, cell) => (
        <Skeleton
          key={cell}
          data-testid="item-skeleton"
          // Высоты в `rem`: заглушка обязана совпасть с тем, что придёт.
          className={columns === 2 ? 'h-[20rem]' : 'h-[26rem]'}
        />
      ))}
    </div>
  );
}
