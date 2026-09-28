import { describe, expect, it } from 'vitest';
import css from '../index.css?raw';

/**
 * Курсор на кнопках — общим правилом: Tailwind 4 снял `cursor: pointer`
 * с кнопок, и без правила «рука» была только там, где её не забыли.
 */
describe('курсор на кнопках', () => {
  it('активная кнопка — «рука», отключённая — запрет', () => {
    expect(css).toMatch(/button:not\(:disabled\)[^{]*\{[^}]*cursor:\s*pointer/);
    expect(css).toMatch(/button:disabled[^{]*\{[^}]*cursor:\s*not-allowed/);
  });
});
