import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright кабинета клиента — по образцу `frontend/front/playwright.config.ts`.
 *
 * Порт 5174 и `strictPort`: рядом на 5173 живёт рабочее место менеджера,
 * и Vite, молча занявший соседний порт, отправил бы тесты не в то приложение.
 */
const PORT = Number(process.env.E2E_PORT) || 5174;
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  // Только e2e и только `*.e2e.ts`: тесты vitest живут в `src` и называются
  // `*.test.tsx`, а маска `*.spec.ts` в `e2e/` попала бы в vitest по его
  // умолчанию — конфиг vite при этом трогать не пришлось бы.
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Следы и отчёт — в `temp/`: он в .gitignore, а `test-results/` в корне — нет.
  outputDir: 'temp/playwright/test-results',

  timeout: 120_000,
  expect: { timeout: 15_000 },

  // Сценарии делят один стенд (арендатор, сотрудник, клиент), поэтому
  // файл идёт последовательно; разные файлы — параллельно.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'temp/playwright/report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'temp/playwright/report' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'ru-RU',
    timezoneId: 'Asia/Almaty',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
