import { useOrderMode } from '../cart/orderMode';
import type { SaleMode } from '../cart/ModeSwitch';
import { useTranslation } from 'react-i18next';
import { Package, ShoppingCart, Sparkles, Star, Tag, type IconComponent } from '../../ui/icons';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import type { ShowcaseItemDto } from '../../api/generated';
import { QuantityField } from '../cart/QuantityField';
import { useAddToCart } from '../cart/ageGate';
import { packsOnly } from '../cart/wholesale';
import { firstQuantity, stepOf } from '../cart/saleTerms';
import { quantityWithUnit, unitPer } from '../../shared/units';
import { soldByOf } from './soldBy';
import { decimal, money } from '../../shared/format';
import { useSupplierCurrency } from '../../supplier/SupplierCurrency';
import { Button } from '../../ui/Button';
import { flyToCart } from '../../ui/flyToCart';
import { cn } from '../../ui/cn';
import { intlLocale } from '../../i18n';

/*
 * Части карточки товара, общие у плитки каталога и других витрин: открыть карточку
 * нажатием, положить в корзину, метки на снимке и условия продажи.
 */

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
export function useOpenCard(itemId: string) {
  const navigate = useNavigate();

  return (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if ((event.target as HTMLElement).closest('a, button, input, label, [role="button"]')) return;
    if ((window.getSelection()?.toString() ?? '') !== '') return;

    navigate(`/catalog/${itemId}`);
  };
}

/**
 * Действие в строке: взять или набрать количество.
 *
 * Пока позиция не в корзине, стоит кнопка. Поле количества у каждой строки
 * означало бы, что в корзине уже лежит весь каталог по нулю, — витрина обязана
 * отличать «не брал» от «взял ноль», иначе оформление примет пустую заявку.
 */
export function CartAction({
  item,
  taken,
  roomy,
  look,
  className,
}: {
  item: ShowcaseItemDto;
  taken: boolean;
  roomy: boolean;
  /** Вид кнопки по карточке шаблона; пусто — прежняя кнопка во всю ширину. */
  look?: CartLook;
  className?: string;
}) {
  const { t } = useTranslation();
  const { add: addToCart, isPending } = useAddToCart();
  // У товара «оптом и в розницу» — строка той заявки, в которой клиент сейчас.
  const [orderMode] = useOrderMode();
  const mode = item.wholesale?.retail ? orderMode : undefined;
  const step = stepOf(item.terms);
  const first = firstQuantity(item.terms);

  if (taken) {
    return (
      <div className="flex flex-col gap-1">
        <QuantityField
          itemId={item.id}
          unit={item.unit}
          terms={item.terms}
          perPack={packsOnly(item) ? item.wholesale!.packQty : undefined}
          mode={mode}
          // Круглая кнопка — на узкой карточке: «в корзине» не влезает рядом с числом.
          suffix={look === 'round' ? undefined : t('catalog.inCartNote')}
          className={look ? 'h-11' : roomy ? 'h-13' : 'h-12'}
        />
        {/* Кратность — словами под счётчиком: «+» прибавляет не одну, а шесть. */}
        {step > 1 && (
          <span className="text-center text-xs font-semibold text-accent-ink">
            {t('catalog.stepNote', { amount: quantityWithUnit(step, item.unit) })}
          </span>
        )}
      </div>
    );
  }

  /**
   * Положить позицию — и показать, КУДА она легла.
   *
   * Между нажатием и ответом сервера не происходит ничего, а заявка живёт
   * наверху экрана или справа. Добросовестный закупщик, не увидев отклика,
   * кладёт ту же позицию второй раз. Поэтому снимок позиции улетает в заявку
   * в тот же кадр, когда палец отпустил кнопку, — до всякого ответа сервера.
   *
   * Летит снимок из ЭТОЙ строки, а не абстрактная точка: на витрине строки
   * похожи друг на друга, и «что-то произошло» отвечает не на тот вопрос,
   * который задан. Ищется он от кнопки вверх по дереву — так действие
   * не обязано получать ссылку на снимок отдельным свойством через два
   * компонента, а строка и плитка остаются каждая собой.
   */
  async function add(event: React.MouseEvent<HTMLButtonElement>) {
    const holder = event.currentTarget.closest('[data-testid="item-tile"], [data-testid="item-row"]');
    const shot = holder?.querySelector('[data-testid="item-thumb"]') ?? event.currentTarget;
    // Товар 21+ улетает в корзину только после «да»: полёт до ответа
    // обещал бы то, чего ещё не случилось.
    const added = await addToCart(item);
    if (added) flyToCart(shot);
  }

  const label = first > 1 ? t('catalog.toCartAmount', { amount: quantityWithUnit(first, item.unit) }) : t('catalog.toCart');
  if (look) {
    // Короткая подпись шаблона («В корзину», «Добавить») — только когда
    // кладётся единица: минимум в десять мешков кнопка обязана назвать.
    const short = first > 1 ? label : look === 'pill' || look === 'link' ? t('design.add') : t('design.toCartShort');
    const round = look === 'round' || look === 'roundLight';
    return (
      <button
        type="button"
        onClick={(event) => void add(event)}
        disabled={isPending}
        aria-label={round ? label : undefined}
        className={cn(
          'qo-hit flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap transition-[transform,background-color,opacity] duration-200',
          'active:scale-95 disabled:cursor-default disabled:opacity-60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          CART_LOOKS[look],
          className,
        )}
      >
        {look === 'link' || look === 'outline' ? null : (
          // Корзина, а не плюс (решение владельца 2026-10-30): сразу понятно, что кнопка кладёт в корзину.
          <ShoppingCart aria-hidden="true" className={round ? 'size-[1.125rem]' : 'size-[0.9375rem]'} />
        )}
        {round ? null : short}
      </button>
    );
  }

  return (
    <Button
      /*
        Цветом магазина и во всю ширину карточки, как в макете: «В корзину» —
        главное действие витрины, и найти его взглядом нужно в любой карточке
        сразу. Кладётся единица: нажавший ждёт, что позиция там окажется,
        дальше её набирают счётчиком, который встанет на это же место.
      */
      variant="accent"
      onClick={(event) => void add(event)}
      disabled={isPending}
      className={cn('w-full rounded-[var(--radius-tile)]', roomy ? 'h-13 text-lead' : 'h-12 text-base')}
    >
      <ShoppingCart aria-hidden="true" className="size-5" />
      {/* Минимум больше одной — кнопка говорит, сколько положит: «В корзину — 10 мешков». */}
      {label}
    </Button>
  );
}

/**
 * Кнопка «В корзину» в характере карточки шаблона — как в предпросмотре
 * продавца: круглый «+» у мягкой карточки, белый круг на снимке, рамка
 * у карточки «в рамке», сплошная заливка у ценника, тонкая рамка чертежа,
 * пилюля цвета магазина у парящей карточки и подчёркнутое слово у простой.
 */
export type CartLook = 'round' | 'roundLight' | 'outline' | 'solid' | 'drawing' | 'pill' | 'link' | 'glow' | 'jelly' | 'ghost';

const CART_LOOKS: Record<CartLook, string> = {
  round: 'size-9 rounded-[var(--radius-chip)] bg-accent text-on-accent hover:bg-accent-hover',
  roundLight: 'size-10 rounded-[var(--radius-chip)] bg-white text-on-white hover:bg-white/90',
  outline: 'h-[2.375rem] w-full rounded-[var(--radius-small)] border border-ink text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:bg-ink hover:text-surface',
  solid: 'h-[2.375rem] w-full rounded-[var(--radius-small)] bg-accent text-sm font-extrabold text-on-accent [text-transform:var(--heading-case)] hover:bg-accent-hover',
  drawing: 'h-[2.375rem] w-full rounded-[var(--radius-small)] border border-ink font-mono text-caption font-bold uppercase tracking-[0.06em] text-ink hover:bg-shop hover:text-on-shop hover:border-shop',
  // Заливка — цвет кнопки (`buttonColors`): у среднего тона бренда он темнее, иначе надпись не читается.
  pill: 'h-[2.375rem] rounded-full bg-accent px-4 text-caption font-semibold text-on-accent hover:bg-accent-hover',
  // Текст — чернилами, цвет магазина — подчёркиванием: светлый цвет (жёлтый мел, яркий зелёный) буквами не читается.
  link: 'h-auto border-b-[1.5px] border-accent pb-px text-caption font-semibold text-ink hover:text-accent',
  // Живые темы: свечение (Неон) — заливка днём, ночью рамка со свечением (`.qo-cta-glow` в index.css).
  glow: 'qo-cta-glow h-[2.375rem] rounded-[var(--radius-small)] bg-accent px-4 text-caption font-semibold text-on-accent',
  // Упругая (Капли, Леденец): крупная пилюля, сжимается пружиной при нажатии.
  jelly: 'qo-cta-jelly h-12 rounded-full bg-accent px-5 text-sm font-extrabold text-on-accent hover:bg-accent-hover',
  // Лукбук: маленькая залитая чернилами, подпись прописными.
  ghost: 'h-11 rounded-[min(var(--radius-small),4px)] bg-ink px-4 text-2xs font-medium uppercase tracking-[0.06em] text-surface hover:opacity-90',
};

/** Налог — мелкой строкой под ценой. «Цена на <дата>» убрана и из каталога (просьба владельца 2026-11-06). */
export function priceNote(item: ShowcaseItemDto, t: TFunction): string {
  const parts: string[] = [];
  if (item.vatRate !== undefined) {
    parts.push(t(item.vatIncluded ? 'catalog.priceNote.vatIncluded' : 'catalog.priceNote.vat', { rate: decimal(item.vatRate) }));
  }
  return parts.join(' · ');
}

/** Признаки товара, по которым ищут: «Хит продаж», «Новинка», «Акция», «Скидка» (опт дешевле розницы). */
export type Mark = 'hit' | 'novelty' | 'promo' | 'wholesaleDeal';

/**
 * Цвет и значок признака — одни на фильтры каталога и метки товаров (решение владельца 2026-10-28):
 * хит — янтарный, новинка — зелёная, акция — оранжевая, скидка на опт — синяя, как цена опта.
 * `tone` — светлая подложка с цветным текстом; `on` — залитый выбранный фильтр (тёмный тон с
 * текстом цвета подложки: контраст держится в обеих темах).
 */
export const MARK_LOOK: Record<Mark, { icon: IconComponent; tone: string; hover: string; on: string }> = {
  hit: { icon: Star, tone: 'border-hit-ink/25 bg-hit-soft text-hit-ink', hover: 'hover:border-hit-ink', on: 'border-hit-ink bg-hit-ink text-surface' },
  novelty: { icon: Sparkles, tone: 'border-ok-ink/25 bg-ok-soft text-ok-ink', hover: 'hover:border-ok-ink', on: 'border-ok-ink bg-ok-ink text-surface' },
  promo: { icon: Tag, tone: 'border-sale-ink/25 bg-sale-soft text-sale-ink', hover: 'hover:border-sale-ink', on: 'border-sale-ink bg-sale-ink text-surface' },
  wholesaleDeal: { icon: Package, tone: 'border-wholesale-ink/25 bg-wholesale-soft text-wholesale-ink', hover: 'hover:border-wholesale-ink', on: 'border-wholesale-ink bg-wholesale-ink text-surface' },
};


export function MarkIcon({ mark, className }: { mark: Mark; className?: string }) {
  const Icon = MARK_LOOK[mark].icon;
  return <Icon aria-hidden="true" className={cn('size-4 shrink-0', className)} />;
}

/** Метка признака на товаре — цветом и значком его фильтра. */
export function MarkBadge({ mark, className, children }: { mark: Mark; className?: string; children: React.ReactNode }) {
  return (
    <span data-testid={`mark-${mark}`} className={cn('gap-1 border', MARK_LOOK[mark].tone, className)}>
      <MarkIcon mark={mark} className="size-3.5" />
      {children}
    </span>
  );
}

/**
 * «Скидка» — опт дешевле розницы, тем же правилом, что фильтр (CatalogItemRepository.WHOLESALE_CHEAPER):
 * товар продаётся и штуками, и оптом, и лучшая ступень опта за единицу дешевле обычной розничной цены.
 */
export function isWholesaleDeal(item: Pick<ShowcaseItemDto, 'price'> & Partial<Pick<ShowcaseItemDto, 'oldPrice' | 'wholesale'>>): boolean {
  const wholesale = item.wholesale;
  if (!wholesale || !wholesale.retail || !(wholesale.packQty > 0) || wholesale.tiers.length === 0) return false;
  const best = Math.min(...wholesale.tiers.map((tier) => tier.price));
  return best / wholesale.packQty < (item.oldPrice ?? item.price);
}

/**
 * Товар глазами выбранной заявки (решение владельца 2026-11-06). У позиции «оптом и в розницу»
 * в «Оптом» — только опт, тем же видом, каким витрина отдаёт товар «только опт»
 * (`ShowcaseServiceImpl.toShowcaseItem`): цена первой ступени за оптовую единицу, минимум — первая
 * ступень, шаг — одна единица; в «В розницу» — только розница, без строки опта и «Скидки» на опт.
 * Только для показа: в корзину кладётся сама позиция, со своей заявкой.
 */
export function inMode<T extends ShowcaseItemDto>(item: T, mode: SaleMode | undefined): T {
  const wholesale = item.wholesale;
  if (!mode || !wholesale?.retail || item.yourPrice) return item;
  if (mode === 'RETAIL') return { ...item, wholesale: undefined };
  const first = wholesale.tiers[0];
  if (!first) return item;
  return {
    ...item,
    unit: wholesale.unit,
    price: first.price,
    oldPrice: first.oldPrice,
    discountPercent: first.oldPrice ? Math.round((1 - first.price / first.oldPrice) * 100) : undefined,
    terms: { ...item.terms, minQuantity: first.from, quantityStep: 1 },
    wholesale: { ...wholesale, retail: false },
  };
}

/**
 * Как продаётся позиция — метка на каждой плитке рядом с «Хит продаж» (решение владельца
 * 2026-10-28): без опта — «В розницу», опт без штук — «Оптом», иначе — «Оптом и в розницу».
 */
export function saleChannel(item: Partial<Pick<ShowcaseItemDto, 'wholesale'>>): 'retail' | 'wholesale' | 'both' {
  if (!item.wholesale) return 'retail';
  return item.wholesale.retail ? 'both' : 'wholesale';
}

/** Пилюля канала продажи — нейтральная: это условие покупки, а не выгода. */
export function SaleChannelBadge({ item, className }: { item: Partial<Pick<ShowcaseItemDto, 'wholesale'>>; className?: string }) {
  const { t } = useTranslation();
  return (
    <span data-testid="sale-channel" className={cn('bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline)]', className)}>
      {t(`catalog.badge.${saleChannel(item)}`)}
    </span>
  );
}

/**
 * Цвет крупной цены: у товара «только опт» это цена упаковки, а не штуки, и она выделена
 * цветом опта (`--color-wholesale`), чтобы её не приняли за розничную (решение владельца 2026-10-28).
 */
export function packPriceClass(item: Partial<Pick<ShowcaseItemDto, 'wholesale'>>): string {
  return saleChannel(item) === 'wholesale' ? 'text-wholesale' : 'text-ink';
}

/**
 * «за кг» у цены — а у товара, который продаётся и штуками, и оптом, «в розницу за кг»:
 * рядом стоит строка опта, и без слова неясно, какая из двух цен — розница.
 */
export function perUnitNote(item: Pick<ShowcaseItemDto, 'unit'> & Partial<Pick<ShowcaseItemDto, 'wholesale'>>, t: TFunction): string {
  return t(saleChannel(item) === 'both' ? 'catalog.priceNote.perUnitRetail' : 'catalog.priceNote.perUnit', { unit: unitPer(item.unit) });
}

/** Мелкая метка на снимке — плитка и карточка товара: сам товар должен быть виден (2026-10-30). */
export const TINY_BADGE = 'flex items-center rounded-[0.375rem] px-1.5 py-0.5 text-2xs font-bold leading-none';

/**
 * Метки на снимке: 21+, скидка, «Хит продаж», «Новинка».
 *
 * 21+ — первой: это не выгода, а условие, о котором человек должен узнать
 * до нажатия «В корзину». Метки ставит продавец; система их не выдумывает.
 *
 * `words` — одна метка словами, как в «Похожих товарах» макета карточки:
 * «Акция» / «Акция + новинка», иначе «Новинка», иначе «Хит продаж». На маленькой карточке
 * под чужим товаром процент — лишняя цифра рядом с ценой, которая и так
 * красная и со старой ценой; важно лишь, что тут выгодно или ново.
 * На витрине процент остаётся: там по нему выбирают.
 */
export function ItemBadges({
  item,
  className,
  words = false,
  belowDots = false,
}: {
  item: Pick<ShowcaseItemDto, 'discountPercent' | 'terms'> & Partial<Pick<ShowcaseItemDto, 'wholesale' | 'price' | 'oldPrice'>>;
  className?: string;
  words?: boolean;
  /** В плитке листаются снимки: точки слева сверху, наклейки — под ними. */
  belowDots?: boolean;
}) {
  const { t } = useTranslation();
  const terms = item.terms;
  const discount = item.discountPercent;
  const pill = 'flex h-[30px] items-center rounded-[var(--radius-pill)] px-3 text-caption font-extrabold';
  if (words) {
    if (!terms?.ageRestricted && !discount && !terms?.hit && !terms?.novelty) return null;
    // Одна метка по старшинству, как в «Похожих товарах» макета ClientProduct:
    // «Акция» / «Акция + новинка» → «Новинка» → «Хит продаж». Две-три пилюли
    // на узком снимке переносились бы и закрывали товар.
    const sale = !!item.discountPercent;
    const fresh = !!terms?.novelty;
    const kind = sale ? 'sale' : fresh ? 'new' : terms?.hit ? 'hit' : undefined;
    const label = kind === 'sale'
      ? (fresh ? t('catalog.badge.saleNew') : t('catalog.badge.sale'))
      : kind === 'new' ? t('catalog.badge.new') : kind === 'hit' ? t('catalog.badge.hit') : undefined;
    return (
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {/* 21+ — не выгода, а условие покупки: оно остаётся отдельной меткой. */}
        {terms?.ageRestricted && (
          <span className={cn(pill, 'bg-adult text-white')}>{t('catalog.badge.adult')}</span>
        )}
        {label && kind && (
          <span data-testid="promo-badge" className="contents">
            <MarkBadge mark={kind === 'sale' ? 'promo' : kind === 'new' ? 'novelty' : 'hit'} className={pill}>{label}</MarkBadge>
          </span>
        )}
      </div>
    );
  }
  // Мелко и по краям снимка (решение владельца 2026-10-30): сам товар должен быть виден.
  // Сверху слева — условие 21+ и наклейка «−N%»; снизу слева — признаки, под ними — как продаётся.
  const tiny = TINY_BADGE;
  const deal = 'price' in item && isWholesaleDeal(item as Pick<ShowcaseItemDto, 'price'>);
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)}>
      {(terms?.ageRestricted || discount) && (
        // Под точками снимков, когда они есть: угол слева сверху — их.
        <div className={cn('absolute left-2 flex gap-1', belowDots ? 'top-8' : 'top-2')}>
          {terms?.ageRestricted && <span className={cn(tiny, 'bg-adult text-white')}>{t('catalog.badge.adult')}</span>}
          {discount ? <span data-testid="discount-sticker" className={cn(tiny, 'bg-sale text-on-sale')}>−{discount}%</span> : null}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] flex-col items-start gap-0.5">
        {terms?.hit && <MarkBadge mark="hit" className={tiny}>{t('catalog.badge.hit')}</MarkBadge>}
        {deal && <WholesaleDealBadge item={item as Pick<ShowcaseItemDto, 'price'> & Partial<Pick<ShowcaseItemDto, 'oldPrice' | 'wholesale'>>} />}
        {terms?.novelty && <MarkBadge mark="novelty" className={tiny}>{t('catalog.badge.new')}</MarkBadge>}
        {discount ? <MarkBadge mark="promo" className={tiny}>{t('catalog.badge.sale')}</MarkBadge> : null}
        <SaleChannelBadge item={item} className={tiny} />
      </div>
    </div>
  );
}

/**
 * «Скидка» на снимке и рядом её размер — «−3%» красным, чуть крупнее метки (решение владельца 2026-10-30):
 * насколько опт за единицу дешевле розницы, считается сам из цен. Меньше процента — числа нет.
 */
export function WholesaleDealBadge({ item }: { item: Pick<ShowcaseItemDto, 'price'> & Partial<Pick<ShowcaseItemDto, 'oldPrice' | 'wholesale'>> }) {
  const { t } = useTranslation();
  // Тем же правилом, что сама метка (isWholesaleDeal): лучшая ступень опта за единицу против обычной розницы.
  const wholesale = item.wholesale;
  const retail = item.oldPrice ?? item.price;
  const best = wholesale && wholesale.packQty > 0 && wholesale.tiers.length > 0
    ? Math.min(...wholesale.tiers.map((tier) => tier.price)) / wholesale.packQty : retail;
  const percent = retail > 0 ? Math.round((1 - best / retail) * 100) : 0;
  return (
    <span className="flex items-center gap-1">
      <MarkBadge mark="wholesaleDeal" className={TINY_BADGE}>{t('catalog.marks.wholesaleDeal')}</MarkBadge>
      {percent >= 1 && (
        <span data-testid="deal-percent" className="rounded-[0.375rem] bg-surface/90 px-1 text-caption font-extrabold leading-tight text-sale">
          −{percent}%
        </span>
      )}
    </span>
  );
}

/**
 * Скидка в цене: старая — зачёркнута красной линией, под ней новая — зелёным (решение владельца
 * 2026-10-30). Распродажа — цена до и после; «Скидка» (опт дешевле розницы) — розница и цена
 * за единицу оптом. Пусто — скидки нет.
 */
export function dealOf(item: Pick<ShowcaseItemDto, 'price'> & Partial<Pick<ShowcaseItemDto, 'oldPrice' | 'wholesale'>>):
  { old: number; now: number; wholesale: boolean } | undefined {
  if (item.oldPrice !== undefined) return { old: item.oldPrice, now: item.price, wholesale: false };
  if (!isWholesaleDeal(item)) return undefined;
  const wholesale = item.wholesale!;
  const best = Math.min(...wholesale.tiers.map((tier) => tier.price)) / wholesale.packQty;
  return { old: item.price, now: Math.round(best * 100) / 100, wholesale: true };
}

export function DealPrice({ item, className, size = 'text-xl', oldSize = 'text-sm' }: {
  item: Pick<ShowcaseItemDto, 'price' | 'unit'> & Partial<Pick<ShowcaseItemDto, 'oldPrice' | 'wholesale'>>;
  className?: string;
  /** Кегль новой цены. */
  size?: string;
  /** Кегль старой, зачёркнутой. */
  oldSize?: string;
}) {
  const { t } = useTranslation();
  const currency = useSupplierCurrency();
  const deal = dealOf(item);
  if (!deal) return null;
  // Опт дешевле розницы — сначала цена оптом, под ней розница с подписью при ней самой
  // (просьба владельца 2026-11-06): прежде «в розницу за кг» стояла последней, отдельно от своей цены.
  if (deal.wholesale) {
    return (
      <span data-testid="deal-price" className={cn('flex flex-col', className)}>
        <span className={cn('whitespace-nowrap font-extrabold tracking-[-0.02em] tabular-nums text-ok-ink', size)}>
          {money(deal.now, currency)}
        </span>
        <span className="text-xs font-semibold text-ok-ink">
          {t('catalog.dealWholesale', { unit: unitPer(item.wholesale!.pieceUnit ?? item.unit) })}
        </span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <s className={cn('whitespace-nowrap font-semibold tabular-nums text-ink-muted decoration-sale decoration-2', oldSize)}>
            {money(deal.old, currency)}
          </s>
          <span className="text-xs font-semibold text-ink-muted">
            {t('catalog.priceNote.perUnitRetail', { unit: unitPer(item.unit) })}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span data-testid="deal-price" className={cn('flex flex-col', className)}>
      <s className={cn('whitespace-nowrap font-semibold tabular-nums text-ink-muted decoration-sale decoration-2', oldSize)}>
        {money(deal.old, currency)}
      </s>
      <span className={cn('whitespace-nowrap font-extrabold tracking-[-0.02em] tabular-nums text-ok-ink', size)}>
        {money(deal.now, currency)}
      </span>
      {deal.wholesale && (
        <span className="text-xs font-semibold text-ok-ink">
          {t('catalog.dealWholesale', { unit: unitPer(item.wholesale!.pieceUnit ?? item.unit) })}
        </span>
      )}
    </span>
  );
}

/**
 * Условия продажи строками под ценой: «Заказ от 10 мешков», «Продаём по 6
 * бутылок», «Продаём с 21 года». Пусто — строк нет: придумывать факты о товаре
 * витрина не вправе.
 */
export function ItemFacts({
  item,
  pills = false,
  inline = false,
}: {
  item: Pick<ShowcaseItemDto, 'unit' | 'terms'>;
  /** Пилюлями в строку — рядом с наличием в карточке товара. */
  pills?: boolean;
  /** Одной строкой через «·» — в плитке витрины: факты не растят карточку выше соседей. */
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const terms = item.terms;
  const facts: { key: string; text: string; warn?: boolean }[] = [];
  // «Продаётся поштучно» — только в карточке товара: в строке витрины это
  // повторялось бы у каждой позиции и заслоняло бы редкое и важное —
  // минимум, кратность и 21+.
  const soldBy = pills ? soldByOf(item.unit, terms, t).pill : undefined;
  if (soldBy) facts.push({ key: 'soldBy', text: soldBy });
  if (terms?.minQuantity && terms.minQuantity > 1) {
    facts.push({ key: 'min', text: t('catalog.facts.min', { amount: quantityWithUnit(terms.minQuantity, item.unit) }) });
  }
  if (terms?.quantityStep && terms.quantityStep > 1) {
    facts.push({ key: 'step', text: t('catalog.facts.step', { amount: quantityWithUnit(terms.quantityStep, item.unit) }) });
  }
  if (terms?.ageRestricted) facts.push({ key: 'adult', text: t('catalog.facts.adult'), warn: true });
  if (facts.length === 0) return null;
  if (pills) {
    return (
      <>
        {facts.map((fact) => (
          <span
            key={fact.key}
            className={cn(
              'flex min-h-[34px] items-center rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-semibold leading-[1.3]',
              fact.warn ? 'bg-adult/10 text-adult' : 'bg-surface text-ink-muted shadow-[0_0_0_1px_var(--color-hairline)]',
            )}
          >
            {fact.text}
          </span>
        ))}
      </>
    );
  }
  if (inline) {
    return (
      <p className="m-0 truncate text-caption leading-snug text-ink-muted" title={facts.map((fact) => fact.text).join(' · ')}>
        {facts.map((fact, index) => (
          <span key={fact.key} className={cn(fact.warn && 'font-semibold text-adult')}>
            {index > 0 ? ' · ' : null}
            {fact.text}
          </span>
        ))}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {facts.map((fact) => (
        <li
          key={fact.key}
          className={cn('text-caption leading-snug', fact.warn ? 'font-semibold text-adult' : 'text-ink-muted')}
        >
          {fact.text}
        </li>
      ))}
    </ul>
  );
}


/**
 * Оценка товара на плитке: звезда, число с одним знаком и «(N)» — сколько
 * отзывов. Как в «Похожих товарах» карточки и в макете канвы.
 *
 * Без оценки не рисуется ничего: «0» или пять пустых звёзд читались бы
 * как плохая оценка, а не как её отсутствие. Экранному диктору — одна
 * фраза целиком («Оценка 4,7 из 5, 3 отзыва»), а не «звезда, 4,7, скобка».
 */
export function RatingBadge({
  rating,
  reviewCount,
  className,
}: {
  rating?: number | null;
  reviewCount?: number | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (rating == null) return null;

  const value = rating.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const label = reviewCount != null
    ? t('item.ratingLabel', { rating: value, count: reviewCount })
    : t('item.ratingOnly', { rating: value });

  return (
    <span
      role="img"
      aria-label={label}
      data-testid="rating-badge"
      className={cn('inline-flex items-center gap-1 text-caption leading-none text-ink-muted tabular-nums', className)}
    >
      <Star aria-hidden="true" className="size-3.5 shrink-0 fill-star text-star" />
      <span className="font-semibold">{value}</span>
      {reviewCount != null && <span>({reviewCount.toLocaleString(intlLocale())})</span>}
    </span>
  );
}
