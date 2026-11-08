import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { PhoneLine } from './PhoneLine';
import { messageCounts } from './messageCounts';
import { Bump } from '../../ui/Bump';
import { getConfig } from '../../config';
import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { HomeCart, HomeCatalog, HomeDelivery, HomeHouse, HomeMessages } from '../home/homeIcons';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { CatalogPage } from '../catalog/CatalogPage';
import { HomePage } from '../home/HomePage';
import { NotificationsPage } from '../notifications/NotificationsBell';
import { AddedToast, CartPanel } from '../cart/CartPanel';
import { cartOf, useCart } from '../cart/useCart';
import { LanguageAsk } from '../language/LanguageAsk';
import { destinationOf, opensWithoutSubject } from '../notifications/NotificationsBell';
import { usePushDevice } from '../../shared/webview/push';
import { ProfilePage } from '../profile/ProfilePage';
import { RequireSupplier } from '../profile/RequireSupplier';
import {
  getGetPortalNotificationsQueryKey,
  getGetPortalPendingInvitationsQueryKey,
  getGetPortalUnreadSummaryQueryKey,
  useGetPortalDebt,
  useGetPortalNotifications,
  readPortalNotification,
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
import { ShopsDialog, useShops } from './Shops';
import { AgeGateDialog } from '../cart/ageGate';
import { StaffBanner } from './StaffBanner';
import { PickupPointPicker } from './layouts/PickupPointPicker';
import { telLink } from './shopHours';
import { isActive, useMainSections, useMoreSections, type Section } from './sections';
import { ClientBar } from './layouts/ClientBar';
import { useSupplier } from '../../supplier/useSupplier';
import { useSupplierAccess } from '../../supplier/useSupplierAccess';
import { PhoneGate } from '../phone/PhoneGate';
import { SupplierCurrencyScope } from '../../supplier/SupplierCurrency';
import { SupplierTheme } from '../../supplier/SupplierTheme';
import { useCabinetDesign, type TemplateStyle } from '../../supplier/cabinetDesign';
import { MotionLevelContext, useMotionLevel } from '../../ui/motion/motionLevel';
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
import { toTop } from './toTop';
import { lazyPage, preloadWhenIdle } from '../../ui/lazyPage';
import { useTrackTrail } from '../../ui/sectionBack';
import { OpenShopsContext } from './openShops';
import { InviteSupplierDialog } from '../referral/InviteSupplierDialog';

/*
 * Разделы, кроме витрины, грузятся отдельными частями при первом переходе:
 * одним файлом кабинет весил мегабайт, и телефон на мобильной сети ждал
 * страницу акций и видеоплеер ради того, чтобы показать каталог.
 */
const ItemCardPage = lazyPage(() => import('../catalog/ItemCardPage').then((module) => module.ItemCardPage));
const CheckoutPage = lazyPage(() => import('../cart/CheckoutPage').then((module) => module.CheckoutPage));
const AllShopsPage = lazyPage(() => import('../allShops/AllShopsPage').then((module) => module.AllShopsPage));
const DeliveryInfoPage = lazyPage(() => import('../delivery/DeliveryInfoPage').then((module) => module.DeliveryInfoPage));
const FavoritesPage = lazyPage(() => import('../favorites/FavoritesPage').then((module) => module.FavoritesPage));
const PromotionsPage = lazyPage(() => import('../promotions/PromotionsPage').then((module) => module.PromotionsPage));
const MyOrdersPage = lazyPage(() => import('../orders/MyOrdersPage').then((module) => module.MyOrdersPage));
const OrderPage = lazyPage(() => import('../orders/OrderPage').then((module) => module.OrderPage));
const QuestionsPage = lazyPage(() => import('../questions/QuestionsPage').then((module) => module.QuestionsPage));
const MyReviewsPage = lazyPage(() => import('../reviews/MyReviewsPage').then((module) => module.MyReviewsPage));
const NewArrivalsPage = lazyPage(() => import('../arrivals/NewArrivalsPage').then((module) => module.NewArrivalsPage));
const MorePage = lazyPage(() => import('./MorePage').then((module) => module.MorePage));
const SuppliersPage = lazyPage(() => import('./SuppliersPage').then((module) => module.SuppliersPage));
const TemplatesPage = lazyPage(() => import('../templates/TemplatesPage').then((module) => module.TemplatesPage));
const DebtPage = lazyPage(() => import('../debt/DebtPage').then((module) => module.DebtPage));
const MessagesPage = lazyPage(() => import('./MessagesPage').then((module) => module.MessagesPage));
/** Все разделы-куски: догружаются в простое после первого экрана (`preloadWhenIdle`). */
const PAGES = [NewArrivalsPage, MorePage, SuppliersPage, ItemCardPage, CheckoutPage, DeliveryInfoPage, FavoritesPage, PromotionsPage, MyOrdersPage, OrderPage, QuestionsPage, MyReviewsPage, TemplatesPage, DebtPage, MessagesPage];

/**
 * Куски разделов — в простое после первого экрана: первый вход в раздел не ждёт сети.
 * Только когда запросы экрана закончились: на медленной сети куски иначе
 * отнимали бы полосу у его данных. Отдельным компонентом — счётчик запросов
 * меняется на каждом из них и не должен перерисовывать оболочку.
 */
function PreloadPages() {
  const idle = useIsFetching() === 0;
  useEffect(() => (idle ? preloadWhenIdle(PAGES) : undefined), [idle]);
  return null;
}

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
  const openShops = useCallback(() => setShopsOpen(true), []);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState('');
  const wide = useWideScreen();
  const location = useLocation();
  const navigation = useNavigationType();
  useTrackTrail();
  const home = location.pathname === '/home';
  // Переход в раздел — с самого верха (решение владельца 2026-10-30): иначе новый раздел открывался
  // на высоте прошлого. Назад браузером (POP) не трогаем; смена фильтров в адресе — тот же раздел.
  useEffect(() => {
    if (navigation !== 'POP') toTop();
  }, [location.pathname, navigation]);
  const others = useOthersUnread();
  const { activated, ready } = useSupplierAccess();
  const { sections: mainSections } = useMainSections(ready);
  const moreSections = useMoreSections(ready);
  const { list, supplierId, select } = useShopsSwitch();
  // Единственный магазин выбирается сам и на экранах без `RequireSupplier` («Сообщения»,
  // «Ещё», «Поставщики»): открытые первыми по ссылке, они показывали в шапке «Поставщик».
  const onlyShop = list.length === 1 ? list[0].supplierId : null;
  useEffect(() => {
    if (onlyShop && supplierId !== onlyShop) select(onlyShop);
  }, [onlyShop, supplierId, select]);
  const queryClient = useQueryClient();
  // Касание push в приложении: магазин уведомления и туда же, куда ведёт плашка.
  usePushDevice((push) => {
    // Приглашение нового магазина: его кабинет ещё не открыт — ни выбирать магазин, ни читать
    // плашку в нём нельзя. Принимают приглашение в окне «Мои магазины»; список перечитывается,
    // иначе свежее приглашение ждало бы следующего опроса.
    if (push.kind === 'PORTAL_INVITATION') {
      void queryClient.invalidateQueries({ queryKey: getGetPortalPendingInvitationsQueryKey() });
      setShopsOpen(true);
      return;
    }
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
  const { layout } = design;
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
    navigate('/home');
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

  // «Все магазины» — над магазинами, а не внутри одного (ряд 17 канвы): своя раскладка — нижнее меню
  // на телефоне, боковое на мониторе; шапки и меню открытого магазина здесь нет.
  if (location.pathname === '/all-shops') {
    return (
      <SupplierCurrencyScope>
        <PhoneGate />
        <Suspense fallback={null}><AllShopsPage onSwitch={switchShop} /></Suspense>
      </SupplierCurrencyScope>
    );
  }

  return (
    // Валюта открытого магазина — на весь кабинет: скоуп стоит корнем оболочки,
    // чтобы им пользовался любой экран внутри, без нового useGetPortalSuppliers
    // в каждом листе.
    <SupplierCurrencyScope>
      <OpenShopsContext.Provider value={openShops}>
    <MotionLevelContext.Provider value={motion}>
    {/* Номер не подтверждён — одна просьба поверх кабинета вместо отказов на каждом экране. */}
    <PhoneGate />
    <PreloadPages />
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
      // «Главная» — на белом, без фактуры и живого фона продавца (решение владельца 2026-10-30).
      className="relative isolate min-h-screen bg-canvas"
      // Строка разделов под шапкой делает шапку выше, и всё, что липнет
      // под ней (колонка оформления), должно знать её настоящую высоту.
      style={{ '--header-h': '4rem' } as CSSProperties}
    >
      {/* Узор или фото продавца — позади всего содержимого. */}
      {!home && <BackgroundLayer pattern={design.pattern} photo={design.photo} />}
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
      {/* «Вариант Б»: на мониторе — одна шапка у всех магазинов; на телефоне шапки нет вовсе —
          у каждого экрана своё «Назад» и имя, внизу — нижнее меню. */}
      {wide ? (
        <ClientBar activated={activated} ready={ready} others={others} onOpenShops={openShops} current={location.pathname} />
      ) : null}

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
          {[...mainSections, ...moreSections].map((section) => (
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
        onShowAll={wide ? () => {
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
          'lg:grid-cols-[minmax(0,1fr)]',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={cn(
              'min-w-0 flex-1 px-4 pt-4 lg:px-8 lg:pt-7',
              // Запас снизу — под нижнее меню телефона (4rem) и поднятую над ним круглую кнопку
              // каталога (ещё 1.75rem): без него последняя строка — итог корзины, кнопка, сумма —
              // уходит под них. Прежде запас держала подпись «Работает на Q-Order»; её убрали
              // (2026-11-05), и низ экранов закрывала кнопка (замечание владельца 2026-11-06).
              activated ? 'pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-8' : 'pb-[calc(10rem+env(safe-area-inset-bottom))] lg:pb-24',
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
              className={cn('animate-page', wide && 'mx-auto max-w-[76rem]')}
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
                <Route path="/debt" element={<RequireSupplier><DebtPage /></RequireSupplier>} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/delivery" element={<RequireSupplier><DeliveryInfoPage /></RequireSupplier>} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/notifications" element={<RequireSupplier><NotificationsPage /></RequireSupplier>} />
                <Route
                  path="/shops"
                  element={<SuppliersPage onSwitch={switchShop} onInvite={currentViewer() === 'staff' ? undefined : () => setInviting(true)} />}
                />
                <Route
                  path="/more"
                  element={(
                    <MorePage
                      others={others}
                      onInvite={currentViewer() === 'staff' ? undefined : () => setInviting(true)}
                      extras={(
                        <div className="rounded-[1.375rem] bg-surface px-3.5 pt-3 border-2 border-solid border-hairline empty:hidden">
                          <PhoneExtras ready={ready} />
                        </div>
                      )}
                    />
                  )}
                />
                {/* Кабинет открывается «Главной» — макеты Варианта Б. */}
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
              </Suspense>
            </div>
          </main>
          {/* «Работает на Q-Order» убран со всех страниц (решение владельца 2026-11-05). */}
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
      </OpenShopsContext.Provider>
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
 * Нижнее меню телефона: «Главная», «Сообщения» (заявки, вопросы, отзывы), витрина, корзина и «Ещё».
 *
 * Под большим пальцем — то, за чем приходят каждый раз. «Ещё» открывает тот
 * же лист, что и «Меню» в шапке: одно место для всех остальных разделов.
 */
/** Свой знак каталога: четыре плитки витрины, одна — фирменная оранжевая (макеты «Кабинет клиента 2.0»). */
/** Разделы, плитки которых стоят на «Главной»: внизу горит она. */
const HOME_PATHS = ['/home', '/orders', '/promotions', '/favorites', '/new-arrivals'];

function BottomNav({
  current,
  cartActive,
}: {
  current: string;
  cartActive: boolean;
}) {
  const { t } = useTranslation();
  const lines = cartOf(useCart(cartActive).data)?.lines.length ?? 0;
  // Непрочитанное текущего магазина — тот же запрос, что у колокольчика: числа совпадают.
  const notifications = useGetPortalNotifications({ query: { enabled: cartActive } });
  // «Сообщения» — разговор с продавцом: заявки, вопросы, отзывы. Колокольчик считает всё.
  const unread = messageCounts(notifications.data?.status === 200 ? notifications.data.data : []).total;
  // Пока долг не погашен, корзина подсвечена: заказывать можно, но долг на виду.
  const debt = useGetPortalDebt({ query: { enabled: cartActive } });
  const inDebt = debt.data?.status === 200 && debt.data.data.debt > 0;
  const catalog = current === '/catalog' || current.startsWith('/catalog/');
  const tab = (active: boolean) => cn(
    'relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
    // Цвет платформы, а не продавца — как у значков «Главной»; значки им же и у неактивных вкладок.
    active ? 'font-extrabold text-home-icon' : 'text-ink-muted',
  );
  const home = HOME_PATHS.some((path) => current === path || current.startsWith(`${path}/`));
  // «Сообщения» горят и в своих разделах: вопросы, отзывы. «Мои заявки» — с «Главной» (решение владельца 2026-11-05).
  const messages = ['/messages', '/questions', '/reviews']
    .some((path) => current === path || current.startsWith(`${path}/`));
  // «Ещё» внизу больше нет (решение владельца 2026-10-30): все разделы — плитками на «Главной», «Выйти» — значком на «Главной» и в заголовке «Всех разделов».
  const delivery = current === '/delivery';
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
        <HomeHouse className="size-6 text-home-icon" />
        {t('shell.tabs.home')}
      </Link>
      <Link to="/messages" aria-current={messages ? 'page' : undefined} className={tab(messages)}>
        <HomeMessages className="size-6 text-home-icon" />
        {t('shell.tabs.messages')}
        {unread > 0 && (
          <span
            role="img"
            aria-label={t('shell.unread', { count: unread })}
            className="absolute left-[calc(50%+4px)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-sale px-1.5 text-xs font-extrabold text-on-sale"
          >
            <Bump value={unread}>{unread}</Bump>
          </span>
        )}
      </Link>
      <Link to="/catalog" aria-current={catalog ? 'page' : undefined} className={cn(tab(catalog), 'justify-end pb-1.5')}>
        <span
          className={cn(
            'mb-0.5 -mt-7 flex size-[3.75rem] items-center justify-center rounded-full bg-home-icon text-surface',
            'shadow-[0_0_0_5px_var(--color-surface),0_10px_22px_rgb(46_139_110/0.35)]',
          )}
        >
          <HomeCatalog className="size-7" />
        </span>
        {t('shell.tabs.catalog')}
      </Link>
      <Link to="/checkout" aria-current={cart ? 'page' : undefined} {...{ [CART_TARGET]: '' }} className={tab(cart)}>
        <HomeCart className="size-6 text-home-icon" />
        {t('shell.tabs.checkout')}
        {inDebt && <span className="sr-only">{t('shell.inDebt')}</span>}
        {inDebt && lines === 0 && (
          <span aria-hidden="true" className="absolute left-[calc(50%+6px)] top-2.5 size-2.5 rounded-full bg-sale ring-2 ring-surface" />
        )}
        {lines > 0 && (
          <span
            role="img"
            aria-label={t('shell.inCart', { count: lines })}
            className={cn(
              'absolute left-[calc(50%+4px)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-sale px-1.5 text-xs font-extrabold text-on-sale',
              inDebt && 'ring-2 ring-sale/30',
            )}
          >
            <Bump value={lines}>{lines}</Bump>
          </span>
        )}
      </Link>
      <Link to="/delivery" aria-current={delivery ? 'page' : undefined} className={tab(delivery)}>
        <HomeDelivery className="size-6 text-home-icon" />
        {t('shell.tabs.delivery')}
      </Link>
    </nav>
  );
}

/**
 * Что на телефоне переехало из шапки в лист «Ещё»: справка к экрану,
 * звонок в магазин и точка самовывоза.
 */
function PhoneExtras({ ready }: { ready: boolean }) {
  const { current: shop } = useShops();
  const tel = telLink(shop?.phone);
  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      <HelpGuide className="size-11 rounded-[var(--radius-control)] border border-line text-ink-muted" />
      {tel && <PhoneLine phone={shop?.phone} className="px-1" />}
      <PickupPointPicker ready={ready} withMap />
    </div>
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
              ? 'h-[22px] min-w-[22px] bg-sale px-[7px] text-2xs font-extrabold text-on-sale'
              : cn('h-6.5 min-w-6.5 px-2 text-caption', active ? 'bg-on-accent text-accent' : 'bg-accent text-on-accent'),
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}
