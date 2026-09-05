import { defineConfig } from 'orval';

// Схема коммитится в репозиторий: сборка кабинета не должна зависеть от того,
// поднят ли бэкенд, а изменение контракта обязано быть видно в pull request
// явным diff — включая ломающие изменения.
export default defineConfig({
  portal: {
    input: './openapi.json',
    output: {
      target: './src/api/generated.ts',
      client: 'react-query',
      // Имена методов берутся из operationId контракта: переименование
      // на сервере ломает сборку кабинета сразу, а не в проде.
      override: { mutator: { path: './src/api/client.ts', name: 'apiRequest' } },
    },
  },
});
