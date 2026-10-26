import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Bump } from '../../ui/Bump';
import { getConfig } from '../../config';
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ClipboardList,
  House,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Phone,
  ShoppingCart,
} from '../../ui/icons';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CatalogPage } from '../catalog/CatalogPage';
import { HomePage } from '../home/HomePage';
import { MorePage } from './MorePage';
import { AddedToast, CartPanel } from '../cart/CartPanel';
import { openCart } from '../cart/cartDrawer';
import { cartOf, useCart } from '../cart/useCart';
import { LanguageAsk } from '../language/LanguageAsk';
import { destinationOf, opensWithoutSubject } from '../notifications/NotificationsBell';
import { usePushDevice } from '../../shared/webview/push';
import { ProfilePage } from '../profile/ProfilePage';
import { RequireSupplier } from '../profile/RequireSupplier';
import {
  getGetPortalNotificationsQueryKey,
  getGetPortalUnreadSummaryQueryKey,
  readPortalNotification,
  useGetPortalFavorites,
  useGetPortalSuppliers,
  useGetPortalUnreadSummary,
} from '../../api/generated';
import { currentViewer } from '../../auth/oidcConfig';
import { ActivationBanner } from './ActivationBanner';
import { FontScalePicker } from './FontScale';
import { ThemeToggle } from './ThemeToggle';
import { LanguagePicker } from './LanguagePicker';
import { HelpGuide } from './HelpGuide';
import { FirstSteps } from './FirstSteps';
import { MyShopsBlock, ShopsDialog, useShops } from './Shops';
import { SuppliersPage } from './SuppliersPage';
import { AgeGateDialog } from '../cart/ageGate';
import { InvitesCard } from './Invitations';
import { StaffBanner } from './StaffBanner';
import { PickupPointPicker } from './layouts/PickupPointPicker';
import { telLink, whatsappLink } from './shopHours';
import { MORE_SECTIONS, isActive, useMainSections, type Section } from './sections';
import { NewArrivalsPage } from '../arrivals/NewArrivalsPage';
import { DesignHeader } from './layouts/DesignHeader';
import { CenterHeader } from './layouts/CenterHeader';
import { CategoryTabs } from './layouts/CategoryTabs';
import { ClientBar } from './layouts/ClientBar';
import { useSupplier } from '../../supplier/useSupplier';
import { useSupplierAccess } from '../../supplier/useSupplierAccess';
import { SupplierCurrencyScope } from '../../supplier/SupplierCurrency';
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
import { InviteSupplierDialog } from '../referral/InviteSupplierDialog';

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
  const [inviting, setInviting] = useState(false);
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
  const queryClient = useQueryClient();
  // Касание push в приложении: магазин уведомления и туда же, куда ведёт плашка.
  usePushDevice((push) => {
    if (!push.kind || (!push.subjectId && !opensWithoutSubject(push.kind))) return;
    if (push.tenantId && push.tenantId !== supplierId) select(push.tenantId);
    // Коснулся уведомления — прочитал его. После смены магазина: плашка
    // принадлежит магазину, и заголовок поставщика должен быть его.
    if (push.notificationId) {
      void readPortalNotification(push.notificationId)
        .catch(() => undefined)
        .finally(() => {
          void queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetPortalUnreadSummaryQueryKey() });
        });
    }
    navigate(destinationOf(push.kind, push.subjectId ?? ''));
  });
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
  // Монитор без шаблона — по макетам ПК-К: одна панель сверху, без колонки разделов.
  const client = wide && !designed;
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
    navigate(own ? '/catalog' : '/home');
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
      style={client ? ({ '--header-h': '4.5rem' } as CSSProperties) : headerHeight(designed, own ?? (hasTopNav ? 'top' : 'side'), layout)}
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
      {/* На телефоне шапка одна у всех магазинов — по макету К1, с шаблоном и без. */}
      {client ? (
        <ClientBar activated={activated} ready={ready} others={others} onOpenShops={() => setShopsOpen(true)} current={location.pathname} />
      ) : (
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

      {/* Первый заказ — три шага, пока продавец не ответил на первую заявку. Сотруднику в просмотре не нужен. */}
      {currentViewer() !== 'staff' && <FirstSteps active={activated && ready} />}

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

      <ShopsDialog
        open={shopsOpen}
        onOpenChange={setShopsOpen}
        onSwitch={switchShop}
        // Сотрудник на своей витрине никого не приглашает: приглашение — дело человека.
        onInvite={currentViewer() === 'staff' ? undefined : () => {
          setShopsOpen(false);
          setInviting(true);
        }}
        // Страница «Поставщики» — только у монитора без шаблона (ПК-К2.6).
        onShowAll={client ? () => {
          setShopsOpen(false);
          navigate('/shops');
        } : undefined}
      />
      <InviteSupplierDialog open={inviting} onOpenChange={setInviting} />
      <AgeGateDialog />

      <div
        data-testid="shell-grid"
        data-layout={layout}
        className={cn(
          'mx-auto flex w-full max-w-[1440px] lg:grid',
          // Сложенная колонка отдаёт свою ширину витрине, а не оставляет
          // пустую дорожку: ради этого её и складывают.
          client ? 'lg:grid-cols-[minmax(0,1fr)]' : gridColumns(layout, railOpen, designed),
        )}
      >
        {!client && railOpen && layout === 'side' && (
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
        {!client && railOpen && layout === 'rail' && (
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
              className={cn('animate-page', own === 'center' && 'mx-auto max-w-[56.25rem]', client && 'mx-auto max-w-[76rem]')}
            >
              <Suspense fallback={null}>
              <Routes>
                <Route path="/home" element={<RequireSupplier><HomePage /></RequireSupplier>} />
                <Route path="/catalog" element={<RequireSupplier><CatalogPage /></RequireSupplier>} />
                <Route path="/catalog/:itemId" element={<RequireSupplier><ItemCardPage /></RequireSupplier>} />
                <Route path="/favorites" element={<RequireSupplier><FavoritesPage /></RequireSupplier>} />
                <Route path="/promotions" element={<RequireSupplier><PromotionsPage /></RequireSupplier>} />
                <Route path="/new-arrivals" element={<RequireSupplier><NewArrivalsPage /></RequireSupplier>} />
                <Route path="/checkout" element={<RequireSupplier><CheckoutPage /></RequireSupplier>} />
                <Route path="/orders" element={<RequireSupplier><MyOrdersPage /></RequireSupplier>} />
                <Route path="/orders/:id" element={<RequireSupplier><OrderPage /></RequireSupplier>} />
                <Route path="/templates" element={<RequireSupplier><TemplatesPage /></RequireSupplier>} />
                <Route path="/questions" element={<RequireSupplier><QuestionsPage /></RequireSupplier>} />
                <Route path="/questions/:threadId" element={<RequireSupplier><QuestionsPage /></RequireSupplier>} />
                <Route path="/reviews" element={<RequireSupplier><MyReviewsPage /></RequireSupplier>} />
                <Route path="/delivery" element={<RequireSupplier><DeliveryInfoPage /></RequireSupplier>} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                  path="/shops"
                  element={client
                    ? <SuppliersPage onSwitch={switchShop} onInvite={currentViewer() === 'staff' ? undefined : () => setInviting(true)} />
                    : <Navigate to="/home" replace />}
                />
                <Route
                  path="/more"
                  element={(
                    <MorePage
                      others={others}
                      onInvite={currentViewer() === 'staff' ? undefined : () => setInviting(true)}
                      extras={(
                        <div className="rounded-[1.375rem] bg-surface px-3.5 pt-3 shadow-[2px_3px_6px_rgba(58,48,30,.07)]">
                          <PhoneExtras ready={ready} />
                        </div>
                      )}
                      footer={<SystemMark />}
                    />
                  )}
                />
                {/* Кабинет открывается витриной — макеты К1 и ПК-К1; шаблон на мониторе — своим каталогом. */}
                <Route path="*" element={<Navigate to={own ? '/catalog' : '/home'} replace />} />
              </Routes>
              </Suspense>
            </div>
          </main>
          {/* Тихая подпись: поставщик, которого не звали, найдёт, где оставить заявку. */}
          {activated && (
            <footer className="px-4 pb-24 pt-6 text-center lg:pb-6">
              <a href="/join" className="text-caption text-ink-subtle hover:text-ink-muted">{t('referral.poweredBy')}</a>
            </footer>
          )}
        </div>
      </div>

      {/*
        Корзина — выдвижной панелью по кнопке в шапке, а не колонкой: витрине
        достаётся вся ширина. В неоткрытом кабинете корзины нет вовсе:
        у клиента без поставщика её не существует.
      */}
      {activated && <CartPanel active={ready} />}
      <AddedToast />

      <BottomNav current={location.pathname} cartActive={ready} />

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
  const { sections, deals, arrivals } = useMainSections(cartActive);
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
              {section.path === '/new-arrivals' && (
                <span role="img" aria-label={t('shell.arrivals', { count: arrivals })} className={pill}>{arrivals}</span>
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
  const { sections, deals, arrivals } = useMainSections(cartActive);
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
              badge={railBadge(section.path, deals, favoriteCount, arrivals)}
              badgeLabel={section.path === '/promotions'
                ? t('shell.deals', { count: deals })
                : section.path === '/new-arrivals' ? t('shell.arrivals', { count: arrivals })
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

/** Число у пункта колонки: скидки у «Акций», новинки у «Новых поступлений», отложенное у «Избранного». */
function railBadge(path: string, deals: number, favorites: number, arrivals = 0): number | undefined {
  if (path === '/promotions' && deals > 0) return deals;
  if (path === '/new-arrivals' && arrivals > 0) return arrivals;
  if (path === '/favorites' && favorites > 0) return favorites;
  return undefined;
}

/**
 * Нижнее меню телефона: витрина, корзина, заявки и «Ещё».
 *
 * Под большим пальцем — то, за чем приходят каждый раз. «Ещё» открывает тот
 * же лист, что и «Меню» в шапке: одно место для всех остальных разделов.
 */
/** Свой знак каталога: четыре плитки витрины, одна — фирменная оранжевая (макеты «Кабинет клиента 2.0»). */
function CatalogMark() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28">
      <rect x="3" y="3" width="10" height="10" rx="3.5" fill="currentColor" />
      <rect x="15" y="3" width="10" height="10" rx="5" className="fill-sale" />
      <rect x="3" y="15" width="10" height="10" rx="3.5" fill="currentColor" />
      <rect x="15" y="15" width="10" height="10" rx="3.5" fill="currentColor" fillOpacity={0.55} />
    </svg>
  );
}

/** Разделы, плитки которых стоят на «Главной»: внизу горит она. */
const HOME_PATHS = ['/home', '/promotions', '/favorites', '/new-arrivals'];

function BottomNav({
  current,
  cartActive,
}: {
  current: string;
  cartActive: boolean;
}) {
  const { t } = useTranslation();
  const lines = cartOf(useCart(cartActive).data)?.lines.length ?? 0;
  const more = current === '/more' || MORE_SECTIONS.some((section) => isActive(section, current));
  const catalog = current === '/catalog' || current.startsWith('/catalog/');
  const tab = (active: boolean) => cn(
    'relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
    active ? 'font-extrabold text-accent-ink' : 'text-ink-muted',
  );
  const home = HOME_PATHS.includes(current);
  const orders = current === '/orders' || current.startsWith('/orders/');
  const cart = current === '/checkout';

  return (
    <nav
      aria-label={t('shell.bottomNav')}
      className={cn(
        // Как «Продажа» у менеджера: каталог — по центру, приподнятой круглой кнопкой.
        'fixed inset-x-0 bottom-0 z-30 flex bg-surface px-1 shadow-[0_-1px_0_var(--color-hairline)] lg:hidden',
        'pb-[calc(0.25rem+env(safe-area-inset-bottom))]',
      )}
    >
      <Link to="/home" aria-current={home ? 'page' : undefined} className={tab(home)}>
        <House aria-hidden="true" className="size-6" />
        {t('shell.tabs.home')}
      </Link>
      <Link to="/orders" aria-current={orders ? 'page' : undefined} className={tab(orders)}>
        <ClipboardList aria-hidden="true" className="size-6" />
        {t('shell.tabs.orders')}
      </Link>
      <Link to="/catalog" aria-current={catalog ? 'page' : undefined} className={cn(tab(catalog), 'justify-end pb-1.5')}>
        <span
          className={cn(
            'mb-0.5 -mt-7 flex size-[3.75rem] items-center justify-center rounded-full text-white',
            'shadow-[0_0_0_5px_var(--color-surface),0_10px_22px_rgb(1_86_64/0.35)]',
            catalog ? 'bg-accent-ink' : 'bg-accent',
          )}
        >
          <CatalogMark />
        </span>
        {t('shell.tabs.catalog')}
      </Link>
      <Link to="/checkout" aria-current={cart ? 'page' : undefined} {...{ [CART_TARGET]: '' }} className={tab(cart)}>
        <ShoppingCart aria-hidden="true" className="size-6" />
        {t('shell.tabs.checkout')}
        {lines > 0 && (
          <span
            role="img"
            aria-label={t('shell.inCart', { count: lines })}
            className="absolute left-[calc(50%+4px)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-sale px-1.5 text-xs font-extrabold text-white"
          >
            <Bump value={lines}>{lines}</Bump>
          </span>
        )}
      </Link>
      <Link to="/more" aria-current={more ? 'page' : undefined} className={tab(more)}>
        <Menu aria-hidden="true" className="size-6" />
        {t('shell.tabs.more')}
      </Link>
    </nav>
  );
}

/**
 * Что на телефоне переехало из шапки в лист «Ещё»: справка к экрану,
 * звонок в магазин и точка самовывоза.
 */
function PhoneExtras({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const { current: shop } = useShops();
  const tel = telLink(shop?.phone);
  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      <HelpGuide className="size-11 rounded-[var(--radius-control)] border border-line text-ink-muted" />
      {tel && (
        <a
          href={tel}
          className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-line px-3.5 text-body font-semibold text-accent-ink"
        >
          <Phone aria-hidden="true" className="size-5" />
          {t('shop.call')}
        </a>
      )}
      <PickupPointPicker ready={ready} withMap />
    </div>
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
