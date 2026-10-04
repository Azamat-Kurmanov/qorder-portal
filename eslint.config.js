import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Сборка, отчёты, генерация из контракта (правится генератором, не руками), черновики QA
  // и служебные папки агентов и инструментов.
  { ignores: ['dist', 'temp', 'graphify-out', '.superpowers', '.agents', '.claude', '.junie', '.impeccable', 'playwright-report', 'test-results', 'src/api/generated.ts', 'src/api/rules.generated.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // react-refresh не подключён: файлы компонентов здесь экспортируют и помощников,
      // цена — полная перезагрузка вместо горячей при их правке (решение 04.10).
      // Классические правила хуков. Остальные правила react-hooks 7 (set-state-in-effect,
      // purity, globals, immutability) — для React Compiler, которого в проекте нет.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Неразрывные пробелы в регулярных выражениях намеренные: ими чистят суммы «1 000».
      'no-irregular-whitespace': ['error', { skipRegExps: true }],
      // `_` в начале — значение не нужно намеренно (`const { a: _a, ...rest }`).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
