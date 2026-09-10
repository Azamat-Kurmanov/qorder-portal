import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import type { TFunction } from 'i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useGetPortalCatalog,
  useGetPortalCategories,
  type ItemCategoryDto,
  type ShowcaseItemDto,
} from '../../api/generated';
import { QuantityField } from '../cart/QuantityField';
import { cartOf, useCart, useSetCartLine } from '../cart/useCart';
import { QuickInput } from './QuickInput';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { ItemThumb } from './ItemThumb';
import { StockNote } from './StockNote';
import { CartBar } from '../cart/CartBar';
import { money, shortDate, tenge } from '../../shared/format';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { cn } from '../../ui/cn';
import { useWideScreen } from '../../ui/useWideScreen';
import { useColumnWidth } from '../../ui/useColumnWidth';

/** Ширина, с которой на экране помещается колонка рубрик и три плитки рядом. */

/**
 * С какой ширины СВОЕЙ КОЛОНКИ витрина раскладывается плитками.
 *
 * Считано по содержимому, а не выбрано на глаз: колонка рубрик 232, промежуток
 * 24 и три плитки с промежутками между ними — около 780 точек. Уже этого
 * плитки начинают отнимать друг у друга буквы: название переносится по слогам,
 * цена отрывается от единицы, а «В корзину» перестаёт помещаться в кнопку.
 *
 * Порог меряется по колонке, а не по окну. На планшете в 1024 точки окно
 * широкое, а колонка витрины — 396: оболочка забирает 232 под разделы и 340
 * под корзину. Витрина, спрашивавшая окно, раскладывала там девятьсот точек
 * в четырёхстах, и плитки схлопывались в полоски по тридцать точек.
 */
const TILES_FROM = 780;

/**
 * С какой ширины колонки рубрики стоят отдельным столбцом слева.
 *
 * Считано так же: 232 под рубрики, 24 промежутка и три плитки не уже 230
 * с промежутками между ними. Плитка в 230 точек держит название в две строки,
 * цену с единицей в одну и «В корзину» целиком — уже этого она начинает
 * отнимать буквы у самой себя.
 *
 * Уже этого порога столбца рубрик нет — но не потому, что рубрики стали
 * не нужны. При открытом рельсе разделов и панели корзины колонка витрины
 * не бывает шире 812 точек — оболочка ограничена 1440, — и столбец рубрик
 * забирал там ровно ту ширину, которой не хватало третьей плитке: товары
 * схлопывались в два ряда, стоило человеку открыть разделы. Поэтому рубрики
 * уходят в выпадающее меню: список раскрывается ПОВЕРХ витрины и ширины
 * у неё не отнимает, а рубрику выбирают раз в заход — товары же человек
 * смотрит всё время, что на витрине стоит.
 */
const RUBRICS_ASIDE_FROM = 978;

/**
 * Главный экран кабинета: поиск, рубрики и витрина.
 *
 * На телефоне — строками: закупщик, который знает, что берёт, собирает заявку,
 * не открывая ни одной карточки. Карточка товара открывается по желанию — за
 * фотографиями, описанием и отзывами, — а не стоит на пути к корзине.
 *
 * На мониторе — плитками в три колонки и рубриками отдельной колонкой: там
 * ширина есть, и строка в 1400 точек оставляла бы имя товара в левой трети
 * пустого поля. Раскладка выбирается один раз на весь экран, а не рисуется
 * обеими сразу: два поля количества на одну позицию сбили бы и экранный
 * диктор, и переход по табу.
 *
 * Фильтрация идёт на сервере, а не в браузере: каталог поставщика не
 * помещается в память телефона, и «поиск по загруженному» нашёл бы только
 * первую страницу.
 */
export function CatalogPage() {
  const { t } = useTranslation();
  /*
   * Где живёт поисковый запрос, зависит от ширины, и это не прихоть.
   *
   * На мониторе поиск стоит в верхней полосе оболочки и отправляет запрос
   * адресом — `/catalog?q=…`. Витрина обязана читать адрес: иначе поиск из
   * шапки не находит ничего. Собственное поле витрина там не рисует вовсе —
   * два поля с одним именем «Поиск по каталогу» в одном дереве означают два
   * разных ответа на вопрос «что я ищу», и человек не знает, какое считается.
   *
   * На телефоне полосы поиска в шапке нет — там поле витрины и есть
   * единственное, а адрес остаётся входной точкой: по ссылке с запросом
   * поле обязано открыться заполненным, а не пустым.
   */
  const [searchParams] = useSearchParams();
  const address = searchParams.get('q') ?? '';
  const [typed, setTyped] = useState(address);

  // Ссылка с запросом могла открыться поверх уже открытой витрины: тогда
  // адрес сменился, а набранное осталось от прошлого экрана.
  useEffect(() => setTyped(address), [address]);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  /*
   * Два разных вопроса, и раньше на них отвечал один признак.
   *
   * `shellWide` — про ОБОЛОЧКУ: стоит ли поиск в её верхней полосе. Ответ
   * обязан совпадать с `lg` Tailwind, потому что полосу прячет класс.
   *
   * `roomy` — про МЕСТО: помещаются ли рядом колонка рубрик и три плитки.
   * Между окном и витриной стоят колонка разделов и панель корзины, и на
   * планшете от 1024 точек окна витрине достаётся 396.
   */
  const shellWide = useWideScreen();
  const [columnRef, columnWidth] = useColumnWidth<HTMLDivElement>();
  const roomy = columnWidth >= TILES_FROM;
  /*
   * Где стоят рубрики — тот же вопрос о месте, только заданный второй раз.
   *
   * Хватает ширины на столбец рубрик И на три плитки рядом — столбец стоит
   * слева. Не хватает — рубрики становятся выпадающим меню над витриной,
   * и три плитки встают на всю ширину колонки: 256 точек, которые забирал
   * столбец, и есть разница между тремя плитками и двумя.
   */
  const rubricsAside = columnWidth >= RUBRICS_ASIDE_FROM;
  const query = shellWide ? address : typed;

  const categories = useGetPortalCategories();
  const categoryList = categories.data?.status === 200 ? categories.data.data : [];
  const catalog = useGetPortalCatalog({
    query: query.trim() || undefined,
    categoryId,
    page: 0,
    size: 50,
  });

  const items = useMemo(
    () => (catalog.data?.status === 200 ? (catalog.data.data.items ?? []) : []),
    [catalog.data],
  );

  // Корзина спрашивается один раз на экран, а не строкой: строке нужен один
  // вопрос — «эта позиция уже взята?», — и пятьдесят подписок ради него
  // означали бы пятьдесят перерисовок на каждое нажатие «плюс».
  const cart = cartOf(useCart().data);
  const taken = useMemo(
    () => new Set((cart?.lines ?? []).map((line) => line.itemId)),
    [cart],
  );

  return (
    /*
      Ширину меряет сам корень витрины: он занимает колонку целиком, и обе
      его раскладки — сетка и колонка — тянутся на все сто процентов. Мерить
      то, что от измерения не меняется в ширину, безопасно: раскладка
      не гоняет сама себя по кругу.
    */
    <div
      ref={columnRef}
      className={
        rubricsAside
          ? 'grid grid-cols-[232px_minmax(0,1fr)] items-start gap-6 pb-8'
          : roomy
            ? 'flex flex-col gap-4 pb-8'
            // Запас снизу — под липкую панель итога: без него последняя строка
            // витрины остаётся под ней и до неё не долистать.
            : 'flex flex-col gap-4 pb-28'
      }
    >
      {rubricsAside && (
        <CategoryColumn
          categories={categoryList}
          selected={categoryId}
          onSelect={setCategoryId}
        />
      )}

      <div className="flex min-w-0 flex-col gap-4">
        {/* На мониторе поиск уже стоит в верхней полосе оболочки — см. выбор
            источника запроса в начале компонента. */}
        {shellWide ? null : (
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            aria-label={t('catalog.search')}
            placeholder={t('catalog.searchPlaceholder')}
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value)}
            className={cn(
              'h-12 w-full rounded-[var(--radius-tile)] border border-hairline bg-surface',
              'pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-faint',
              'transition-all duration-300 focus:border-ink/30 focus:outline-none',
              'focus:ring-2 focus:ring-brand/30',
            )}
          />
        </div>
        )}

        <QuickInput />

        {!rubricsAside && categoryList.length > 0 && (
          roomy ? (
            <CategoryMenu
              categories={categoryList}
              selected={categoryId}
              onSelect={setCategoryId}
            />
          ) : (
            // Рубрики одной прокручиваемой строкой: двадцать тысяч позиций
            // поиском не листаются, а сетка рубрик отняла бы пол-экрана.
            // Меню вместо строки телефону не годится: раскрытый список
            // накрыл бы там весь экран, а строка чипов листается пальцем.
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <CategoryChip selected={categoryId === undefined} onSelect={() => setCategoryId(undefined)}>
                {t('catalog.all')}
              </CategoryChip>
              {categoryList.map((category) => (
                <CategoryChip
                  key={category.id}
                  selected={categoryId === category.id}
                  onSelect={() => setCategoryId(category.id)}
                >
                  {category.name}
                </CategoryChip>
              ))}
            </div>
          )
        )}

        {catalog.isPending ? (
          <Skeletons columns={roomy ? 3 : 0} />
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-ink-subtle">
            {t('catalog.nothingFound')}
          </p>
        ) : roomy ? (
          // Плитки в ряду тянутся до общей высоты — оттого действие и стоит
          // у них по нижнему краю: разъехавшиеся кнопки читаются как разные
          // состояния, а не как разной длины имена.
          <div
            data-testid="item-grid"
            className="grid grid-cols-3 content-start gap-4"
          >
            {items.map((item, index) => (
              <Reveal key={item.id} delay={Math.min(index, 3) * 0.04}>
                <ItemTile item={item} taken={taken.has(item.id)} />
              </Reveal>
            ))}
          </div>
        ) : (
          // Строки идут одним полотном с волосяными разделителями, а не
          // отдельными карточками: полсотни висящих в воздухе прямоугольников
          // читаются медленнее, чем один список.
          <Card className="divide-y divide-hairline overflow-hidden">
            {items.map((item, index) => (
              <Reveal key={item.id} delay={Math.min(index, 3) * 0.04}>
                <ItemRow item={item} taken={taken.has(item.id)} />
              </Reveal>
            ))}
          </Card>
        )}
      </div>

      <CartBar />
    </div>
  );
}

/**
 * Открыть карточку позиции нажатием по прямоугольнику.
 *
 * Обработчик на контейнере, а не ссылка вокруг всего: внутри лежат сердечко,
 * «В корзину» и поле количества, а ссылка с кнопками внутри — недопустимая
 * разметка, которую экранный диктор читает одним бессмысленным именем.
 * Поэтому имя остаётся настоящей ссылкой — по ней ходят с клавиатуры,
 * её открывают в новой вкладке и по ней же карточку называют вслух, — а
 * нажатие по остальному прямоугольнику только повторяет то, что ссылка
 * и так умеет.
 *
 * Три случая обработчик пропускает мимо себя:
 *
 * — нажатие пришло из ссылки, кнопки или поля. Они отвечают за себя сами,
 *   и увести с витрины промахнувшегося по «плюсу» — ровно то, ради чего
 *   ссылка когда-то жила на одном имени;
 * — нажатие с Ctrl или ⌘. Человек просил новую вкладку, а обработчик умеет
 *   только сменить экран под собой; пусть лучше не делает ничего, чем делает
 *   не то;
 * — нажатие, которым закончилось выделение текста. Скопировать имя или цену
 *   из строки — обычное дело, и уезжать с витрины на отпускании кнопки
 *   после выделения нельзя.
 */
function useOpenCard(itemId: string) {
  const navigate = useNavigate();

  return (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if ((event.target as HTMLElement).closest('a, button, input, label, [role="button"]')) return;
    if ((window.getSelection()?.toString() ?? '') !== '') return;

    navigate(`/catalog/${itemId}`);
  };
}

/**
 * Строка витрины на телефоне.
 *
 * Открывается касанием куда угодно по строке, а не только по имени: имя
 * занимает треть ширины, а остальные две трети — цена, наличие и пустое
 * место — до сих пор не отвечали ни на что, и в карточку приходилось
 * прицеливаться.
 *
 * Ссылка на имени при этом остаётся настоящей ссылкой — см. `useOpenCard`.
 */
function ItemRow({ item, taken }: { item: ShowcaseItemDto; taken: boolean }) {
  const { t } = useTranslation();
  const openCard = useOpenCard(item.id);

  return (
    <div data-testid="item-row" onClick={openCard} className="flex cursor-pointer gap-3 p-4">
      <ItemThumb itemId={item.id} src={item.thumbnailUrl} className="size-16 rounded-[var(--radius-tile)]" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/catalog/${item.id}`}
            className="text-[15px] font-medium leading-[1.3] text-ink transition-all duration-300 hover:text-accent"
          >
            {item.name}
          </Link>
          {/*
            Сердечко без своей подложки: над именем оно чип, а не кнопка, —
            но цель остаётся в сорок четыре точки, иначе палец промахивается.
          */}
          <FavoriteButton
            itemId={item.id}
            favorite={item.favorite}
            className="-mr-2 -mt-2 shrink-0 border-transparent bg-transparent"
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold tracking-[-0.01em] tabular-nums text-ink">
            {tenge(item.price)}
          </span>
          <span className="min-w-0 text-xs text-ink-subtle">{priceNote(item, t)}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <StockNote stock={item.stock} available={item.available} className="mt-0 text-xs" />
          <CartAction item={item} taken={taken} />
        </div>
      </div>
    </div>
  );
}

/**
 * Плитка витрины на мониторе.
 *
 * Снимок сверху, потому что на широком экране выбирают глазами: имя и цена
 * там читаются вторыми. Сердечко лежит поверх снимка — единственное место,
 * где оно не отнимает ширину у имени.
 *
 * Нажимается плитка целиком, как и строка: снимок в плитке крупнее имени,
 * и целиться мышью в две строки текста под ним человек не обязан.
 */
function ItemTile({ item, taken }: { item: ShowcaseItemDto; taken: boolean }) {
  const { t } = useTranslation();
  const openCard = useOpenCard(item.id);

  return (
    <Card
      interactive
      data-testid="item-tile"
      onClick={openCard}
      className="flex h-full cursor-pointer flex-col overflow-hidden"
    >
      <div className="relative">
        <ItemThumb itemId={item.id} src={item.thumbnailUrl} className="h-[168px] w-full" />
        <FavoriteButton
          itemId={item.id}
          favorite={item.favorite}
          className="absolute right-2 top-2 border-transparent bg-surface/80"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link
          to={`/catalog/${item.id}`}
          className="text-[15px] font-medium leading-[1.3] text-ink transition-all duration-300 hover:text-accent"
        >
          {item.name}
        </Link>

        <div className="flex items-baseline gap-2">
          <span className="text-[19px] font-semibold tracking-[-0.01em] tabular-nums text-ink">
            {tenge(item.price)}
          </span>
          <span className="min-w-0 text-xs text-ink-subtle">{priceNote(item, t)}</span>
        </div>

        <StockNote stock={item.stock} available={item.available} className="mt-0 text-xs" />

        {/* Действие прижато к низу: у плиток разной высоты кнопки обязаны стоять в ряд. */}
        <div className="mt-auto pt-2">
          <CartAction item={item} taken={taken} full />
        </div>
      </div>
    </Card>
  );
}

/**
 * Действие в строке: взять или набрать количество.
 *
 * Пока позиция не в корзине, стоит кнопка. Поле количества у каждой строки
 * означало бы, что в корзине уже лежит весь каталог по нулю, — витрина обязана
 * отличать «не брал» от «взял ноль», иначе оформление примет пустую заявку.
 */
function CartAction({
  item,
  taken,
  full = false,
}: {
  item: ShowcaseItemDto;
  taken: boolean;
  full?: boolean;
}) {
  const { t } = useTranslation();
  const setLine = useSetCartLine();

  if (taken) return <QuantityField itemId={item.id} unit={item.unit} />;

  return (
    <Button
      variant="outline"
      // Кладётся единица, а не ноль: кнопка называется «В корзину», и нажавший
      // ждёт, что позиция там окажется. Дальше её набирают счётчиком, который
      // встанет на это же место.
      onClick={() => setLine.mutate({ itemId: item.id, data: { quantity: 1 } })}
      disabled={setLine.isPending}
      className={cn('rounded-[var(--radius-tile)]', full && 'w-full')}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
        <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {t('catalog.toCart')}
    </Button>
  );
}

/**
 * Единица, налог и дата — одной мелкой строкой рядом с ценой.
 *
 * Дата актуальности остаётся и здесь, хотя в макете её нет: требование о
 * полноте торговой информации действует на витрине раньше, чем на оформлении,
 * и цена без даты превращается в бессрочное обещание.
 */
function priceNote(item: ShowcaseItemDto, t: TFunction): string {
  const parts = [t('catalog.priceNote.perUnit', { unit: item.unit })];
  if (item.vatRate !== undefined) {
    parts.push(t('catalog.priceNote.vat', { rate: money(item.vatRate) }));
  }
  if (item.priceAsOf) {
    parts.push(t('catalog.priceNote.asOf', { date: shortDate(item.priceAsOf) }));
  }
  return parts.join(' · ');
}

/**
 * Колонка рубрик на мониторе.
 *
 * Кнопками, а не ссылками: рубрика — это фильтр открытого экрана, а не
 * отдельная страница, и адрес её пока не хранит. Выбранная названа выбранной
 * (`aria-pressed`), а не только подкрашена: цвет читает не всякий.
 *
 * Числа позиций рядом с рубрикой, как в макете, нет: сервер отдаёт рубрику
 * идентификатором, именем и порядком — считать за него нечем, а подставить
 * правдоподобное число значило бы соврать о размере каталога.
 */
function CategoryColumn({
  categories,
  selected,
  onSelect,
}: {
  categories: ItemCategoryDto[];
  selected?: string;
  onSelect: (categoryId?: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <aside
      data-testid="category-column"
      aria-label={t('catalog.rubrics')}
      className="sticky top-20 flex flex-col gap-[3px] rounded-[var(--radius-card)] border border-hairline bg-sunk p-4"
    >
      <span className="px-3 pb-2.5 text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
        {t('catalog.rubrics')}
      </span>
      <CategoryLink selected={selected === undefined} onSelect={() => onSelect(undefined)}>
        {t('catalog.all')}
      </CategoryLink>
      {categories.map((category) => (
        <CategoryLink
          key={category.id}
          selected={selected === category.id}
          onSelect={() => onSelect(category.id)}
        >
          {category.name}
        </CategoryLink>
      ))}
    </aside>
  );
}

/**
 * Рубрики выпадающим меню — там, где столбцу для них места нет.
 *
 * Тот же список и тот же выбор, что в столбце, но список лежит закрытым
 * и раскрывается ПОВЕРХ витрины: разложи его в потоке — витрина съедет вниз
 * на пол-экрана, а стой он столбцом — отнимет у плиток ширину, ради которой
 * меню и заведено.
 *
 * Кнопка называет не только слово «Рубрики», но и выбранную рубрику: список
 * закрыт, и без этого человек не знает, почему витрина показывает не всё.
 * По той же причине выбранная рубрика названа выбранной внутри меню
 * (`aria-checked`), а не только подкрашена.
 *
 * Меню закрывается тремя способами — выбором, Escape и нажатием мимо.
 * Escape обязателен: список поверх содержимого, у которого не осталось
 * другого способа вернуться к товарам с клавиатуры. Фокус после закрытия
 * возвращается на кнопку — иначе он уезжает на страницу целиком, и следующий
 * таб начинает обход кабинета заново.
 */
function CategoryMenu({
  categories,
  selected,
  onSelect,
}: {
  categories: ItemCategoryDto[];
  selected?: string;
  onSelect: (categoryId?: string) => void;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const holder = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const chosen = categories.find((category) => category.id === selected);
  const title = `${t('catalog.rubrics')}: ${chosen?.name ?? t('catalog.all')}`;

  useEffect(() => {
    if (!opened) return;

    // Нажатие мимо считается по `mousedown`, а не по `click`: закрытие
    // на отпускании кнопки съело бы первое нажатие по товару под меню.
    const away = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpened(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpened(false);
      trigger.current?.focus();
    };

    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [opened]);

  const choose = (categoryId?: string) => {
    onSelect(categoryId);
    setOpened(false);
    trigger.current?.focus();
  };

  return (
    <div ref={holder} data-testid="category-menu" className="relative self-start">
      <button
        ref={trigger}
        type="button"
        aria-expanded={opened}
        aria-haspopup="menu"
        onClick={() => setOpened((open) => !open)}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)]',
          'border border-hairline bg-surface px-4 text-sm font-medium text-ink',
          'transition-all duration-300 hover:border-ink/20 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        )}
      >
        {title}
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 text-ink-faint transition-transform duration-300', opened && 'rotate-180')}
        />
      </button>

      {opened && (
        // Ширина у списка своя, а не по кнопке: имя рубрики длиннее слова
        // «Рубрики», и список по кнопке рвал бы названия переносами.
        // Высота ограничена окном — рубрик у поставщика бывает три десятка.
        <div
          role="menu"
          aria-label={t('catalog.rubrics')}
          className={cn(
            'absolute left-0 top-full z-30 mt-1 flex max-h-[60vh] w-72 flex-col overflow-y-auto',
            'rounded-[var(--radius-tile)] border border-hairline bg-surface p-1 shadow-lg',
          )}
        >
          <CategoryOption selected={selected === undefined} onSelect={() => choose(undefined)}>
            {t('catalog.all')}
          </CategoryOption>
          {categories.map((category) => (
            <CategoryOption
              key={category.id}
              selected={selected === category.id}
              onSelect={() => choose(category.id)}
            >
              {category.name}
            </CategoryOption>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Рубрика в выпадающем меню.
 *
 * `menuitemradio`, а не кнопка с `aria-pressed`: в меню выбрана ровно одна
 * рубрика из списка, и «нажата/не нажата» сказало бы о каждой строке
 * отдельно, будто их можно включить несколько.
 */
function CategoryOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex h-11 shrink-0 items-center rounded-[var(--radius-control)] px-3 text-left text-sm',
        'transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        selected ? 'bg-accent-soft font-medium text-accent' : 'text-ink-muted hover:bg-ink/5',
      )}
    >
      {children}
    </button>
  );
}

/** Рубрика в колонке: выбранная — заливкой акцента, как выбранный раздел кабинета. */
function CategoryLink({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex h-11 items-center rounded-[var(--radius-control)] px-3 text-left text-sm',
        'transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        selected ? 'bg-accent-soft font-medium text-accent' : 'text-ink-muted hover:bg-ink/5',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Рубрика как чип.
 *
 * Выбранная набрана чернилами, остальные — обычной поверхностью: цвет здесь
 * означал бы состояние товара, а не выбор человека.
 */
function CategoryChip({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'h-11 shrink-0 rounded-full px-4 text-[13px] font-medium',
        'transition-all duration-300 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        selected
          ? 'bg-ink text-white'
          : 'border border-hairline bg-surface text-ink-muted hover:border-ink/20',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Ожидание в форме будущего содержимого: подмена высоты не даёт списку прыгнуть.
 *
 * Число колонок приходит то же, что и у витрины: заглушка в три колонки перед
 * витриной в две — это прыжок, ради предотвращения которого её и рисуют.
 * Ноль означает строки.
 */
function Skeletons({ columns }: { columns: 0 | 3 }) {
  const tiles = columns > 0;

  return (
    <div className={cn(tiles ? 'grid grid-cols-3 gap-4' : 'flex flex-col gap-3')}>
      {(tiles ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3]).map((cell) => (
        <div
          key={cell}
          data-testid="item-skeleton"
          className={cn(
            'animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk',
            tiles ? 'h-[320px]' : 'h-[92px]',
          )}
        />
      ))}
    </div>
  );
}

/**
 * Ширина экрана как состояние, а не как класс.
 *
 * Раскладку решает не CSS, потому что от неё зависит, что вообще попадёт
 * в дерево: спрятанная классом вторая раскладка осталась бы в разметке — со
 * своим полем количества, своей ссылкой и своим сердечком на каждую позицию.
 */
