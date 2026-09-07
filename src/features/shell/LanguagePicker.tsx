import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { cn } from '../../ui/cn';

/**
 * Выбор языка кабинета.
 *
 * Языки названы на себе самих: человек, открывший кабинет на чужом языке,
 * ищет своё слово, а не его перевод. По той же причине список короткий
 * и всегда одинаковый — три кода, а не выпадающий список стран.
 *
 * Кнопка названа словами («Язык интерфейса»), а не только показывает код:
 * «РУС» само по себе экранный диктор прочитал бы как обрывок текста.
 *
 * Смена языка сбрасывает кеш запросов. Ответы сервера переведены по заголовку
 * `Accept-Language`, и оставленные в кеше тексты ошибок пережили бы смену:
 * экран переключился, а отказ на нём остался на прежнем языке.
 */
export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const current = i18n.resolvedLanguage ?? 'ru';

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${t('language.label')}: ${t(`language.${current}`)}`}
        aria-expanded={opened}
        aria-haspopup="menu"
        onClick={() => setOpened((open) => !open)}
        className={cn(
          'inline-flex h-11 items-center rounded-[var(--radius-control)] px-3',
          'text-sm font-medium text-ink-muted transition-all duration-300',
          'hover:bg-ink/5 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        )}
      >
        {t(`language.${current}`)}
      </button>

      {opened && (
        <div
          role="menu"
          aria-label={t('language.label')}
          className={cn(
            'absolute right-0 top-full z-30 mt-1 flex min-w-24 flex-col',
            'rounded-[var(--radius-tile)] border border-hairline bg-surface p-1 shadow-lg',
          )}
        >
          {SUPPORTED_LANGUAGES.map((lng) => (
            <button
              key={lng}
              type="button"
              role="menuitem"
              aria-current={lng === current ? 'true' : undefined}
              onClick={() => {
                if (lng === current) {
                  setOpened(false);
                  return;
                }
                void i18n.changeLanguage(lng);
                // Именно clear: ответы сервера переведены по заголовку,
                // и старые тексты не должны пережить смену языка.
                queryClient.clear();
                setOpened(false);
              }}
              className={cn(
                'flex h-11 items-center rounded-[var(--radius-control)] px-3 text-left text-sm',
                'transition-all duration-300 active:scale-95',
                lng === current ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-ink/5',
              )}
            >
              {t(`language.${lng}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
