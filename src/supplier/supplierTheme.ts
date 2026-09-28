/**
 * Оформление кабинета, которое задаёт поставщик: фирменный цвет и фон.
 *
 * Выбирает их продавец в своих реквизитах, а кабинет клиента только
 * применяет. Формулы те же, что у кабинета сотрудников
 * (`front/src/design/brandTheme.ts`): клиент и сотрудник одного поставщика
 * должны видеть одну и ту же шапку.
 *
 * Опубликованный продавцом шаблон (`cabinetDesign.ts`) добавляет к цвету
 * и фону шрифты, скругления, масштаб и стиль карточек. У покупателя есть
 * тёмная тема, поэтому оттенки считаются дважды: светлые — на `:root`,
 * тёмные — под `html[data-theme='dark']`, по формулам макета «Дизайн
 * кабинета клиента» (панель #1B1C1F, мягкая подложка — цвет, почти
 * растворённый в панели, кнопка — цвет, разбавленный белым наполовину).
 */

import { TEMPLATE_FONTS, type CabinetTemplate, type ResolvedDesign, type TemplateStyle } from './cabinetDesign';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const WHITE = '#FFFFFF';
const BLACK = '#000000';

/** Бумага кабинета — от неё разбавляется фон «в тон фирменному». */
const CANVAS = '#F5F2EC';

/**
 * Фоны за блоками — те же коды и оттенки, что в палитре кабинета сотрудников
 * (`front/src/design/brandPalette.json`). «В тон фирменному» считается
 * из цвета, нейтральный оставляет бумагу кабинета.
 */
const BACKGROUNDS: Record<string, string> = {
  SAND: '#F2EADB',
  PEACH: '#F5E6DC',
  POWDER: '#F3E4E6',
  LILAC: '#EAE6F2',
  SKY: '#E2EAF1',
  MINT: '#E0EEE8',
  SAGE: '#E6EADC',
  FOG: '#E6E8EB',
};

function channels(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16)) as [number, number, number];
}

/** Надпись, читаемая на цвете: белая или почти чёрная — у какой контраст выше. */
function readableOn(hex: string): string {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Контраст с белым (1.05 / (L + .05)) против контраста с #1A1917 (≈ L 0.01).
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.06 ? WHITE : '#1A1917';
}

function mix(from: string, to: string, t: number): string {
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * Переменные, которые перекрывают токены `index.css`.
 *
 * Цвет — только запись #RRGGBB: значение встаёт в таблицу стилей страницы,
 * и имя цвета или `url(...)` в нём — способ вмешаться в чужой экран.
 */
export function supplierTokens(brandColor: string | null | undefined, background: string | null | undefined):
  Record<string, string> {
  const brand = brandColor && HEX.test(brandColor) ? brandColor.toUpperCase() : null;
  const tokens: Record<string, string> = {};

  if (brand) {
    const [r, g, b] = channels(brand);
    tokens['--color-accent'] = brand;
    // Светлый фирменный цвет (жёлтый, мятный) под белыми буквами не читается —
    // надпись на кнопке, полосе шапки и баннере становится тёмной.
    tokens['--color-on-accent'] = readableOn(brand);
    tokens['--color-on-brand'] = readableOn(brand);
    tokens['--color-accent-top'] = mix(brand, WHITE, 0.12);
    // Баннеры и распродажа днём — сам фирменный цвет (макет: banner = brand).
    tokens['--color-banner'] = brand;
    tokens['--color-accent-soft'] = mix(brand, WHITE, 0.86);
    // Текст на мягкой подложке и заливка под курсором — как в макете.
    tokens['--color-accent-ink'] = mix(brand, BLACK, 0.22);
    tokens['--color-accent-hover'] = mix(brand, BLACK, 0.18);
    tokens['--shadow-accent'] = `0 4px 10px -4px rgb(${r} ${g} ${b} / 0.4), 0 14px 28px -14px rgb(${r} ${g} ${b} / 0.55)`;
    // Шапка — как у сотрудников: цвет, почти растворённый в белом, и линия под ней.
    tokens['--color-bar'] = mix(brand, WHITE, 0.93);
    tokens['--color-bar-wide'] = mix(brand, WHITE, 0.93);
    tokens['--color-bar-line'] = mix(brand, WHITE, 0.78);
  }

  if (background === 'BRAND' && brand) {
    tokens['--color-canvas'] = mix(brand, CANVAS, 0.88);
  } else if (background && BACKGROUNDS[background]) {
    tokens['--color-canvas'] = BACKGROUNDS[background];
  }

  return tokens;
}

/** Цвет платформы: от него считаются тёмные оттенки, когда свой цвет не выбран. */
const PLATFORM_BRAND = '#A8450A';
/** Панель и линии тёмной темы — как в макете и в `index.css`. */
const DARK_PANEL = '#1B1C1F';
const DARK_LINE = '#2C2E33';
const DARK_CANVAS = '#0F1012';

/**
 * Оттенок, которым тонируется тёмная бумага под выбранным фоном.
 *
 * Светлые пастели фона в тёмной теме не годятся — они и были бы светлыми
 * пятнами. Поэтому у каждого фона есть свой насыщенный оттенок, почти
 * целиком растворённый в тёмной бумаге (87 %): фон узнаётся, но не светит.
 */
const DARK_TINTS: Record<string, string> = {
  SAND: '#B8894A',
  PEACH: '#C0714A',
  POWDER: '#A8566A',
  LILAC: '#6E5AA8',
  SKY: '#3E6E96',
  MINT: '#3A8A6C',
  SAGE: '#6E7E45',
  FOG: '#5A6470',
};

/**
 * Тёмные оттенки от фирменного цвета и фона.
 *
 * Кнопка в тёмной теме — цвет, разбавленный белым наполовину, с тёмной
 * надписью: насыщенный тёмный фирменный цвет на почти чёрной бумаге
 * не читается как кнопка вовсе (графитовый цвет у «Минимала» исчез бы).
 * Полоса шапки — наоборот, цвет, притушенный панелью: белые подписи на ней
 * должны остаться читаемыми.
 */
export function darkTokens(brandColor: string | null | undefined, background: string | null | undefined):
  Record<string, string> {
  const brand = brandColor && HEX.test(brandColor) ? brandColor.toUpperCase() : PLATFORM_BRAND;
  const [r, g, b] = channels(brand);
  const button = mix(brand, WHITE, 0.5);
  const tokens: Record<string, string> = {
    '--color-accent': button,
    '--color-accent-top': mix(button, WHITE, 0.12),
    '--color-accent-hover': mix(button, WHITE, 0.18),
    '--color-accent-soft': mix(brand, DARK_PANEL, 0.62),
    '--color-accent-ink': mix(brand, WHITE, 0.7),
    '--color-strip': mix(brand, DARK_PANEL, 0.35),
    '--color-on-brand': readableOn(mix(brand, DARK_PANEL, 0.35)),
    // Баннер ночью — цвет, притушенный панелью (макет: mix(brand, #1B1C1F, .35)):
    // светлая кнопочная заливка под белыми буквами баннера не читается.
    '--color-banner': mix(brand, DARK_PANEL, 0.35),
    '--color-bar': mix(brand, DARK_PANEL, 0.9),
    '--color-bar-wide': mix(brand, DARK_PANEL, 0.9),
    '--color-bar-line': mix(brand, DARK_LINE, 0.8),
    '--shadow-accent': `0 4px 10px -4px rgb(0 0 0 / 0.5), 0 14px 28px -14px rgb(${r} ${g} ${b} / 0.45)`,
  };
  if (background === 'BRAND') {
    tokens['--color-canvas'] = mix(brand, DARK_CANVAS, 0.87);
  } else if (background && DARK_TINTS[background]) {
    tokens['--color-canvas'] = mix(DARK_TINTS[background], DARK_CANVAS, 0.87);
  }
  return tokens;
}

/**
 * Скругления шаблона в четырёх ступенях кабинета.
 *
 * Шаблон задаёт одно число — скругление карточки в макете. Кабинет же
 * скругляет по-разному поле, плитку, карточку и галерею, и пропорции между
 * ними сохраняются: у «Классики» (12) выходит ровно прежний вид
 * 14 / 16 / 22 / 24. Крупные ступени ограничены сверху — у «Мягкого» (22)
 * карточка в 40 точек превратилась бы в пилюлю.
 */
export function templateRadii(radius: number): Record<string, string> {
  const step = (factor: number, max: number) => `${Math.min(Math.round((radius * factor) / 12), max)}px`;
  // Малое скругление макета: знак магазина, поле поиска, кнопки шапки.
  const small = `${Math.max(0, Math.round(radius * 0.6))}px`;
  return {
    '--radius-control': step(14, 28),
    '--radius-tile': step(16, 30),
    '--radius-card': step(22, 36),
    '--radius-gallery': step(24, 40),
    '--radius-small': small,
    // Пилюля — как в макете: у крупных скруглений круглая, у мелких —
    // тем же малым радиусом, что и кнопки (прямые углы «Минимала»
    // среди круглых чипов выглядели бы чужими).
    '--radius-pill': radius >= 12 ? '9999px' : small,
    // Скругление самого макета — карточки, баннеры и плитки шаблона рисуются
    // им, а не ступенями кабинета: у «Классики» (14) плитка в 26 точек
    // выглядела бы мягче, чем её утвердил продавец в предпросмотре.
    '--radius-template': `${Math.max(0, radius)}px`,
    // Чип и ценник макета: у крупных скруглений — 18 точек, у мелких — малое.
    '--radius-chip': radius >= 12 ? '18px' : small,
  };
}

/**
 * Стиль карточек: линия, тень или ничего.
 *
 * Тени — ссылками на ступени `index.css`, а не числами: в тёмной теме
 * ступени перекрашены, и карточка шаблона «с тенью» не должна отбрасывать
 * тёплую коричневую тень на чёрную бумагу.
 */
const CARD_STYLES: Record<string, Record<string, string>> = {
  border: {
    '--card-border': 'var(--color-hairline)',
    '--card-border-hover': 'var(--color-line)',
    '--card-shadow': '0 0 #0000',
    '--card-shadow-hover': 'var(--shadow-soft)',
  },
  shadow: {
    '--card-border': 'transparent',
    '--card-border-hover': 'transparent',
    '--card-shadow': 'var(--shadow-lift)',
    '--card-shadow-hover': 'var(--shadow-float)',
  },
  none: {
    '--card-border': 'transparent',
    '--card-border-hover': 'var(--color-hairline)',
    '--card-shadow': '0 0 #0000',
    '--card-shadow-hover': '0 0 #0000',
  },
};

/** Шрифты, скругления, масштаб и карточки шаблона — от темы не зависят. */
export function templateTokens(template: CabinetTemplate): Record<string, string> {
  const tokens: Record<string, string> = {
    ...templateRadii(template.radius),
    ...(CARD_STYLES[template.card] ?? {}),
  };
  const sans = TEMPLATE_FONTS[template.font];
  const heading = TEMPLATE_FONTS[template.heading];
  if (sans) tokens['--font-sans'] = sans;
  if (heading) tokens['--font-heading'] = heading;
  // Моноширинный шрифт — только у шаблона, который его указал («Техно»):
  // остальным артикулы остаются системным моноширинным стеком `index.css`.
  if (template.font === 'mono' || template.heading === 'mono') tokens['--font-mono'] = TEMPLATE_FONTS.mono;
  // Множитель к размеру корня: ступени «крупный шрифт» покупателя умножаются
  // на него, а не заменяются им (см. `index.css`).
  if (template.scale !== 1) tokens['--ui-scale'] = String(template.scale);
  // «Фермерский» — кремовые карточки вместо белых, как в макете.
  if (template.id === 'FARM') tokens['--color-surface'] = '#FFFDF6';
  // Манера заголовков: насыщенность, разрядка и регистр шаблона. Применяются
  // правилом к заголовкам экранов (`designCss`) и классом `qo-heading`.
  const style = template.style;
  if (style) {
    tokens['--heading-weight'] = String(style.headingWeight);
    tokens['--heading-tracking'] = `${style.headingTracking}em`;
    tokens['--heading-case'] = style.headingCase === 'upper' ? 'uppercase' : 'none';
  }
  return tokens;
}

/** Бледная линия узора: та же, что у макета (`faint` светлой и тёмной палитры). */
const FAINT_LIGHT = '#DAD6CC';
const FAINT_DARK = '#3A3C42';
/** Текст на втором цвете шаблона: тёмный в обеих темах — второй цвет всегда светлый. */
const ACCENT2_INK_LIGHT = '#16171A';
const ACCENT2_INK_DARK = '#141414';

/**
 * Цвета, которые шаблон выводит из своего характера, — те же формулы, что
 * у предпросмотра продавца (`styleColors` в `designModel.ts`).
 *
 * `canvas` — подложка этой темы: подсветка и узор считаются от неё, иначе
 * в тёмной теме светилось бы дневное пятно. Узор — готовым значением
 * `background`: слои градиентов не собрать утилитами.
 */
function styleTokens(style: TemplateStyle, brand: string, canvas: string, dark: boolean): Record<string, string> {
  const accent2 = HEX.test(style.accent2) ? style.accent2.toUpperCase() : brand;
  const second = dark ? accent2 : mix(accent2, BLACK, 0.08);
  const glow = mix(brand, canvas, dark ? 0.72 : 0.82);
  const faint = dark ? FAINT_DARK : FAINT_LIGHT;
  const layers: Record<TemplateStyle['pattern'], string> = {
    none: canvas,
    dots: `radial-gradient(${faint} 1.2px, ${canvas} 1.6px) 0 0 / 18px 18px, ${canvas}`,
    grid: `linear-gradient(${mix(faint, canvas, 0.55)} 1px, ${canvas} 1px) 0 0 / 100% 28px, `
      + `linear-gradient(90deg, ${mix(faint, canvas, 0.55)} 1px, ${canvas} 1px) 0 0 / 28px 100%`,
    grain: `repeating-linear-gradient(45deg, ${mix(faint, canvas, 0.8)} 0 1px, ${canvas} 1px 7px)`,
    glow: `radial-gradient(60% 50% at 85% 0%, ${glow}, transparent 70%), `
      + `radial-gradient(50% 40% at 0% 100%, ${mix(accent2, canvas, dark ? 0.8 : 0.85)}, transparent 70%), ${canvas}`,
  };
  return {
    // Фирменный цвет как есть — в обеих темах: градиенты баннеров и колонки
    // «разворота» рисуются им, а не осветлённой кнопочной заливкой ночи.
    '--color-shop': brand,
    '--color-on-shop': readableOn(brand),
    '--color-accent2': second,
    '--color-accent2-ink': dark ? ACCENT2_INK_DARK : ACCENT2_INK_LIGHT,
    '--color-brand-deep': mix(brand, BLACK, dark ? 0.35 : 0.3),
    '--color-glow': glow,
    '--canvas-bg': layers[style.pattern] ?? canvas,
  };
}

function block(selector: string, tokens: Record<string, string>): string {
  const entries = Object.entries(tokens);
  return entries.length === 0 ? '' : `${selector} { ${entries.map(([name, value]) => `${name}: ${value};`).join(' ')} }`;
}

/**
 * Таблица стилей дизайна поставщика; `null` — остаётся оформление платформы.
 *
 * Без шаблона тёмный блок пишется только тогда, когда поставщик выбрал
 * цвет или фон: тёмные оттенки платформы уже стоят в `index.css`.
 */
export function designCss(design: ResolvedDesign): string | null {
  const light = supplierTokens(design.brand, design.background);
  const shared = design.template ? templateTokens(design.template) : {};
  const hasOwn = Object.keys(light).length > 0 || Object.keys(shared).length > 0;
  if (!hasOwn) return null;
  const dark = darkTokens(design.brand, design.background);
  const darkBlock: Record<string, string> = { ...dark };
  // Кремовую поверхность «Фермерского» тёмная тема возвращает к своей панели.
  if (shared['--color-surface']) darkBlock['--color-surface'] = DARK_PANEL;
  const lightBlock: Record<string, string> = { ...light, ...shared };
  const style = design.template?.style;
  if (style) {
    const brand = design.brand ?? PLATFORM_BRAND;
    Object.assign(lightBlock, styleTokens(style, brand, light['--color-canvas'] ?? CANVAS, false));
    Object.assign(darkBlock, styleTokens(style, brand, dark['--color-canvas'] ?? DARK_CANVAS, true));
  }
  return [
    block(':root', lightBlock),
    block("html[data-theme='dark']", darkBlock),
    // Заголовки экранов — в манере шаблона. Правилом вне слоёв, а не токеном
    // в `@layer base`: у заголовков стоят утилиты насыщенности и разрядки,
    // и правило основы им проиграло бы. Только внутри `main` — лист меню
    // и окна остаются в прежнем наборе.
    style ? 'main :is(h1, h2, h3) { font-weight: var(--heading-weight); letter-spacing: var(--heading-tracking); '
      + 'text-transform: var(--heading-case); }' : '',
  ]
    .filter(Boolean)
    .join('\n');
}
