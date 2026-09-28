import { describe, expect, it } from 'vitest';
import { darkTokens, designCss, supplierTokens, templateRadii, templateTokens } from './supplierTheme';
import { CABINET_OCCASIONS, CABINET_TEMPLATES, resolveDesign } from './cabinetDesign';

describe('оформление поставщика в кабинете клиента', () => {
  /** Не выбравший ничего поставщик — оформление платформы, без своей таблицы стилей. */
  it('без цвета и фона стилей нет', () => {
    expect(designCss(resolveDesign({}))).toBeNull();
    expect(designCss(resolveDesign({ background: 'NEUTRAL' }))).toBeNull();
  });

  /** В таблицу стилей не попадает ничего, кроме #RRGGBB и известного кода фона. */
  it('чужое в поле цвета и фона игнорируется', () => {
    expect(designCss(resolveDesign({ brandColor: 'url(https://x)', background: 'red; } body { display: none' as never })))
      .toBeNull();
  });

  /** Шапка — по формулам кабинета сотрудников: одна шапка у клиента и у сотрудника. */
  it('фирменный цвет тонирует шапку и акцент', () => {
    const tokens = supplierTokens('#1f5c57', null);
    expect(tokens['--color-accent']).toBe('#1F5C57');
    expect(tokens['--color-bar-wide']).toBe('#EFF4F3');
    expect(tokens['--color-bar-line']).toBe('#CEDBDA');
    expect(tokens['--color-canvas']).toBeUndefined();
  });

  it('фон подменяет бумагу кабинета', () => {
    expect(supplierTokens(null, 'SAND')['--color-canvas']).toBe('#F2EADB');
    // «В тон фирменному» без цвета — не повод красить: остаётся бумага.
    expect(supplierTokens(null, 'BRAND')['--color-canvas']).toBeUndefined();
    expect(supplierTokens('#1F5C57', 'BRAND')['--color-canvas']).toBe('#DBE0DA');
  });
});

describe('дизайн кабинета из шаблона', () => {
  const night = resolveDesign({ design: { template: 'NIGHT', theme: 'TEMPLATE', published: true } });
  const classic = resolveDesign({ design: { template: 'CLASSIC', theme: 'TEMPLATE', published: true } });

  /** Пустой цвет и фон в дизайне — «как в шаблоне», а не «как в реквизитах». */
  it('шаблон приносит свой цвет, фон, раскладку и вид витрины', () => {
    const vitrina = resolveDesign({
      brandColor: '#123456',
      design: { template: 'VITRINA', theme: 'TEMPLATE', published: true },
    });
    expect(vitrina.brand).toBe('#1F5C57');
    expect(vitrina.background).toBe('SAND');
    expect(vitrina.layout).toBe('top');
    expect(vitrina.view).toBe('big');
    expect(vitrina.dark).toBe(false);
  });

  it('выбранные продавцом цвет и фон главнее шаблона', () => {
    const design = resolveDesign({
      design: { template: 'VITRINA', brandColor: '#aa0000', background: 'MINT', theme: 'TEMPLATE', published: true },
    });
    expect(design.brand).toBe('#AA0000');
    expect(design.background).toBe('MINT');
  });

  /** Тема при первом входе: «как в шаблоне» у «Ночи» — тёмная, явная — какая выбрана. */
  it('тема по умолчанию — из шаблона или явная', () => {
    expect(night.dark).toBe(true);
    expect(classic.dark).toBe(false);
    expect(resolveDesign({ design: { template: 'NIGHT', theme: 'LIGHT', published: true } }).dark).toBe(false);
    expect(resolveDesign({ design: { template: 'CLASSIC', theme: 'DARK', published: true } }).dark).toBe(true);
  });

  /** Неопубликованный дизайн — кабинет по реквизитам, как до шаблонов. */
  it('неопубликованный дизайн не применяется', () => {
    const design = resolveDesign({
      brandColor: '#1F5C57',
      design: { template: 'NIGHT', theme: 'TEMPLATE', published: false },
    });
    expect(design.template).toBeNull();
    expect(design.layout).toBe('side');
    expect(design.brand).toBe('#1F5C57');
    expect(design.dark).toBe(false);
  });

  /**
   * Скругление 12 даёт ровно прежние ступени кабинета: 14 / 16 / 22 / 24.
   * Плитки и баннеры шаблона рисуются его собственным скруглением, а чип
   * у крупных скруглений — 18 точек, как в макете.
   */
  it('скругления шаблона сохраняют пропорции кабинета', () => {
    expect(templateRadii(12)).toEqual({
      '--radius-control': '14px',
      '--radius-tile': '16px',
      '--radius-card': '22px',
      '--radius-gallery': '24px',
      '--radius-small': '7px',
      '--radius-pill': '9999px',
      '--radius-template': '12px',
      '--radius-chip': '18px',
    });
    // У мелких скруглений чип — тем же малым радиусом, что и кнопки.
    expect(templateRadii(4)['--radius-chip']).toBe('2px');
    expect(templateRadii(0)['--radius-card']).toBe('0px');
    // «Мягкий» — крупнее, но карточка не превращается в пилюлю.
    expect(templateRadii(22)['--radius-card']).toBe('36px');
  });

  /** Пилюля — по формуле макета: radius >= 12 ? круглая : малый радиус (round(radius*0.6)). */
  it('пилюли следуют мелкому скруглению шаблона', () => {
    expect(templateTokens(CABINET_TEMPLATES.MINIMAL)['--radius-pill']).toBe('0px');
    expect(templateTokens(CABINET_TEMPLATES.BOUTIQUE)['--radius-pill']).toBe('1px');
    expect(templateTokens(CABINET_TEMPLATES.STRICT)['--radius-pill']).toBe('2px');
    expect(templateTokens(CABINET_TEMPLATES.SKLAD)['--radius-pill']).toBe('2px');
    expect(templateTokens(CABINET_TEMPLATES.COMPACT)['--radius-pill']).toBe('5px');
    expect(templateTokens(CABINET_TEMPLATES.COMPACT)['--radius-small']).toBe('5px');
    expect(templateTokens(CABINET_TEMPLATES.CLASSIC)['--radius-pill']).toBe('9999px');
    expect(templateTokens(CABINET_TEMPLATES.SOFT)['--radius-pill']).toBe('9999px');
    // Светлая и тёмная таблицы: пилюля от темы не зависит и стоит на :root.
    const css = designCss(resolveDesign({ design: { template: 'MINIMAL', theme: 'TEMPLATE', published: true } }))!;
    expect(css.split("html[data-theme='dark']")[0]).toContain('--radius-pill: 0px');
  });

  /** Баннер: днём — фирменный цвет, ночью — он же, притушенный панелью (#1B1C1F, 35 %). */
  it('цвет баннера считается для обеих тем', () => {
    expect(supplierTokens('#1F5C57', null)['--color-banner']).toBe('#1F5C57');
    expect(darkTokens('#1F5C57', null)['--color-banner']).toBe('#1E4643');
    // Без своего цвета тёмный баннер — от цвета платформы, как в `index.css`.
    expect(darkTokens(null, null)['--color-banner']).toBe('#773711');
    const css = designCss(resolveDesign({ brandColor: '#1F5C57' }))!;
    const [light, dark] = css.split("html[data-theme='dark']");
    expect(light).toContain('--color-banner: #1F5C57');
    expect(dark).toContain('--color-banner: #1E4643');
  });

  /** IBM Plex Mono — только у «Техно», где моноширинный указан шрифтом заголовков. */
  it('моноширинный шрифт — только у шаблона, который его выбрал', () => {
    expect(templateTokens(CABINET_TEMPLATES.TECH)['--font-mono']).toContain('IBM Plex Mono');
    expect(templateTokens(CABINET_TEMPLATES.SKLAD)['--font-mono']).toBeUndefined();
    expect(templateTokens(CABINET_TEMPLATES.CLASSIC)['--font-mono']).toBeUndefined();
  });

  it('шрифты, масштаб и стиль карточек — из шаблона', () => {
    const boutique = templateTokens(CABINET_TEMPLATES.BOUTIQUE);
    expect(boutique['--font-heading']).toContain('PT Serif');
    expect(boutique['--font-sans']).toContain('Inter');
    expect(boutique['--card-border']).toBe('transparent');
    expect(boutique['--card-shadow']).toBe('0 0 #0000');
    expect(templateTokens(CABINET_TEMPLATES.LARGE)['--ui-scale']).toBe('1.18');
    expect(templateTokens(CABINET_TEMPLATES.CLASSIC)['--ui-scale']).toBeUndefined();
    expect(templateTokens(CABINET_TEMPLATES.CLASSIC)['--card-shadow']).toBe('var(--shadow-lift)');
    expect(templateTokens(CABINET_TEMPLATES.COMPACT)['--card-border']).toBe('var(--color-hairline)');
  });

  /** Тёмные оттенки — по формулам макета: кнопка — цвет пополам с белым, тёмная надпись на ней. */
  it('тёмные токены считаются от цвета и фона', () => {
    const dark = darkTokens('#1F5C57', 'SAND');
    expect(dark['--color-accent']).toBe('#8FAEAB');
    expect(dark['--color-accent-soft']).toBe('#1D3434');
    expect(dark['--color-accent-ink']).toBe('#BCCECD');
    expect(dark['--color-canvas']).toBe('#252019');
    // Нейтральный фон — просто тёмная бумага, без своего блока.
    expect(darkTokens('#1F5C57', 'NEUTRAL')['--color-canvas']).toBeUndefined();
  });

  it('таблица стилей шаблона пишет светлый и тёмный блоки', () => {
    const css = designCss(night)!;
    expect(css).toContain(':root {');
    expect(css).toContain("html[data-theme='dark'] {");
    expect(css).toContain('--radius-card: 36px');
    expect(css).toContain('--font-sans: \'Onest Variable\'');
  });

  /** Поставщик без дизайна — прежний вид: ни шрифтов, ни скруглений, ни масштаба. */
  it('без дизайна скругления, шрифты и карточки не меняются', () => {
    const css = designCss(resolveDesign({ brandColor: '#1F5C57' }))!;
    expect(css).not.toContain('--radius');
    expect(css).not.toContain('--font');
    expect(css).not.toContain('--card');
    expect(css).not.toContain('--ui-scale');
    // Светлые токены — те же, что и раньше.
    expect(css).toContain('--color-bar-wide: #EFF4F3');
    // А тёмная тема у покупателя всё равно в его цвете.
    expect(css).toContain("html[data-theme='dark'] { --color-accent: #8FAEAB;");
    expect(designCss(resolveDesign({}))).toBeNull();
  });
});

describe('праздничное оформление', () => {
  const naurz = {
    template: 'VITRINA', theme: 'TEMPLATE', published: true,
    occasion: 'NAURYZ', occasionFrom: '2027-03-14', occasionUntil: '2027-03-23',
  } as const;

  /** В даты повода меняются второй цвет и фактура; фирменный цвет продавца остаётся. */
  it('ложится поверх шаблона в даты повода', () => {
    const plain = resolveDesign({ design: { ...naurz, occasion: undefined } });
    const festive = resolveDesign({ design: naurz }, '2027-03-20');

    expect(festive.occasion).toBe('NAURYZ');
    expect(festive.brand).toBe(plain.brand);
    expect(festive.style?.accent2).not.toBe(plain.style?.accent2);
    expect(festive.style?.pattern).toBe(CABINET_OCCASIONS.NAURYZ.pattern);
  });

  it('вне дат повода кабинет выглядит как обычно', () => {
    const plain = resolveDesign({ design: { ...naurz, occasion: undefined } });
    for (const day of ['2027-03-13', '2027-03-24']) {
      const design = resolveDesign({ design: naurz }, day);
      expect(design.occasion).toBeNull();
      expect(design.style).toEqual(plain.style);
    }
  });
});
