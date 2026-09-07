import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import kk from './kk.json';
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

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ru: { translation: ru }, kk: { translation: kk }, en: { translation: en } },
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

/** Локаль для `Intl`: даты и суммы записываются по правилам выбранного языка. */
export function intlLocale(): string {
  return INTL_LOCALES[currentLanguage()];
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
