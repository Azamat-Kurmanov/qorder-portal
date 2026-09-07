import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
 * Кончается эта раскладка на 768 точках, а не на 1024, как остальная
 * оболочка, и порог здесь свой намеренно. Снимок во всю ширину и кнопка
 * «В корзину» во всю ширину — приём для ладони; на планшете в книжной
 * ориентации та же кнопка тянется на восемьсот точек и читается не как
 * решение, а как случайность вёрстки. Оболочке при этом ломаться незачем:
 * рельс разделов на планшете и правда не помещается.
 *
 * На мониторе порядок тот же — снимок сверху, решение под ним, — и колонка
 * одна. Двух колонок здесь не было ни дня без последствий: снимок кончался
 * на восьмистах точках, а описание, характеристики и отзывы продолжались
 * ещё на полторы тысячи, и слева под галереей висел пустой столб во весь
 * рост страницы. Текст при этом сидел в половине ширины — он не «стоял
 * рядом со снимком», он был им отжат вправо.
 *
 * Ширина колонки ограничена: строка в тысячу двести точек теряется при
 * переносе взгляда, а снимок, растянутый на всю витрину, перестаёт быть
 * снимком товара и становится баннером.
 */
export function ItemCardPage() {
  const { t } = useTranslation();
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

  const item = card.data.data;

  // Условия, при которых цена верна, — отдельной мелкой строкой под ценой.
  // Требование о полноте торговой информации от размера шрифта не зависит:
  // строка не исчезает, а только уступает первый взгляд самой цене.
  const terms = [
    item.vatRate != null ? t('catalog.vat', { rate: money(item.vatRate) }) : undefined,
    item.priceAsOf ? t('catalog.asOf', { date: shortDate(item.priceAsOf) }) : undefined,
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
    /*
      Одна колонка на весь монитор, и вместе с ней — путь обратно: ссылка
      «Каталог» стоит над снимком и обязана начинаться с того же края.
      Отдельно от карточки она уезжала бы к левому краю витрины, и колонка
      читалась бы не как страница товара, а как блок, забытый посередине.
    */
    <div className="md:mx-auto md:w-full md:max-w-[720px] md:pb-28">
      {/*
        Путь обратно на мониторе — строкой над карточкой: кружок поверх снимка
        там незачем, мышь достаёт любой угол одинаково. Назван он «Каталогом»,
        а не «В каталог»: это место, где человек был, а не действие.
      */}
      <Link
        to="/catalog"
        className="mb-4 hidden h-11 items-center gap-2 text-sm text-ink-muted transition-all duration-300 hover:text-ink md:inline-flex"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('catalog.title')}
      </Link>

      <div className="md:flex md:flex-col md:gap-6">
        {/*
          Отрицательные поля гасят отступы оболочки: на телефоне снимок идёт
          от края до края, иначе он читался бы картинкой внутри карточки,
          а не подложкой страницы. На мониторе гасить нечего — там галерея
          стоит первой строкой колонки, со своими скруглениями.
        */}
        <div className="-mx-4 -mt-4 md:mx-0 md:mt-0">
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
            'md:mx-0 md:mt-0 md:gap-[18px] md:rounded-none md:bg-transparent md:px-0 md:pb-0 md:pt-0',
          )}
        >
          <div className="flex flex-col gap-2">
            <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-ink md:text-[28px]">
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
              <span className="text-2xl font-bold tabular-nums tracking-[-0.02em] text-ink md:text-[32px]">
                {tenge(item.price)}
              </span>
              <span className="text-[13px] text-ink-muted md:text-sm">за {item.unit}</span>
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
              className="min-w-0 flex-1 px-4 text-[15px] md:flex-none md:px-7"
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
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-muted md:text-sm">
              {item.description}
            </p>
          )}

          {item.attributes.length > 0 && (
            <section aria-labelledby="attributes-heading" className="flex flex-col gap-2">
              <h2 id="attributes-heading" className="text-base font-semibold text-ink">
                {t('catalog.attributes')}
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
          <div className="[&>button]:h-12 [&>button]:w-full [&>button]:rounded-[var(--radius-card)] md:[&>button]:w-auto">
            <AskQuestionForm itemId={item.id} itemName={item.name} />
          </div>

          {/*
            Отзывы встают в две колонки, когда колонка витрины это позволяет:
            отзыв — это две-три строки, и в один столбец они выстраиваются
            лестницей из огрызков, между которыми больше пустоты, чем текста.

            Считается ширина самого блока, а не окна. Окно здесь не отвечает
            ни за что: на планшете в 1024 точки колонка витрины остаётся
            в четыреста пятьдесят — рельс разделов забирает 232, панель
            корзины 340, — и правило «широкое окно, значит два столбца»
            резало отзыв на четыре строки в полосе шириной в двести точек.
            Ту же колонку меняет и складывание рельса, которого окно не видит
            вовсе.

            Порог — 520 точек: два столбца по 250 с промежутком между ними.
            Уже этого отзыв рвётся по слову, шире — начинает пустовать: строка
            в полтысячи точек под фразой «цена как договаривались» и есть та
            самая пустота, ради избавления от которой столбца два.

            Правится снаружи, а не в самом ReviewsBlock: файл принадлежит
            другой задаче.
          */}
          <div className="@container border-t border-hairline pt-3.5">
            <div className="@[520px]:[&_ul]:grid @[520px]:[&_ul]:grid-cols-2 @[520px]:[&_ul]:gap-3">
              <ReviewsBlock itemId={item.id} canReview={item.canReview} />
            </div>
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
