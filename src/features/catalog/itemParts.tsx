import { useTranslation } from 'react-i18next';
import { Plus, Star } from '../../ui/icons';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import type { ShowcaseItemDto } from '../../api/generated';
import { QuantityField } from '../cart/QuantityField';
import { useAddToCart } from '../cart/ageGate';
import { packsOnly } from '../cart/wholesale';
import { firstQuantity, stepOf } from '../cart/saleTerms';
import { quantityWithUnit } from '../../shared/units';
import { soldByOf } from './soldBy';
import { decimal, shortDate } from '../../shared/format';
import { Button } from '../../ui/Button';
import { flyToCart } from '../../ui/flyToCart';
import { cn } from '../../ui/cn';
import { intlLocale } from '../../i18n';

/*
 * Части карточки товара, общие у прежней плитки, строки таблицы и плиток
 * шаблонов (`tiles/TemplateTile.tsx`): открыть карточку нажатием, положить
 * в корзину, метки на снимке и условия продажи.
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
          <Plus aria-hidden="true" className={round ? 'size-[1.125rem]' : 'size-[0.9375rem]'} strokeWidth={2.4} />
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
      <Plus aria-hidden="true" className="size-5" strokeWidth={2.4} />
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
  roundLight: 'size-10 rounded-[var(--radius-chip)] bg-white text-[#16171A] hover:bg-white/90',
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

/**
 * Налог и дата — мелкой строкой под ценой.
 *
 * Дата актуальности остаётся, хотя в макете её нет: требование о полноте
 * торговой информации действует на витрине раньше, чем на оформлении, и цена
 * без даты превращается в бессрочное обещание.
 */
export function priceNote(item: ShowcaseItemDto, t: TFunction): string {
  const parts: string[] = [];
  if (item.vatRate !== undefined) {
    parts.push(t(item.vatIncluded ? 'catalog.priceNote.vatIncluded' : 'catalog.priceNote.vat', { rate: decimal(item.vatRate) }));
  }
  if (item.priceAsOf) {
    parts.push(t('catalog.priceNote.asOf', { date: shortDate(item.priceAsOf) }));
  }
  return parts.join(' · ');
}

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
  hideDiscount = false,
}: {
  item: Pick<ShowcaseItemDto, 'discountPercent' | 'terms'>;
  className?: string;
  words?: boolean;
  /** Без метки скидки: плитка шаблона рисует скидку своей наклейкой. */
  hideDiscount?: boolean;
}) {
  const { t } = useTranslation();
  const terms = item.terms;
  const discount = hideDiscount ? undefined : item.discountPercent;
  if (!terms?.ageRestricted && !discount && !terms?.hit && !terms?.novelty) return null;
  const pill = 'flex h-[30px] items-center rounded-[var(--radius-pill)] px-3 text-caption font-extrabold';
  if (words) {
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
        {label && (
          <span
            data-testid="promo-badge"
            className={cn(
              pill,
              kind === 'sale' ? 'bg-sale text-white'
                : kind === 'hit' ? 'bg-night text-white'
                  : 'bg-surface text-ok-ink shadow-[0_0_0_1px_var(--color-hairline)]',
            )}
          >
            {label}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {terms?.ageRestricted && (
        <span className={cn(pill, 'bg-adult text-white')}>{t('catalog.badge.adult')}</span>
      )}
      {discount ? (
        <span className={cn(pill, 'bg-sale text-white')}>−{discount}%</span>
      ) : null}
      {terms?.hit && <span className={cn(pill, 'bg-night text-white')}>{t('catalog.badge.hit')}</span>}
      {terms?.novelty && (
        <span className={cn(pill, 'bg-surface text-ok-ink shadow-[0_0_0_1px_var(--color-hairline)]')}>
          {t('catalog.badge.new')}
        </span>
      )}
    </div>
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
}: {
  item: Pick<ShowcaseItemDto, 'unit' | 'terms'>;
  /** Пилюлями в строку — рядом с наличием в карточке товара. */
  pills?: boolean;
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
      <Star aria-hidden="true" className="size-3.5 shrink-0 fill-[#D97706] text-[#D97706]" />
      <span className="font-semibold">{value}</span>
      {reviewCount != null && <span>({reviewCount.toLocaleString(intlLocale())})</span>}
    </span>
  );
}
