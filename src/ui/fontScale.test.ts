import { beforeEach, describe, expect, it } from 'vitest';
import { FONT_SCALES, applyFontScale, currentFontScale, rememberFontScale } from './fontScale';

describe('размер шрифта кабинета', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.fontScale;
  });

  it('по умолчанию обычный', () => {
    expect(currentFontScale()).toBe('normal');
  });

  it('помнит выбор между заходами', () => {
    rememberFontScale('large');

    expect(currentFontScale()).toBe('large');
  });

  // Чужое значение в хранилище — это не повод открыть кабинет нечитаемым:
  // ключ переживает смену версий, и когда-нибудь в нём окажется ступень,
  // которой больше нет.
  it('не верит незнакомой ступени', () => {
    window.localStorage.setItem('q-order.portal.font-scale', 'gigantic');

    expect(currentFontScale()).toBe('normal');
  });

  // Ступень объявляется признаком на корне страницы: правило размера живёт
  // в таблице стилей рядом с остальными, а не инлайном на элементе.
  it('объявляет ступень признаком корня страницы', () => {
    applyFontScale('large');

    expect(document.documentElement.dataset.fontScale).toBe('large');
  });

  // Обычная ступень признака не оставляет: она и есть умолчание таблицы
  // стилей, и лишний признак означал бы, что умолчание задано дважды.
  it('обычную ступень признаком не помечает', () => {
    applyFontScale('large');
    applyFontScale('normal');

    expect(document.documentElement.dataset.fontScale).toBeUndefined();
  });

  it('знает ровно две ступени', () => {
    expect([...FONT_SCALES]).toEqual(['normal', 'large']);
  });

  // «Очень крупный» убран: кто его выбрал раньше, получает ближайший — «Крупный».
  it('прежний «Очень крупный» читает как «Крупный»', () => {
    window.localStorage.setItem('q-order.portal.font-scale', 'huge');

    expect(currentFontScale()).toBe('large');
  });
});
