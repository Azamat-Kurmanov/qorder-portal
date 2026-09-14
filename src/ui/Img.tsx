import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { cn } from './cn';

/**
 * Снимок, который проявляется, а не выскакивает.
 *
 * Картинка, дошедшая по мобильной сети, встаёт на место мгновенным скачком —
 * и на витрине из полусотни строк эти скачки идут вразнобой, пока человек
 * читает. Плавное проявление за треть секунды превращает их в приход
 * содержимого, а не в дёрганье списка.
 *
 * Пока снимок не дошёл, под ним видна подложка того, кто его поставил
 * (заполнитель в `ItemThumb`, поверхность в галерее): картинка прозрачна,
 * а не отсутствует, и место под неё уже занято — список не прыгнет.
 *
 * `loading="lazy"` и `decoding="async"` — про ту же мобильную сеть: полсотни
 * снимков, затребованных разом, кладут первый экран целиком.
 */
export function Img({ className, onLoad, ...props }: ComponentProps<'img'>) {
  const [shown, setShown] = useState(false);
  const image = useRef<HTMLImageElement | null>(null);

  /*
   * Снимок из кеша успевает загрузиться ДО того, как React повесит
   * обработчик, и события `load` тогда не будет вовсе — картинка осталась бы
   * прозрачной навсегда. Отсюда проверка `complete` сразу после установки
   * узла: она ловит ровно этот случай, самый частый при возврате на витрину.
   */
  useEffect(() => {
    if (image.current?.complete) setShown(true);
  }, [props.src]);

  return (
    <img
      ref={image}
      loading="lazy"
      decoding="async"
      onLoad={(event) => {
        setShown(true);
        onLoad?.(event);
      }}
      className={cn(
        'transition-opacity duration-500 ease-out',
        shown ? 'opacity-100' : 'opacity-0',
        className,
      )}
      {...props}
    />
  );
}
