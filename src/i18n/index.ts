import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import type { BackendModule } from 'i18next';
import ru from './ru.json';

export const SUPPORTED_LANGUAGES = ['ru', 'kk', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Локали для `Intl`: запись чисел и дат различается сильнее, чем подписи.
 *
 * Английский взят британским, а не американским: порядок «день, месяц»
 * совпадает с тем, как дату читают здесь, и «09/07» в значении седьмого
 * сентября никого не собьёт.
 */
const INTL_LOCALES: Record<Language, string> = {
  ru: 'ru-KZ',
  kk: 'kk-KZ',
  en: 'en-GB',
};

/**
 * Словарь нужен один, а не три. Русский (он же запасной) — в сборке,
 * казахский и английский догружаются, когда язык выбран: при старте —
 * определённый браузером, потом — переключателем (`changeLanguage` сам ждёт словарь).
 */
const LAZY: Record<string, () => Promise<{ default: object }>> = {
  kk: () => import('./kk.json'),
  en: () => import('./en.json'),
};

const lazyBundles: BackendModule = {
  type: 'backend',
  init() {},
  read(language, _namespace, callback) {
    const load = LAZY[language];
    if (!load) return callback(null, {});
    load().then((bundle) => callback(null, bundle.default as never), (error: Error) => callback(error, null));
  },
};

/** Готов словарь стартового языка: до этого экран рисовать незачем — мелькнул бы русский. */
export const i18nReady = i18n
  .use(lazyBundles)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ru: { translation: ru } },
    partialBundledLanguages: true,
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
  });

/**
 * Язык интерфейса и заголовок запроса обязаны совпадать: сообщения об ошибках
 * приходят с сервера уже переведёнными по Accept-Language, и расхождение даёт
 * экран на одном языке с ошибкой на другом.
 */
export function currentLanguage(): Language {
  const lng = i18n.resolvedLanguage;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng ?? '')
    ? (lng as Language)
    : 'ru';
}

/**
 * Знает ли браузер казахские правила. Chrome (и десктоп 156, и Android) везёт урезанные данные
 * локалей: без них `kk-KZ` даёт «31,990», «09-12» и месяц «M09». Спрашивается один раз —
 * данные браузера за время работы кабинета не меняются.
 */
export const kazakhIntl: boolean = (() => {
  try {
    return new Intl.DateTimeFormat('kk-KZ', { month: 'long' }).format(new Date(2026, 8, 12)) === 'қыркүйек';
  } catch {
    return false;
  }
})();

/**
 * Локаль для `Intl`: даты и суммы записываются по правилам выбранного языка.
 * Казахский без данных в браузере пишется по `ru-KZ`: разряды через пробел и «12.09» у них общие.
 * Месяц словом так не получить — для него `dayMonth` (`shared/format.ts`).
 */
export function intlLocale(): string {
  const language = currentLanguage();
  return language === 'kk' && !kazakhIntl ? 'ru-KZ' : INTL_LOCALES[language];
}

/*
 * Язык документа объявляется браузеру, а не только человеку: без него
 * экранный диктор читает казахский текст русскими правилами, а браузер
 * переносит слова по чужим.
 *
 * Заодно переводится имя вкладки. В `index.html` оно стоит по-русски — иначе
 * до загрузки приложения вкладка была бы безымянной, — но остаться русским
 * на казахском кабинете оно не должно: у человека с тремя вкладками имя
 * вкладки и есть способ найти нужную.
 */
function announce(): void {
  document.documentElement.lang = currentLanguage();
  document.title = i18n.t('common.appTitle');
}

announce();
i18n.on('languageChanged', announce);

export default i18n;
