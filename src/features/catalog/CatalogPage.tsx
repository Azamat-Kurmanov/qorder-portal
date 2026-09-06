import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
 * С какой ширины колонки в ряд встаёт третья плитка.
 *
 * Считано так же: 232 под рубрики, 24 промежутка и три плитки не уже 230
 * с промежутками между ними. Плитка в 230 точек держит название в две строки,
 * цену с единицей в одну и «В корзину» целиком — уже этого она начинает
 * отнимать буквы у самой себя.
 *
 * Ступень в две колонки заведена не ради полноты набора. При открытом рельсе
 * и панели корзины колонка витрины не бывает шире 812 точек — оболочка
 * ограничена 1440, — и три плитки укладывались туда по 170: название в три
 * строки, цена оторвана от единицы. Две по 270 читаются, а третья приходит
 * тогда, когда рельс сложили и место действительно появилось.
 */
const THREE_TILES_FROM = 978;

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
  // Сколько плиток в ряду — тот же вопрос о месте, только заданный второй раз.
  const columns = columnWidth >= THREE_TILES_FROM ? 3 : 2;
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
        roomy
          ? 'grid grid-cols-[232px_minmax(0,1fr)] items-start gap-6 pb-8'
          // Запас снизу — под липкую панель итога: без него последняя строка
          // витрины остаётся под ней и до неё не долистать.
          : 'flex flex-col gap-4 pb-28'
      }
    >
      {roomy && (
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
            aria-label="Поиск по каталогу"
            placeholder="Что нужно? Например, цемент"
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

        {!roomy && categoryList.length > 0 && (
          // Рубрики одной прокручиваемой строкой: двадцать тысяч позиций
          // поиском не листаются, а сетка рубрик отняла бы пол-экрана.
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChip selected={categoryId === undefined} onSelect={() => setCategoryId(undefined)}>
              Всё
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
        )}

        {catalog.isPending ? (
          <Skeletons columns={roomy ? columns : 0} />
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-ink-subtle">
            Ничего не нашлось. Попробуйте другое слово или выберите рубрику.
          </p>
        ) : roomy ? (
          // Плитки в ряду тянутся до общей высоты — оттого действие и стоит
          // у них по нижнему краю: разъехавшиеся кнопки читаются как разные
          // состояния, а не как разной длины имена.
          <div
            data-testid="item-grid"
            className={cn('grid content-start gap-4', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}
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
 * Строка витрины на телефоне.
 *
 * Ссылка — на имени, а не на всей строке: строку занимают счётчик и сердечко,
 * и карточка, открывающаяся от касания где угодно, уводила бы с витрины тех,
 * кто просто промахнулся по «плюсу».
 */
function ItemRow({ item, taken }: { item: ShowcaseItemDto; taken: boolean }) {
  return (
    <div data-testid="item-row" className="flex gap-3 p-4">
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
          <span className="min-w-0 text-xs text-ink-subtle">{priceNote(item)}</span>
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
 */
function ItemTile({ item, taken }: { item: ShowcaseItemDto; taken: boolean }) {
  return (
    <Card interactive data-testid="item-tile" className="flex h-full flex-col overflow-hidden">
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
          <span className="min-w-0 text-xs text-ink-subtle">{priceNote(item)}</span>
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
      В корзину
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
function priceNote(item: ShowcaseItemDto): string {
  const parts = [`за ${item.unit}`];
  if (item.vatRate !== undefined) parts.push(`с НДС ${money(item.vatRate)}%`);
  if (item.priceAsOf) parts.push(`цена на ${shortDate(item.priceAsOf)}`);
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
  return (
    <aside
      data-testid="category-column"
      aria-label="Рубрики"
      className="sticky top-20 flex flex-col gap-[3px] rounded-[var(--radius-card)] border border-hairline bg-sunk p-4"
    >
      <span className="px-3 pb-2.5 text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
        Рубрики
      </span>
      <CategoryLink selected={selected === undefined} onSelect={() => onSelect(undefined)}>
        Всё
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
function Skeletons({ columns }: { columns: 0 | 2 | 3 }) {
  const tiles = columns > 0;

  return (
    <div
      className={cn(
        tiles ? 'grid gap-4' : 'flex flex-col gap-3',
        columns === 3 && 'grid-cols-3',
        columns === 2 && 'grid-cols-2',
      )}
    >
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
