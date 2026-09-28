import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(__dirname, '..');
const CURRENCY_FILE = join(SRC_DIR, 'shared', 'currency.ts');
const SIGNS = ['₸', '₽', '€', 'сўм'];
// «$» в словаре законен сам по себе, валюта — только рядом с числом или
// плейсхолдером.
const DOLLAR = /\d\s*\$|\$\s*\d|\}\}\s*\$|\$\s*\{\{/;
// Валюта словом. «сом» — только целым словом, иначе ловилось бы «сомнение»;
// «сома» не ловится: по-казахски это «сумма». «тенге» — с любым окончанием.
const WORDS = /(?<!\p{L})(?:тенге|теңге|tenge)|(?<!\p{L})(?:сом|сўм)(?:ы|ов)?(?!\p{L})/iu;

/**
 * Исходники дизайн-слоя приёмки не подчиняются (`design/acceptance.test.tsx`
 * кабинета продавца) — у портала своего дизайн-слоя со знаком валюты внутри
 * нет, поэтому исключений, кроме служебных, не заводится.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    // Созданное генерацией (`npm run api:generate`) правилам слоя не
    // подчиняется: символы валют и коды перечислений там — данные контракта,
    // а не написанный человеком текст.
    if (/generated/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

describe('справочник валют — единственное место со знаками валют', () => {
  it('ни один файл .ts/.tsx кроме shared/currency.ts не печатает знак валюты сам', () => {
    const violations: string[] = [];

    for (const file of sourceFiles(SRC_DIR)) {
      if (file === CURRENCY_FILE) continue;
      const code = readFileSync(file, 'utf8');
      for (const sign of SIGNS) {
        if (code.includes(sign)) violations.push(`${file}: «${sign}»`);
      }
    }

    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  it('словари переводов не содержат знака валюты — он не переводится, а берётся из справочника', () => {
    const violations: string[] = [];

    const walk = (node: unknown, path: string[]): void => {
      if (typeof node === 'string') {
        for (const sign of SIGNS) {
          if (node.includes(sign)) violations.push(`${path.join('.')}: «${sign}»`);
        }
        if (DOLLAR.test(node) || WORDS.test(node)) violations.push(`${path.join('.')}: валюта словом или «$»`);
        return;
      }
      if (node && typeof node === 'object') {
        for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
          walk(child, [...path, key]);
        }
      }
    };

    for (const lang of ['ru', 'kk', 'en']) {
      const dict = JSON.parse(readFileSync(join(SRC_DIR, 'i18n', `${lang}.json`), 'utf8'));
      walk(dict, [lang]);
    }

    expect(violations, violations.join('\n')).toHaveLength(0);
  });
});
