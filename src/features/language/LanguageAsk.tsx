import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { SUPPORTED_LANGUAGES, currentLanguage, type Language } from '../../i18n';
import { languageChosen, rememberLanguageChoice } from './languageChoice';
import { Flag } from '../../ui/Flag';
import { cn } from '../../ui/cn';

/**
 * Вопрос о языке — один раз, при первом заходе в этом браузере.
 *
 * Язык кабинета до этого угадан по браузеру, и угадан он бывает мимо:
 * телефон, купленный с английской прошивкой, открывает кабинет по-английски
 * человеку, который читает по-казахски. Переключатель в шапке это чинит,
 * но только тому, кто его нашёл, — а ищут его на языке, которого не знают.
 * Отсюда вопрос: он стоит ровно там, куда человек и так смотрит.
 *
 * Спрашивается один раз и больше никогда: ответ помнится в браузере
 * (см. `languageChoice`). Закрытие без выбора — тоже ответ, «оставьте как
 * есть»: человек, которому кабинет открылся на понятном языке, не обязан
 * подтверждать очевидное, и запирать его в окне ради формальности нельзя.
 *
 * На Radix, а не на самодельной обёртке и не на `confirm` браузера: тот
 * запрещён (`portal.md` §6.2), а у Radix есть ловушка фокуса, возврат
 * фокуса, Escape и блокировка прокрутки под окном.
 */
export function LanguageAsk() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  /*
   * Решение спрашивать принимается один раз — при первом рендере.
   *
   * Читай мы хранилище на каждом рендере, окно моргало бы обратно: смена
   * языка перерисовывает всё дерево, а к этому моменту ответ уже записан
   * и окно должно закрыться, а не открыться заново.
   */
  const [asking, setAsking] = useState(() => !languageChosen());

  const current = currentLanguage();

  /**
   * Ответ на вопрос: выбранный язык — или тот же самый, если окно закрыли.
   *
   * Кеш запросов сбрасывается вместе со сменой — тем же движением, что
   * и в переключателе шапки: ответы сервера переведены по `Accept-Language`,
   * и оставленные в кеше тексты пережили бы смену языка.
   */
  const answer = (language: Language) => {
    if (language !== currentLanguage()) {
      void i18n.changeLanguage(language);
      queryClient.clear();
    }
    rememberLanguageChoice(language);
    setAsking(false);
  };

  return (
    <Dialog.Root
      open={asking}
      onOpenChange={(open) => {
        // Закрыли Escape или нажатием мимо — за человеком остаётся язык,
        // который браузер угадал, и второй раз его не спросят.
        if (!open) answer(currentLanguage());
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/40" />

        <Dialog.Content
          className={cn(
            'qo-dialog fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[min(24rem,calc(100vw-2rem))] rounded-[var(--radius-gallery)]',
            'border border-hairline bg-surface p-5 shadow-lg',
          )}
        >
          {/*
            Заголовок — сразу на трёх языках, а не на угаданном: вопрос
            «на каком языке вам удобно» на непонятном языке и есть та самая
            беда, ради которой окно заведено.
          */}
          <Dialog.Title className="text-base font-semibold text-ink">
            {t('language.ask.title')}
          </Dialog.Title>

          <div className="mt-4 flex flex-col gap-2">
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                key={language}
                type="button"
                // Выбранным назван, а не только подкрашен: цвет читает
                // не всякий, а угаданный язык здесь и есть подсказка.
                aria-current={language === current ? 'true' : undefined}
                onClick={() => answer(language)}
                className={cn(
                  'flex h-12 items-center justify-center rounded-[var(--radius-control)]',
                  'text-[15px] font-medium transition-all duration-300 active:scale-95',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  language === current
                    ? 'bg-accent-soft text-accent'
                    : 'border border-hairline text-ink hover:bg-ink/5',
                )}
              >
                {/*
                  Язык назван на себе самом: своё слово ищут, а не его перевод.
                  Флаг рядом — чтобы строку находили взглядом, не читая: тому,
                  кому окно открылось на чужом языке, читать здесь нечего.
                */}
                <Flag language={language} className="mr-2.5" />
                {t(`language.full.${language}`)}
              </button>
            ))}
          </div>

          {/*
            Обещание, что решение не окончательное: без него выбор выглядит
            дверью, которая захлопнется, и его откладывают.
          */}
          <Dialog.Description className="mt-4 text-[13px] leading-snug text-ink-subtle">
            {t('language.ask.note')}
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
