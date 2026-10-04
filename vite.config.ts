import { loadEnv } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Куда dev-сервер переправляет запросы кабинета.
 *
 * Прокси убирает CORS не хитростью, а по существу: браузер видит запрос
 * на собственный origin страницы, и правило источников к нему не применяется
 * вовсе. Заодно пропадает целый класс расхождений — `localhost` против
 * `127.0.0.1`, повышение адреса до https в браузере, порядок IPv6/IPv4.
 *
 * Проксируются два пути: `/api` — сам кабинет, `/actuator/info` — проверка
 * версии API при старте, для которой источники на бэкенде не объявлены вовсе.
 */
const PROXIED = ['/api', '/actuator'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const target = env.VITE_DEV_API_TARGET || 'http://localhost:5000';

  const proxy = Object.fromEntries(
    PROXIED.map((path) => [path, { target, changeOrigin: true }]),
  );

  return {
    plugins: [react(), tailwindcss()],
    // Свой порт: рядом поднято рабочее место менеджера, и два приложения
    // на одном порту означали бы, что кто-то из них не запустится.
    server: { port: 5174, proxy },
    preview: { port: 5174, proxy },
    test: {
      testTimeout: 15000,
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      // Навыки агента (.agents/) несут свои тесты на node:test — vitest их не исполняет.
      exclude: [...configDefaults.exclude, '.agents/**'],
      css: true,
    },
  };
});
