import { describe, expect, it } from 'vitest';
import { buttonColors, contrastRatio, darkTokens, designCss, supplierTokens, templateRadii, templateTokens } from './supplierTheme';
import { CABINET_OCCASIONS, motionTemplateOf, resolveDesign } from './cabinetDesign';

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
    // «Витрина» ведёт на «Глубину»: её цвет, раскладка и крупные плитки.
    expect(vitrina.template?.id).toBe('DEPTH');
    expect(vitrina.brand).toBe('#0B4FD6');
    expect(vitrina.background).toBe('NEUTRAL');
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
  it('пилюли следуют мелкому скруглению темы', () => {
    expect(templateTokens(motionTemplateOf('LOOKBOOK'))['--radius-pill']).toBe('0px');
    expect(templateTokens(motionTemplateOf('STUDIO'))['--radius-pill']).toBe('6px');
    expect(templateTokens(motionTemplateOf('NEON'))['--radius-pill']).toBe('9999px');
    expect(templateTokens(motionTemplateOf('GLOW'))['--radius-pill']).toBe('9999px');
    // Светлая и тёмная таблицы: пилюля от темы не зависит и стоит на :root.
    const css = designCss(resolveDesign({ design: { template: 'LOOKBOOK', theme: 'TEMPLATE', published: true } }))!;
    expect(css.split("html[data-theme='dark']")[0]).toContain('--radius-pill: 0px');
  });

  /** Баннер: днём — фирменный цвет, ночью — он же, притушенный панелью (#1B1C1F, 35 %). */
  it('цвет баннера считается для обеих тем', () => {
    expect(supplierTokens('#1F5C57', null)['--color-banner']).toBe('#1F5C57');
    expect(darkTokens('#1F5C57', null)['--color-banner']).toBe('#1E4643');
    // Без своего цвета тёмный баннер — от цвета платформы, как в `index.css`.
    expect(darkTokens(null, null)['--color-banner']).toBe('#0A4234');
    const css = designCss(resolveDesign({ brandColor: '#1F5C57' }))!;
    const [light, dark] = css.split("html[data-theme='dark']");
    expect(light).toContain('--color-banner: #1F5C57');
    expect(dark).toContain('--color-banner: #1E4643');
  });

  /** JetBrains Mono — только у тем с моноширинной ценой: «Неон», «Импульс». */
  it('моноширинный шрифт — только у темы, которая его выбрала', () => {
    expect(templateTokens(motionTemplateOf('NEON'))['--font-mono']).toContain('JetBrains Mono');
    expect(templateTokens(motionTemplateOf('PULSE'))['--font-mono']).toContain('JetBrains Mono');
    expect(templateTokens(motionTemplateOf('GLOW'))['--font-mono']).toBeUndefined();
  });

  it('шрифты, масштаб и стиль карточек — из темы', () => {
    const studio = templateTokens(motionTemplateOf('STUDIO'));
    expect(studio['--font-heading']).toContain('Onest');
    expect(studio['--font-sans']).toContain('Onest');
    expect(studio['--card-border']).toBe('var(--color-hairline)');
    const glow = templateTokens(motionTemplateOf('GLOW'));
    expect(glow['--card-border']).toBe('transparent');
    expect(glow['--card-shadow']).toBe('0 0 #0000');
    expect(glow['--ui-scale']).toBeUndefined();
    expect(templateTokens(motionTemplateOf('DEPTH'))['--card-shadow']).toBe('var(--shadow-lift)');
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
    // «Ночь» ведёт на «Неон»: его скругление 14, шрифт и бумага с чернилами в обеих темах.
    expect(css).toContain(`--radius-card: ${templateRadii(14)['--radius-card']}`);
    expect(css).toContain('--font-heading: \'Unbounded Variable\'');
    const [light, dark] = css.split("html[data-theme='dark']");
    expect(light).toContain('--color-canvas: #F2F4F8');
    expect(light).toContain('--color-ink: #0B0D12');
    expect(dark).toContain('--color-canvas: #07080C');
    expect(dark).toContain('--color-ink: #F1F3F8');
  });

  /** Выбранный продавцом фон главнее бумаги темы; ушедший код открывается ближайшей живой темой. */
  it('свой фон главнее бумаги шаблона, ушедший код ведёт на ближайший', () => {
    const css = designCss(resolveDesign({ design: { template: 'NIGHT', background: 'SAND', theme: 'TEMPLATE', published: true } }))!;
    expect(css.split("html[data-theme='dark']")[0]).toContain('--color-canvas: #F2EADB');
    expect(resolveDesign({ design: { template: 'GLASS', theme: 'TEMPLATE', published: true } }).template?.id).toBe('DEPTH');
    // Яркий цвет ночью остаётся собой: зелёный «Сцены» не выцветает до мятного.
    expect(darkTokens('#0AE448', null)['--color-accent']).toBe('#0AE448');
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

describe('живой фон и движение в дизайне', () => {
  const shop = (design: Record<string, unknown>) =>
    resolveDesign({ design: { theme: 'TEMPLATE', published: true, ...design } as never });

  it('без дизайна — без фона, движение «живо», как сейчас', () => {
    expect(resolveDesign({})).toMatchObject({ backdrop: 'NONE', motion: 'LIVELY' });
    expect(resolveDesign(null)).toMatchObject({ backdrop: 'NONE', motion: 'LIVELY' });
  });

  it('старый код — тема, куда он ведёт: её фон, движение и вид', () => {
    const classic = shop({ template: 'CLASSIC' });
    expect(classic.template?.id).toBe('GLOW');
    expect(classic).toMatchObject({ backdrop: 'GLOW', motion: 'LIVELY', layout: 'top', view: 'grid' });
    expect(shop({ template: 'BOUTIQUE' }).template?.id).toBe('LOOKBOOK');
    expect(shop({ template: 'FRESH' }).template?.id).toBe('GLOW');
  });

  it('неизвестный код — «Сияние», кабинет не падает', () => {
    expect(shop({ template: 'НЕТ ТАКОГО' }).template?.id).toBe('GLOW');
  });

  it('выбор продавца важнее темы', () => {
    expect(shop({ template: 'CLASSIC', backdrop: 'HORIZON', motion: 'VIVID' }))
      .toMatchObject({ backdrop: 'HORIZON', motion: 'VIVID' });
  });

  it('узор и своё фото — из опубликованного дизайна; без дизайна их нет', () => {
    const photo = { url: 'https://drive.google.com/thumbnail?id=abc&sz=w2560', veil: 'STRONG' };
    expect(shop({ template: 'GLOW', pattern: 'FOOD' })).toMatchObject({ pattern: 'FOOD', photo: null });
    expect(shop({ template: 'GLOW', photo })).toMatchObject({ pattern: null, photo });
    expect(resolveDesign({ design: { template: 'GLOW', theme: 'TEMPLATE', published: false, pattern: 'FOOD' } as never }))
      .toMatchObject({ pattern: null, photo: null });
  });

  it('«по сезону» и праздник на свои даты — узор и живой фон на сегодня', () => {
    const seasonal = { design: { template: 'GLOW', theme: 'TEMPLATE', published: true, pattern: 'SEASON', backdrop: 'SEASON' } as never };
    expect(resolveDesign(seasonal, '2027-01-10')).toMatchObject({ pattern: 'WINTER', backdrop: 'SNOW' });
    expect(resolveDesign(seasonal, '2027-10-10')).toMatchObject({ pattern: 'AUTUMN', backdrop: 'LEAVES' });
    const birthday = { design: { template: 'GLOW', theme: 'TEMPLATE', published: true, occasion: 'BIRTHDAY',
      occasionFrom: '2027-05-01', occasionUntil: '2027-05-03' } as never };
    expect(resolveDesign(birthday, '2027-05-02')).toMatchObject({ pattern: 'BIRTHDAY', backdrop: 'BALLOONS', occasion: 'BIRTHDAY' });
    expect(resolveDesign(birthday, '2027-05-04')).toMatchObject({ pattern: null, backdrop: 'GLOW', occasion: null });
  });

  it('новая тема без выбора — её фон и движение; кабинет не падает', () => {
    expect(shop({ template: 'NEON' })).toMatchObject({ backdrop: 'HORIZON', motion: 'LIVELY' });
    expect(shop({ template: 'JELLY' })).toMatchObject({ backdrop: 'BLOBS', motion: 'VIVID' });
  });
});

describe('кнопка читается на любом цвете бренда', () => {
  it.each(['#F15730', '#FFC629', '#0AE448', '#E0663C', '#2E8B57', '#CC5500', '#5433EB', '#0A0A0A', '#FFFFFF'])('%s', (brand) => {
    const { fill, text } = buttonColors(brand);
    expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(4.5);
  });

  it('цвет, который и так читается, не трогается', () => {
    expect(buttonColors('#5433EB')).toEqual({ fill: '#5433EB', text: '#FFFFFF' });
    expect(buttonColors('#FFC629')).toEqual({ fill: '#FFC629', text: '#1A1917' });
  });

  it('средний тон, где ни белый, ни тёмный текст не читаются, — заливка темнеет до белого текста', () => {
    // Морская зелень: белый 4,25, тёмный 4,14 — ни один не дотягивает до 4,5.
    const { fill, text } = buttonColors('#2E8B57');
    expect(text).toBe('#FFFFFF');
    expect(fill).not.toBe('#2E8B57');
  });

  it('кнопка кабинета днём — эти же цвета', () => {
    const tokens = supplierTokens('#2E8B57', null);
    expect(tokens['--color-accent']).toBe(buttonColors('#2E8B57').fill);
    expect(tokens['--color-on-accent']).toBe('#FFFFFF');
  });
});

describe('ночная кнопка тоже читается', () => {
  it.each(['#F15730', '#FFC629', '#0AE448', '#2E8B57', '#CC5500', '#5433EB', '#0A0A0A'])('%s', (brand) => {
    const tokens = darkTokens(brand, null);
    expect(contrastRatio(tokens['--color-accent'], tokens['--color-on-accent'])).toBeGreaterThanOrEqual(4.5);
  });
});
