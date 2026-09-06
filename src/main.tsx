import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import '@fontsource-variable/inter';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { rememberViewer } from './auth/oidcConfig';

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
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
);
