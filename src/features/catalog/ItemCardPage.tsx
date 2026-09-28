import { useEffect, useState } from 'react';
import { PackContents, packMembers } from './PackContents';
import { packsOnly, splitOf, tierFor, toPieces } from '../cart/wholesale';
import * as Dialog from '@radix-ui/react-dialog';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, MessageCircle, Ruler, ShieldCheck, Sparkles, Star, Tag, X, Zap } from 'lucide-react';
import {
  useGetPortalCatalog,
  useGetPortalCatalogItem,
  useGetPortalCategories,
  useGetPortalPromotions,
  type ItemSaleTerms,
  type ShowcaseCardDto,
} from '../../api/generated';
import { fieldText } from './fieldText';
import { CartBar } from '../cart/CartBar';
import { QuantityField } from '../cart/QuantityField';
import { cartOf, useCart } from '../cart/useCart';
import { useAddToCart } from '../cart/ageGate';
import { firstQuantity, fitQuantity, lessQuantity, stepOf } from '../cart/saleTerms';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { ReviewsBlock } from '../reviews/ReviewsBlock';
import { AskQuestionForm } from '../questions/AskQuestionForm';
import { useCurrentShop } from '../shell/Shops';
import { hoursText } from '../shell/shopHours';
import { MediaGallery } from './MediaGallery';
import { VariantPicker } from './VariantPicker';
import { StockNote } from './StockNote';
import { soldByOf } from './soldBy';
import { ItemBadges, ItemFacts } from './CatalogPage';
import { RatingBadge } from './itemParts';
import type { ShowcaseCardDtoSizeGuide, ShowcaseItemDto, ShowcaseWholesaleDto } from '../../api/generated';
import { ItemThumb } from './ItemThumb';
import { decimal, money, shortDate } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { quantityWithUnit, unitPer } from '../../shared/units';
import { intlLocale } from '../../i18n';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { flyToCart } from '../../ui/flyToCart';
import { cn } from '../../ui/cn';

/**
 * Карточка товара: то, за чем сюда приходят с витрины.
 *
 * Открывается по желанию, а не на пути к корзине: закупщик, который знает,
 * что берёт, набирает количество прямо в строке витрины и карточку не видит
 * никогда. Сюда идут за снимками, характеристиками и чужим мнением — и здесь
 * же кладут в корзину, чтобы не возвращаться назад ради одного касания.
 *
 * На мониторе — две колонки, как в макете: снимки слева, решение справа
 * (цена, количество, сумма, «Добавить в корзину» и условия сделки), а под
 * ними двумя панелями — характеристики и отзывы, ниже — похожие товары.
 * Пустого столба под галереей больше нет: длинное — характеристики и
 * отзывы — ушло под обе колонки, а не тянется в одной из них.
 *
 * На телефоне порядок тот же, одной колонкой: снимок во всю ширину, а на него
 * снизу наезжает белый лист с решением. Наезд не украшение: он говорит, что
 * лист прокручивается поверх снимка, и первым экраном человек получает всё,
 * ради чего открывал.
 */
export function ItemCardPage() {
  const { t } = useTranslation();
  const { itemId = '' } = useParams();
  const card = useGetPortalCatalogItem(itemId);

  if (card.isPending) {
    return (
      // Бегущий свет, а не мигание: мигающий прямоугольник читается как
      // поломка, а карточку товара открывают по присланной ссылке — то есть
      // на самой медленной связи, какая бывает у клиента.
      <Skeleton data-testid="card-skeleton" className="h-64" />
    );
  }

  if (card.data?.status !== 200) {
    return (
      <div className="flex flex-col items-start gap-4 py-12">
        <p className="text-ink-subtle">
          {t('catalog.gone')}
        </p>
        <Link
          to="/catalog"
          className="inline-flex h-11 items-center gap-2 text-sm font-medium text-ink-muted transition-all duration-300 hover:text-ink active:scale-95"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('catalog.toCatalog')}
        </Link>
      </div>
    );
  }

  // Ключом позиции: выбор другого варианта открывает другую позицию, и набранное
  // количество с формой вопроса начинаются заново.
  return <ItemCard key={card.data.data.id} item={card.data.data} />;
}

function ItemCard({ item }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  const categories = useGetPortalCategories();
  const category = categories.data?.status === 200
    ? categories.data.data.find((entry) => entry.id === item.categoryId)
    : undefined;

  /*
    Характеристики рубрики и прочие свойства показываются одним списком,
    характеристики — выше. Клиенту разница между ними ничего не объясняет:
    первые продавец завёл шаблоном отрасли и заполняет у каждой позиции,
    вторые — разовое, чему поля не завели. Порядок и есть всё объяснение.

    Характеристика без значения выпадает: строка с подписью и пустотой
    занимает место сообщением ни о чём. Внутренних здесь не бывает вовсе —
    сервер их не отдаёт ни кодом, ни подписью.
  */
  const properties = [
    ...(item.fields ?? []).map((field) => (
      { key: `field:${field.code}`, name: field.name, value: fieldText(field) }
    )),
    ...item.attributes.map((attribute) => (
      { key: `attribute:${attribute.name}`, name: attribute.name, value: attribute.value }
    )),
  ].filter((property) => property.value.trim() !== '');
  /*
    «Продаётся — поштучно» строкой характеристик, как в макете. Выводится
    из единицы и кратности; если продавец сам завёл такое свойство, его
    слово важнее выведенного, и второй строки нет.
  */
  if (!properties.some((property) => /^(продаётся|продается|sold|сатылады)/i.test(property.name))) {
    properties.push({ key: 'soldBy', name: t('item.soldBy.label'), value: soldByOf(item.unit, item.terms, t).value });
  }
  const hasSpec = properties.length > 0 || !!item.description;
  // Метки отзыва о размере — только у товара, у которого размер есть.
  const hasSize = properties.some((property) => /^(размер|size|өлшем)/i.test(property.name));

  return (
    <div className="flex flex-col gap-6 pb-28 lg:gap-11 lg:pb-0">
      {/*
        Путь обратно на мониторе — строкой над карточкой вместе с «где вы
        находитесь»: карточку открывают и по присланной ссылке, и тогда крошки
        — единственный ответ на вопрос, из какой она рубрики.
      */}
      <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 md:flex lg:-mb-5">
        <Link
          to="/catalog"
          className="inline-flex h-11 items-center gap-2 text-sm font-bold text-ink transition-colors duration-300 hover:text-accent-ink"
        >
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
          {t('item.back')}
        </Link>
        <nav aria-label={t('item.crumbs')} className="flex items-center gap-2 text-sm text-ink-subtle">
          <Link to="/catalog" className="hover:text-ink">{t('catalog.title')}</Link>
          {category && (
            <>
              <span aria-hidden="true">/</span>
              <span className="text-ink-muted">{category.name}</span>
            </>
          )}
        </nav>
      </div>

      {/*
        Три части одной сеткой: снимки, решение и характеристики. На мониторе
        характеристики стоят под снимками, а решение — колонкой справа во всю
        высоту; на телефоне всё идёт подряд — снимки, решение, характеристики.
        Панель одна: две копии для двух ширин диктор прочёл бы дважды.
      */}
      <section className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-9 lg:gap-y-5">
        {/*
          Отрицательные поля гасят отступы оболочки: на телефоне снимок идёт
          от края до края, иначе он читался бы картинкой внутри карточки,
          а не подложкой страницы.
        */}
        <div className="-mx-4 -mt-4 md:mx-0 md:mt-0 lg:col-start-1 lg:row-start-1">
          <MediaGallery
            media={item.media}
            itemName={item.name}
            topLeft={(
              <div className="flex items-start gap-2">
                <BackCircle />
                <PhotoBadges item={item} />
              </div>
            )}
            topRight={(
              <FavoriteButton
                itemId={item.id}
                favorite={item.favorite}
                // На снимке кнопка держится полупрозрачной подложкой, а не
                // рамкой: рамка на светлом кадре пропадает, а на тёмном
                // выглядит вырезанной дырой.
                className="size-12 rounded-full border-transparent bg-surface/85 backdrop-blur"
              />
            )}
          />
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Decision item={item} categoryName={category?.name} />
        </div>

        {hasSpec && (
          <div className="mt-5 flex flex-col gap-4 lg:col-start-1 lg:row-start-2 lg:mt-0">
            <SpecPanel item={item} properties={properties} />
          </div>
        )}
      </section>

      <ReviewsBlock
        itemId={item.id}
        canReview={item.canReview}
        sizeTags={hasSize}
        purchase={{ orderNumber: item.purchaseOrderNumber, at: item.purchasedAt }}
      />

      {item.categoryId && <Similar itemId={item.id} categoryId={item.categoryId} categoryName={category?.name} />}

      <CartBar />
    </div>
  );
}

/**
 * Правая колонка: всё, из чего складывается решение купить.
 *
 * Сверху вниз — что это (рубрика, оценка, название), почём (цена, старая
 * цена и выгода, налог и дата), сколько и во что обойдётся (количество
 * и сумма), само действие и условия сделки. Порядок совпадает с тем,
 * в каком человек задаёт себе эти вопросы.
 */
function Decision({ item, categoryName }: { item: ShowcaseCardDto; categoryName?: string }) {
  const { t, i18n } = useTranslation();
  const currency = useSupplierCurrency();
  const [asking, setAsking] = useState(false);

  // Условия, при которых цена верна, — отдельной мелкой строкой под ценой.
  // Требование о полноте торговой информации от размера шрифта не зависит:
  // строка не исчезает, а только уступает первый взгляд самой цене.
  const terms = [
    item.vatRate != null ? t('catalog.vat', { rate: decimal(item.vatRate) }) : undefined,
    item.priceAsOf ? t('catalog.asOf', { date: shortDate(item.priceAsOf) }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  // Подложка пилюли — единственное, что решается здесь; чем «наличие
  // уточняется» отличается от «нет в наличии», знает StockNote.
  const stockTint = (item.available != null ? item.available > 0 : item.stock === 'IN_STOCK')
    ? 'bg-in-stock/10'
    : item.stock === 'UNKNOWN'
      ? 'bg-unclear/10'
      : 'bg-canvas';
  const stockKnown = item.available != null || item.stock != null;
  const noveltySince = item.terms?.noveltySince
    ? new Intl.DateTimeFormat(i18n.language === 'kk' ? 'kk-KZ' : i18n.language, { day: '2-digit', month: '2-digit' })
      .format(new Date(`${item.terms.noveltySince}T12:00:00`))
    : null;

  return (
    <div
      className={cn(
        // Лист наезжает на снимок на те же 20 точек, на которые скруглён:
        // скругление без наезда выглядело бы обрезанным углом.
        'relative z-10 -mx-4 -mt-5 flex flex-col gap-4 rounded-t-[calc(var(--radius-tile)*1.25)] bg-surface px-4 pt-5',
        'md:mx-0 md:mt-5 md:gap-[22px] md:rounded-none md:bg-transparent md:px-0 md:pt-0 lg:mt-0',
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-caption">
          {categoryName && (
            <span className="flex h-[30px] items-center rounded-[var(--radius-pill)] bg-accent-soft px-3 font-bold text-accent-ink">{categoryName}</span>
          )}
          {item.terms?.novelty && (
            <span className="flex h-[30px] items-center rounded-[var(--radius-pill)] bg-surface px-3 font-bold text-ok-ink shadow-[0_0_0_1px_var(--color-hairline)]">
              {noveltySince ? t('item.novelSince', { date: noveltySince }) : t('catalog.badge.new')}
            </span>
          )}
          {/*
            Оценка — ссылкой к отзывам: число без отзывов за ним ничего
            не объясняет. Сравнение с null обязательно: незаполненную оценку
            сервер присылает значением null, а не отсутствием ключа.
          */}
          <a
            href="#reviews"
            data-testid="item-rating"
            className="flex h-[30px] items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface px-3 font-bold text-ink shadow-[0_0_0_1px_var(--color-hairline)] hover:shadow-[0_0_0_1px_var(--color-line)]"
          >
            <Star aria-hidden="true" className={cn('size-[15px]', item.rating != null ? 'fill-[#D97706] text-[#D97706]' : 'text-ink-faint')} />
            {item.rating != null
              ? `${item.rating.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${
                item.reviewCount != null ? ` · ${t('item.reviews', { count: item.reviewCount })}` : ''}`
              : t('item.noReviews')}
          </a>
        </div>
        <h1 className="text-[1.375rem] font-extrabold leading-tight tracking-[-0.02em] text-ink md:text-[2rem] lg:text-[2.75rem] lg:font-black lg:leading-[1.02] lg:tracking-[-0.03em]">
          {item.name}
        </h1>
      </div>

      <div className="flex flex-col gap-1.5">
        {/*
          Цена, единица, старая цена и выгода — одной строкой на общей базовой
          линии, как в макете: «2 500 тенге» без «за мешок» ничего не значит там,
          где рядом лежит цена за тонну. Цифры табличные, чтобы цена не дёргалась.
        */}
        <div data-testid="item-price" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={cn(
              'text-[1.75rem] font-extrabold tabular-nums leading-none tracking-[-0.02em] md:text-[2.25rem] lg:text-[2.875rem] lg:font-black lg:tracking-[-0.03em]',
              item.oldPrice != null ? 'text-sale' : 'text-ink',
            )}
          >
            {money(item.price, currency)}
          </span>
          <span className="text-sm font-semibold text-ink-muted md:text-base">
            {t('catalog.priceNote.perUnit', { unit: unitPer(item.unit) })}
          </span>
          {item.oldPrice != null && (
            <>
              <s className="text-base tabular-nums text-ink-faint md:text-xl">{money(item.oldPrice, currency)}</s>
              <span className="flex h-7 items-center self-center rounded-[var(--radius-pill)] bg-sale-soft px-2.5 text-sm font-extrabold text-sale-ink first-letter:uppercase">
                {t('catalog.saving', { amount: money(item.oldPrice - item.price, currency) })}
              </span>
            </>
          )}
        </div>
        {terms && <p className="text-sm text-ink-subtle">{terms}</p>}
      </div>

      {item.discountPercent ? <SaleParticipation /> : null}

      <div className="flex flex-wrap items-center gap-2">
        {stockKnown && (
          <span
            data-testid="stock-pill"
            className={cn('inline-flex h-[34px] items-center rounded-[var(--radius-pill)] px-3 [&>span]:mt-0', stockTint)}
          >
            <StockNote stock={item.stock} available={item.available} />
          </span>
        )}
        <ItemFacts item={item} pills />
      </div>

      {/*
        Покупка — панелью, как в макете: количество с суммой, главное действие
        и два второстепенных — вопрос продавцу и избранное.
      */}
      <div className="flex flex-col gap-[18px] md:rounded-[var(--radius-gallery)] md:bg-surface md:p-5 md:shadow-[0_0_0_1px_var(--color-hairline)]">
        {(item.variants ?? []).length > 1 && (
          <VariantPicker
            itemId={item.id}
            variants={item.variants}
            sizeAction={item.sizeGuide && <SizeGuide kind={item.sizeGuide} onAsk={() => setAsking(true)} />}
          />
        )}
        {item.pack ? <PackContents label={t('pack.inPress')} members={packMembers(item.pack)} /> : null}
        <Purchase item={item} />
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            aria-expanded={asking}
            onClick={() => setAsking((open) => !open)}
            className={GHOST}
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            {t('questions.ask')}
          </button>
          <FavoriteButton itemId={item.id} favorite={item.favorite} labelled className={cn(GHOST, 'size-auto')} />
        </div>
        {/*
          Вопрос о товаре уезжает в отдельную вкладку переписки: менеджер
          увидит его вместе с названием позиции.
        */}
        {asking && (
          <AskQuestionForm itemId={item.id} itemName={item.name} startOpened onClose={() => setAsking(false)} />
        )}
      </div>

      <DealFacts />

      <DiscountsPanel item={item} />
    </div>
  );
}

/**
 * Силуэт спереди — один на все мерки: меняется только лента на нём.
 * Правая половина зеркалит левую, чтобы фигура не кривилась.
 */
const SILHOUETTE = (() => {
  const right: [number, number][] = [
    [35, 17], [46, 22], [50, 48], [47, 60], [44, 46], [42, 30],
    [40, 46], [43, 60], [41, 112], [34, 112], [32, 72],
  ];
  const left = right.slice(0, -1).reverse().map(([x, y]) => [64 - x, y] as [number, number]);
  return `M${[...right, ...left].map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
})();

/** Стопа сверху: пятка внизу, носок вверху. */
const FOOT = 'M32 6 C44 6 50 16 50.5 32 C51 46 47 58 45.5 74 C44 90 44.5 104 41 110 C38.5 114.5 25.5 114.5 23 110 C19.5 104 20 90 18.5 74 C17 58 13 46 13.5 32 C14 16 20 6 32 6 Z';

/** Какую фигуру мерить: одежду — на силуэте, обувь — по стопе, головной убор — по голове. */
type SizeGuideKind = ShowcaseCardDtoSizeGuide;

/** Мерки каждого вида — в порядке, в каком их снимают. */
const STEPS = {
  CLOTHING: ['chest', 'waist', 'hips', 'inseam'],
  SHOES: ['footLength', 'footWidth'],
  HEADWEAR: ['head'],
} as const satisfies Record<SizeGuideKind, readonly string[]>;

type MeasureStep = (typeof STEPS)[SizeGuideKind][number];

/** Вступление к меркам: у каждого вида своё — стопу мерят вечером, голову без шапки. */
const INTRO: Record<SizeGuideKind, string> = {
  CLOTHING: 'intro',
  SHOES: 'shoesIntro',
  HEADWEAR: 'headwearIntro',
};

/** Где лежит лента: отрезок от точки до точки на фигуре 64×120. */
const TAPES: Record<MeasureStep, [number, number, number, number]> = {
  chest: [20, 34, 44, 34],
  waist: [22, 46, 42, 46],
  hips: [19, 60, 45, 60],
  inseam: [33.5, 76, 35.5, 108],
  footLength: [32, 8, 32, 112],
  footWidth: [13, 36, 51, 36],
  head: [11, 44, 53, 44],
};

/** Фигура под лентой. Контур — токенами, как и лента. */
function Figure({ kind }: { kind: SizeGuideKind }) {
  const outline = 'fill-surface stroke-ink-faint';
  if (kind === 'SHOES') {
    return <path d={FOOT} className={outline} strokeWidth="1.5" strokeLinejoin="round" />;
  }
  if (kind === 'HEADWEAR') {
    return (
      <>
        {/* Шея начинается под головой, а голова рисуется поверх: стык без зазора. */}
        <path d="M25 72 V92 C25 98 14 101 8 116 M39 72 V92 C39 98 50 101 56 116" className="fill-none stroke-ink-faint" strokeWidth="1.5" />
        <ellipse cx="32" cy="54" rx="21" ry="27" className={outline} strokeWidth="1.5" />
        <path d="M11 52 C7 52 7 62 11.5 62 M53 52 C57 52 57 62 52.5 62" className="fill-none stroke-ink-faint" strokeWidth="1.5" />
      </>
    );
  }
  return (
    <>
      <circle cx="32" cy="10" r="6.5" className="fill-none stroke-ink-faint" strokeWidth="1.5" />
      <path d={SILHOUETTE} className={outline} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}

/**
 * Схема мерки: где приложить ленту. Картинка повторяет текст рядом,
 * поэтому скрыта от скринридера; цвета — токенами, и схема сама
 * перекрашивается в тёмной теме и в цвет магазина.
 */
function MeasureSchema({ kind, step, large = false }: { kind: SizeGuideKind; step: MeasureStep; large?: boolean }) {
  const [x1, y1, x2, y2] = TAPES[step];
  // Засечки на концах ленты — поперёк неё, по три точки в каждую сторону.
  const length = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / length) * 3;
  const ny = ((x2 - x1) / length) * 3;
  return (
    <svg
      aria-hidden="true"
      data-testid={`size-schema-${step}`}
      data-size={large ? 'large' : 'small'}
      viewBox="0 0 64 120"
      className={cn(
        'shrink-0 rounded-[var(--radius-control)] bg-sunk motion-safe:transition-[width,height] motion-safe:duration-200',
        large ? 'h-40 w-[5.35rem]' : 'h-[5.5rem] w-12',
      )}
    >
      <Figure kind={kind} />
      <g className="stroke-accent" strokeWidth="2.25" strokeLinecap="round">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <line x1={x1 - nx} y1={y1 - ny} x2={x1 + nx} y2={y1 + ny} />
        <line x1={x2 - nx} y1={y2 - ny} x2={x2 + nx} y2={y2 + ny} />
      </g>
    </svg>
  );
}

/**
 * «Как подобрать размер» — ссылкой у выбора размера и окном с подсказкой.
 *
 * Подсказка общая, а не таблица размеров: размерной сетки продавец
 * не заводит, и выдуманные сантиметры были бы хуже никаких. Окно учит
 * снять мерки и отправляет с сомнением к продавцу — тот знает свою
 * посадку. Radix-диалог, как у проверки 21+: ловушка фокуса, Esc
 * и возврат фокуса на ссылку — даром.
 *
 * Что мерить, решает сервер по отрасли рубрики (`sizeGuide`): у обуви —
 * стопу, у головного убора — голову. Без его ответа подсказки нет вовсе:
 * мерки одежды у кроссовок учили бы не тому.
 */
function SizeGuide({ kind, onAsk }: { kind: SizeGuideKind; onAsk: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Мелкая схема рядом с текстом читается с трудом: нажатая мерка показывает
  // свою крупно. Крупной бывает одна за раз — иначе окно ушло бы в прокрутку.
  const [enlarged, setEnlarged] = useState<MeasureStep | null>(null);
  const steps: readonly MeasureStep[] = STEPS[kind];
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="qo-hit inline-flex min-h-8 items-center gap-1.5 text-sm font-bold text-accent-ink underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Ruler aria-hidden="true" className="size-4" />
          {t('item.sizeGuide.link')}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/45 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby="size-guide-text"
          className={cn(
            'qo-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'flex-col gap-3 overflow-y-auto rounded-[calc(var(--radius-gallery)*7/6)] bg-surface p-6 shadow-float',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              {t('item.sizeGuide.title')}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t('item.sizeGuide.close')}
              className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <p id="size-guide-text" className="text-body leading-normal text-ink-muted">{t(`item.sizeGuide.${INTRO[kind]}`)}</p>
          {/*
            Окно с раскрытой меркой обязано помещаться без прокрутки: строки
            разделяет их собственная подсветка, а не промежуток, и крупная
            схема ровно такая, чтобы уложиться в экран ноутбука.
          */}
          <ul className="flex flex-col gap-1">
            {steps.map((step) => (
              <li key={step}>
                <button
                  type="button"
                  aria-expanded={enlarged === step}
                  onClick={() => setEnlarged((current) => (current === step ? null : step))}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-[var(--radius-control)] px-2 py-1 text-left text-body leading-snug hover:bg-sunk/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <MeasureSchema kind={kind} step={step} large={enlarged === step} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <b className="text-ink">{t(`item.sizeGuide.${step}`)}</b>
                    <span className="text-ink-muted">{t(`item.sizeGuide.${step}How`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="rounded-[var(--radius-control)] bg-sunk px-3.5 py-3 text-sm font-semibold text-ink">{t('item.sizeGuide.doubt')}</p>
          <Button
            size="lg"
            variant="accent"
            className="gap-2"
            onClick={() => {
              // Та же форма, что у кнопки «Спросить продавца» ниже, — не вторая
              // копия в окне: вопрос о размере продавец получит с названием
              // позиции, как любой другой. Фокус Radix вернёт на ссылку,
              // а форма раскроется под кнопками покупки.
              setOpen(false);
              onAsk();
            }}
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            {t('questions.ask')}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Второстепенная кнопка карточки: вопрос продавцу и избранное. */
const GHOST = cn(
  'inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[var(--radius-tile)] px-3 py-1 text-center text-base font-semibold leading-[1.15] text-ink',
  'shadow-[0_0_0_1px_var(--color-line)] transition-colors duration-200 hover:bg-sunk',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

/**
 * Метки на снимке столбиком, как в макете: скидка крупнее всех — она
 * меняет цену, «Хит продаж» и «Новинка» ниже.
 */
function PhotoBadges({ item }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  const terms = item.terms;
  if (!terms?.ageRestricted && !item.discountPercent && !terms?.hit && !terms?.novelty) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      {item.discountPercent ? (
        <span className="flex h-[34px] items-center rounded-[var(--radius-pill)] bg-sale px-3.5 text-body font-black text-white lg:h-[38px] lg:text-lead">
          −{item.discountPercent}%
        </span>
      ) : null}
      {terms?.hit && (
        <span className="flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface px-3 text-caption font-extrabold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]">
          <Zap aria-hidden="true" className="size-3.5 fill-[#E0A04A] text-[#E0A04A]" />
          {t('catalog.badge.hit')}
        </span>
      )}
      {terms?.novelty && (
        <span className="flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] bg-night px-3 text-caption font-extrabold uppercase tracking-[0.04em] text-white">
          <Sparkles aria-hidden="true" className="size-3.5" />
          {t('catalog.badge.new')}
        </span>
      )}
      {terms?.ageRestricted && (
        <span className="flex h-8 items-center rounded-[var(--radius-pill)] bg-adult px-3 text-caption font-extrabold text-white">
          {t('catalog.badge.adult')}
        </span>
      )}
    </div>
  );
}

/**
 * Количество, сумма и «Добавить в корзину».
 *
 * Пока позиции нет в корзине, количество набирается здесь же, до нажатия:
 * сумма считается сразу, и человек видит, во что обойдётся набранное, раньше,
 * чем нажмёт. Первым стоит допустимое количество — минимум продавца, поднятый
 * до кратности, — а не ноль: «Сумма 0 тенге» читалась бы поломкой.
 *
 * Положенная позиция дальше правится тем же счётчиком, что на витрине
 * и в корзине, — прямо в корзине, — а вместо кнопки встаёт «Добавлено»
 * со ссылкой в корзину.
 */
function Purchase({ item }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const { add, isPending } = useAddToCart();
  const wholesale = item.wholesale;
  const only = packsOnly(item);
  // Поле считает в единицах витрины: у «только опт» — упаковки, иначе штуки.
  // Корзина хранит штуки: уложенное переводится обратно делением на вложение.
  const perPack = only ? wholesale!.packQty : 1;
  const inCart = cart?.lines.find((line) => line.itemId === item.id)?.quantity;
  const ordered = inCart === undefined ? undefined : inCart / perPack;
  const [wanted, setWanted] = useState(() => firstQuantity(item.terms));
  const amount = ordered ?? wanted;
  const pieces = toPieces(item, amount);
  const split = wholesale ? splitOf(wholesale, pieces, only ? undefined : item.price) : undefined;
  // Сумма — тем же разбиением, что посчитает корзина: упаковки по ступени, остаток в розницу.
  const sum = split?.tier
    ? split.packs * split.tier.price + (only ? 0 : split.rest * item.price)
    : item.price * amount;
  const breakdown = split && split.packs > 0 && wholesale ? (
    <p data-testid="wholesale-split" className="text-caption font-semibold text-ink-muted">
      {t('item.wholesale.split', {
        pieces: quantityWithUnit(pieces, wholesale.pieceUnit),
        packs: quantityWithUnit(split.packs, wholesale.unit),
        price: money(split.tier!.price, currency),
      })}
      {split.rest > 0
        ? ` + ${quantityWithUnit(split.rest, wholesale.pieceUnit)} × ${money(item.price, currency)}`
        : ''}
    </p>
  ) : null;

  if (ordered !== undefined) {
    return (
      <div className="flex flex-col gap-3">
        {wholesale && <WholesaleTerms item={item} wholesale={wholesale} packs={split?.packs ?? 0} />}
        <div className="flex flex-wrap items-center gap-3">
          <QuantityField itemId={item.id} unit={item.unit} terms={item.terms} perPack={perPack}
            className="h-13 w-auto min-w-[12rem] flex-1" />
          <Sum amount={sum} />
        </div>
        {breakdown}
        <p role="status" className="flex items-center gap-2.5 rounded-[var(--radius-control)] bg-ok-soft px-3.5 py-3 text-body font-bold text-ok-ink">
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          {t('item.added', { amount: quantityWithUnit(ordered, item.unit) })}
        </p>
        <Link
          to="/checkout"
          className={cn(
            'flex h-14 w-full items-center justify-center gap-2.5 rounded-[calc(var(--radius-tile)*1.125)] bg-night lg:h-[60px]',
            'text-[1.0625rem] font-bold text-white transition-opacity duration-200 hover:opacity-90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          )}
        >
          {t('item.toCart')}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {wholesale && <WholesaleTerms item={item} wholesale={wholesale} packs={split?.packs ?? 0} />}
      <div className="flex flex-wrap items-center gap-3">
        <LocalStepper value={wanted} unit={item.unit} terms={item.terms} onChange={setWanted} />
        <Sum amount={sum} />
      </div>
      {breakdown}
      <Button
        /*
          Цвет магазина и самый крупный размер: на карточке это единственное
          главное действие и то, ради чего её открыли.
        */
        variant="accent"
        size="xl"
        className="w-full gap-2.5 rounded-[calc(var(--radius-tile)*1.125)] text-base lg:h-[60px] lg:text-lg"
        disabled={isPending || wanted <= 0}
        onClick={async (event) => {
          // Летит текущий кадр галереи: заявка живёт наверху экрана или справа,
          // и молча нажатая кнопка заставляет класть позицию второй раз.
          const shot = document.querySelector('[data-testid="gallery-photo"]') ?? event.currentTarget;
          const added = await add(item, wanted);
          if (added) flyToCart(shot);
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 8H6.2" /></svg>
        {t('item.add')}
      </Button>
    </div>
  );
}

/**
 * «Как купить по оптовой цене» — условия видны всегда, до набора количества:
 * клиент должен понимать, что сделать ради опта. Упаковка и её вложение, ступени
 * с ценой за упаковку и за штуку (текущая подсвечена), что будет при недоборе.
 */
function WholesaleTerms({ item, wholesale, packs }: { item: ShowcaseCardDto; wholesale: ShowcaseWholesaleDto; packs: number }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const current = tierFor(wholesale.tiers, packs);
  return (
    <section data-testid="wholesale-terms" aria-labelledby="wholesale-terms-title"
      className="flex flex-col gap-2 rounded-[var(--radius-tile)] bg-sunk p-3.5">
      <h3 id="wholesale-terms-title" className="text-body font-bold text-ink">{t('item.wholesale.title')}</h3>
      <p className="text-caption font-semibold text-ink-muted">
        {t('item.wholesale.packOf', { unit: wholesale.unit, amount: quantityWithUnit(wholesale.packQty, wholesale.pieceUnit) })}
      </p>
      <PackContents label={t('pack.inPack')}
        members={[{ key: item.id, name: item.name, quantity: wholesale.packQty, unit: wholesale.pieceUnit }]} />
      <ul data-testid="wholesale-tiers" aria-label={t('item.wholesale.tiers')} className="m-0 flex list-none flex-col gap-1 p-0">
        {wholesale.tiers.map((tier) => (
          <li
            key={tier.from}
            data-testid="wholesale-tier"
            aria-current={tier === current ? 'true' : undefined}
            className={cn(
              'flex flex-wrap items-baseline justify-between gap-x-3 rounded-[var(--radius-control)] px-3 py-2 text-body',
              tier === current ? 'bg-accent-soft font-bold text-accent-ink' : 'bg-surface text-ink',
            )}
          >
            <span>
              {t('item.wholesale.tierFrom', { amount: quantityWithUnit(tier.from, wholesale.unit) })}
              {' '}
              <span className="text-caption font-normal text-ink-muted">
                ({quantityWithUnit(tier.from * wholesale.packQty, wholesale.pieceUnit)})
              </span>
            </span>
            <span className="flex items-baseline gap-2 tabular-nums">
              {tier.oldPrice !== undefined && <s className="text-caption text-ink-faint">{money(tier.oldPrice, currency)}</s>}
              {money(tier.price, currency)}
              <span className="text-caption font-normal text-ink-muted">
                {t('item.wholesale.perPiece', {
                  price: money(Math.round(tier.price / wholesale.packQty), currency),
                  unit: unitPer(wholesale.pieceUnit),
                })}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-ink-muted">
        {wholesale.retail
          ? t('item.wholesale.belowMin', {
            price: money(item.price, currency),
            unit: unitPer(wholesale.pieceUnit),
          })
          : t('item.wholesale.onlyPacks', { amount: quantityWithUnit(wholesale.tiers[0].from, wholesale.unit) })}
      </p>
      {item.discountPercent && !wholesale.tiers[0]?.oldPrice ? (
        <p className="text-caption font-semibold text-sale-ink">{t('item.wholesale.noSale')}</p>
      ) : null}
    </section>
  );
}

/** «Сумма» справа от количества — крупно, табличными цифрами. */
function Sum({ amount }: { amount: number }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  return (
    <div className="ml-auto flex flex-col items-end">
      <span className="text-caption text-ink-subtle">{t('item.sum')}</span>
      <span data-testid="item-sum" className="text-2xl font-extrabold tabular-nums tracking-[-0.01em] text-ink">{money(amount, currency)}</span>
    </div>
  );
}

/**
 * Количество до корзины: «+» и «−» по кратности продавца, ниже минимума
 * не опускается — убирать из корзины здесь ещё нечего.
 */
function LocalStepper({
  value,
  unit,
  terms,
  onChange,
}: {
  value: number;
  unit: string;
  terms?: ItemSaleTerms;
  onChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const least = firstQuantity(terms);
  const button = cn(
    'flex size-[46px] shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*6/7)] bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]',
    'transition-all duration-200 active:scale-95 hover:bg-sunk disabled:pointer-events-none disabled:opacity-40',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  );
  return (
    <div className="flex h-14 min-w-[12rem] flex-1 items-center justify-between gap-1 rounded-[var(--radius-tile)] bg-sunk p-1 shadow-[0_0_0_1px_var(--color-hairline)]">
      <button
        type="button"
        aria-label={t('cart.less')}
        className={button}
        disabled={value <= least}
        onClick={() => onChange(Math.max(least, lessQuantity(value, terms)))}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span aria-live="polite" className="text-lg font-bold tabular-nums text-ink">
        {quantityWithUnit(value, unit)}
      </span>
      <button
        type="button"
        aria-label={t('cart.more')}
        className={button}
        onClick={() => onChange(fitQuantity(value + stepOf(terms), terms))}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Условия сделки списком под кнопкой: платить сейчас не нужно и где забирать.
 * Адрес и часы — из реквизитов продавца; не назвал — строки нет. Скидки
 * стоят своей панелью ниже (`DiscountsPanel`).
 */
function DealFacts() {
  const { t } = useTranslation();
  const shop = useCurrentShop();
  const hours = hoursText(shop?.hours, t);
  const fact = 'flex items-start gap-3 text-sm leading-normal text-ink-muted';
  const icon = 'flex size-[34px] shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*5/7)] bg-sunk text-accent-ink';

  return (
    <ul className="flex flex-col gap-2.5">
      <li className={fact}>
        <span className={icon}><ShieldCheck aria-hidden="true" className="size-[18px]" /></span>
        <span className="pt-1.5"><b className="font-semibold text-ink">{t('item.factPayLabel')}</b> {t('item.factPay')}</span>
      </li>
      {shop?.address && (
        <li className={fact}>
          <span className={icon}><MapPin aria-hidden="true" className="size-[18px]" /></span>
          <span className="pt-1.5">
            <b className="font-semibold text-ink">{t('item.factPickupLabel')}</b>
            {' '}
            {[shop.address, hours?.toLocaleLowerCase()].filter(Boolean).join(', ')}.
          </span>
        </li>
      )}
    </ul>
  );
}

/**
 * Характеристики и описание — панелью под снимками. Если среди свойств есть
 * состав в процентах («Вискоза 65%, полиэстер 30%»), он показан ещё и полосками
 * — «Из чего сделано»: доли читаются быстрее, чем через запятую.
 */
function SpecPanel({
  item,
  properties,
}: {
  item: ShowcaseCardDto;
  properties: { key: string; name: string; value: string }[];
}) {
  const { t } = useTranslation();
  const composition = compositionOf(properties);
  const panel = 'flex flex-col rounded-[calc(var(--radius-card)*13/11)] bg-surface px-5 py-5 shadow-[0_0_0_1px_var(--color-hairline)] lg:px-7 lg:py-6';
  return (
    <>
      <div className={cn(panel, 'gap-1.5')}>
        <h2 id="attributes-heading" className="text-xl font-extrabold text-ink lg:text-2xl">{t('catalog.attributes')}</h2>
        {item.description && (
          <p className="whitespace-pre-line py-2 text-body leading-relaxed text-ink-muted">{item.description}</p>
        )}
        {properties.length > 0 && (
          /*
            Список описаний, а не таблица: свойств у позиции от двух
            до двадцати, и таблица из двух строк выглядит поломкой вёрстки.
          */
          <dl aria-labelledby="attributes-heading" className="flex flex-col">
            {properties.map((property) => (
              <div
                key={property.key}
                data-testid="item-property"
                className="flex items-baseline justify-between gap-4 border-b border-hairline py-3.5 text-body last:border-b-0"
              >
                <dt className="text-ink-muted">{property.name}</dt>
                <dd className="text-right font-bold text-ink">{property.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {composition.length >= 2 && (
        <div className={cn(panel, 'gap-[18px]')}>
          <h3 className="text-lg font-extrabold text-ink">{t('item.composition')}</h3>
          {/*
            Доли одной полосой, как в макете: полоса читается как целое,
            из которого складываются части, — отдельные полоски этого не говорят.
          */}
          <div aria-hidden="true" className="flex h-[18px] gap-[3px] overflow-hidden rounded-[9px]">
            {composition.map((part, index) => (
              <span key={part.name} className={SHARE_COLORS[index % SHARE_COLORS.length]} style={{ width: `${part.percent}%` }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {composition.map((part, index) => (
              <li key={part.name} className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <span aria-hidden="true" className={cn('size-2.5 rounded-full', SHARE_COLORS[index % SHARE_COLORS.length])} />
                  {part.name}
                </span>
                <b className="text-[1.625rem] font-extrabold tabular-nums text-ink">{part.percent}%</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** Цвета долей состава: различимы и по светлоте, не только по оттенку. */
const SHARE_COLORS = ['bg-accent', 'bg-[#E0A04A]', 'bg-[#E7A0AE]', 'bg-[#5B7FA6]', 'bg-ink-faint'];

/**
 * Доли состава из свойства «Состав»: «Вискоза 65%, полиэстер 30%, эластан 5%».
 * Только если сумма — сто процентов: иначе это не состав, а что-то похожее,
 * и полоски соврали бы.
 */
function compositionOf(properties: { name: string; value: string }[]) {
  const source = properties.find((property) => /^(состав|құрамы|composition)/i.test(property.name));
  if (!source) return [];
  const parts = [...source.value.matchAll(/([\p{L}][\p{L}\s-]*?)\s*(\d{1,3})\s*%/gu)]
    .map((match) => ({ name: match[1].trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase()), percent: Number(match[2]) }));
  const sum = parts.reduce((total, part) => total + part.percent, 0);
  return sum === 100 ? parts : [];
}

/**
 * «Участвует в акции» — ссылкой на «Акции и скидки», с отсчётом до конца.
 * Только когда у товара есть скидка распродажи и распродажа идёт.
 */
function SaleParticipation() {
  const { t, i18n } = useTranslation();
  const promotions = useGetPortalPromotions();
  const sale = promotions.data?.status === 200 ? promotions.data.data.sale : undefined;
  const left = useSaleCountdown(sale?.endsAt);
  if (!sale) return null;
  const until = sale.endsOn
    ? new Intl.DateTimeFormat(i18n.language === 'kk' ? 'kk-KZ' : i18n.language, { day: 'numeric', month: 'long' })
      .format(new Date(`${sale.endsOn}T12:00:00`))
    : null;
  const box = 'flex min-w-10 flex-col items-center justify-center rounded-[calc(var(--radius-control)*5/7)] bg-black/25 px-1.5 py-1.5 leading-none';
  return (
    <Link
      to="/promotions"
      data-testid="sale-participation"
      className="flex flex-wrap items-center gap-3.5 rounded-[calc(var(--radius-tile)*1.125)] bg-sale px-4 py-3.5 text-white transition-opacity hover:opacity-95"
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)*6/7)] bg-black/25">
        <Tag className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-body">{t('item.inSale', { title: sale.title })}</b>
        <span className="text-caption text-white/80">
          {until ? t('item.inSaleUntil', { date: until }) : t('promotions.sale.noCode')}
        </span>
      </span>
      {left && sale.countdown && (
        <span className="flex gap-1 tabular-nums" aria-label={t('promotions.sale.leftLabel', left)}>
          <span className={box}><b className="text-lead">{left.days}</b><span className="mt-1 text-[0.625rem] text-white/80">{t('item.dd')}</span></span>
          <span className={box}><b className="text-lead">{String(left.hours).padStart(2, '0')}</b><span className="mt-1 text-[0.625rem] text-white/80">{t('item.hh')}</span></span>
          <span className={box}><b className="text-lead">{String(left.minutes).padStart(2, '0')}</b><span className="mt-1 text-[0.625rem] text-white/80">{t('item.mm')}</span></span>
        </span>
      )}
    </Link>
  );
}

function useSaleCountdown(endsAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const minutes = Math.floor(Math.max(0, new Date(endsAt).getTime() - now) / 60_000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

/**
 * «Скидки на этот товар»: какие скидки магазина к нему применимы и что
 * будет с корзиной. Распродажа — уже в цене; за объём — от суммы заявки;
 * на первую заявку — если покупателю она ещё положена. Числа — из акций
 * и корзины, экран их не придумывает.
 */
function DiscountsPanel({ item }: { item: ShowcaseCardDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const promotions = useGetPortalPromotions();
  const data = promotions.data?.status === 200 ? promotions.data.data : undefined;
  const cart = cartOf(useCart().data);
  if (!data) return null;
  const tier = data.volumeTiers[0];
  const first = data.firstOrder?.status === 'ELIGIBLE' ? data.firstOrder : undefined;
  if (!item.discountPercent && !tier && !first) return null;
  const goods = cart?.goodsTotal ?? 0;
  // Ближайший порог считается здесь по самим порогам, а не по `cart.nextTier`:
  // тот приходит, только когда продавец включил подсказку в корзине и до
  // порога близко, — его отсутствие не значит, что порог набран.
  const upcoming = data.volumeTiers.find((entry) => entry.from > goods);
  const next = upcoming ? { missing: upcoming.from - goods, percent: upcoming.percent } : undefined;
  const volumeOn = cart?.discount?.kind === 'VOLUME';

  // Сколько набрано до ближайшего порога — полосой, как в макете.
  const progress = next ? Math.round((goods / (goods + next.missing)) * 100) : 100;
  // Набранный порог — самый высокий из пройденных: о нём и говорит «Сумма больше…».
  const passed = [...data.volumeTiers].reverse().find((entry) => entry.from <= goods);
  // Полоса «ещё N» — как решил магазин и как на странице акций: только
  // с подсказкой (`volumeHintPercent`) и когда до порога уже близко или
  // скидка взята. Издалека строка просто называет условие.
  const hintShare = data.volumeHintPercent;
  const near = upcoming !== undefined && hintShare != null
    && (passed !== undefined || (upcoming.from - goods) * 100 <= upcoming.from * hintShare);
  const showBar = upcoming ? near : passed !== undefined;
  // Порог в строке — тот, к которому идёт полоса; все взяты — последний взятый.
  const shown = upcoming ?? passed ?? tier;
  const volumeSub = passed && upcoming
    ? t('item.discounts.partial', { have: passed.percent, missing: money(upcoming.from - goods, currency), percent: upcoming.percent })
    : t('item.discounts.from', { amount: money(shown?.from ?? 0, currency) });
  const volumeValue = passed && upcoming ? passed.percent : shown?.percent;

  const row = (key: string, on: boolean, title: string, sub: string, value?: string, muted = false) => (
    <li key={key} className={cn('flex items-center gap-3 text-sm', muted && 'opacity-70')}>
      <span
        aria-hidden="true"
        className={cn('flex size-[26px] shrink-0 items-center justify-center rounded-full text-caption font-black',
          on ? 'bg-accent text-on-accent' : 'bg-sunk text-ink-muted')}
      >
        {on ? '✓' : muted ? '—' : '%'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-ink">{title}</b>
        <span className="text-caption text-ink-subtle">{sub}</span>
      </span>
      {value && <b className={on ? 'text-sale-ink' : 'text-ink-muted'}>{value}</b>}
    </li>
  );

  return (
    <section aria-labelledby="h-item-discounts" className="flex flex-col gap-3 rounded-[calc(var(--radius-tile)*1.25)] bg-surface px-[18px] py-4 shadow-[0_0_0_1px_var(--color-hairline)]">
      <h2 id="h-item-discounts" className="text-caption font-bold uppercase tracking-[0.06em] text-ink-subtle">{t('item.discounts.title')}</h2>
      <ul className="flex flex-col gap-3">
        {item.discountPercent && data.sale
          ? row('sale', true, data.sale.title, t('item.discounts.inPrice'), `−${item.discountPercent}%`)
          : row('sale', false, t('item.discounts.noSale'), t('item.discounts.noSaleSub'), undefined, true)}
        {tier && row('volume', volumeOn, t('promotions.volume.title'), volumeSub, `−${volumeValue}%`)}
        {first && row('first', cart?.discount?.kind === 'FIRST_ORDER', t('promotions.v2.first.title'),
          t('item.discounts.newBuyers'), `−${first.percent}%`)}
      </ul>
      {tier && showBar && (
        <>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-sunk">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-caption font-semibold text-accent-ink">
            {next
              ? t('item.discounts.left', { amount: money(next.missing, currency) })
              : t('item.discounts.reached', { threshold: money(passed?.from ?? tier.from, currency) })}
          </p>
        </>
      )}
      {(tier || first) && <p className="text-xs text-ink-faint">{t('promotions.v2.noStack')}</p>}
    </section>
  );
}

/**
 * Похожие товары — из той же рубрики, без самой позиции.
 *
 * Рубрика и есть «похожесть», которую знает система: придумывать связи
 * между товарами, которых продавец не проводил, она не вправе.
 */
function Similar({ itemId, categoryId, categoryName }: { itemId: string; categoryId: string; categoryName?: string }) {
  const { t } = useTranslation();
  const similar = useGetPortalCatalog({ categoryId, page: 0, size: 5, sort: 'POPULAR' });
  const items = (similar.data?.status === 200 ? (similar.data.data.items ?? []) : [])
    .filter((entry) => entry.id !== itemId)
    .slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="similar-heading" className="flex flex-col gap-4 lg:gap-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="similar-heading" className="text-xl font-extrabold tracking-[-0.02em] text-ink lg:text-[1.75rem] lg:font-black">{t('item.similar')}</h2>
        <Link
          to={categoryName ? `/catalog?category=${encodeURIComponent(categoryId)}` : '/catalog'}
          className="text-sm font-bold text-accent-ink underline-offset-[3px] hover:underline lg:text-body"
        >
          {categoryName ? t('item.allInCategory', { name: categoryName }) : t('item.allCatalog')} →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {items.map((entry) => <SimilarCard key={entry.id} entry={entry} />)}
      </div>
    </section>
  );
}

/**
 * Карточка похожего товара: снимок с метками, название, оценка, цена
 * и «+ В корзину» — положить, не открывая его карточку.
 */
function SimilarCard({ entry }: { entry: ShowcaseItemDto }) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const cart = cartOf(useCart().data);
  const { add, isPending } = useAddToCart();
  const inCart = cart?.lines.some((line) => line.itemId === entry.id) ?? false;

  return (
    <div
      data-testid="similar-card"
      className={cn(
        'flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface',
        'shadow-[0_0_0_1px_var(--color-hairline)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_0_0_1px_var(--color-line)]',
      )}
    >
      <Link
        to={`/catalog/${entry.id}`}
        className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <div className="relative">
          <ItemThumb itemId={entry.id} src={entry.thumbnailUrl} className="h-40 w-full lg:h-[250px]" />
          <ItemBadges item={entry} words className="absolute left-2.5 top-2.5" />
        </div>
        <span className="flex flex-col gap-2 px-4 pt-4">
          <span className="line-clamp-2 min-h-10 text-body font-semibold leading-snug text-ink">{entry.name}</span>
          <RatingBadge rating={entry.rating} reviewCount={entry.reviewCount} />
          <span className="flex flex-wrap items-baseline gap-2">
            <span className={cn('text-lg font-extrabold tabular-nums lg:text-title', entry.oldPrice != null ? 'text-sale' : 'text-ink')}>
              {money(entry.price, currency)}
            </span>
            {entry.oldPrice != null && <s className="text-caption tabular-nums text-ink-faint">{money(entry.oldPrice, currency)}</s>}
            <span className="text-caption font-semibold text-ink-muted">
              {t('catalog.priceNote.perUnit', { unit: unitPer(entry.unit) })}
            </span>
          </span>
        </span>
      </Link>
      <div className="px-4 pb-4 pt-2">
        {inCart ? (
          <Link
            to="/checkout"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-ok-soft text-body font-bold text-ok-ink"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {t('item.similarInCart')}
          </Link>
        ) : (
          <button
            type="button"
            disabled={isPending}
            aria-label={t('item.similarAddAria', { name: entry.name })}
            onClick={() => void add(entry, firstQuantity(entry.terms))}
            className={cn(
              'flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent-soft text-body font-bold text-accent-ink',
              'transition-colors duration-200 hover:bg-accent hover:text-on-accent disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            {t('item.similarAdd')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Возврат в каталог кружком поверх снимка.
 *
 * Ссылкой, а не «назад» браузера: карточку открывают по присланному адресу,
 * и истории, куда возвращаться, у такого посетителя нет.
 */
function BackCircle() {
  const { t } = useTranslation();

  return (
    <Link
      to="/catalog"
      aria-label={t('catalog.toCatalog')}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full',
        'bg-surface/85 text-ink backdrop-blur',
        'transition-all duration-300 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        // На мониторе путь обратно стоит строкой над карточкой.
        'md:hidden',
      )}
    >
      <ArrowLeft className="size-[18px]" aria-hidden="true" />
    </Link>
  );
}
