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

import { TEMPLATE_FONTS, type MotionStyle, type MotionTemplate, type ResolvedDesign, type TemplateInks } from './cabinetDesign';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const WHITE = '#FFFFFF';
const BLACK = '#000000';

/** Бумага кабинета — от неё разбавляется фон «в тон фирменному». */
const CANVAS = '#F5F2EC';

/**
 * Бумага «в тон фирменному»: цвет, почти растворённый в бумаге (`share` — его доля).
 *
 * Доля уменьшается, пока самый бледный текст кабинета (`ink-faint`, `faint`) не
 * читается на ней с контрастом 4,5:1: тёмный или насыщенный цвет на 12 % притемнял
 * бумагу так, что даты цен и «На странице» опускались до 3,7:1.
 */
function brandPaper(brand: string, paper: string, faint: string, share: number): string {
  let canvas = mix(brand, paper, 1 - share);
  for (let k = share - 0.01; contrastRatio(faint, canvas) < 4.5 && k > 0; k -= 0.01) canvas = mix(brand, paper, 1 - k);
  return canvas;
}

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
  IVORY: '#F6F2E6',
  LEMON: '#F6F1D6',
  APRICOT: '#F7E4D2',
  CORAL: '#F6E0DA',
  ROSE: '#F5E1EA',
  PLUM: '#ECE2EE',
  AZURE: '#E0EBF5',
  TEAL: '#DDEDEC',
  PISTACHIO: '#E8EFD9',
  STONE: '#E9E6E1',
};

function channels(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16)) as [number, number, number];
}

function luminanceOf(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Надпись, читаемая на цвете: белая или почти чёрная — у какой контраст выше. */
export function readableOn(hex: string): string {
  const luminance = luminanceOf(hex);
  // Контраст с белым (1.05 / (L + .05)) против контраста с #1A1917 (≈ L 0.01).
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.06 ? WHITE : '#1A1917';
}

/** Контраст двух цветов #RRGGBB по WCAG: 1 — одинаковые, 21 — чёрный на белом. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminanceOf(a), luminanceOf(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Заливка и надпись кнопки для цвета бренда. Надпись — белая или тёмная,
 * какая читается лучше; у среднего тона не читается ни одна (контраст ниже
 * 4,5:1) — тогда заливка темнеет до белой надписи с контрастом 4,5:1.
 */
export function buttonColors(brand: string): { fill: string; text: string } {
  const text = readableOn(brand);
  if (contrastRatio(brand, text) >= 4.5) return { fill: brand, text };
  let fill = brand;
  for (let k = 0.04; contrastRatio(fill, WHITE) < 4.5 && k < 1; k += 0.04) fill = mix(brand, BLACK, k);
  return { fill, text: WHITE };
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
    // Кнопка — цвет бренда с читаемой надписью; средний тон темнеет (`buttonColors`).
    const button = buttonColors(brand);
    tokens['--color-accent'] = button.fill;
    tokens['--color-on-accent'] = button.text;
    tokens['--color-on-brand'] = readableOn(brand);
    tokens['--color-accent-top'] = mix(brand, WHITE, 0.12);
    // Баннеры и распродажа днём — сам фирменный цвет (макет: banner = brand).
    tokens['--color-banner'] = brand;
    tokens['--color-accent-soft'] = mix(brand, WHITE, 0.86);
    // Текст на мягкой подложке и заливка под курсором — как в макете.
    // У светлого цвета (жёлтый мел) текст на светлом уводится глубже в чёрный — иначе не читается.
    const ink = mix(brand, BLACK, 0.22);
    tokens['--color-accent-ink'] = (1.05 / (luminanceOf(ink) + 0.05)) >= 4.5 ? ink : mix(brand, BLACK, 0.62);
    tokens['--color-accent-hover'] = mix(brand, BLACK, 0.18);
    tokens['--shadow-accent'] = `0 4px 10px -4px rgb(${r} ${g} ${b} / 0.4), 0 14px 28px -14px rgb(${r} ${g} ${b} / 0.55)`;
    // Шапка — как у сотрудников: цвет, почти растворённый в белом, и линия под ней.
    tokens['--color-bar'] = mix(brand, WHITE, 0.93);
    tokens['--color-bar-wide'] = mix(brand, WHITE, 0.93);
    tokens['--color-bar-line'] = mix(brand, WHITE, 0.78);
  }

  if (background === 'BRAND' && brand) {
    tokens['--color-canvas'] = brandPaper(brand, CANVAS, '#67625A', 0.12);
  } else if (background && BACKGROUNDS[background]) {
    tokens['--color-canvas'] = BACKGROUNDS[background];
  }

  return tokens;
}

/** Цвет платформы: от него считаются тёмные оттенки, когда свой цвет не выбран. */
const PLATFORM_BRAND = '#015640';
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
  // Светлый и яркий цвет (жёлтый мел «Лавки», зелёный «Сцены») и ночью
  // читается как кнопка сам — разбавлять его белым значит выцветить шаблон.
  const bright = (luminanceOf(brand) + 0.05) / (luminanceOf(DARK_PANEL) + 0.05) >= 4.5;
  // Надпись — по контрасту к ночной заливке; средний тон темнеет (`buttonColors`).
  const night = buttonColors(bright ? brand : mix(brand, WHITE, 0.5));
  const button = night.fill;
  // Полоса и баннер у яркого цвета — сам цвет с тёмной надписью: притушенный
  // панелью жёлтый или зелёный становится грязно-оливковым.
  const strip = bright ? brand : mix(brand, DARK_PANEL, 0.35);
  const tokens: Record<string, string> = {
    '--color-accent': button,
    '--color-on-accent': night.text,
    '--color-accent-top': mix(button, WHITE, 0.12),
    '--color-accent-hover': mix(button, WHITE, 0.18),
    '--color-accent-soft': mix(brand, DARK_PANEL, bright ? 0.8 : 0.62),
    '--color-accent-ink': mix(brand, WHITE, 0.7),
    '--color-strip': strip,
    '--color-on-brand': readableOn(strip),
    // Баннер ночью — цвет, притушенный панелью (макет: mix(brand, #1B1C1F, .35)):
    // светлая кнопочная заливка под белыми буквами баннера не читается.
    '--color-banner': strip,
    '--color-bar': mix(brand, DARK_PANEL, 0.9),
    '--color-bar-wide': mix(brand, DARK_PANEL, 0.9),
    '--color-bar-line': mix(brand, DARK_LINE, 0.8),
    '--shadow-accent': `0 4px 10px -4px rgb(0 0 0 / 0.5), 0 14px 28px -14px rgb(${r} ${g} ${b} / 0.45)`,
  };
  if (background === 'BRAND') {
    tokens['--color-canvas'] = brandPaper(brand, DARK_CANVAS, '#9196A0', 0.13);
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
export function templateTokens(template: MotionTemplate): Record<string, string> {
  const tokens: Record<string, string> = {
    ...templateRadii(template.radius),
    ...(CARD_STYLES[template.card] ?? {}),
  };
  const sans = TEMPLATE_FONTS[template.font];
  const heading = TEMPLATE_FONTS[template.heading];
  if (sans) tokens['--font-sans'] = sans;
  if (heading) tokens['--font-heading'] = heading;
  // Моноширинный шрифт — у шаблонов с моноширинной ценой и у тех, что
  // его указали: остальным артикулы остаются системным стеком `index.css`.
  if (template.font === 'mono' || template.heading === 'mono' || template.style?.price === 'mono') tokens['--font-mono'] = TEMPLATE_FONTS.mono;
  // Почерк для цены маркером и надписей мелом.
  tokens['--font-hand'] = TEMPLATE_FONTS.caveat;
  // Множитель к размеру корня: ступени «крупный шрифт» покупателя умножаются
  // на него, а не заменяются им (см. `index.css`).
  if (template.scale !== 1) tokens['--ui-scale'] = String(template.scale);
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
/** Тёмный текст на втором цвете шаблона; на тёмном втором цвете — белый. */
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
/**
 * Фирменный цвет для текста: тот же оттенок, уведённый к чёрному (днём) или к белому (ночью),
 * пока не читается на бумаге с контрастом 4,5:1. Неоновый и жёлтый цвет шаблона как текст
 * на светлой бумаге давал 1,2–1,7:1.
 */
function shopInk(brand: string, papers: string[], dark: boolean): string {
  const toward = dark ? WHITE : BLACK;
  const reads = (ink: string) => papers.every((paper) => contrastRatio(ink, paper) >= 4.5);
  let ink = dark ? mix(brand, WHITE, 0.6) : brand;
  for (let k = 0.04; !reads(ink) && k <= 1; k += 0.04) ink = mix(brand, toward, dark ? 0.6 + k * 0.4 : k);
  return ink;
}

function styleTokens(style: MotionStyle, brand: string, canvas: string, dark: boolean, surface?: string): Record<string, string> {
  const accent2 = HEX.test(style.accent2) ? style.accent2.toUpperCase() : brand;
  const second = dark ? accent2 : mix(accent2, BLACK, 0.08);
  const faint = dark ? FAINT_DARK : FAINT_LIGHT;
  const layers: Record<MotionStyle['pattern'], string> = {
    none: canvas,
    dots: `radial-gradient(${faint} 1.2px, ${canvas} 1.6px) 0 0 / 18px 18px, ${canvas}`,
    grid: `linear-gradient(${mix(faint, canvas, 0.55)} 1px, ${canvas} 1px) 0 0 / 100% 28px, `
      + `linear-gradient(90deg, ${mix(faint, canvas, 0.55)} 1px, ${canvas} 1px) 0 0 / 28px 100%`,
    grain: `repeating-linear-gradient(45deg, ${mix(faint, canvas, 0.8)} 0 1px, ${canvas} 1px 7px)`,
    ornament: `${ornamentLayer(mix(faint, canvas, 0.35))} 0 0 / 56px 56px, ${canvas}`,
  };
  return {
    // Фирменный цвет как есть — в обеих темах: градиенты баннеров и колонки
    // «разворота» рисуются им, а не осветлённой кнопочной заливкой ночи.
    '--color-shop': brand,
    '--color-on-shop': readableOn(brand),
    // И к бумаге, и к карточке: у «Желе» карточка темнее бумаги.
    '--color-shop-ink': shopInk(brand, surface ? [canvas, surface] : [canvas], dark),
    '--color-accent2': second,
    // По контрасту: у праздников второй цвет бывает тёмным (красный, синий),
    // и прежний «всегда тёмный» текст на нём не читался.
    '--color-accent2-ink': readableOn(second) === WHITE ? WHITE : dark ? ACCENT2_INK_DARK : ACCENT2_INK_LIGHT,
    '--color-brand-deep': mix(brand, BLACK, dark ? 0.35 : 0.3),
    '--canvas-bg': layers[style.pattern] ?? canvas,
  };
}

/**
 * Орнамент «қошқар мүйіз» — бараньи рога казахского узора, бледной линией.
 * Тот же рисунок, что у предпросмотра продавца (`ornamentLayer` в `designModel.ts`).
 */
export function ornamentLayer(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56' fill='none' stroke='${color}' stroke-width='1.4' stroke-linecap='round'>`
    + '<path d=\'M28 40V31M28 31C28 22 20 16 15 20C11 23 14 29 18 27M28 31C28 22 36 16 41 20C45 23 42 29 38 27\'/>'
    + '<path d=\'M0 8h4M52 8h4M28 50v6\'/></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Бумага, панель, линии и чернила шаблона. Бумага — только когда продавец
 * не выбрал свой фон: выбранный фон главнее шаблона.
 */
function inkTokens(inks: TemplateInks, canvas: string): Record<string, string> {
  return {
    '--color-canvas': canvas,
    '--color-surface': inks.surface,
    '--color-sunk': mix(inks.surface, inks.canvas, 0.5),
    '--color-hairline': mix(inks.line, inks.surface, 0.35),
    '--color-line': inks.line,
    '--color-ink': inks.ink,
    '--color-ink-muted': inks.muted,
    '--color-ink-subtle': inks.muted,
    '--color-ink-faint': inks.muted,
    // Шапка — на панели шаблона, а не цветом, растворённым в белом.
    '--color-bar': inks.surface,
    '--color-bar-wide': inks.surface,
    '--color-bar-line': inks.line,
  };
}

function block(selector: string, tokens: Record<string, string>): string {
  const entries = Object.entries(tokens);
  return entries.length === 0 ? '' : `${selector} { ${entries.map(([name, value]) => `${name}: ${value};`).join(' ')} }`;
}

const PLATFORM_ONLY = ['--color-accent', '--color-on-accent', '--color-accent-top', '--color-accent-soft',
  '--color-accent-ink', '--color-accent-hover', '--shadow-accent'];

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
  const lightBlock: Record<string, string> = { ...light, ...shared };
  const inks = design.template?.palette;
  const lightCanvas = light['--color-canvas'] ?? inks?.light.canvas ?? CANVAS;
  const darkCanvas = dark['--color-canvas'] ?? inks?.dark.canvas ?? DARK_CANVAS;
  if (inks) {
    Object.assign(lightBlock, inkTokens(inks.light, lightCanvas));
    Object.assign(darkBlock, inkTokens(inks.dark, darkCanvas));
  }
  const style = design.template?.style;
  if (style) {
    const brand = design.brand ?? PLATFORM_BRAND;
    Object.assign(lightBlock, styleTokens(style, brand, lightCanvas, false, inks?.light.surface));
    Object.assign(darkBlock, styleTokens(style, brand, darkCanvas, true, inks?.dark.surface));
  }
  // Кнопки и ссылки — общий цвет платформы из `index.css`, продавец его не меняет
  // (решение владельца 2026-10-30): его цвет остаётся шапке, баннерам и фону.
  for (const token of PLATFORM_ONLY) {
    delete lightBlock[token];
    delete darkBlock[token];
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
