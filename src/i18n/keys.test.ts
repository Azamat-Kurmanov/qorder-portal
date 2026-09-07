import { describe, expect, it } from 'vitest';
import ru from './ru.json';
import kk from './kk.json';
import en from './en.json';

/** Плоский список путей до листьев: `cart.total`. */
function keyPaths(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [prefix];

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

function valueAt(bundle: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node as Record<string, unknown>)?.[key],
    bundle,
  );
}

/**
 * Ключ без формы множественного числа: `common.positions_few` — это
 * `common.positions`.
 *
 * Формы задаёт язык, а не словарь: у русского их три (`_one`, `_few`,
 * `_many`), у казахского одна, у английского две. Требовать одинаковых
 * наборов форм значило бы заставить казахский словарь повторить русские
 * ветки — ровно ту ошибку, ради которой самописное склонение и убрано.
 * Совпадать обязан сам ключ: именно его спрашивает экран.
 */
function baseKey(path: string): string {
  return path.replace(/_(zero|one|two|few|many|other)$/, '');
}

const BUNDLES = { ru, kk, en } as const;

describe('словари переводов', () => {
  // Недостающий ключ i18next не роняет ничего: он молча отдаёт сам ключ,
  // и на экране появляется «cart.total» вместо «Итого». Расхождение наборов
  // ловится здесь, а не клиентом.
  it('наборы ключей ru / kk / en совпадают поимённо', () => {
    const reference = [...new Set(keyPaths(ru).map(baseKey))].sort();

    for (const [lang, bundle] of Object.entries(BUNDLES)) {
      const keys = [...new Set(keyPaths(bundle).map(baseKey))].sort();
      const missing = reference.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !reference.includes(key));

      expect(missing, `в ${lang}.json нет ключей: ${missing.join(', ')}`).toHaveLength(0);
      expect(extra, `в ${lang}.json лишние ключи: ${extra.join(', ')}`).toHaveLength(0);
    }
  });

  it('ни одно значение не пустое', () => {
    for (const [lang, bundle] of Object.entries(BUNDLES)) {
      const empty = keyPaths(bundle).filter((path) => {
        const value = valueAt(bundle, path);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(empty, `в ${lang}.json пустые значения: ${empty.join(', ')}`).toHaveLength(0);
    }
  });

  /**
   * Плейсхолдер, потерянный в переводе, оставляет клиента без числа:
   * «Непрочитанных:» вместо «Непрочитанных: 4».
   *
   * Сверяются все формы одного ключа разом: у слова со склонением форм
   * в каждом языке своё число, а набор подстановок в них обязан быть один
   * и тот же.
   */
  it('плейсхолдеры интерполяции одинаковы во всех трёх языках', () => {
    const placeholders = (text: string) =>
      (text.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? []).map((token) => token.replace(/\s/g, ''));

    const collect = (bundle: unknown) => {
      const byKey = new Map<string, Set<string>>();
      for (const path of keyPaths(bundle)) {
        const key = baseKey(path);
        const found = byKey.get(key) ?? new Set<string>();
        placeholders(valueAt(bundle, path) as string).forEach((token) => found.add(token));
        byKey.set(key, found);
      }
      return byKey;
    };

    const reference = collect(ru);

    for (const [lang, bundle] of Object.entries(BUNDLES)) {
      const actual = collect(bundle);

      for (const [key, expected] of reference) {
        expect(
          [...(actual.get(key) ?? [])].sort(),
          `${lang}.json, ключ ${key}`,
        ).toEqual([...expected].sort());
      }
    }
  });
});
