import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CatalogPage } from '../catalog/CatalogPage';
import { ItemCardPage } from '../catalog/ItemCardPage';
import { CartPanel } from '../cart/CartPanel';
import { CheckoutPage } from '../cart/CheckoutPage';
import { DeliveryInfoPage } from '../delivery/DeliveryInfoPage';
import { FavoritesPage } from '../favorites/FavoritesPage';
import { MyOrdersPage } from '../orders/MyOrdersPage';
import { OrderPage } from '../orders/OrderPage';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { ProfilePage } from '../profile/ProfilePage';
import { QuestionsPage } from '../questions/QuestionsPage';
import { RequireSupplier } from '../profile/RequireSupplier';
import { MyReviewsPage } from '../reviews/MyReviewsPage';
import { TemplatesPage } from '../templates/TemplatesPage';
import { useGetPortalSuppliers, useGetPortalUnreadSummary } from '../../api/generated';
import { currentViewer } from '../../auth/oidcConfig';
import { ActivationBanner } from './ActivationBanner';
import { LanguagePicker } from './LanguagePicker';
import { StaffBanner } from './StaffBanner';
import { useSupplier } from '../../supplier/useSupplier';
import { useSupplierAccess } from '../../supplier/useSupplierAccess';
import { Button } from '../../ui/Button';
import { Logo } from '../../ui/Logo';
import { Sheet } from '../../ui/Sheet';
import { useWideScreen } from '../../ui/useWideScreen';
import { cn } from '../../ui/cn';

/**
 * Разделы кабинета — один список на оба экрана.
 *
 * Именно один: разойдись боковая колонка с выдвижным листом, на телефоне
 * и на мониторе оказались бы разные кабинеты, и объяснять по телефону, куда
 * нажать, стало бы нечем.
 */
/*
 * Хранится ключ, а не подпись: подпись зависит от языка, а список считается
 * один раз на модуле — посчитанная здесь, она осталась бы прежней до
 * перезагрузки страницы.
 */
const SECTIONS = [
  { key: 'catalog', path: '/catalog' },
  { key: 'favorites', path: '/favorites' },
  { key: 'checkout', path: '/checkout' },
  { key: 'orders', path: '/orders' },
  { key: 'templates', path: '/templates' },
  { key: 'questions', path: '/questions' },
  { key: 'reviews', path: '/reviews' },
  { key: 'delivery', path: '/delivery' },
  { key: 'profile', path: '/profile' },
];

/**
 * Сколько новостей ждёт у поставщиков, кроме текущего.
 *
 * Текущий не считается намеренно: его новости показывает колокольчик, и одно
 * и то же число в двух местах шапки читается как два разных повода.
 *
 * Считаются только строки сводки, чей поставщик есть в списке поставщиков.
 * На сервере встречается расхождение: поставщик, у которого не читаются
 * сведения о продавце, выпадает из списка, но остаётся в сводке со счётом.
 * Список поставщиков — источник истины о том, к кому клиент может пойти;
 * сводка может знать о поставщике, к которому идти уже некуда, и точка
 * в шапке или бейдж «Поставщики», зажжённые от него, были бы тупиковым
 * индикатором — горит, а идти некуда.
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
 * Оболочка кабинета: шапка, разделы, экраны и заявка.
 *
 * Разделы приходят слева на любой ширине, и открывают их одни и те же три
 * полоски — иначе кабинет на телефоне и кабинет на мониторе объясняются
 * по-разному, а объяснять приходится по телефону.
 *
 * Различается только то, чем именно кнопка управляет. На телефоне постоянной
 * колонке места нет — она съела бы треть экрана у того, кто пришёл за двумя
 * позициями, — и кнопка открывает выдвижной лист. На мониторе колонка стоит
 * слева всегда развёрнутой, и та же кнопка её складывает: лист, выехавший
 * слева поверх точно такого же списка слева, читался бы поломкой, а не меню.
 *
 * Лист разделов выезжает слева — с той же стороны, где на мониторе стоит
 * постоянная колонка: навигация живёт в одном месте на всех ширинах.
 * Корзина и уведомления остаются нижними — они относятся к открытому
 * экрану, а не меняют его.
 *
 * Заявка на мониторе — третья колонка, а не липкая полоса внизу: полоса
 * поверх широкого экрана закрывает последнюю строку витрины ради суммы,
 * для которой справа есть пустое место.
 */
export function Shell() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const wide = useWideScreen();
  // Колонка развёрнута, пока её не сложили: человек, открывший кабинет
  // впервые, обязан увидеть разделы, а не догадаться нажать на полоски.
  const [railOpen, setRailOpen] = useState(true);
  const location = useLocation();
  const others = useOthersUnread();
  const { activated, ready } = useSupplierAccess();

  /*
   * На оформлении заявка и есть экран: колонка справа показывала бы тот же
   * состав второй раз и отнимала бы у формы треть ширины. Грид тогда
   * перестраивается на две колонки — иначе 340 точек остались бы пустыми.
   *
   * В неоткрытом кабинете колонки нет по другой причине: заявки у клиента
   * без поставщика не существует, и запрос за ней вернул бы отказ — тот
   * самый, вместо которого стоит полоса с объяснением.
   */
  const withCart = !location.pathname.startsWith('/checkout') && activated;

  return (
    <div className="min-h-screen bg-canvas">
      {/*
        Одна кнопка на обе ширины: на мониторе она складывает постоянную
        колонку, на телефоне открывает лист. Названа она «Меню» в обоих
        случаях — человек нажимает её за одним и тем же.
      */}
      <Header
        activated={activated}
        ready={ready}
        onOpenSections={() => (wide ? setRailOpen((open) => !open) : setOpened(true))}
      />

      {/*
        Полоса арендатора стоит под шапкой и над всем остальным: она объясняет,
        почему этот кабинет — не чей-то, а свой, и её незаметность означала бы,
        что проверку приняли за работу клиента.
      */}
      {currentViewer() === 'staff' && (
        <StaffBanner webUrl={import.meta.env.VITE_WEB_URL ?? '/'} />
      )}

      {/*
        Полоса о неоткрытом кабинете — единственное, что клиенту без
        поставщика вообще есть смысл показывать: всё остальное здесь
        принадлежит поставщику.
      */}
      {!activated && <ActivationBanner />}

      <Sheet open={opened && !wide} onOpenChange={setOpened} title={t('shell.menu')} side="left">
        {/*
          Язык — первой строкой: на телефоне кружка профиля в шапке нет,
          и другого места для переключателя там не остаётся.
        */}
        <div className="flex items-center justify-between gap-2 pb-2">
          <LanguagePicker />
        </div>

        <nav aria-label={t('shell.sectionsNav')} className="flex flex-col gap-1">
          {SECTIONS.map((section) => (
            <SectionLink
              key={section.path}
              section={section}
              current={location.pathname}
              badge={section.path === '/profile' ? others : undefined}
              onFollow={() => setOpened(false)}
            />
          ))}
        </nav>
      </Sheet>

      <div
        data-testid="shell-grid"
        className={cn(
          'mx-auto flex w-full max-w-[1440px] lg:grid',
          // Сложенная колонка отдаёт свои 232 точки витрине, а не оставляет
          // пустую дорожку: ради этого её и складывают.
          railOpen
            ? (withCart
              ? 'lg:grid-cols-[232px_minmax(0,1fr)_340px]'
              : 'lg:grid-cols-[232px_minmax(0,1fr)]')
            : (withCart
              ? 'lg:grid-cols-[minmax(0,1fr)_340px]'
              : 'lg:grid-cols-[minmax(0,1fr)]'),
        )}
      >
        {/*
          Колонка разделов на широком экране. `hidden lg:flex` — единственное,
          что отличает её от списка в листе: содержимое то же самое.

          Липкая и со своей прокруткой: разделы — это способ уйти с экрана,
          и уезжать вместе с длинной витриной они не должны.
        */}
        {railOpen && (
        <nav
          aria-label={t('shell.sectionsRail')}
          className={cn(
            'hidden flex-col gap-[3px] border-r border-hairline bg-sunk px-4 py-6 lg:flex',
            'lg:sticky lg:top-[68px] lg:h-[calc(100dvh-68px)] lg:overflow-y-auto',
          )}
        >
          <span className="px-3 pb-2.5 text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
            {t('shell.sectionsTitle')}
          </span>
          {SECTIONS.map((section) => (
            <SectionLink
              key={section.path}
              section={section}
              current={location.pathname}
              badge={section.path === '/profile' ? others : undefined}
            />
          ))}
        </nav>
        )}

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-7 lg:py-6">
          <Routes>
            <Route path="/catalog" element={<RequireSupplier><CatalogPage /></RequireSupplier>} />
            <Route path="/catalog/:itemId" element={<RequireSupplier><ItemCardPage /></RequireSupplier>} />
            <Route path="/favorites" element={<RequireSupplier><FavoritesPage /></RequireSupplier>} />
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
        </main>

        {/*
          Колонка заявки стоит и до ответа сервера — иначе витрина прыгала бы
          на 340 точек в момент, когда список поставщиков дошёл. Запрос за
          составом заявки при этом ждёт подтверждения: уйди он раньше,
          клиент без поставщика получил бы на него отказ.
        */}
        {withCart && <CartPanel active={ready} />}
      </div>
    </div>
  );
}

/**
 * Верхняя полоса.
 *
 * Одна на все ширины, а не две разные: два `<header>` под медиазапросами
 * означали бы два колокольчика и две ссылки на избранное в дереве страницы —
 * экранный диктор прочитал бы каждую дважды, независимо от того, что скрыто
 * стилями.
 *
 * На телефоне полоса называет поставщика и даёт два значка; на мониторе
 * к ним добавляются знак продукта, поиск и подписи. Слово «Кабинет», стоявшее
 * здесь раньше, не говорило ничего: кабинет одинаков у всех, а закупаются
 * у разных.
 */
function Header({
  activated,
  ready,
  onOpenSections,
}: {
  activated: boolean;
  ready: boolean;
  onOpenSections: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function search(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    // Запрос уезжает адресом, а не поднятым в оболочку состоянием: найденное
    // отправляют ссылкой коллеге и открывают в соседней вкладке.
    navigate(trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : '/catalog');
  }

  return (
    <header className="sticky top-0 z-20 bg-canvas lg:border-b lg:border-hairline lg:bg-surface">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 py-3 lg:h-[68px] lg:gap-6 lg:px-7 lg:py-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('shell.menu')}
          className="shrink-0"
          onClick={onOpenSections}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>

        {/*
          Знак продукта и надпись — только на мониторе (решение владельца).
          На телефоне их нет: шапка там и без них тесная, и знак отнимал
          ширину у имени поставщика — «ТОО Стройбаза Алматы» усекалось
          до «ТОО …». Кому принадлежит кабинет, важнее того, чья это
          система: адрес клиент открывает по присланной ссылке и второй раз
          не выбирает, а поставщиков у него бывает несколько.

          Знак системы на телефоне человек всё равно видит — на экране входа
          и на активации приглашения, где ширину у него никто не оспаривает.

          Само изображение помечено `decorative`: имя системы стоит подписью
          у ссылки, и экранный читатель произносит его один раз.
        */}
        <Link
          to="/catalog"
          aria-label={t('shell.logo')}
          className="hidden shrink-0 items-center gap-2.5 lg:flex"
        >
          <Logo decorative className="h-8" />
          <span className="text-base font-semibold tracking-[-0.01em] text-ink">
            FastOrders
          </span>
        </Link>

        <SupplierMark />

        <form
          role="search"
          onSubmit={search}
          className={cn(
            'hidden min-w-0 flex-1 items-center gap-2.5 lg:flex',
            'h-11 max-w-[560px] rounded-[var(--radius-tile)] border border-hairline bg-sunk px-3.5',
            'focus-within:border-ink/30 focus-within:ring-2 focus-within:ring-brand/30',
            'transition-all duration-300',
          )}
        >
          <Search className="size-[18px] shrink-0 text-ink-subtle" aria-hidden="true" />
          <input
            type="search"
            aria-label={t('shell.search')}
            placeholder={t('shell.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-2.5">
          <HeaderAction to="/favorites" label={t('shell.sections.favorites')}>
            <Heart className="size-5" aria-hidden="true" />
          </HeaderAction>

          {/*
            Значок заявки — только на телефоне: на мониторе её состав и итог
            стоят колонкой справа, и значок был бы третьим местом с той же
            суммой.
          */}
          <HeaderAction to="/checkout" label={t('shell.cart')} className="lg:hidden">
            <ShoppingBag className="size-5" aria-hidden="true" />
          </HeaderAction>

          <Link
            to="/orders"
            className={cn(
              'hidden h-11 items-center rounded-[var(--radius-tile)] px-3.5 text-sm text-ink-muted lg:flex',
              'transition-all duration-300 hover:bg-ink/5 active:scale-95',
            )}
          >
            {t('shell.orders')}
          </Link>

          {/*
            В неоткрытом кабинете колокольчика нет: новостям взяться неоткуда,
            а запрос за ними вернул бы отказ. Пустой колокольчик обещал бы,
            что новости сюда придут, — они придут только после активации.
          */}
          {activated && <NotificationsBell active={ready} />}

          {/*
            Переключатель языка — рядом с профилем и только на мониторе.
            На телефоне шапка занята именем поставщика и значками, и четвёртая
            цель отняла бы ширину у имени, ради которого шапку и переделывали;
            там тот же переключатель стоит первой строкой выдвижного меню.
          */}
          <div className="hidden lg:block">
            <LanguagePicker />
          </div>

          {/*
            Кружок профиля вместо инициалов: имени вошедшего кабинет не знает —
            ни AuthContext, ни портальное API его не отдают. Две выдуманные
            буквы были бы чужими инициалами на экране человека.
          */}
          <Link
            to="/profile"
            aria-label={t('shell.profile')}
            className={cn(
              'hidden size-10 shrink-0 items-center justify-center rounded-full lg:flex',
              'bg-accent-soft text-accent transition-all duration-300 active:scale-95',
            )}
          >
            <User className="size-[18px]" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Имя поставщика в шапке — со стрелкой и ссылкой на выбор.
 *
 * Стрелка обещает переключение, и обещание должно исполняться: ведёт туда же,
 * где поставщики перечислены списком.
 *
 * Знак стоит рядом с именем, а не вместо него. Узнаётся он взглядом — у клиента
 * с тремя поставщиками переключатель без знаков читается как список одинаковых
 * строк, — но читается всё-таки имя, и поставщик, у которого картинка
 * не загрузилась, обязан остаться узнаваемым. Знака у продавца может не быть
 * вовсе: заглушка на его месте обещала бы то, чего он не давал, поэтому пусто
 * означает пусто.
 *
 * Пока список не пришёл, стоит нейтральное слово: пустое место в шапке
 * читается как поломка, а «Поставщик» — как ещё не загруженное имя.
 */
function SupplierMark() {
  const { t } = useTranslation();
  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];
  const current = list.find((supplier) => supplier.supplierId === supplierId);
  const name = current?.name;
  /*
   * Точка, а не число: оно повторило бы бейдж раздела, а места в шапке нет.
   * Нужна она потому, что на телефоне рельс спрятан в выдвижном листе, и без
   * метки здесь клиент бейджа не увидит вовсе.
   */
  const others = useOthersUnread();

  return (
    <Link
      to="/profile"
      className={cn(
        'flex min-h-11 min-w-0 flex-col justify-center gap-0.5 rounded-[var(--radius-control)]',
        'transition-all duration-300 active:scale-95',
        'lg:h-10 lg:min-h-0 lg:flex-row lg:items-center lg:gap-2 lg:border lg:border-hairline',
        'lg:bg-sunk lg:px-3 lg:hover:border-ink/20',
      )}
    >
      <span
        className={cn(
          'text-[11px] uppercase tracking-[0.08em] text-ink-subtle',
          'lg:text-[13px] lg:normal-case lg:tracking-normal',
        )}
      >
        {t('shell.supplier')}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        {/*
          Подписан именем поставщика, а не словом «логотип»: диктору важно,
          чей это знак, а не то, что это картинка. Рядом стоит то же имя
          текстом — повтор здесь дешевле, чем поставщик, опознаваемый только
          по картинке.
        */}
        {current?.logoUrl && (
          <img
            src={current.logoUrl}
            alt={current.name}
            className={cn(
              'size-7 shrink-0 rounded-[var(--radius-control)] object-contain',
              'border border-hairline bg-surface lg:size-6',
            )}
          />
        )}
        <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink lg:text-sm lg:font-medium">
          {name ?? t('shell.supplierChoose')}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        {others > 0 && (
          <span
            role="img"
            aria-label={t('shell.othersHaveNews')}
            className="size-2 shrink-0 rounded-full bg-accent"
          />
        )}
      </span>
    </Link>
  );
}

/**
 * Значок в шапке: на телефоне — цель в 44 точки на белой плитке, на мониторе
 * та же ссылка распрямляется в подпись.
 *
 * Название задано словом (`aria-label`), а не только рисунком: на телефоне
 * подписи нет вовсе, и без него экранный диктор прочитал бы «ссылка».
 */
function HeaderAction({
  to,
  label,
  className,
  children,
}: {
  to: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-tile)]',
        'border border-hairline bg-surface text-ink',
        'transition-all duration-300 active:scale-95',
        'lg:size-auto lg:h-11 lg:gap-2 lg:border-transparent lg:bg-transparent lg:px-3.5',
        'lg:text-sm lg:text-ink-muted lg:hover:bg-ink/5',
        className,
      )}
    >
      {children}
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

/**
 * Раздел в списке.
 *
 * Ссылкой, а не кнопкой: раздел открывают в соседней вкладке и присылают
 * ссылкой коллеге, и кнопка отняла бы и то, и другое. Выбранный назван
 * выбранным (`aria-current`), а не только подкрашен: цвет читает не всякий.
 */
function SectionLink({
  section,
  current,
  badge,
  onFollow,
}: {
  section: { key: string; path: string };
  current: string;
  badge?: number;
  onFollow?: () => void;
}) {
  const { t } = useTranslation();
  const active = current === section.path
    || (section.path !== '/catalog' && current.startsWith(`${section.path}/`))
    || (section.path === '/orders' && current.startsWith('/orders'));

  return (
    <NavLink
      to={section.path}
      onClick={onFollow}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 items-center rounded-[var(--radius-control)] px-3 text-left text-sm font-medium',
        'transition-all duration-300 active:scale-95',
        active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-ink/5',
      )}
    >
      {t(`shell.sections.${section.key}`)}
      {badge !== undefined && badge > 0 && (
        // Тот же приём, что у пилюли в списке поставщиков и у точки в шапке:
        // роль и осмысленное имя со словом. Голое число диктор произнёс бы
        // без единицы измерения — «Поставщики 4, ссылка» вместо понятного.
        <span
          role="img"
          aria-label={t('shell.unread', { count: badge })}
          className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-surface"
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}
