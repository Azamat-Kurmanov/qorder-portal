import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../ui/cn';
import { Img } from '../../ui/Img';
import { placeholderOf } from '../../ui/thumbPlaceholder';

/**
 * Миниатюра позиции: главный снимок товара или заполнитель на его месте.
 *
 * Одна на все строки кабинета — корзину, сверку при оформлении, заявки,
 * избранное: по картинке человек узнаёт, что заказал, быстрее, чем
 * по названию, и узнавать он должен одно и то же во всех местах.
 *
 * Место под снимок занято всегда, даже когда снимка нет: строки с картинкой
 * и без неё расходились бы по высоте — список прыгал бы на каждой позиции.
 * Снимок, который не загрузился (ссылка протухла, чужое хранилище закрыло
 * доступ), возвращает заполнитель: разбитая иконка браузера на месте товара
 * хуже честного пятна.
 *
 * Заливка выбирается по самой позиции, а не наугад: случайная менялась бы
 * на каждой перерисовке, и один и тот же цемент выглядел бы каждый раз
 * другим товаром.
 *
 * Снимок для диктора пуст: название стоит рядом, и «изображение» на каждой
 * строке только удлиняло бы путь к цене.
 */
export function LineThumb({ seed, src, className }: { seed: string; src?: string; className?: string }) {
  const [from, to] = placeholderOf(seed);
  // Запоминается адрес, а не флаг: пришёл новый снимок — пробуем его заново.
  const [broken, setBroken] = useState<string>();

  if (src && src !== broken) {
    return (
      <div
        aria-hidden="true"
        data-testid="line-thumb"
        // Настоящий снимок ночью не притемняется: это товар, а не пятно.
        className={cn('size-11 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-sunk', className)}
      >
        <Img
          src={src}
          alt=""
          data-testid="line-thumb-photo"
          onError={() => setBroken(src)}
          className="size-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid="line-thumb"
      // Ночью светлый бежевый заполнитель светил бы пятном — он приглушается.
      className={cn('size-11 shrink-0 rounded-[var(--radius-control)] dark:brightness-50', className)}
      style={{ backgroundImage: `linear-gradient(150deg, ${from}, ${to})` }}
    />
  );
}

/**
 * Миниатюра, которая открывает карточку товара.
 *
 * Для строк, где позиция может быть недоступна: у заявок и избранного.
 * Без `itemId` (позиции больше нет в каталоге) или с `linked={false}`
 * это просто картинка — ссылка в пустоту хуже её отсутствия.
 *
 * `label` — когда рядом нет другой ссылки на товар (строки заявок):
 * тогда миниатюра и есть путь к карточке, и диктор называет его словами.
 * Без `label` ссылка дублирует соседнюю (название в избранном) и убрана
 * из обхода клавиатурой и из дерева доступности — два одинаковых пути
 * подряд только удлиняют список.
 */
export function LinkedLineThumb({ itemId, seed, src, label, linked = true, className }: {
  itemId?: string;
  seed: string;
  src?: string;
  label?: string;
  linked?: boolean;
  className?: string;
}) {
  const thumb = <LineThumb seed={seed} src={src} className={className} />;
  if (!itemId || !linked) return thumb;

  return (
    <Link
      to={`/catalog/${itemId}`}
      {...(label ? { 'aria-label': label } : { 'aria-hidden': true, tabIndex: -1 })}
      className={cn(
        'shrink-0 rounded-[var(--radius-control)] transition-opacity duration-200 hover:opacity-85',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      )}
    >
      {thumb}
    </Link>
  );
}
