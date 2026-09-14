import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALargeSmall, Check } from 'lucide-react';
import {
  FONT_SCALES,
  applyFontScale,
  currentFontScale,
  rememberFontScale,
  type FontScale,
} from '../../ui/fontScale';
import { cn } from '../../ui/cn';

/**
 * Размер интерфейса — три ступени.
 *
 * Стоит рядом с языком и по той же причине: это две настройки того, как
 * кабинет ЧИТАЕТСЯ, и человек, который ищет одну, находит вторую. На мониторе
 * обе живут в шапке, на телефоне — первой строкой выдвижного меню, где
 * ширину у них никто не оспаривает.
 *
 * Ступень меняет размер шрифта корня страницы, поэтому растут не одни буквы,
 * а весь кабинет — кнопки, поля, промежутки. Обратное («увеличить только
 * текст») было бы хуже, чем ничего: крупные буквы в прежних тесных кнопках
 * читаются легче, а попадают по ним хуже.
 *
 * Ступени названы словами, а не процентами и не размером в точках: «120 %»
 * ничего не говорит тому, кто пришёл сюда потому, что плохо видит.
 *
 * Выбор запоминается и применяется до первой отрисовки следующего захода —
 * скриптом в `index.html`. Здесь же он применяется сразу, без перезагрузки.
 */
export function FontScalePicker({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [scale, setScale] = useState<FontScale>(currentFontScale);
  const holder = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  /*
   * Меню закрывается тремя способами — выбором, Escape и нажатием мимо.
   * Escape обязателен: список лежит поверх содержимого, и без него у
   * клавиатуры не остаётся способа вернуться назад. Фокус после закрытия
   * возвращается на кнопку, иначе следующий таб начинает обход кабинета
   * заново. Тот же приём, что у меню рубрик на витрине.
   */
  useEffect(() => {
    if (!opened) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpened(false);
      trigger.current?.focus();
    }

    function onOutside(event: MouseEvent) {
      if (!holder.current?.contains(event.target as Node)) setOpened(false);
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [opened]);

  function choose(next: FontScale) {
    setScale(next);
    applyFontScale(next);
    rememberFontScale(next);
    setOpened(false);
    trigger.current?.focus();
  }

  return (
    <div ref={holder} className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        /*
          Названа словами и называет текущую ступень: значок «Аа» сам по себе
          экранный диктор прочитал бы как обрывок текста, а человек с мышью
          не понял бы, крупный у него сейчас шрифт или обычный.
        */
        aria-label={`${t('fontScale.label')}: ${t(`fontScale.${scale}`)}`}
        aria-expanded={opened}
        aria-haspopup="menu"
        onClick={() => setOpened((open) => !open)}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] px-3',
          'text-sm font-medium text-ink-muted transition-all duration-300 ease-out',
          'hover:bg-ink/5 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          // Выбранная не обычная ступень видна и в закрытом виде: иначе
          // человек, у которого кабинет уже крупный, ищет, чем его вернуть.
          scale !== 'normal' && 'bg-accent-soft text-accent',
        )}
      >
        <ALargeSmall className="size-5 shrink-0" aria-hidden="true" />
        {/* Подпись — только там, где есть ширина. В выдвижном меню и в шапке
            монитора она есть; сам значок при этом остаётся узнаваемым. */}
        <span className="hidden sm:inline">{t(`fontScale.${scale}`)}</span>
      </button>

      {opened && (
        <div
          role="menu"
          aria-label={t('fontScale.label')}
          className={cn(
            'absolute left-0 top-full z-30 mt-1 flex min-w-52 flex-col',
            'rounded-[var(--radius-tile)] border border-hairline bg-surface p-1 shadow-float',
            // На мониторе переключатель стоит у правого края шапки, и меню,
            // выехавшее вправо, ушло бы за край окна.
            'lg:left-auto lg:right-0',
          )}
        >
          {FONT_SCALES.map((step) => (
            <button
              key={step}
              type="button"
              /*
                `menuitemradio`, а не кнопка с `aria-pressed`: ступень выбрана
                ровно одна из трёх, и «нажата/не нажата» сказало бы о каждой
                строке отдельно, будто их можно включить несколько.
              */
              role="menuitemradio"
              aria-checked={step === scale}
              onClick={() => choose(step)}
              className={cn(
                'flex h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-left',
                'transition-all duration-300 ease-out active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                step === scale ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-ink/5',
              )}
            >
              {/*
                Ступень показана своим же размером — она и есть образец того,
                что получится. Читать «Очень крупный» мелкими буквами и гадать,
                насколько крупный, не приходится.
              */}
              <span className={cn(step === 'normal' && 'text-sm', step === 'large' && 'text-base', step === 'huge' && 'text-lg')}>
                {t(`fontScale.${step}`)}
              </span>
              {step === scale && <Check className="ml-auto size-4 shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
