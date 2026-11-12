import { takenIn } from '../cart/cartPart';
import { WholesaleNote } from './tiles/TemplatePrice';
import { LoadFailed } from '../../ui/LoadFailed';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronLeft, Zap } from '../../ui/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useGetPortalCatalog,
  useGetPortalCatalogFilters,
  useGetPortalCatalogCounts,
  useGetPortalCategories,
  useGetPortalPromotions,
  type GetPortalCatalogPresence,
  type GetPortalCatalogSort,
  type ShowcaseBannerDto,
  type ShowcaseCounts,
  type ShowcaseItemDto,
  type ItemCategoryDto,
} from '../../api/generated';
import { cartOf, useCart } from '../cart/useCart';
import { QuickInput } from './QuickInput';
import { PriceListDownload } from './PriceListDownload';
import { BranchNote } from '../city/BranchNote';
import { CITY_CHIP, HeaderCity } from '../city/HeaderCity';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { ItemThumb } from './ItemThumb';
import { ColourCountBadge } from './ColourCountBadge';
import { useTileVariant } from './TileVariants';
import { StockNote } from './StockNote';
import { CartBar } from '../cart/CartBar';
import { BannerCarousel } from '../banners/BannerCarousel';
import { decimal, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { quantityWithUnit } from '../../shared/units';
import { Button } from '../../ui/Button';
import { Reveal } from '../../ui/Reveal';
import { Pagination } from '../../ui/Pagination';
import { Skeleton } from '../../ui/Skeleton';
import { cn } from '../../ui/cn';
import { useColumnWidth } from '../../ui/useColumnWidth';
import { useWideScreen } from '../../ui/useWideScreen';
import { CartAction, DealPrice, ItemBadges, ItemFacts, MARK_LOOK, dealOf, inMode, MarkIcon, RatingBadge, packPriceClass, perUnitNote, priceNote, useOpenCard } from './itemParts';
import { useOrderMode } from '../cart/orderMode';
import { isCounts, useShopChannel } from './OrderModeSwitch';
import { ChosenChips, PhoneFilters, RubricPicture, SortButton, SortMenu } from './PhoneFilters';
import { HOME } from '../../ui/sectionBack';
import { SearchField } from '../shell/layouts/headerParts';
import { PageHelp } from '../shell/HelpGuide';

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

/** Классы колонок литералами: Tailwind находит классы по тексту исходника. */
const GRID_COLUMNS: Record<number, string> = {
  2: 'grid-cols-2 gap-3',
  3: 'grid-cols-3 gap-5',
  4: 'grid-cols-4 gap-5',
  5: 'grid-cols-5 gap-4',
};

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
  // Быстрые отборы «Хит продаж», «Новинка», «Акция», «Скидка» (решение владельца 2026-10-28):
  // по ним в основном и ищут, и они сочетаются по «и» — между собой, с рубрикой и поиском.
  // «Новинка» приходит и адресом: на неё ведёт вкладка «Новинки» раскладки «вкладки»;
  // «Акция» — адресом `?sale=1`: на неё ведут экран акций и кнопка баннера.
  const noveltyInAddress = searchParams.get('novelty') === '1';
  const saleInAddress = searchParams.get('sale') === '1';
  const [marks, setMarks] = useState<Marks>({ ...NO_MARKS, novelty: noveltyInAddress, promo: saleInAddress });
  const anyMark = MARKS.some((mark) => marks[mark]);
  const setMark = (mark: Mark, on: boolean) => setMarks((current) => ({ ...current, [mark]: on }));
  // Порядок по умолчанию — «сначала популярные», как в макете: хиты
  // и новинки, которые продавец сам вынес вперёд, стоят первыми.
  const [sort, setSort] = useState<GetPortalCatalogSort>('POPULAR');
  // «Оптом / В розницу» — жёсткий переключатель «Варианта Б» (решение владельца 2026-11-04): оптовая
  // и розничная заявки раздельные, и витрина показывает только то, что можно заказать выбранным способом.
  // Выбор общий с карточкой и корзиной (`orderMode.ts`). У продавца с одним способом переключателя нет.
  const { shop, orderMode, setOrderMode, wholesaleModels, retailModels, twoWays, channel } = useShopChannel();
  // Наличие: по умолчанию товара, которого точно нет, клиент не видит — он путал. Закончившееся
  // находят, только выбрав «Все» или «Нет в наличии».
  const [presence, setPresence] = useState<GetPortalCatalogPresence>('IN_STOCK');
  // Снятый из адреса отбор снимается и с витрины: вкладка «Все товары»
  // шаблона уводит со `/catalog?sale=1` на `/catalog`.
  const saleWasInAddress = useRef(saleInAddress);
  useEffect(() => {
    if (saleInAddress) {
      setMark('promo', true);
      setCategoryId(undefined);
    } else if (saleWasInAddress.current) {
      setMark('promo', false);
    }
    saleWasInAddress.current = saleInAddress;
  }, [saleInAddress]);
  const noveltyWasInAddress = useRef(noveltyInAddress);
  useEffect(() => {
    if (noveltyInAddress) {
      setMark('novelty', true);
      setCategoryId(undefined);
    } else if (noveltyWasInAddress.current) {
      setMark('novelty', false);
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
  // Без шаблона на мониторе — по макету ПК-К2: колонка рубрик слева, справа
  // четыре карточки в ряд, пока каждой хватает ширины.
  const columns = phone ? 2 : columnWidth >= 900 ? 4 : three ? 3 : 2;
  // Просторная карточка — там, где у неё есть ширина.
  const roomy = three;
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
  // Отбор по полям — свой у рубрики: в другой рубрике другие поля, и выбранное там ничего не значит.
  // Кроме размера: он есть и в «Всех товарах», и выбранный там размер идёт с человеком в рубрику.
  const [fields, setFields] = useState<string[]>([]);
  const [fieldsCategory, setFieldsCategory] = useState(categoryId);
  if (fieldsCategory !== categoryId) {
    setFieldsCategory(categoryId);
    setFields((chosen) => chosen.filter((key) => key.startsWith('SIZE:') || key.startsWith('SIZE_RUN:')));
  }
  const listKey = JSON.stringify([query, categoryId, marks, sortShown, size, channel, fields, presence]);
  const [pagedKey, setPagedKey] = useState(listKey);
  if (pagedKey !== listKey) {
    setPagedKey(listKey);
    setPage(0);
  }

  const categories = useGetPortalCategories();
  const categoryList = categories.data?.status === 200 ? categories.data.data : [];
  // Рубрика, в которой человек сейчас, — для её баннеров.
  const openCategory = categoryList.find((category) => category.id === categoryId);
  const catalog = useGetPortalCatalog({
    // Быстрые отборы сужают найденное поиском и рубрикой, а не подменяют его.
    query: query.trim() || undefined,
    categoryId,
    page,
    size,
    sort: sortShown,
    hit: marks.hit || undefined,
    novelty: marks.novelty || undefined,
    promo: marks.promo || undefined,
    wholesaleDeal: marks.wholesaleDeal || undefined,
    channel,
    field: fields.length === 0 ? undefined : fields,
    presence,
  });
  // В «Всех товарах» — поля всего каталога и «Размер» из рубрик одежды (решение владельца 2026-10-30).
  // Числа у вариантов — с тем же наличием, что у списка; прежние держатся, пока идут новые, чтобы ряд не мигал.
  const filtersQuery = useGetPortalCatalogFilters({ categoryId, presence },
    { query: { placeholderData: keepPreviousData } });
  const facets = filtersQuery.data?.status === 200
    && Array.isArray(filtersQuery.data.data) ? filtersQuery.data.data : [];
  // Числа у чипов — с тем же поиском, что и страница: число обещает, сколько
  // человек увидит, нажав чип.
  // Прежние числа держатся, пока идут новые: иначе переключатель «Розница / Опт» мигал бы при каждом выборе.
  const counts = useGetPortalCatalogCounts({ query: query.trim() || undefined, channel, presence }, { query: { placeholderData: keepPreviousData } });
  const count = counts.data?.status === 200 && isCounts(counts.data.data) ? counts.data.data : undefined;
  // Все товары, без отбора наличия: по ним видно, скрыто ли что-нибудь, — иначе переключатель не нужен.
  const allCounts = useGetPortalCatalogCounts({ query: query.trim() || undefined, channel, presence: 'ALL' }, { query: { placeholderData: keepPreviousData } });
  const everything = allCounts.data?.status === 200 && isCounts(allCounts.data.data) ? allCounts.data.data.all : undefined;
  const soldOutCounts = useGetPortalCatalogCounts({ presence: 'OUT_OF_STOCK' });
  const shopSoldOut = soldOutCounts.data?.status === 200 && isCounts(soldOutCounts.data.data) ? soldOutCounts.data.data.all : undefined;
  // Сколько найденного скрыто отбором «В наличии» — для подсказки на пустом результате.
  const hiddenSoldOut = presence === 'IN_STOCK' && everything !== undefined && count ? everything - count.all : 0;
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
  // Взятые в заявку того способа, что выбран: розничная строка не делает товар «взятым» в опте.
  const taken = useMemo(() => takenIn(cart, orderMode), [cart, orderMode]);

  /** «Показать все товары»: снять и запрос, и рубрику. */
  function showAll() {
    setCategoryId(undefined);
    setMarks(NO_MARKS);
    if (address || saleInAddress || categoryInAddress || noveltyInAddress) navigate('/catalog');
  }

  // Выбран ли раздел или отбор: только тогда пустой ответ можно поправить
  // «Сбросить раздел». Без них кнопка ничего бы не меняла.
  const filtered = anyMark || categoryId !== undefined || fields.length > 0;

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
    setMarks(NO_MARKS);
    setFields([]);
    if (saleInAddress || categoryInAddress || noveltyInAddress) {
      navigate(address ? `/catalog?q=${encodeURIComponent(address)}` : '/catalog');
    }
  }

  /** Рубрика или «все»: быстрые отборы остаются — они сочетаются с рубрикой. */
  function pickCategory(id: string | undefined) {
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
    setMarks({ ...NO_MARKS, promo: true });
    setCategoryId(undefined);
    // Новинки или рубрика в адресе уступают распродаже — тоже адресом,
    // иначе снятый адрес тут же снял бы и новый отбор.
    if (noveltyInAddress || categoryInAddress) navigate('/catalog?sale=1');
    gridStart.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }


  // Быстрые отборы — свой ряд чипов-переключателей: в отличие от рубрики их можно
  // включить несколько. Чип без товаров виден, но не нажимается — не ведёт в пустоту.
  const markCount = (mark: Mark) => count?.[MARK_COUNT[mark]];

  /*
    Порядок витрины — обычным списком выбора: четыре варианта, и каждый
    читается целиком. У распродажи свой порядок, и выбор там не нужен.
    «Быстрый заказ» — только на мониторе: на телефоне макет отдаёт место
    витрине.
  */
  // Продавец продаёт одним способом — вместо переключателя плашка «Только оптом» / «Только в розницу»
  // (решение владельца 2026-11-04).
  const only = !shop || twoWays ? undefined : wholesaleModels > 0 ? 'WHOLESALE' as const : retailModels > 0 ? 'RETAIL' as const : undefined;


  const quick = quickOpen ? (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4 shadow-[0_0_0_1px_var(--color-hairline)]">
      <p className="text-sm font-semibold text-ink-muted">{t('catalog.quickOrderHint')}</p>
      <QuickInput />
    </div>
  ) : null;

  let results: ReactNode;
  if (catalog.isPending) {
    results = <Skeletons columns={columns} />;
  } else if (catalog.isError) {
    results = <LoadFailed onRetry={() => void catalog.refetch()} />;
  } else if (items.length === 0) {
    results = (
      <div className="flex flex-col items-center gap-3.5 rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center shadow-[0_0_0_1px_var(--color-hairline)]">
        {/* Одной строкой, как в макете: что случилось и что с этим делать. */}
        <p className="max-w-[28rem] text-base leading-normal text-ink-muted">{t('catalog.nothingFound')}</p>
        {/* Найденное могло просто закончиться: «ничего не нашли» без этой строки звучало как «такого нет вовсе».
            Числа — по всему поиску без раздела и отборов, поэтому подсказка — только без них. */}
        {hiddenSoldOut > 0 && !filtered ? (
          <p className="flex flex-wrap items-center justify-center gap-2 text-base text-ink">
            {t('catalog.presence.hiddenHint', { count: hiddenSoldOut })}
            <Button size="lg" variant="outline" onClick={() => setPresence('OUT_OF_STOCK')}>{t('catalog.presence.showHidden')}</Button>
          </p>
        ) : null}
        {/* «Сбросьте раздел» — эта кнопка; без выбранного раздела сбрасывать нечего. */}
        {filtered && <Button size="lg" onClick={resetSection}>{t('catalog.resetSection')}</Button>}
      </div>
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
            <ItemTile item={item} taken={taken} roomy={roomy} phone />
          </Reveal>
        ))}
      </div>
    );
  }

  // Отбор (рубрика, скидки, новинки, поиск) — «назад» ко всему каталогу, без баннеров.
  const narrowed = Boolean(anyMark || openCategory || query.trim());
  // Один быстрый отбор без рубрики — его имя в заголовке («Хит продаж · 8»); иначе рубрика или поиск.
  const onlyMark = MARKS.filter((mark) => marks[mark]);
  const title = openCategory?.name
    ?? (query.trim() ? `«${query.trim()}»` : onlyMark.length === 1 ? t(`catalog.marks.${onlyMark[0]}`) : t('catalog.title'));
  if (phone) {
    return (
      <div ref={columnRef} data-testid="catalog-phone" className="flex flex-col gap-3 pb-20">
        {/* Каталог — вкладка нижнего меню (макеты «Кабинет клиента 2.0»): весь
            каталог открывается баннерами магазина, отбор — кнопкой «назад». */}
        {narrowed ? null : <BannerCarousel width={columnWidth} onAction={openBanner} onSale={openSale} />}
        {/*
          Верх по выбору владельца (2026-11-05): стрелка, «Каталог» и справа «Оптом / В розницу»;
          ниже — поиск и значок порядка ↑↓; под ними строка фильтров.
          Эти две строки при прокрутке закреплены сверху (просьба владельца 2026-11-06): режим и поиск
          под рукой у любого товара; вернулся наверх — баннеры над ними на своём месте.
        */}
        <div data-testid="catalog-phone-top" className="sticky top-0 z-20 -mx-4 -my-2 flex flex-col gap-3 bg-canvas px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('common.back')}
            // Стрелка у имени раздела — всегда на «Главную» (решение владельца 2026-11-05).
            onClick={() => navigate(HOME)}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[0.75rem] border-2 border-solid border-line bg-surface text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <h1 className="m-0 min-w-0 flex-1 truncate text-base font-extrabold tracking-[-0.01em] text-ink">{title}</h1>
          <PageHelp />
          {twoWays ? (
            <div role="radiogroup" aria-label={t('catalog.orderMode.label')} className="flex shrink-0 gap-0.5 rounded-[0.625rem] bg-night p-0.5">
              {(['WHOLESALE', 'RETAIL'] as const).map((mode) => (
                <button key={mode} type="button" role="radio" aria-checked={orderMode === mode} onClick={() => setOrderMode(mode)}
                  className={cn(
                    'qo-hit h-8 cursor-pointer rounded-lg border-0 px-2 text-caption font-extrabold',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    orderMode === mode ? 'bg-surface text-ink' : 'bg-transparent text-night-sub',
                  )}>
                  {t(`catalog.orderMode.${mode}`)}
                </button>
              ))}
            </div>
          ) : only ? (
            <p role="note" className="m-0 shrink-0 whitespace-nowrap rounded-[0.625rem] bg-night px-2.5 py-1.5 text-caption font-extrabold text-white">
              {t(`catalog.channel.only.${only}`)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* Шапки на телефоне нет («Вариант Б») — поиск стоит в самом каталоге. */}
          <SearchField placeholder={t('catalog.searchShort')} hint={false}
            className="h-14 min-w-0 flex-1 rounded-[1.125rem] border-2 bg-surface px-4 [&_input]:text-base [&_svg]:size-5" />
          {/* Порядок — только значком со стрелками (решение владельца 2026-11-05); варианты — окном снизу. */}
          <SortButton value={sortShown} onChange={setSort}
            options={[...PHONE_SORTS, ...(dealCount > 0 ? ['DISCOUNT' as const] : [])]} />
          <PriceListDownload compact categoryId={categoryId}
            note={vatRate !== undefined ? t(items[0].vatIncluded ? 'catalog.leadVatIncluded' : 'catalog.leadVat', { rate: decimal(vatRate) }) : t('catalog.lead')} />
        </div>
        </div>
        {/* Город клиента (для него наличие и доставка) и филиал («Филиалы»): строкой под поиском — в верхней строке
            места нет. Нажатие — в профиль, где город меняется. Магазин без филиалов — только город. */}
        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          <HeaderCity className={CITY_CHIP} />
          <BranchNote />
        </div>
        {/* Фильтры — одной строкой: значок со всеми фильтрами слева и кнопка на каждое поле (решение владельца 2026-11-05). */}
        <PhoneFilters
          rubrics={[
            { name: t('catalog.all'), count: count?.all },
            ...categoryList
              .filter((category) => !isEmpty(category.id) || categoryId === category.id)
              .map((category) => ({ id: category.id, parentId: category.parentId, name: category.name, image: category.imageSrc, count: count ? (count.byCategory[category.id] ?? 0) : undefined })),
          ]}
          rubric={categoryId}
          onRubric={pickCategory}
          facets={facets}
          marks={MARKS.map((mark) => ({
            key: mark, label: t(`catalog.marks.${mark}`), icon: <MarkIcon mark={mark} />, count: markCount(mark),
            idle: cn(MARK_LOOK[mark].tone, MARK_LOOK[mark].hover), on: MARK_LOOK[mark].on,
          }))}
          showPresence={presence !== 'IN_STOCK' || (shopSoldOut ?? 0) > 0}
          value={{ fields, marks: MARKS.filter((mark) => marks[mark]), presence }}
          onApply={(next) => {
            setFields(next.fields);
            setMarks({ ...NO_MARKS, ...Object.fromEntries(next.marks.map((mark) => [mark, true])) });
            setPresence(next.presence);
          }}
        />
        <div ref={gridStart} aria-hidden="true" />
        {results}
        {pager}
        <CartBar />
      </div>
    );
  }

  /** Строка колонки рубрик: имя и число товаров, выбранная — мягкой подложкой. */
  const rubric = (key: string, label: string, selected: boolean, number: number | undefined, onSelect: () => void, image?: string,
    depth = 0, branch?: 'open' | 'closed') => (
    <button
      key={key}
      type="button"
      aria-pressed={selected}
      aria-expanded={branch ? branch === 'open' : undefined}
      onClick={onSelect}
      style={depth > 0 ? { paddingLeft: `${0.5 + depth * 1.25}rem` } : undefined}
      className={cn(
        'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1 text-left text-sm font-bold',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected ? 'bg-accent-soft font-extrabold text-accent-ink' : 'text-ink hover:bg-canvas',
      )}
    >
      {/* Картинка рубрики, как в окне рубрик на телефоне и в макете (просьба владельца 2026-11-05). */}
      <RubricPicture id={key === 'all' ? undefined : key} image={image} small />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {number !== undefined && <span className="text-xs font-semibold text-ink-muted">{number}</span>}
      {branch ? <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-ink-muted transition-transform', branch === 'closed' && '-rotate-90')} /> : null}
    </button>
  );
  /** Отбор «Показать» — флажком, как в макете; нажимается как кнопка. */
  const toggle = (label: string, on: boolean, onSelect: () => void, number?: number, disabled = false, key?: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onSelect}
      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span aria-hidden="true" className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border-2', on ? 'border-accent bg-accent text-on-accent' : 'border-line')}>
        {on && <Check className="size-3.5" />}
      </span>
      {key && key in MARK_LOOK ? (
        <span className={cn('flex flex-1 items-center gap-1.5 rounded-[var(--radius-pill)] border px-2 py-0.5', MARK_LOOK[key as Mark].tone)}>
          <MarkIcon mark={key as Mark} />{label}
        </span>
      ) : <span className="flex-1">{label}</span>}
      {number !== undefined && <span className="text-xs font-semibold text-ink-muted">{number}</span>}
    </button>
  );
  const shownRubric = (category: ItemCategoryDto) => showEmpty || !isEmpty(category.id) || categoryId === category.id;
  // Раскрыты выбранный раздел и все над ним — по цепочке родителей.
  const openPath: string[] = [];
  for (let at = categoryList.find((category) => category.id === categoryId); at; at = categoryList.find((category) => category.id === at?.parentId)) {
    if (openPath.includes(at.id)) break;
    openPath.push(at.id);
  }
  const branchOf = (parentId: string | undefined, depth: number): ReactNode[] => categoryList
    .filter((category) => (category.parentId ?? undefined) === parentId && shownRubric(category))
    .flatMap((category) => {
      const children = categoryList.some((child) => child.parentId === category.id && shownRubric(child));
      const open = children && openPath.includes(category.id);
      return [
        rubric(category.id, category.name, categoryId === category.id,
          count ? (count.byCategory[category.id] ?? 0) : undefined, () => pickCategory(category.id), category.imageSrc,
          depth, children ? (open ? 'open' : 'closed') : undefined),
        ...(open ? branchOf(category.id, depth + 1) : []),
      ];
    });
  const CARD = 'rounded-[1.5rem] bg-surface p-2.5 border-2 border-solid border-hairline';

  return (
    // Монитор без шаблона — по макету ПК-К2: рубрики и отборы колонкой слева;
    // весь каталог открывается баннерами магазина во всю ширину.
    <div className="flex flex-col gap-6">
    {narrowed ? null : <BannerCarousel width={columnWidth} onAction={openBanner} onSale={openSale} />}
    <div data-testid="catalog-plain" className="flex items-start gap-6 pb-20 lg:pb-0">
      <aside className="sticky top-[calc(var(--header-h)+1.5rem)] flex w-60 shrink-0 flex-col gap-4">
        <div role="group" aria-label={t('catalog.rubrics')} className={CARD}>
          {rubric('all', t('catalog.all'), categoryId === undefined, count?.all, () => pickCategory(undefined))}
          {/* Разделы деревом (просьба владельца 2026-11-05): видны верхние; выбранный раскрывается подразделами. */}
          {branchOf(undefined, 0)}
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
        <div role="group" aria-label={t('catalog.marks.label')} className={cn(CARD, 'px-3.5 py-3')}>
          <p className="px-2 pb-1 text-xs font-bold text-ink-muted">{t('catalog.show')}</p>
          {MARKS.map((mark) => toggle(t(`catalog.marks.${mark}`), marks[mark], () => setMark(mark, !marks[mark]),
            markCount(mark), !marks[mark] && markCount(mark) === 0, mark))}
        </div>
      </aside>

      <div ref={columnRef} className="flex min-w-0 flex-1 flex-col gap-4">
        {/*
          Вариант В (решения владельца 2026-11-05): в строке «Каталог» справа — «Фильтры · N» (панель справа), порядок
          и «Быстрый заказ»; ниже — поиск, выбранное чипами и справа «Прайс-лист ▾» (пояснение и две ссылки).
          «Оптом / В розницу» — в верхней панели; наличие и поля — в панели фильтров; быстрые отборы и рубрики — слева.
        */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Нижний предел ширины: на kk кнопки длиннее, и без него заголовок сжимался до «К.», а не уступал им строку. */}
          <h1 className="mr-2 min-w-[8rem] flex-1 truncate text-display font-black tracking-[-0.02em] text-ink">
            {title}
            {total !== undefined && <span className="font-bold text-ink-muted"> · {total}</span>}
          </h1>
          {/* «Как пользоваться» — у названия экрана: из шапки монитора кнопка убрана. */}
          <PageHelp className="shrink-0" />
          {/* Плашка магазина с одним способом; переключатель «Оптом / В розницу» — в верхней панели. */}
          {only ? (
            <p role="note" className="m-0 flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl bg-night px-3.5 text-sm font-extrabold text-white">
              {t(`catalog.channel.only.${only}`)}
            </p>
          ) : null}
          <PhoneFilters wide rubrics={[]} rubric={categoryId} onRubric={pickCategory}
            facets={facets} marks={[]}
            showPresence={presence !== 'IN_STOCK' || (shopSoldOut ?? 0) > 0}
            value={{ fields, marks: MARKS.filter((mark) => marks[mark]), presence }}
            onApply={(next) => { setFields(next.fields); setPresence(next.presence); }} />
          <SortMenu value={sortShown} options={sorts} onChange={setSort} />
          {/* «Быстрый заказ» — в строке «Каталог» после порядка (просьба владельца 2026-11-05). */}
          <button
            type="button"
            aria-expanded={quickOpen}
            onClick={() => setQuickOpen((open) => !open)}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold',
              'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              quickOpen ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <Zap aria-hidden="true" className="size-[18px]" />
            {t('catalog.quickOrder')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Поиск — главный путь к товару: крупный и по свободному месту строки, а не в 18rem, где подсказка обрезалась (просьба владельца 2026-11-06). */}
          <SearchField className="h-13 min-w-[20rem] max-w-[40rem] rounded-2xl border-2 bg-surface pl-4 [&_input]:text-base [&_svg]:size-5" />
          <ChosenChips facets={facets} value={{ fields, marks: MARKS.filter((mark) => marks[mark]), presence }}
            onApply={(next) => { setFields(next.fields); setPresence(next.presence); }} />
          <BranchNote />
          {/* Прайс-лист — в строке поиска, справа (просьба владельца 2026-11-05). */}
          <div className="ml-auto shrink-0">
            <PriceListDownload categoryId={categoryId}
              note={vatRate !== undefined ? t(items[0].vatIncluded ? 'catalog.leadVatIncluded' : 'catalog.leadVat', { rate: decimal(vatRate) }) : t('catalog.lead')} />
          </div>
        </div>
        {quick}
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
  // Сведения выбранной заявки: в «Оптом» — опт, в «В розницу» — розница. В корзину кладётся `shown`.
  const [orderMode] = useOrderMode();
  const view = inMode(shown, orderMode);
  const openCard = useOpenCard(shown.id);

  if (phone) {
    // Карточка «Кабинета клиента 2.0»: снимок, имя, сразу под ним цена,
    // затем опт, условия и наличие. Цена — вплотную к имени (решение владельца 2026-10-28):
    // прижатая к низу карточки, она оставляла пустоту между именем и ценой у короткой карточки.
    // Наличие — всегда, когда оно известно: «В наличии», «Нет в наличии», «С другого склада».
    const taken_ = taken.has(shown.id);
    return (
      <article data-testid="item-tile" onClick={openCard} className="flex h-full cursor-pointer flex-col gap-2">
        {/* shrink-0: с `overflow-hidden` блок снимка сжимается первым, и у карточки с длинными
            условиями (опт, шаг продажи, размеры) фото схлопывалось в полоску. */}
        <div className="relative shrink-0 overflow-hidden rounded-[1.125rem]">
          <ItemThumb itemId={item.id} src={item.thumbnailUrl} photos={item.photos} flight className="h-[10.5rem] w-full lg:h-[13rem]" />
          {/* На узком телефоне метки снизу слева дотягивались до круглой корзины справа —
              там они встают над ней. */}
          <ItemBadges item={view} belowDots={(item.photos?.length ?? 0) > 1} className="max-[374px]:[&>div:last-child]:bottom-[3.25rem]" />
          <FavoriteButton
            itemId={item.id}
            favorite={item.favorite}
            className="absolute right-1.5 top-1.5 rounded-full border-transparent bg-surface/90 shadow-soft backdrop-blur-sm"
          />
          {/* Круглая корзина — в правом нижнем углу снимка (решение владельца 2026-10-30): у всех
              карточек на одном месте, сколько бы строк ни было у цены и условий. */}
          {taken_ ? null : (
            <CartAction item={shown} taken={false} roomy={false} look="round"
              className="absolute bottom-1.5 right-1.5 size-10 !rounded-full bg-accent text-on-accent shadow-soft" />
          )}
        </div>
        {/* Ровно две строки (решение владельца 2026-10-30): длинное имя не растит карточку,
            и цены соседей в ряду стоят на одной линии. Полное имя — в подсказке и в карточке товара. */}
        <Link to={`/catalog/${shown.id}`} title={item.name}
          className="line-clamp-2 min-h-[2.6em] text-sm font-semibold leading-[1.3] text-ink">
          {item.name}
        </Link>
        <div data-testid="tile-price" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col">
              {/* Скидка: старая цена зачёркнута красной линией, новая — зелёным под ней. */}
              {dealOf(view) ? <DealPrice item={view} size="text-lead lg:text-lg" /> : (
                <span className={cn('whitespace-nowrap text-lead font-extrabold tabular-nums lg:text-lg', packPriceClass(view))}>
                  {money(view.price, currency)}
                </span>
              )}
              {/* Своей строкой: «в розницу за кг» рядом с ценой налезало на круглую «+». У скидки опта
                  подпись розницы — внутри DealPrice, при зачёркнутой цене. */}
              {dealOf(view)?.wholesale ? null : <span className="text-xs font-semibold text-ink-muted">{perUnitNote(view, t)}</span>}
              {/* Налог и дата цены — мелко: без даты цена стала бы бессрочным обещанием. */}
              <span className="text-2xs leading-tight text-ink-subtle">{priceNote(view, t)}</span>
            </span>
          </div>
          {taken_ ? <CartAction item={shown} taken roomy={false} look="round" /> : null}
        </div>
        {/* В две строки, а не обрезкой: «за линейку (6 шт.)» — главное в строке опта. */}
        <WholesaleNote item={view} className="line-clamp-2 leading-snug" />
        {/* «Уточняется» у каждой позиции — шум: пишется только то, что что-то говорит. */}
        {shown.available != null || (shown.stock && shown.stock !== 'UNKNOWN')
          ? <StockNote stock={shown.stock} available={shown.available} short className="mt-0 text-xs" />
          : null}
        <ItemFacts item={view} inline />
        {choice}
        <RatingBadge rating={item.rating} reviewCount={item.reviewCount} />
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
          photos={item.photos}
          flight
          className={cn('w-full', thumbHeight(roomy, photo))}
        />
        <ItemBadges item={view} belowDots={(item.photos?.length ?? 0) > 1} />
        <FavoriteButton
          itemId={item.id}
          favorite={item.favorite}
          // Размытие под сердечком: на пёстром снимке полупрозрачная белая
          // подложка без него сливается с кадром.
          className="absolute right-2.5 top-2.5 rounded-full border-transparent bg-surface/90 shadow-soft backdrop-blur-sm"
        />
        {/* Внизу справа: верх занят наклейкой и сердечком, низ слева — метками. */}
        <ColourCountBadge count={colour ? undefined : item.colorCount} className="absolute bottom-2.5 right-2.5" />
      </div>

      <div className={cn('flex flex-1 flex-col', roomy ? 'gap-3 px-[1.125rem] pb-[1.125rem] pt-4' : 'gap-2 p-3')}>
        {/* Ровно две строки — как у плитки телефона: соседи в ряду не расходятся по высоте. */}
        <Link
          to={`/catalog/${shown.id}`}
          title={item.name}
          className={cn(
            'line-clamp-2 min-h-[2.6em] font-semibold leading-[1.3] text-ink transition-colors duration-300 hover:text-accent',
            roomy ? 'text-lead' : 'text-body',
          )}
        >
          {item.name}
        </Link>

        {/* Место под рейтинг держится и без отзывов: иначе цена у соседа без оценки подскакивала бы вверх. */}
        <div className="flex min-h-5 items-center">
          <RatingBadge rating={item.rating} reviewCount={item.reviewCount} />
        </div>

        {choice}

        <div className="flex flex-col gap-0.5">
          {/* Скидка: старая цена зачёркнута красной линией, новая — зелёным под ней. */}
          {dealOf(view) ? (
            <DealPrice item={view} size={roomy ? 'text-display' : 'text-xl'} />
          ) : (
            <span
              className={cn(
                'whitespace-nowrap font-extrabold tracking-[-0.02em] tabular-nums',
                packPriceClass(view),
                roomy ? 'text-display' : 'text-xl',
              )}
            >
              {money(view.price, currency)}
            </span>
          )}
          {dealOf(view)?.wholesale ? null : (
            <span className={cn('font-semibold text-ink-muted', roomy ? 'text-body' : 'text-caption')}>
              {perUnitNote(view, t)}
            </span>
          )}
          <span className="text-xs text-ink-subtle">{priceNote(view, t)}</span>
          {/* В две строки, а не обрезкой: «за линейку (6 шт.)» — главное в строке опта. */}
          <WholesaleNote item={view} className="line-clamp-2 leading-snug" />
        </div>

        <StockNote stock={shown.stock} available={shown.available} short className="mt-0 text-sm" />

        <ItemFacts item={view} inline />
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


/** Порядки витрины в том порядке, в каком их предлагает список «Показать». */
const SORTS: GetPortalCatalogSort[] = ['POPULAR', 'CHEAPEST', 'DEAREST', 'NAME'];
/** Порядок на телефоне — окном по значку со стрелками (решение владельца 2026-11-05). */
const PHONE_SORTS: GetPortalCatalogSort[] = ['POPULAR', 'NEWEST', 'CHEAPEST', 'DEAREST', 'RATING'];

/** Быстрые отборы каталога — в порядке чипов: «Хит продаж», «Новинка», «Акция», «Скидка» (опт дешевле). */
const MARKS = ['hit', 'novelty', 'promo', 'wholesaleDeal'] as const;
type Mark = (typeof MARKS)[number];
type Marks = Record<Mark, boolean>;
const NO_MARKS: Marks = { hit: false, novelty: false, promo: false, wholesaleDeal: false };
/** Число у чипа отбора — поле ответа `/catalog/counts`. */
const MARK_COUNT = { hit: 'hit', novelty: 'novelty', promo: 'sale', wholesaleDeal: 'wholesaleDeal' } as const satisfies Record<Mark, keyof ShowcaseCounts>;

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
