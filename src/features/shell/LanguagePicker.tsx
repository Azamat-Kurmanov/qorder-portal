import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Globe } from '../../ui/icons';
import { SUPPORTED_LANGUAGES, currentLanguage, type Language } from '../../i18n';
import { useAccountLanguage } from '../language/accountLanguage';
import { cn } from '../../ui/cn';

/**
 * Код языка на ярлыке — как в макете: латиницей и одинаковый на любом
 * языке кабинета. Код не переводится: по нему язык узнают, не читая.
 */
const CODE: Record<Language, string> = { ru: 'RU', kk: 'KZ', en: 'EN' };

/**
 * Выбор языка кабинета — макет «Клиент · Мои заявки v2»: глобус, код
 * и стрелка; в меню — код, название на самом языке и галочка у текущего.
 *
 * Языки названы на себе самих: человек, открывший кабинет на чужом языке,
 * ищет своё слово, а не его перевод. Список короткий и всегда одинаковый.
 *
 * Кнопка названа словами («Язык интерфейса: Русский»), а не только кодом:
 * «RU» само по себе экранный диктор прочитал бы как обрывок текста.
 *
 * Смена языка сбрасывает кеш запросов. Ответы сервера переведены по заголовку
 * `Accept-Language`, и оставленные в кеше тексты ошибок пережили бы смену:
 * экран переключился, а отказ на нём остался на прежнем языке.
 */
export function LanguagePicker({
  onBrand = false,
  strip = false,
}: {
  onBrand?: boolean;
  /** Низкая кнопка цветом строки статуса над шапкой шаблона, как в макете. */
  strip?: boolean;
} = {}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { save } = useAccountLanguage();
  const [opened, setOpened] = useState(false);
  const current = currentLanguage();
  const holder = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  // Закрытие Escape и нажатием мимо — тем же приёмом, что у размера шрифта.
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

  function choose(lng: Language) {
    setOpened(false);
    trigger.current?.focus();
    if (lng === current) return;
    void i18n.changeLanguage(lng);
    // Именно clear: ответы сервера переведены по заголовку,
    // и старые тексты не должны пережить смену языка.
    queryClient.clear();
    // В учётную запись — чтобы на другом устройстве кабинет открылся на нём же.
    save(lng);
  }

  return (
    <div ref={holder} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={`${t('language.label')}: ${t(`language.full.${current}`)}`}
        title={t(`language.full.${current}`)}
        aria-expanded={opened}
        aria-haspopup="menu"
        onClick={() => setOpened((open) => !open)}
        className={cn(
          'inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5',
          'text-caption font-bold tracking-[0.04em] transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2',
          // На фирменной полосе шапки — белым по цвету поставщика.
          strip
            ? cn('h-7 gap-1 rounded-[var(--radius-small)] px-2 text-accent-ink hover:bg-accent/10 focus-visible:ring-accent', opened && 'bg-accent/10')
            : onBrand
            ? cn('h-10 text-on-brand hover:bg-black/15 focus-visible:ring-on-brand', opened && 'bg-black/15')
            : cn('text-ink-muted hover:bg-ink/5 hover:text-ink focus-visible:ring-brand', opened && 'bg-ink/5 text-ink'),
        )}
      >
        <Globe aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
        {CODE[current]}
        <ChevronDown aria-hidden="true" className={cn('size-3 shrink-0 transition-transform duration-200', opened && 'rotate-180')} strokeWidth={2.2} />
      </button>

      {opened && (
        <div
          role="menu"
          aria-label={t('language.label')}
          className={cn(
            'absolute right-0 top-full z-30 mt-1 flex w-[200px] flex-col gap-0.5',
            'rounded-[var(--radius-tile)] border border-hairline bg-surface p-1.5 shadow-float',
          )}
        >
          {SUPPORTED_LANGUAGES.map((lng) => (
            <button
              key={lng}
              type="button"
              // Язык выбран ровно один из трёх — радио, а не набор кнопок.
              role="menuitemradio"
              aria-checked={lng === current}
              onClick={() => choose(lng)}
              className={cn(
                'flex h-10 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left text-sm font-semibold text-ink',
                'transition-colors duration-200 hover:bg-ink/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              )}
            >
              <span aria-hidden="true" className="w-7 text-xs font-bold tracking-[0.04em] text-ink-subtle">{CODE[lng]}</span>
              <span className="flex-1">{t(`language.full.${lng}`)}</span>
              {lng === current && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" strokeWidth={2.6} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
