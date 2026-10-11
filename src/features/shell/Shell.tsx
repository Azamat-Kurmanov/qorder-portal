import { useIsFetching } from '@tanstack/react-query';
import { Bump } from '../../ui/Bump';
import { getConfig } from '../../config';
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  Clock,
  MapPin,
  Menu,
  MessageCircle,
  MessageCircleQuestion,
  MoreHorizontal,
  Phone,
  Search,
  ShoppingCart,
  Star,
  Store,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CatalogPage } from '../catalog/CatalogPage';
import { AddedToast, CartPanel } from '../cart/CartPanel';
import { openCart, toggleCart, useCartDrawer } from '../cart/cartDrawer';
import { cartOf, useCart } from '../cart/useCart';
import { LanguageAsk } from '../language/LanguageAsk';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { ProfilePage } from '../profile/ProfilePage';
import { RequireSupplier } from '../profile/RequireSupplier';
import { useGetPortalDeliveryOptions, useGetPortalFavorites, useGetPortalSuppliers, useGetPortalUnreadSummary } from '../../api/generated';
import { currentViewer } from '../../auth/oidcConfig';
import { intlLocale } from '../../i18n';
import { money, phone as formatPhone } from '../../shared/format';
import { ActivationBanner } from './ActivationBanner';
import { FontScalePicker } from './FontScale';
import { ThemeToggle } from './ThemeToggle';
import { LanguagePicker } from './LanguagePicker';
import { MyShopsBlock, ShopTile, ShopsDialog, useShops } from './Shops';
import { AgeGateDialog } from '../cart/ageGate';
import { InvitesCard, usePendingInvitations } from './Invitations';
import { StaffBanner } from './StaffBanner';
import { ViewerBadge } from './ViewerBadge';
import { PickupPointPicker } from './layouts/PickupPointPicker';
import { hoursText, telLink, whatsappLink } from './shopHours';
import { MORE_SECTIONS, isActive, useMainSections, type Section } from './sections';
import { DesignHeader } from './layouts/DesignHeader';
import { CenterHeader } from './layouts/CenterHeader';
import { CategoryTabs } from './layouts/CategoryTabs';
import { useHeaderSearch } from './layouts/headerParts';
import { useSupplier } from '../../supplier/useSupplier';
import { useSupplierAccess } from '../../supplier/useSupplierAccess';
import { SupplierCurrencyScope, useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { SupplierTheme } from '../../supplier/SupplierTheme';
import { useCabinetDesign, type CabinetLayout, type TemplateStyle } from '../../supplier/cabinetDesign';
import { MotionLevelContext, useMotionLevel } from '../../ui/motion/motionLevel';
import { Backdrop } from '../../ui/motion/Backdrop';
import { BackgroundLayer } from '../../ui/motion/BackgroundLayer';
import { attachPointerFx, pointerFxEnabled } from '../../ui/motion/pointerFx';
import { ShopAnnounceBar } from './AnnounceBar';
import { OccasionRibbon } from './OccasionRibbon';
import { navItemClass } from '../../supplier/templateLook';
import { Logo } from '../../ui/Logo';
import { Sheet } from '../../ui/Sheet';
import { CART_TARGET } from '../../ui/flyToCart';
import { useWideScreen } from '../../ui/useWideScreen';
import { cn } from '../../ui/cn';
import { ScrollJumps } from './ScrollJumps';

/*
 * Разделы, кроме витрины, грузятся отдельными частями при первом переходе:
 * одним файлом кабинет весил мегабайт, и телефон на мобильной сети ждал
 * страницу акций и видеоплеер ради того, чтобы показать каталог.
 */
const ItemCardPage = lazy(() => import('../catalog/ItemCardPage').then((module) => ({ default: module.ItemCardPage })));
const CheckoutPage = lazy(() => import('../cart/CheckoutPage').then((module) => ({ default: module.CheckoutPage })));
const DeliveryInfoPage = lazy(() => import('../delivery/DeliveryInfoPage').then((module) => ({ default: module.DeliveryInfoPage })));
const FavoritesPage = lazy(() => import('../favorites/FavoritesPage').then((module) => ({ default: module.FavoritesPage })));
const PromotionsPage = lazy(() => import('../promotions/PromotionsPage').then((module) => ({ default: module.PromotionsPage })));
const MyOrdersPage = lazy(() => import('../orders/MyOrdersPage').then((module) => ({ default: module.MyOrdersPage })));
const OrderPage = lazy(() => import('../orders/OrderPage').then((module) => ({ default: module.OrderPage })));
const QuestionsPage = lazy(() => import('../questions/QuestionsPage').then((module) => ({ default: module.QuestionsPage })));
const MyReviewsPage = lazy(() => import('../reviews/MyReviewsPage').then((module) => ({ default: module.MyReviewsPage })));
const TemplatesPage = lazy(() => import('../templates/TemplatesPage').then((module) => ({ default: module.TemplatesPage })));

/**
 * Сколько новостей ждёт у поставщиков, кроме текущего.
 *
 * Текущий не считается намеренно: его новости показывает колокольчик, и одно
 * и то же число в двух местах шапки читается как два разных повода.
 *
 * Считаются только строки сводки, чей поставщик есть в списке поставщиков:
 * сводка может знать о поставщике, к которому идти уже некуда, и точка,
 * зажжённая от него, горела бы без выхода.
 */
function useOthersUnread(): number {
  const { supplierId } = useSupplier();
  const summary = useGetPortalUnreadSummary();
  const suppliers = useGetPortalSuppliers();
  const rows = summary.data?.status === 200 ? summary.data.data : [];
  const knownIds = new Set(
    suppliers.data?.status === 200 ? suppliers.data.data.map((supplier) => supplier.supplierId) : [],
  );
  return rows
    .filter((row) => row.supplierId !== supplierId && knownIds.has(row.supplierId))
    .reduce((sum, row) => sum + row.unread, 0);
}

/**
 * Оболочка кабинета: шапка магазина, колонка разделов, экран и корзина.
 *
 * Кабинет принадлежит магазину, а не системе: шапка окрашена цветом
 * поставщика и называет его, а переход в другой магазин стоит первым
 * блоком колонки — магазинов у клиента бывает несколько, и у каждого свой
 * каталог, цены и корзина.
 *
 * На мониторе колонка разделов стоит слева всегда, и кнопка «Меню» её
 * складывает. На телефоне колонки нет: главные разделы стоят в нижнем меню
 * под большим пальцем, а остальные открывает тот же лист, что и «Меню».
 *
 * Корзина на мониторе — третья колонка, а не липкая полоса внизу: полоса
 * поверх широкого экрана закрывает последнюю строку витрины ради суммы,
 * для которой справа есть место.
 */
export function Shell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [shopsOpen, setShopsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const wide = useWideScreen();
  // Колонка развёрнута, пока её не сложили: человек, открывший кабинет
  // впервые, обязан увидеть разделы, а не догадаться нажать на полоски.
  const [railOpen, setRailOpen] = useState(true);
  const location = useLocation();
  const others = useOthersUnread();
  const { activated, ready } = useSupplierAccess();
  const { sections: mainSections } = useMainSections(ready);
  const { list, supplierId, select } = useShopsSwitch();
  // Раскладка меню на мониторе — из шаблона продавца. На телефоне она
  // не меняется: нижнее меню под большим пальцем удобнее любой другой.
  const design = useCabinetDesign();
  const motion = useMotionLevel(design.motion);
  // Тот же запрос и тот же кеш, что у дизайна: лишнего похода на сервер нет.
  const suppliersPending = useGetPortalSuppliers({ query: { refetchOnMount: false, retryOnMount: false } }).isPending;
  // Эффекты под курсором (свечение, наклон карточек) — один слушатель на весь кабинет;
  // корень появляется, когда список поставщиков пришёл.
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = shellRef.current;
    return root ? attachPointerFx(root, () => pointerFxEnabled(root)) : undefined;
  }, [suppliersPending]);
  const { layout, style } = design;
  // Новая шапка макета — только у опубликованного дизайна. Без него кабинет
  // остаётся прежним целиком, как и обещано в `cabinetDesign.ts`: молча
  // переделать чужую витрину тем, кто ничего не выбирал, нельзя.
  const designed = design.template !== null;
  // Строка разделов под шапкой — у «меню сверху» и «нижнего меню», как в макете.
  const hasTopNav = layout === 'top' || layout === 'bottom';
  // Колонку складывает «Меню» только там, где колонка есть; в остальных
  // раскладках та же кнопка открывает лист со всеми разделами — иначе
  // редкие разделы на мониторе было бы не найти.
  const hasColumn = layout === 'side' || layout === 'rail';
  // Раскладки со своей шапкой вместо обычной — только на мониторе и только
  // у дизайна: на телефоне у всех шаблонов одна шапка и нижнее меню.
  const own = designed && wide ? layout : null;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /**
   * Перейти в другой магазин.
   *
   * После перехода открывается витрина: карточка товара или заявка прежнего
   * магазина у нового не существует. Сообщение о переходе нужно потому, что
   * экран меняется целиком — цвет, имя, товары, — и без слов это читается
   * как сбой, а не как ответ на нажатие.
   */
  function switchShop(id: string) {
    setShopsOpen(false);
    setOpened(false);
    if (id === supplierId) return;
    const name = list.find((supplier) => supplier.supplierId === id)?.name ?? '';
    select(id);
    navigate('/catalog');
    setToast(t('shops.switched', { name }));
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }

  // Пока список магазинов не пришёл, шаблон неизвестен: оболочка по умолчанию,
  // нарисованная сейчас, через секунду сменилась бы шаблоном магазина. Вместо
  // неё — пустая подложка в цветах магазина (их уже поставил `index.html`).
  if (suppliersPending) {
    return <div data-testid="shell-pending" aria-busy="true" className="min-h-screen bg-canvas" />;
  }

  return (
    // Валюта открытого магазина — на весь кабинет: скоуп стоит корнем оболочки,
    // чтобы им пользовался любой экран внутри, без нового useGetPortalSuppliers
    // в каждом листе.
    <SupplierCurrencyScope>
    <MotionLevelContext.Provider value={motion}>
    <div
      ref={shellRef}
      data-testid="shell"
      // Уровень движения — для правил CSS (`index.css`) и полёта в корзину.
      data-motion={motion}
      // Тема — для её особенностей в CSS (радужная рамка Призмы и т. п.).
      data-template={design.template?.id}
      // Вид кнопок темы (`liveTheme.css`, `.qo-btn`).
      data-cta={design.style?.cta}
      // Подложка шаблона — с фактурой (точки, сетка, подсветка); без
      // дизайна — прежняя бумага.
      // `isolate` — своя стековая группа: слой живого фона (z-index: -1)
      // ложится над подложкой оболочки, а не под ней.
      className={cn('relative min-h-screen isolate', designed ? 'qo-canvas' : 'bg-canvas')}
      // Строка разделов под шапкой делает шапку выше, и всё, что липнет
      // под ней (колонка оформления), должно знать её настоящую высоту.
      style={headerHeight(designed, own ?? (hasTopNav ? 'top' : 'side'), layout)}
    >
      {/* Узор или фото продавца — под живым фоном, позади всего содержимого. */}
      <BackgroundLayer pattern={design.pattern} photo={design.photo} />
      {/* Живой фон — позади всего содержимого оболочки. */}
      <Backdrop code={design.backdrop} level={motion} season={design.template?.id === 'SEASON'} />
      {/* Цвет шапки и фон подложки задаёт поставщик в своих реквизитах. */}
      <SupplierTheme />
      {/*
        Вопрос о языке — поверх всего и до всего: кабинет, открывшийся не на
        том языке, человек не читает, а разглядывает.
      */}
      <LanguageAsk />

      {/* Полоса объявлений — у тем, где она есть (Вспышка, Лукбук, Сезон). */}
      <ShopAnnounceBar enabled={!!design.style?.announce} />
      {designed ? (
        <ShellHeader
          layout={own}
          activated={activated}
          ready={ready}
          others={others}
          nav={style?.nav ?? 'pill'}
          onOpenSections={() => (wide && hasColumn ? setRailOpen((open) => !open) : setOpened(true))}
          onOpenShops={() => setShopsOpen(true)}
          onMore={() => setOpened(true)}
          topNav={hasTopNav}
        />
      ) : (
        <Header
          activated={activated}
          ready={ready}
          onOpenSections={() => (wide && hasColumn ? setRailOpen((open) => !open) : setOpened(true))}
          onOpenShops={() => setShopsOpen(true)}
          othersUnread={others}
        />
      )}

      {/*
        Полоса арендатора стоит под шапкой и над всем остальным: она объясняет,
        почему этот кабинет — не чей-то, а свой.
      */}
      {currentViewer() === 'staff' && (
        <StaffBanner webUrl={getConfig().WEB_URL ?? '/'} />
      )}

      {/* Полоса о неоткрытом кабинете — единственное, что клиенту без поставщика есть смысл показывать. */}
      {!activated && <ActivationBanner />}

      {/* Праздник продавца — только в его дни, решает `resolveDesign`. */}
      {design.occasion && (
        <OccasionRibbon occasion={design.occasion} shop={list.find((supplier) => supplier.supplierId === supplierId)?.name} />
      )}

      <Sheet open={opened && !(wide && layout === 'side')} onOpenChange={setOpened} title={t('shell.menu')} side="left">
        {/*
          Язык и размер шрифта — первой строкой: на телефоне фирменной полосы
          шапки нет, и другого места для переключателей там не остаётся.
        */}
        <div className="flex items-center justify-between gap-2 pb-2">
          <LanguagePicker />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <FontScalePicker />
          </div>
        </div>

        <nav aria-label={t('shell.sectionsNav')} className="flex flex-col gap-1">
          {[...mainSections, ...MORE_SECTIONS].map((section) => (
            <SectionLink
              key={section.path}
              section={section}
              current={location.pathname}
              badge={section.path === '/profile' ? others : undefined}
              onFollow={() => setOpened(false)}
            />
          ))}
        </nav>

        {/*
          Знак системы — подвалом под разделами: с телефона человек попал сюда
          по присланной ссылке и спрашивает, чья это система. Меню — верное
          для этого место: открывают его не в спешке.
        */}
        <div
          data-testid="menu-logo"
          className="mt-6 flex flex-col items-center gap-1 border-t border-hairline pt-4"
        >
          <SystemMark />
        </div>
      </Sheet>

      <ShopsDialog open={shopsOpen} onOpenChange={setShopsOpen} onSwitch={switchShop} />
      <AgeGateDialog />

      <div
        data-testid="shell-grid"
        data-layout={layout}
        className={cn(
          'mx-auto flex w-full max-w-[1440px] lg:grid',
          // Сложенная колонка отдаёт свою ширину витрине, а не оставляет
          // пустую дорожку: ради этого её и складывают.
          gridColumns(layout, railOpen, designed),
        )}
      >
        {railOpen && layout === 'side' && (
          <Rail
            current={location.pathname}
            others={others}
            cartActive={ready}
            onOpenShops={() => setShopsOpen(true)}
            onSwitch={switchShop}
            designed={designed}
            nav={style?.nav}
          />
        )}
        {railOpen && layout === 'rail' && (
          <SlimRail
            current={location.pathname}
            others={others}
            cartActive={ready}
            onMore={() => setOpened(true)}
            nav={style?.nav}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={cn(
              'min-w-0 flex-1 px-4 pt-4 lg:px-8 lg:pb-24 lg:pt-7',
              // Запас снизу — под нижнее меню телефона и стрелку «наверх» над ним:
              // без него последняя строка экрана остаётся под ними и до неё не долистать.
              'pb-[calc(10rem+env(safe-area-inset-bottom))]',
            )}
          >
            {/*
              Смена экрана видна движением: четверть секунды, проявление и
              полсантиметра снизу. Ключом служит адрес — иначе анимация отыграла
              бы один раз за всё время работы кабинета. В ключе и магазин:
              витрина другого магазина начинается заново — без прежней
              рубрики, отбора, порядка, страницы и слайда.
            */}
            <div
              key={`${supplierId ?? ''}:${location.pathname}`}
              // Лента по центру — узкой колонкой в 900 точек, как в макете.
              className={cn('animate-page', own === 'center' && 'mx-auto max-w-[56.25rem]')}
            >
              <Suspense fallback={null}>
              <Routes>
                <Route path="/catalog" element={<RequireSupplier><CatalogPage /></RequireSupplier>} />
                <Route path="/catalog/:itemId" element={<RequireSupplier><ItemCardPage /></RequireSupplier>} />
                <Route path="/favorites" element={<RequireSupplier><FavoritesPage /></RequireSupplier>} />
                <Route path="/promotions" element={<RequireSupplier><PromotionsPage /></RequireSupplier>} />
                <Route path="/checkout" element={<RequireSupplier><CheckoutPage /></RequireSupplier>} />
                <Route path="/orders" element={<RequireSupplier><MyOrdersPage /></RequireSupplier>} />
                <Route path="/orders/:id" element={<RequireSupplier><OrderPage /></RequireSupplier>} />
                <Route path="/templates" element={<RequireSupplier><TemplatesPage /></RequireSupplier>} />
                <Route path="/questions" element={<RequireSupplier><QuestionsPage /></RequireSupplier>} />
                <Route path="/reviews" element={<RequireSupplier><MyReviewsPage /></RequireSupplier>} />
                <Route path="/delivery" element={<RequireSupplier><DeliveryInfoPage /></RequireSupplier>} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/catalog" replace />} />
              </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {/*
        Корзина — выдвижной панелью по кнопке в шапке, а не колонкой: витрине
        достаётся вся ширина. В неоткрытом кабинете корзины нет вовсе:
        у клиента без поставщика её не существует.
      */}
      {activated && <CartPanel active={ready} />}
      <AddedToast />

      <BottomNav
        current={location.pathname}
        cartActive={ready}
        onMore={() => setOpened(true)}
      />

      <ScrollJumps content={shellRef} />

      {toast && (
        <div
          role="status"
          className={cn(
            'fixed left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius-pill)] bg-ink px-5 py-3 text-body font-semibold text-on-ink shadow-float',
            'transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0',
            'bottom-[calc(6rem+env(safe-area-inset-bottom))]',
            'lg:bottom-8',
          )}
        >
          {toast}
        </div>
      )}
    </div>
    </MotionLevelContext.Provider>
    </SupplierCurrencyScope>
  );
}

/** Список магазинов и выбор — одной парой, чтобы оболочке не держать два хука ради одного перехода. */
function useShopsSwitch() {
  const { list, supplierId } = useShops();
  const { select } = useSupplier();
  return { list, supplierId, select };
}

/**
 * Высота шапки для всего, что липнет под ней.
 *
 * Без дизайна — прежняя (`index.css`). Шапка шаблона — панель 68 точек
 * и полоса графика 34, как в макете, и ещё строка разделов 52 у «меню
 * сверху» и «нижнего меню». В `rem`: при крупном шрифте полосы растут.
 */
function headerHeight(designed: boolean, own: CabinetLayout, layout: CabinetLayout): CSSProperties | undefined {
  if (!designed) return undefined;
  const heights: Partial<Record<CabinetLayout, string>> = {
    top: 'calc(6.375rem + 3.25rem)',
    center: '7.5rem',
    tabs: 'calc(6.375rem + 5.25rem)',
  };
  // На телефоне раскладка своей шапки не рисует — там высота обычной.
  const height = heights[own] ?? (layout === 'top' || layout === 'bottom' ? heights.top : '6.375rem');
  return { '--header-h': height } as CSSProperties;
}

/**
 * Шапка кабинета с дизайном — по раскладке шаблона на мониторе.
 *
 * `layout` пуст на телефоне: там у всех шаблонов одна шапка и нижнее меню.
 * Плавающая панель, шапка дока и шапка по центру — свои; «разворот» шапки
 * не имеет вовсе (его колонка и верхняя строка стоят в сетке); остальные —
 * обычная шапка, под которой строка разделов или вкладки рубрик.
 */
function ShellHeader({
  layout,
  activated,
  ready,
  others,
  nav,
  onOpenSections,
  onOpenShops,
  onMore,
  topNav,
}: {
  layout: CabinetLayout | null;
  activated: boolean;
  ready: boolean;
  others: number;
  nav: TemplateStyle['nav'];
  onOpenSections: () => void;
  onOpenShops: () => void;
  onMore: () => void;
  topNav: boolean;
}) {
  const location = useLocation();
  const common = { activated, ready, othersUnread: others, onOpenShops };
  switch (layout) {
    case 'center':
      return <CenterHeader {...common} onMore={onMore} />;
    default:
      return (
        <DesignHeader
          {...common}
          onOpenSections={onOpenSections}
          below={topNav ? (
            <TopNav current={location.pathname} others={others} cartActive={ready} onMore={onMore} nav={nav} />
          ) : layout === 'tabs' ? <CategoryTabs ready={ready} /> : null}
        />
      );
  }
}

/**
 * Колонки сетки на мониторе: колонка разделов, узкая рейка или ничего.
 *
 * Рейка — 72 точки, как в макете: значок и короткая подпись под ним.
 * У раскладок «меню сверху» и «нижнее меню» колонки слева нет вовсе —
 * витрине достаётся вся ширина.
 */
function gridColumns(layout: CabinetLayout, railOpen: boolean, designed: boolean): string {
  // Колонка шаблона — 232 точки, как в макете; без дизайна — прежние 256.
  if (railOpen && layout === 'side') {
    return designed ? 'lg:grid-cols-[232px_minmax(0,1fr)]' : 'lg:grid-cols-[256px_minmax(0,1fr)]';
  }
  if (railOpen && layout === 'rail') return 'lg:grid-cols-[72px_minmax(0,1fr)]';
  return 'lg:grid-cols-[minmax(0,1fr)]';
}

/**
 * Строка разделов под шапкой — шаблоны с меню сверху («Витрина», «Маркет»).
 *
 * Только главные разделы и «Ещё»: десять пунктов в строку не помещаются,
 * а редкие разделы открывает тот же лист, что и «Меню» в шапке.
 * Выбранный раздел — мягкой подложкой, как в макете: сплошная заливка
 * в строке из пяти пунктов спорила бы с кнопкой корзины рядом.
 */
function TopNav({
  current,
  others,
  cartActive,
  onMore,
  nav = 'pill',
}: {
  current: string;
  others: number;
  cartActive: boolean;
  onMore: () => void;
  /** Вид пункта по шаблону: подложка, подчёркивание во всю высоту строки или полоса снизу. */
  nav?: TemplateStyle['nav'];
}) {
  const { t } = useTranslation();
  const lines = cartOf(useCart(cartActive).data)?.lines.length ?? 0;
  const { sections, deals } = useMainSections(cartActive);
  const inMore = MORE_SECTIONS.some((section) => isActive(section, current));
  const item = (active: boolean) => cn(
    'flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-sm',
    nav === 'underline' ? 'h-full' : 'h-9',
    'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    navItemClass(nav, active, false),
  );
  // Счётчик — цветом скидки, как в макете: он зовёт к выгоде, а не к кнопке.
  const pill = 'inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-sale px-1.5 text-2xs font-extrabold text-white';

  return (
    <nav
      aria-label={t('shell.sectionsRail')}
      data-testid="top-nav"
      className="hidden border-b border-hairline bg-surface lg:block"
    >
      <div className="mx-auto flex h-13 w-full max-w-[1440px] items-center gap-1.5 overflow-x-auto px-[22px] [scrollbar-width:none]">
        {sections.map((section) => {
          const Icon = section.icon;
          if (section.path === '/checkout') {
            return (
              <button key={section.path} type="button" aria-haspopup="dialog" onClick={openCart} className={item(false)}>
                <Icon aria-hidden="true" className="size-[18px]" />
                {t(`shell.sections.${section.key}`)}
                {lines > 0 && (
                  <span role="img" aria-label={t('shell.inCart', { count: lines })} className={pill}><Bump value={lines}>{lines}</Bump></span>
                )}
              </button>
            );
          }
          const active = isActive(section, current);
          return (
            <NavLink
              key={section.path}
              to={section.path}
              aria-current={active ? 'page' : undefined}
              className={item(active)}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              {t(`shell.sections.${section.key}`)}
              {section.path === '/promotions' && deals > 0 && (
                <span role="img" aria-label={t('shell.deals', { count: deals })} className={pill}>{deals}</span>
              )}
            </NavLink>
          );
        })}
        <button type="button" onClick={onMore} className={item(inMore)}>
          <MoreHorizontal aria-hidden="true" className="size-[18px]" />
          {t('shell.more')}
          {others > 0 && (
            <span role="img" aria-label={t('shell.unread', { count: others })} className={pill}>{others}</span>
          )}
        </button>
      </div>
    </nav>
  );
}

/**
 * Узкая рейка — шаблоны «Строгий» и «Техно».
 *
 * Значок и короткая подпись под ним: одни значки — загадка для того, кто
 * открыл кабинет впервые, а полные названия в 72 точки не помещаются.
 * Подписи — те же короткие, что в нижнем меню телефона. Полное название
 * стоит в `title`: мышью его можно подсмотреть.
 */
function SlimRail({
  current,
  others,
  cartActive,
  onMore,
  nav = 'pill',
}: {
  current: string;
  others: number;
  cartActive: boolean;
  onMore: () => void;
  nav?: TemplateStyle['nav'];
}) {
  const { t } = useTranslation();
  const lines = cartOf(useCart(cartActive).data)?.lines.length ?? 0;
  const { sections } = useMainSections(cartActive);
  const inMore = MORE_SECTIONS.some((section) => isActive(section, current));
  const item = (active: boolean) => cn(
    'relative flex w-[3.75rem] flex-col items-center gap-1 px-0.5 py-[9px] text-center text-[0.6562rem] leading-tight',
    'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    navItemClass(nav, active, true),
    'font-bold',
  );
  const dot = 'absolute right-1 top-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-[var(--radius-pill)] bg-accent px-1 text-[0.625rem] font-bold text-on-accent';

  return (
    <nav
      aria-label={t('shell.sectionsRail')}
      data-testid="slim-rail"
      className={cn(
        'hidden flex-col items-center gap-2 border-r border-hairline bg-surface py-4 lg:flex',
        'lg:sticky lg:top-[var(--header-h)] lg:h-[calc(100dvh-var(--header-h))] lg:overflow-y-auto',
      )}
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const title = t(`shell.sections.${section.key}`);
        if (section.path === '/checkout') {
          return (
            <button key={section.path} type="button" aria-haspopup="dialog" title={title} onClick={openCart} className={item(false)}>
              <Icon aria-hidden="true" className="size-5" />
              {t(`shell.tabs.${section.key}`)}
              {lines > 0 && (
                <span role="img" aria-label={t('shell.inCart', { count: lines })} className={dot}><Bump value={lines}>{lines}</Bump></span>
              )}
            </button>
          );
        }
        const active = isActive(section, current);
        return (
          <NavLink
            key={section.path}
            to={section.path}
            title={title}
            aria-current={active ? 'page' : undefined}
            className={item(active)}
          >
            <Icon aria-hidden="true" className="size-5" />
            {t(`shell.tabs.${section.key}`)}
          </NavLink>
        );
      })}
      <button type="button" onClick={onMore} className={item(inMore)}>
        <MoreHorizontal aria-hidden="true" className="size-5" />
        {t('shell.tabs.more')}
        {others > 0 && (
          <span role="img" aria-label={t('shell.unread', { count: others })} className={dot}>{others}</span>
        )}
      </button>
    </nav>
  );
}

/**
 * Знак системы с лозунгом: «чья это система» и «что она делает».
 *
 * Пока идёт первая загрузка, знак «дышит». Первая — значит запрос в полёте,
 * а данных у него ещё нет: тихое обновление уже показанного не считается,
 * иначе знак двигался бы почти всё время.
 */
function SystemMark() {
  const { t } = useTranslation();
  const loading = useIsFetching({ predicate: (query) => query.state.data === undefined }) > 0;
  return (
    <>
      <div className="flex items-center gap-2">
        <Logo variant="mark" decorative animated={loading} className="h-6" />
        <span className="text-caption font-medium tracking-[-0.01em] text-ink-subtle">
          Q-Order
        </span>
      </div>
      <p className="text-center text-2xs leading-4 text-ink-faint">{t('brand.tagline')}</p>
    </>
  );
}

/**
 * Колонка слева на мониторе: мои магазины, разделы и помощь.
 *
 * Липкая и со своей прокруткой: разделы — это способ уйти с экрана,
 * и уезжать вместе с длинной витриной они не должны.
 */
function Rail({
  current,
  others,
  cartActive,
  onOpenShops,
  onSwitch,
  designed = false,
  nav = 'pill',
}: {
  current: string;
  others: number;
  cartActive: boolean;
  onOpenShops: () => void;
  /** Переход в другой магазин из блока «Мои магазины» — тот же, что из окна. */
  onSwitch: (supplierId: string) => void;
  /**
   * Колонка шаблона продавца — по макету: белая панель, пункты по 44 точки,
   * выбранный — по виду пункта шаблона, счётчик — цветом скидки, карточка
   * «Вы сейчас в» — на подсветке фирменного и второго цвета.
   */
  designed?: boolean;
  /** Вид пункта меню по шаблону: подложка, подчёркивание или полоса у края. */
  nav?: TemplateStyle['nav'];
}) {
  const { t } = useTranslation();
  const lines = cartOf(useCart(cartActive).data)?.lines.length ?? 0;
  // Число товаров со скидкой — у «Акций и скидок», как в макете: оно говорит,
  // что туда стоит заглянуть, раньше, чем человек туда зайдёт.
  const { sections, deals } = useMainSections(cartActive);
  // Число отложенного — у «Избранного», как у корзины: видно, что там есть
  // что взять, не заходя. Спрашивается тот же список, что рисует раздел, —
  // отметка сердечком его перечитывает, и число следует за ней.
  const favorites = useGetPortalFavorites({ query: { enabled: cartActive } });
  const favoriteCount = favorites.data?.status === 200 ? favorites.data.data.length : 0;
  // Телефон магазина решает, куда ведёт «Нужна помощь?»: он есть — помощь
  // звонит напрямую, а не пересылает в вопросы продавцу, на которые тоже
  // нужно ждать ответа.
  const { current: shop, list } = useShops();
  const shopCount = list.length;
  const helpTel = telLink(shop?.phone);
  const helpWa = whatsappLink(shop?.whatsapp);
  const inMore = MORE_SECTIONS.some((section) => isActive(section, current));
  // «Ещё» раскрыто само, если открыт один из его разделов: выбранный пункт,
  // спрятанный под свёрнутым списком, оставил бы человека без ответа «где я».
  const [moreOpen, setMoreOpen] = useState(inMore);
  const showMore = moreOpen || inMore;

  return (
    <div
      data-testid="rail"
      className={cn(
        'hidden flex-col gap-1.5 border-r border-hairline lg:flex',
        designed ? 'bg-surface px-3 pb-5 pt-[18px]' : 'bg-sunk px-4 pb-5 pt-4',
        'lg:sticky lg:top-[var(--header-h)] lg:h-[calc(100dvh-var(--header-h))] lg:overflow-y-auto',
      )}
    >
      <nav aria-label={t('shell.sectionsRail')} className="flex flex-col gap-1">
        {sections.map((section) => (
          section.path === '/checkout' ? (
            // Корзина в колонке открывает ту же панель, что и кнопка в шапке:
            // уводить с витрины ради взгляда на состав незачем.
            <CartNavButton key={section.path} section={section} lines={lines} designed={designed} nav={nav} />
          ) : (
            <SectionLink
              key={section.path}
              section={section}
              current={current}
              badge={railBadge(section.path, deals, favoriteCount)}
              badgeLabel={section.path === '/promotions'
                ? t('shell.deals', { count: deals })
                : section.path === '/favorites' ? t('shell.favoritesCount', { count: favoriteCount }) : undefined}
              large
              designed={designed}
              nav={nav}
            />
          )
        ))}

        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            'flex min-h-11 w-full items-center gap-3.5 px-3.5 text-left text-body text-ink-muted',
            designed ? 'rounded-[var(--radius-small)]' : 'rounded-[var(--radius-control)]',
            'transition-colors duration-200 hover:bg-ink/5 hover:text-ink',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          <MoreHorizontal aria-hidden="true" className="size-5 shrink-0" />
          {showMore ? t('shell.less') : t('shell.more')}
          <ChevronDown
            aria-hidden="true"
            className={cn('ml-auto size-4 transition-transform duration-300', showMore && 'rotate-180')}
          />
        </button>

        {showMore && MORE_SECTIONS.map((section) => (
          <SectionLink
            key={section.path}
            section={section}
            current={current}
            badge={section.path === '/profile' ? others : undefined}
            designed={designed}
            nav={nav}
          />
        ))}
      </nav>

      {/*
        Где я и куда ещё можно — внизу колонки, как в макете: переход в другой
        магазин нужен реже, чем разделы, но всегда должен быть на виду.
        Новые приглашения — там же: они и ведут к новому магазину.
      */}
      {/*
        «Нужна помощь?» — только когда есть чем помочь напрямую: телефон или
        WhatsApp магазина. Без них помощь — это вопросы продавцу, а они и так
        стоят в «Ещё».
      */}
      {(helpTel || helpWa) && (
        <div
          className={cn(
            'mt-auto flex flex-col gap-2.5 p-3.5',
            designed
              ? 'rounded-[var(--radius-card)] bg-canvas'
              : 'rounded-[calc(var(--radius-tile)*1.125)] bg-surface shadow-[0_0_0_1px_var(--color-hairline)]',
          )}
        >
          <p className="text-body font-bold text-ink">{t('shell.help.title')}</p>
          <p className="text-sm leading-[1.45] text-ink-muted">{t('shell.help.noteCall')}</p>
          {helpTel && (
            <a
              href={helpTel}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent text-sm font-bold text-on-accent',
                'hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              )}
            >
              <Phone aria-hidden="true" className="size-4" />
              {t('shop.call')}
            </a>
          )}
          {helpWa && (
            <a
              href={helpWa}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border-[1.5px] border-line text-sm font-semibold text-ink',
                'hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              {t('shop.whatsapp')}
            </a>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex flex-col gap-1.5 p-4',
          designed
            ? 'rounded-[var(--radius-template)] border border-hairline bg-canvas'
            : 'rounded-[calc(var(--radius-tile)*1.125)] bg-surface shadow-[0_0_0_1px_var(--color-hairline)]',
          !(helpTel || helpWa) && 'mt-auto',
        )}
      >
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-subtle">{t('shell.youAreIn')}</span>
        <span className="text-body font-bold text-ink">{shop?.name ?? t('shell.supplier')}</span>
        <button
          type="button"
          onClick={onOpenShops}
          className={cn(
            'flex min-h-11 items-center self-start text-sm font-semibold text-accent-ink hover:underline',
            'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {t('shops.all', { count: shopCount })} →
        </button>
        <InvitesCard onOpen={onOpenShops} />
      </div>

      {/*
        Свои магазины — под карточкой «Вы сейчас в», как в макете: карточка
        говорит, где я, а блок — куда ещё можно одним нажатием. Колонка
        есть только на мониторе, и блок вместе с ней.
      */}
      <MyShopsBlock onSwitch={onSwitch} />

      {/*
        Тот же знак, что в подвале выдвижного листа: колонка и лист показывают
        один список разделов и заканчиваться по-разному не должны.
      */}
      <div data-testid="rail-logo" className="flex flex-col items-center gap-1 pt-3">
        <SystemMark />
      </div>
    </div>
  );
}

/** Число у пункта колонки: скидки у «Акций», отложенное у «Избранного». */
function railBadge(path: string, deals: number, favorites: number): number | undefined {
  if (path === '/promotions' && deals > 0) return deals;
  if (path === '/favorites' && favorites > 0) return favorites;
  return undefined;
}

/**
 * Верхняя часть кабинета: фирменная полоса и полоса магазина.
 *
 * Одна на все ширины, а не две разные: два `<header>` под медиазапросами
 * означали бы два колокольчика в дереве страницы, и экранный диктор прочитал
 * бы каждый дважды.
 *
 * Фирменная полоса — только на мониторе: в ней доставка, вопросы продавцу,
 * язык и размер шрифта. На телефоне сама полоса магазина окрашена цветом
 * поставщика, а переключатели стоят в меню.
 */
function Header({
  activated,
  ready,
  othersUnread,
  onOpenSections,
  onOpenShops,
}: {
  activated: boolean;
  ready: boolean;
  othersUnread: number;
  onOpenSections: () => void;
  onOpenShops: () => void;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const { query, setQuery, search, searchRef } = useHeaderSearch();
  const headerCart = cartOf(useCart(ready).data);
  const lines = headerCart?.lines.length ?? 0;
  const cartTotal = headerCart?.total ?? 0;
  const drawer = useCartDrawer();
  const { current: shop } = useShops();
  // Режим доставки спрашивается только когда кабинет открыт: до этого
  // запрос за условиями поставщика всё равно вернул бы отказ.
  const delivery = useGetPortalDeliveryOptions({ query: { enabled: ready } });
  const pickupOnly = delivery.data?.status === 200 && delivery.data.data.mode === 'PICKUP_ONLY';
  const hours = hoursText(shop?.hours, t);
  const closedToday = hours === t('shop.hours.closedToday');
  const tel = telLink(shop?.phone);
  const wa = whatsappLink(shop?.whatsapp);
  // Полоса называет настоящий магазин — адрес и часы. Ни того ни другого
  // продавец не заполнил — полоса не пустеет, а держит прежние ссылки.
  const hasShopInfo = !!(shop?.address || hours);

  return (
    <header data-shell-header className="sticky top-0 z-20">
      <div className="hidden bg-strip text-on-brand lg:block">
        <div className="mx-auto flex h-12 w-full max-w-[1440px] items-center gap-1 pl-4 pr-4 text-sm font-medium">
          {hasShopInfo ? (
            <>
              {shop?.address && (
                <StripLink to="/delivery" icon={MapPin}>{shop.address}</StripLink>
              )}
              {hours && (closedToday ? (
                // Закрыто сегодня — не повод не оформлять: заявку примут
                // и обработают в ближайший рабочий день, и это сказано сразу.
                <span className="flex h-10 items-center gap-2 px-2.5 font-semibold">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#F59E0B]" />
                  {t('shell.closedNote')}
                </span>
              ) : (
                <span className="flex h-10 items-center gap-2 px-2.5">
                  <Clock aria-hidden="true" className="size-4" />
                  {hours}
                </span>
              ))}
              {pickupOnly && (
                <span className="flex h-10 items-center gap-2 px-2.5">
                  <Store aria-hidden="true" className="size-4" />
                  {t('shop.pickup')}
                </span>
              )}
            </>
          ) : (
            <>
              <StripLink to="/delivery" icon={Truck}>{t('shell.sections.delivery')}</StripLink>
              <StripLink to="/questions" icon={MessageCircleQuestion}>{t('shell.sections.questions')}</StripLink>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {tel && (
              // Обычная ссылка, а не `<Link>`: у `tel:` своя схема адреса,
              // и внутренний маршрутизатор принял бы её за путь кабинета.
              <a
                href={tel}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-[calc(var(--radius-control)*5/7)] px-2.5 text-on-brand transition-colors duration-200 hover:bg-on-brand/15',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-brand',
                )}
              >
                <Phone aria-hidden="true" className="size-4" />
                {shop?.phone && formatPhone(shop.phone)}
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex h-10 items-center gap-2 rounded-[calc(var(--radius-control)*5/7)] px-2.5 text-on-brand transition-colors duration-200 hover:bg-on-brand/15',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-brand',
                )}
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                {t('shop.whatsapp')}
              </a>
            )}
            <div className="hidden lg:block">
              <LanguagePicker onBrand />
            </div>
            <span aria-hidden="true" className="mx-1.5 h-5.5 w-px bg-on-brand/30" />
            <ThemeToggle onBrand />
            <FontScalePicker onBrand />
          </div>
        </div>
      </div>

      <div className="bg-strip text-on-brand lg:border-b lg:border-bar-line lg:bg-bar-wide lg:text-ink">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2.5 px-3 py-3 lg:h-[5.75rem] lg:gap-4 lg:px-6 lg:py-0">
          <button
            type="button"
            aria-label={t('shell.menu')}
            onClick={onOpenSections}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)]',
              'bg-on-brand/15 text-on-brand transition-all duration-300 active:scale-95',
              'lg:bg-transparent lg:text-ink-muted lg:hover:bg-ink/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-brand lg:focus-visible:ring-accent',
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <ShopButton onOpen={onOpenShops} othersUnread={othersUnread} />

          <form
            role="search"
            onSubmit={search}
            className={cn(
              'hidden h-14 min-w-0 flex-1 cursor-text items-center gap-3 lg:flex',
              'rounded-[calc(var(--radius-tile)*1.125)] border-2 border-bar-line bg-surface pl-5 pr-2',
              'transition-all duration-300 focus-within:border-accent',
              'focus-within:shadow-[0_0_0_4px_var(--color-accent-soft)]',
            )}
          >
            <Search className="size-[22px] shrink-0 text-ink-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label={t('shell.search')}
              aria-keyshortcuts="/"
              placeholder={t('shell.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-lead text-ink outline-none placeholder:text-ink-subtle"
            />
            <kbd
              aria-hidden="true"
              className="flex h-6.5 items-center rounded-[7px] border border-line px-2 font-sans text-xs font-semibold text-ink-subtle"
            >
              /
            </kbd>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 lg:gap-2.5">
            {/*
              Корзина в шапке — только на мониторе: на телефоне она стоит
              в нижнем меню, под большим пальцем.
            */}
            {/*
              Кнопка открывает выдвижную корзину, а не уводит на оформление:
              на ней число позиций и сумма — чтобы заглядывать в корзину
              приходилось реже. Открытая корзина перекрашивает кнопку.
            */}
            <button
              type="button"
              aria-expanded={drawer.open}
              aria-haspopup="dialog"
              onClick={toggleCart}
              {...{ [CART_TARGET]: '' }}
              className={cn(
                'hidden h-13 items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-tile)] pl-4.5 pr-2 lg:flex',
                'text-base font-bold transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                drawer.open ? 'bg-ink text-on-ink' : 'bg-accent text-on-accent hover:bg-accent-hover',
              )}
            >
              <ShoppingCart aria-hidden="true" className="size-[22px]" />
              {t('shell.cart')}
              {lines > 0 ? (
                <>
                  <span
                    role="img"
                    aria-label={t('shell.inCart', { count: lines })}
                    className="flex h-6.5 min-w-6.5 items-center justify-center rounded-[var(--radius-pill)] bg-on-accent px-2 text-caption font-extrabold text-accent"
                  >
                    <Bump value={lines}>{lines}</Bump>
                  </span>
                  <span className="flex h-8 items-center rounded-[calc(var(--radius-control)*5/7)] bg-black/15 px-2.5 text-sm font-bold tabular-nums">
                    {money(cartTotal, currency)}
                  </span>
                </>
              ) : (
                <span aria-hidden="true" className="w-1" />
              )}
            </button>

            {/* Точка самовывоза: по её складу витрина и корзина считают наличие. */}
            <PickupPointPicker
              ready={ready}
              className="max-lg:max-w-[9rem] max-lg:border-transparent max-lg:bg-white/15 max-lg:text-white lg:h-13 lg:rounded-[var(--radius-tile)] lg:border-[1.5px] lg:border-bar-line lg:bg-surface"
            />

            {/*
              В неоткрытом кабинете колокольчика нет: новостям взяться неоткуда,
              а запрос за ними вернул бы отказ.
            */}
            {activated && (
              <NotificationsBell
                active={ready}
                className={cn(
                  'bg-white/15 text-white hover:bg-white/25',
                  'lg:size-13 lg:rounded-[var(--radius-tile)] lg:border-[1.5px] lg:border-bar-line lg:bg-surface lg:text-ink',
                  'lg:hover:border-accent lg:hover:bg-surface',
                )}
              />
            )}

            {/*
              Кто вошёл — именем: слева «у кого покупаю», справа «кем вошёл».
              На телефоне от плашки остаётся кружок с инициалами.
            */}
            <ViewerBadge active={ready} />

            {/*
              Кнопка звонка — только на телефоне: на мониторе телефон уже
              стоит в фирменной полосе выше. Имя у неё длиннее, чем у
              соседней в колонке справки, — телефон дописан в подпись,
              чтобы диктор не назвал два разных звонка одинаково.
            */}
            {tel && (
              <a
                href={tel}
                aria-label={`${t('shop.call')} ${shop?.phone ? formatPhone(shop.phone) : ''}`.trim()}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-tile)] bg-surface text-accent-ink lg:hidden',
                  'transition-transform duration-200 active:scale-95',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                )}
              >
                <Phone aria-hidden="true" className="size-5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/*
        Поиск на телефоне — строкой под шапкой, как в макете, и на всех
        экранах, а не только на витрине: товар ищут и из заявок. Рядом —
        «Аа»: крупный шрифт на телефоне нужен чаще, чем на мониторе.
      */}
      <div className="flex gap-2 border-b border-bar-line bg-bar px-4 py-3 lg:hidden">
        <form
          role="search"
          onSubmit={search}
          className={cn(
            'flex h-13 min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-[var(--radius-tile)] border-2 border-bar-line bg-surface px-4',
            'transition-all duration-300 focus-within:border-accent',
          )}
        >
          <Search className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label={t('catalog.search')}
            placeholder={t('catalog.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-lead text-ink outline-none placeholder:text-ink-subtle"
          />
        </form>
        <ThemeToggle boxed />
        <FontScalePicker boxed />
      </div>
    </header>
  );
}

/** Ссылка на фирменной полосе: белым по цвету магазина. */
function StripLink({ to, icon: Icon, children }: { to: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex h-10 items-center gap-2 rounded-[calc(var(--radius-control)*5/7)] px-2.5 text-on-brand transition-colors duration-200 hover:bg-on-brand/15',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-brand',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

/**
 * Кнопка магазина в шапке: знак, имя и число магазинов.
 *
 * Открывает окно «Мои магазины»: стрелка обещает переключение, и обещание
 * должно исполняться на месте, а не уводом в профиль.
 *
 * Пока список не пришёл, стоит нейтральное слово: пустое место в шапке
 * читается как поломка, а «Поставщик» — как ещё не загруженное имя.
 */
function ShopButton({ onOpen, othersUnread }: { onOpen: () => void; othersUnread: number }) {
  const { t } = useTranslation();
  const { list, current } = useShops();
  const invites = usePendingInvitations().length;
  const name = current?.name;
  const rating = current?.rating;
  const ratingText = rating != null
    ? rating.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : null;
  // Подпись и рейтинг вытесняют счёт магазинов из-под имени — счёт при этом
  // не пропадает, а переезжает пилюлей вправо: на мониторе для него есть
  // место, а без подписи и рейтинга он остаётся там же, где стоял всегда.
  const hasBadge = !!(current?.tagline || ratingText);
  // На телефоне под именем — где магазин и когда открыт, как в макете:
  // ради этого человек и смотрит на шапку, стоя у рынка.
  const hours = hoursText(current?.hours, t);
  const place = [current?.address, hours].filter(Boolean).join(' · ');

  const countPill = (
    <span className="flex items-center gap-1">
      {list.length > 0 ? t('shell.switchShop', { count: list.length }) : t('shell.supplierChoose')}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      {/*
        Точка, а не число: оно повторило бы счёт в списке магазинов,
        а места в шапке нет.
      */}
      {othersUnread > 0 && (
        <span
          role="img"
          aria-label={t('shell.othersHaveNews')}
          className="size-2.5 shrink-0 rounded-full bg-[#F59E0B] lg:bg-accent"
        />
      )}
      {/* Новое приглашение — та же точка: в окне магазинов его ждёт ответ. */}
      {invites > 0 && othersUnread === 0 && (
        <span
          role="img"
          aria-label={t('shops.invites.badge')}
          className="size-2.5 shrink-0 rounded-full bg-[#F59E0B] lg:bg-accent"
        />
      )}
    </span>
  );

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={cn(
        'flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[calc(var(--radius-tile)*1.125)] px-1 text-left lg:w-[21.5rem] lg:flex-none lg:gap-3.5 lg:px-2',
        'transition-colors duration-200 lg:-ml-2 lg:h-[4.5rem] lg:hover:bg-surface/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:focus-visible:ring-accent',
      )}
    >
      {current && (
        <ShopTile
          // Цвет не передаётся: плитка текущего магазина и так окрашена его
          // цветом (акцентом), а на телефоне стоит на нём же — там ей нужна
          // светлая подложка, которую инлайновый цвет перекрыл бы.
          supplier={{ name: current.name, logoUrl: current.logoUrl }}
          alt={current.name}
          className={cn(
            'size-11 rounded-[var(--radius-control)] text-xl lg:size-14 lg:rounded-[var(--radius-tile)] lg:text-2xl',
            'max-lg:bg-white/15 lg:shadow-[0_6px_16px_-8px_var(--color-accent)]',
          )}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-1">
        <span className="truncate text-lead font-extrabold tracking-[-0.01em] lg:text-[1.3125rem]">
          {name ?? t('shell.supplier')}
        </span>
        {place && (
          <span className="flex min-w-0 items-center gap-1.5 text-caption text-white/90 lg:hidden">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{place}</span>
          </span>
        )}
        {hasBadge ? (
          <span className={cn('flex min-w-0 items-center gap-2 text-caption text-white/85 lg:text-ink-muted', place && 'max-lg:hidden')}>
            {current?.tagline && <span className="truncate font-semibold">{current.tagline}</span>}
            {ratingText && (
              <span
                aria-label={t('shop.rating', { value: ratingText })}
                className="flex shrink-0 items-center gap-0.5 font-bold text-white lg:text-ink"
              >
                <Star aria-hidden="true" className="size-3.5 fill-[#D97706] text-[#D97706]" />
                {ratingText}
              </span>
            )}
          </span>
        ) : (
          <span className={cn('text-caption font-semibold text-white/85 lg:text-ink-muted', place && 'max-lg:hidden')}>{countPill}</span>
        )}
      </span>
      {/*
        Пилюля со счётом — только на мониторе и только когда строка под
        именем занята подписью и рейтингом: иначе тот же счёт уже стоит там.
      */}
      {hasBadge && (
        <span
          className={cn(
            'relative ml-auto hidden h-[34px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-pill)] border-[1.5px] border-bar-line bg-surface px-3 text-caption font-bold text-ink-muted lg:flex',
          )}
        >
          {countPill}
        </span>
      )}
    </button>
  );
}

/**
 * Нижнее меню телефона: витрина, корзина, заявки и «Ещё».
 *
 * Под большим пальцем — то, за чем приходят каждый раз. «Ещё» открывает тот
 * же лист, что и «Меню» в шапке: одно место для всех остальных разделов.
 */
function BottomNav({
  current,
  cartActive,
  onMore,
}: {
  current: string;
  cartActive: boolean;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const lines = cartOf(useCart(cartActive).data)?.lines.length ?? 0;
  // Как в макете: витрина, акции, корзина, заявки — и «Ещё» для остального.
  // Избранное — в листе «Ещё»: под пальцем только то, за чем приходят всегда.
  const tabs = useMainSections(cartActive).sections.filter((section) => section.path !== '/favorites');

  return (
    <nav
      aria-label={t('shell.bottomNav')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-surface px-2',
        // Только телефон — и у «Как приложение» тоже: на мониторе, как в
        // полноразмерном макете, его место занимает строка разделов под шапкой.
        'lg:hidden',
        'pb-[calc(0.25rem+env(safe-area-inset-bottom))]',
      )}
    >
      {tabs.map((section) => {
        const Icon = section.icon;
        const active = isActive(section, current);
        const cart = section.path === '/checkout';
        return (
          <NavLink
            key={section.path}
            to={section.path}
            aria-current={active ? 'page' : undefined}
            {...(cart ? { [CART_TARGET]: '' } : {})}
            className={cn(
              'relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold lg:max-w-[9rem]',
              active ? 'text-accent-ink' : 'text-ink-muted',
            )}
          >
            <Icon aria-hidden="true" className="size-6" />
            {t(`shell.tabs.${section.key}`)}
            {cart && lines > 0 && (
              <span
                role="img"
                aria-label={t('shell.inCart', { count: lines })}
                className="absolute left-[calc(50%+6px)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-accent px-1.5 text-xs font-bold text-on-accent"
              >
                <Bump value={lines}>{lines}</Bump>
              </span>
            )}
          </NavLink>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-ink-muted lg:max-w-[9rem]"
      >
        <Menu aria-hidden="true" className="size-6" />
        {t('shell.tabs.more')}
      </button>
    </nav>
  );
}

/**
 * «Корзина» в колонке разделов — кнопкой: открывает ту же выдвижную
 * корзину, что и кнопка в шапке, а не уводит с экрана.
 */
function CartNavButton({ section, lines, designed = false, nav = 'pill' }: {
  section: Section;
  lines: number;
  designed?: boolean;
  nav?: TemplateStyle['nav'];
}) {
  const { t } = useTranslation();
  const Icon = section.icon;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={openCart}
      className={cn(
        'flex items-center gap-3.5 px-3.5 py-2 text-left font-medium',
        designed
          ? cn('min-h-11 gap-3 whitespace-nowrap text-sm', navItemClass(nav, false, true))
          : 'min-h-13 rounded-[var(--radius-control)] text-base text-ink hover:bg-ink/5',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      <Icon aria-hidden="true" className={designed ? 'size-[18px] shrink-0' : 'size-5 shrink-0'} />
      {t(`shell.sections.${section.key}`)}
      {lines > 0 && (
        <span
          role="img"
          aria-label={t('shell.inCart', { count: lines })}
          className="ml-auto inline-flex h-6.5 min-w-6.5 items-center justify-center rounded-[var(--radius-pill)] bg-accent px-2 text-caption font-bold text-on-accent"
        >
          <Bump value={lines}>{lines}</Bump>
        </span>
      )}
    </button>
  );
}

/**
 * Раздел в списке.
 *
 * Ссылкой, а не кнопкой: раздел открывают в соседней вкладке и присылают
 * ссылкой коллеге. Выбранный назван выбранным (`aria-current`), а не только
 * залит цветом магазина: цвет читает не всякий.
 */
function SectionLink({
  section,
  current,
  badge,
  badgeLabel,
  large = false,
  designed = false,
  nav = 'pill',
  onFollow,
}: {
  section: Section;
  current: string;
  badge?: number;
  /** Имя числа для диктора; по умолчанию — «непрочитанных». */
  badgeLabel?: string;
  /** Главный раздел колонки — крупнее тех, что под «Ещё». */
  large?: boolean;
  /** Пункт колонки шаблона: 44 точки, выбранный — по виду пункта шаблона, как в макете. */
  designed?: boolean;
  nav?: TemplateStyle['nav'];
  onFollow?: () => void;
}) {
  const { t } = useTranslation();
  const Icon = section.icon;
  const active = isActive(section, current);

  return (
    <NavLink
      to={section.path}
      onClick={onFollow}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // Высота задана снизу, а не намертво: «Доставка и самовывоз» при
        // крупном шрифте переносится второй строкой.
        'flex items-center gap-3.5 px-3.5 py-2 text-left',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        designed
          ? cn(
            // Как в макете: пункты колонки шаблона — 14 точек, в одну строку,
            // значок 18 точек.
            'min-h-11 gap-3 whitespace-nowrap text-sm',
            navItemClass(nav, active, true),
          )
          : cn(
            'rounded-[var(--radius-control)]',
            large ? 'min-h-13 text-base font-medium' : 'min-h-11 text-body',
            active
              ? 'bg-accent text-on-accent'
              : cn(large ? 'text-ink' : 'text-ink-muted', 'hover:bg-ink/5 hover:text-ink'),
          ),
      )}
    >
      <Icon aria-hidden="true" className={designed ? 'size-[18px] shrink-0' : 'size-5 shrink-0'} />
      {t(`shell.sections.${section.key}`)}
      {badge !== undefined && badge > 0 && (
        // Роль и имя со словом: голое число диктор произнёс бы без единицы.
        <span
          role="img"
          aria-label={badgeLabel ?? t('shell.unread', { count: badge })}
          className={cn(
            'ml-auto inline-flex items-center justify-center rounded-[var(--radius-pill)] font-bold',
            designed
              ? 'h-[22px] min-w-[22px] bg-sale px-[7px] text-2xs font-extrabold text-white'
              : cn('h-6.5 min-w-6.5 px-2 text-caption', active ? 'bg-on-accent text-accent' : 'bg-accent text-on-accent'),
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}
