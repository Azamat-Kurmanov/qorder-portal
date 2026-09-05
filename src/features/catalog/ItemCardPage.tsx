import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGetPortalCatalogItem } from '../../api/generated';
import { CartBar } from '../cart/CartBar';
import { QuantityField } from '../cart/QuantityField';
import { cartOf, useCart, useSetCartLine } from '../cart/useCart';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { ReviewsBlock } from '../reviews/ReviewsBlock';
import { Stars } from '../reviews/Stars';
import { AskQuestionForm } from '../questions/AskQuestionForm';
import { MediaGallery } from './MediaGallery';
import { StockNote } from './StockNote';
import { money, shortDate, tenge } from '../../shared/format';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * Карточка товара: то, за чем сюда приходят с витрины.
 *
 * Открывается по желанию, а не на пути к корзине: закупщик, который знает,
 * что берёт, набирает количество прямо в строке витрины и карточку не видит
 * никогда. Сюда идут за снимками, характеристиками и чужим мнением — и здесь
 * же кладут в корзину, чтобы не возвращаться назад ради одного касания.
 *
 * На телефоне карточка сложена как страница товара, а не как строка кабинета:
 * снимок во всю ширину, а на него снизу наезжает белый лист с решением —
 * цена, наличие, количество и корзина. Наезд не украшение: он говорит, что
 * лист прокручивается поверх снимка, и первым экраном человек получает всё,
 * ради чего открывал.
 *
 * На мониторе тот же порядок разложен в две колонки: снимки слева, решение
 * справа и целиком в поле зрения — без прокрутки к цене.
 */
export function ItemCardPage() {
  const { itemId = '' } = useParams();
  const card = useGetPortalCatalogItem(itemId);
  const cart = cartOf(useCart().data);
  const setLine = useSetCartLine();

  if (card.isPending) {
    return (
      <div
        data-testid="card-skeleton"
        className="h-64 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk"
      />
    );
  }

  if (card.data?.status !== 200) {
    return (
      <div className="flex flex-col items-start gap-4 py-12">
        <p className="text-ink-subtle">
          Позиция не открывается. Возможно, поставщик снял её с продажи.
        </p>
        <Link
          to="/catalog"
          className="inline-flex h-11 items-center gap-2 text-sm font-medium text-ink-muted transition-all duration-300 hover:text-ink active:scale-95"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          В каталог
        </Link>
      </div>
    );
  }

  const item = card.data.data;

  // Условия, при которых цена верна, — отдельной мелкой строкой под ценой.
  // Требование о полноте торговой информации от размера шрифта не зависит:
  // строка не исчезает, а только уступает первый взгляд самой цене.
  const terms = [
    item.vatRate != null ? `в том числе НДС ${money(item.vatRate)}%` : undefined,
    item.priceAsOf ? `цена на ${shortDate(item.priceAsOf)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const ordered = cart?.lines.find((line) => line.itemId === item.id)?.quantity ?? 0;

  // Нетронутый счётчик — это не «ноль тенге»: пришедший за одним мешком
  // прочитал бы «В корзину · 0 ₸» как поломку, а не как приглашение набрать
  // количество. Поэтому кнопка считает по одной единице, пока не набрано
  // больше, и столько же кладёт в корзину.
  const wanted = Math.max(ordered, 1);

  // Подложка пилюли — единственное, что решается здесь; чем «наличие
  // уточняется» отличается от «нет в наличии», знает StockNote, и слова
  // остаются за ним. Подложка при этом не бывает нейтральной: пилюля без
  // цвета читалась бы подтверждением наличия у всех трёх состояний.
  const stockTint = (item.available != null ? item.available > 0 : item.stock === 'IN_STOCK')
    ? 'bg-in-stock/10'
    : item.stock === 'UNKNOWN'
      ? 'bg-unclear/10'
      : 'bg-canvas';
  const stockKnown = item.available != null || item.stock != null;

  return (
    <div className="lg:pb-28">
      {/*
        Путь обратно на мониторе — строкой над карточкой: кружок поверх снимка
        там незачем, мышь достаёт любой угол одинаково. Назван он «Каталогом»,
        а не «В каталог»: это место, где человек был, а не действие.
      */}
      <Link
        to="/catalog"
        className="mb-4 hidden h-11 items-center gap-2 text-sm text-ink-muted transition-all duration-300 hover:text-ink lg:inline-flex"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Каталог
      </Link>

      <div className="lg:grid lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:items-start lg:gap-7">
        {/*
          Отрицательные поля гасят отступы оболочки: на телефоне снимок идёт
          от края до края, иначе он читался бы картинкой внутри карточки,
          а не подложкой страницы. На мониторе гасить нечего — там галерея
          стоит колонкой со своими скруглениями.
        */}
        <div className="-mx-4 -mt-4 lg:mx-0 lg:mt-0">
          <MediaGallery
            media={item.media}
            itemName={item.name}
            topLeft={<BackCircle />}
            topRight={(
              <FavoriteButton
                itemId={item.id}
                favorite={item.favorite}
                // На снимке кнопка держится полупрозрачной подложкой, а не
                // рамкой: рамка на светлом кадре пропадает, а на тёмном
                // выглядит вырезанной дырой.
                className="border-transparent bg-surface/85 backdrop-blur"
              />
            )}
          />
        </div>

        <div
          className={cn(
            // Лист наезжает на снимок на те же 20 точек, на которые скруглён:
            // скругление без наезда выглядело бы обрезанным углом. Низ листа
            // уходит под липкую панель итога — белое обязано доходить
            // до края экрана, иначе под отзывами повиснет полоса основания.
            'relative z-10 -mx-4 -mt-5 flex flex-col gap-4 rounded-t-[20px] bg-surface px-4 pb-28 pt-5',
            'lg:mx-0 lg:mt-0 lg:gap-[18px] lg:rounded-none lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0',
          )}
        >
          <div className="flex flex-col gap-2">
            <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-ink lg:text-[28px]">
              {item.name}
            </h1>

            {/*
              Сравнение с null обязательно: незаполненную оценку сервер
              присылает значением null, а не отсутствием ключа, и проверка
              на одно лишь undefined роняла бы карточку целиком.
            */}
            {item.rating != null && (
              <span
                data-testid="item-rating"
                className="inline-flex items-center gap-2 text-sm text-ink-muted"
              >
                <Stars value={item.rating} />
                {/*
                  Число отзывов стоит рядом с оценкой всегда: 4,5 по двум
                  отзывам и 4,5 по двум сотням — разные утверждения.
                */}
                {item.rating.toLocaleString('ru-KZ', { maximumFractionDigits: 1 })}
                {item.reviewCount != null && ` · отзывов: ${item.reviewCount}`}
              </span>
            )}

            {/*
              Цена и единица — одной строкой на общей базовой линии: «2 500 ₸»
              без «за мешок» ничего не значит там, где рядом лежит цена
              за тонну. Цифры табличные, чтобы цена не дёргалась, когда
              её пересчитают.
            */}
            <div data-testid="item-price" className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-2xl font-bold tabular-nums tracking-[-0.02em] text-ink lg:text-[32px]">
                {tenge(item.price)}
              </span>
              <span className="text-[13px] text-ink-muted lg:text-sm">за {item.unit}</span>
            </div>

            {terms && <p className="text-xs text-ink-subtle">{terms}</p>}

            {stockKnown && (
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span
                  data-testid="stock-pill"
                  className={cn(
                    // Отступ сверху снимается у самого StockNote: он рассчитан
                    // на строку под ценой, а внутри пилюли сбивал бы её
                    // содержимое вниз.
                    'inline-flex h-7 items-center rounded-full px-2.5 [&>span]:mt-0',
                    stockTint,
                  )}
                >
                  <StockNote stock={item.stock} available={item.available} />
                </span>
              </div>
            )}
          </div>

          {/*
            Счётчик и корзина — одной строкой: это одно действие, разделённое
            на «сколько» и «беру», и разнесённые по разным местам они заставили бы
            искать вторую половину.
          */}
          <div className="flex items-center gap-2">
            <QuantityField itemId={item.id} unit={item.unit} />
            <Button
              size="lg"
              // Поля кнопки на телефоне уже обычных: рядом стоит счётчик,
              // и сумма в шесть цифр иначе выезжает за край экрана.
              className="min-w-0 flex-1 px-4 text-[15px] lg:flex-none lg:px-7"
              onClick={() => setLine.mutate({ itemId: item.id, data: { quantity: wanted } })}
            >
              {/*
                Сумма прямо на кнопке: человек видит, во что обойдётся набранное,
                до нажатия, а не на следующем экране — и не отменяет заявку,
                удивившись итогу.
              */}
              В корзину · {tenge(item.price * wanted)}
            </Button>
          </div>

          {item.description && (
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-muted lg:text-sm">
              {item.description}
            </p>
          )}

          {item.attributes.length > 0 && (
            <section aria-labelledby="attributes-heading" className="flex flex-col gap-2">
              <h2 id="attributes-heading" className="text-base font-semibold text-ink">
                Характеристики
              </h2>
              {/*
                Список описаний, а не таблица: свойств у позиции от двух
                до двадцати, и таблица из двух строк выглядит поломкой вёрстки.
              */}
              <dl className="divide-y divide-hairline overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface">
                {item.attributes.map((attribute) => (
                  <div key={attribute.name} className="flex gap-4 px-4 py-2.5">
                    <dt className="w-2/5 shrink-0 text-sm text-ink-subtle">{attribute.name}</dt>
                    <dd className="text-sm text-ink">{attribute.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/*
            Вопрос о товаре задаётся отсюда и уезжает в отдельную вкладку
            переписки: менеджер увидит его вместе с названием позиции,
            а карточка не превратится в чат.

            Форма разворачивается по нажатию — это собственное поведение
            AskQuestionForm. Снаружи задан только рост и ширина кнопки:
            в макете это полоса во всю колонку под описанием, а не короткая
            кнопка у левого края. Задано снаружи, потому что сам файл формы
            принадлежит другой задаче.
          */}
          <div className="[&>button]:h-12 [&>button]:w-full [&>button]:rounded-[var(--radius-card)] lg:[&>button]:w-auto">
            <AskQuestionForm itemId={item.id} itemName={item.name} />
          </div>

          {/*
            На мониторе отзывы встают в две колонки: колонка решения шире
            шестисот точек, и отзыв в одну строку тянулся бы через весь экран,
            теряя строку при переносе взгляда. Правится снаружи, а не в самом
            ReviewsBlock: файл принадлежит другой задаче.
          */}
          <div className="border-t border-hairline pt-3.5 lg:[&_ul]:grid lg:[&_ul]:grid-cols-2 lg:[&_ul]:gap-3">
            <ReviewsBlock itemId={item.id} canReview={item.canReview} />
          </div>
        </div>
      </div>

      <CartBar />
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
  return (
    <Link
      to="/catalog"
      aria-label="В каталог"
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full',
        'bg-surface/85 text-ink backdrop-blur',
        'transition-all duration-300 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        // На мониторе путь обратно стоит строкой над карточкой.
        'lg:hidden',
      )}
    >
      <ArrowLeft className="size-[18px]" aria-hidden="true" />
    </Link>
  );
}
