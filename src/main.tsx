import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import './ui/motion/liveTheme.css';
// Язык поднимается до первого рендера: подпись, нарисованная раньше, чем
// известен язык, мигнула бы русским текстом на казахском экране.
import { i18nReady } from './i18n';
import { acceptLanguageFromUrl } from './features/language/languageChoice';
import '@fontsource-variable/onest';
import '@fontsource-variable/inter';
// Шрифты шаблонов кабинета (src/supplier/cabinetTemplates.json). Подключение
// объявляет только начертания: файл шрифта браузер скачает, лишь когда
// продавец выбрал шаблон, где он нужен.
import '@fontsource-variable/golos-text';
import '@fontsource-variable/wix-madefor-display';
import '@fontsource-variable/wix-madefor-text';
import '@fontsource-variable/geologica';
import '@fontsource-variable/oswald';
import '@fontsource-variable/caveat';
import '@fontsource/yeseva-one/400.css';
import '@fontsource-variable/commissioner';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/literata';
import '@fontsource-variable/tektur';
import '@fontsource-variable/nunito';
import '@fontsource-variable/rubik';
import '@fontsource-variable/jetbrains-mono';
// Поздравление праздника (`FestiveScene`) набрано PT Serif.
import '@fontsource/pt-serif/400.css';
import '@fontsource/pt-serif/700.css';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { rememberViewer } from './auth/oidcConfig';
import { getGetPortalSuppliersQueryKey } from './api/generated';

// Язык уже выбран на экране выбора кабинета — не спрашиваем второй раз.
acceptLanguageFromUrl(window.location.search);

/*
 * Режим читается из адреса до первого рендера — и сразу из него убирается.
 *
 * До: вход поднимается вместе с провайдером, и режим, прочитанный позже,
 * опоздал бы к выбору realm. Из адреса: переход из рабочего места — это
 * обычная ссылка, другого способа передать признак у неё нет.
 * Убирается: адрес с «mode=staff» человек скопирует и пришлёт клиенту,
 * а тому в realm сотрудников делать нечего.
 */
const params = new URLSearchParams(window.location.search);
if (params.get('mode') === 'staff') {
  rememberViewer('staff');
  params.delete('mode');
  const query = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

// Дизайн-язык кабинета свой: рабочее место менеджера плотное, потому что в нём
// проводят день, а кабинет открывают на три минуты с телефона. Отсюда крупные
// касания — не меньше сорока четырёх точек — и воздух между строками. Шрифт,
// радиусы и размер касания заданы токенами в index.css и компонентами src/ui —
// отдельная тема здесь больше не нужна.

// Один клиент на приложение: корзина, витрина и профиль обязаны делить кеш,
// иначе ответ на изменение количества не обновит панель итога.
//
// Отказ сервера не повторяется: «нет доступа» и «не найдено» — это ответ,
// а не сбой связи, и второй такой же запрос вернёт то же самое. Повторы
// по умолчанию превращали каждый отказ в четыре: в журнале клиента, у
// которого поставщик не открыл кабинет, стояли по три-четыре одинаковых
// «403» на каждый экран. Сетевой сбой и поломка сервера повторяются
// по-прежнему — там второй запрос имеет смысл.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status !== undefined && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

// Список поставщиков спрашивают около девяти компонентов кабинета, и с тех
// пор как карточка отдаёт ещё и часы с рейтингом, ответ стоит пять запросов
// к базе на магазин. Нулевой staleTime по умолчанию превращал каждое такое
// монтирование в новый поход на сервер. Минута сглаживает это, не трогая
// сами компоненты: ни один хук не приходится переписывать. Смена поставщика
// по-прежнему сбрасывает кеш целиком — staleTime её не переживает, а не мешает.
// Возврат во вкладку перечитывает список всегда: продавец мог сменить валюту,
// и старый знак не должен висеть ещё минуту.
queryClient.setQueryDefaults(getGetPortalSuppliersQueryKey(), { staleTime: 60_000, refetchOnWindowFocus: 'always' });

void i18nReady.then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
));
