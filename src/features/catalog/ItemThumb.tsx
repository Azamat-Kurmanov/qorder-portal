import { cn } from '../../ui/cn';
import { useTranslation } from 'react-i18next';

/**
 * Тёплые пары для заполнителя.
 *
 * Единственные сырые цвета в кабинете — и умышленно не токены: токен объявляет
 * смысл («в наличии», «чернила», «акцент»), а здесь смысла нет, это заглушка
 * на месте снимка. Завести их палитрой значило бы объявить семью цветов,
 * которой в системе не существует, и однажды покрасить ими что-то живое.
 * Взяты прямо из макета — там все снимки нарисованы такими градиентами.
 */
const PLACEHOLDERS: readonly (readonly [string, string])[] = [
  ['#D9D2C6', '#B9AE9C'],
  ['#E7DFCF', '#CBBFA6'],
  ['#DCD3C2', '#A8997F'],
  ['#DED6C8', '#B3A793'],
  ['#D8D8D2', '#A5A59C'],
  ['#E2DACB', '#BDB09A'],
  ['#D5DCD8', '#9FB0A8'],
];

/**
 * Заполнитель выбирается по идентификатору, а не случайно.
 *
 * Случайный менялся бы на каждый ответ сервера — от поиска, от переключения
 * рубрики, от нажатия на сердечко, — и список мигал бы разными пятнами под
 * пальцем. Сумма кодов достаточна: нужен постоянный выбор из семи, а не
 * равномерное распределение.
 */
function placeholderOf(itemId: string): readonly [string, string] {
  let sum = 0;
  for (let index = 0; index < itemId.length; index += 1) sum += itemId.charCodeAt(index);
  return PLACEHOLDERS[sum % PLACEHOLDERS.length];
}

/**
 * Слот под снимок позиции.
 *
 * Витрина снимков не отдаёт: в строке приходит всё, кроме картинки, а тянуть
 * карточку ради каждой строки — полсотни запросов на один экран. Пока поля
 * нет, слот занят градиентом; `src` — то самое место, куда подставится
 * настоящий адрес, когда сервер заведёт поле, и остальной витрине про эту
 * замену знать не придётся.
 *
 * Сам снимок для экранного диктора пуст: он ничего не сообщает сверх имени,
 * которое стоит рядом, а озвученное «изображение» на каждой из пятидесяти
 * строк только удлиняет путь к цене. Метка ролика — сообщает, и потому
 * остаётся словом.
 */
export function ItemThumb({
  itemId,
  src,
  video = false,
  className,
}: {
  itemId: string;
  src?: string;
  video?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [from, to] = placeholderOf(itemId);

  return (
    <div
      data-testid="item-thumb"
      style={src ? undefined : { backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 100%)` }}
      className={cn('relative shrink-0 overflow-hidden bg-sunk', className)}
    >
      {src && <img src={src} alt="" className="size-full object-cover" />}

      {/*
        Метка ролика: видео в карточке смотрят до заказа, и знать о нём с
        витрины — повод открыть карточку. Признак приходит отдельным полем,
        потому что строка витрины о медиа не сообщает вовсе.
      */}
      {video && (
        <span
          className={cn(
            'absolute bottom-2 left-2 inline-flex h-6 items-center gap-1.5 rounded-full',
            'bg-ink/70 px-2 text-[11px] text-white',
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-[11px]">
            <path d="M2.5 4.5h7v7h-7z" stroke="currentColor" strokeWidth="1.4" />
            <path d="m9.5 8 4-2.2v4.4L9.5 8Z" fill="currentColor" />
          </svg>
          {t('catalog.video')}
        </span>
      )}
    </div>
  );
}
