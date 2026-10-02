import type { CSSProperties, ReactNode } from 'react';
import palette from './festiveScenes.json';

/**
 * Праздничная сцена под шапкой кабинета клиента — у каждого повода своя.
 *
 * Одна растяжка на все праздники, перекрашенная в цвет повода, читалась
 * одинаково: полоса и полоса. Здесь у каждого праздника свой сюжет, палитра,
 * шрифт и движение — ночное небо с гирляндой и снегом у Нового года, букет
 * и лепестки у 8 Марта, орнамент и восход у Наурыза, фонари и полумесяц
 * у Рамадана, волны у лета, школьная доска, чёрная пятница с лентой.
 *
 * Файл самодостаточный — только React и встроенные стили, — и одна и та же
 * копия лежит в кабинете клиента (`portal/src/features/shell`) и в
 * предпросмотре дизайна у продавца (`front/src/features/cabinetDesign`):
 * продавец видит ровно то, что увидят покупатели. Правка — в обоих; разойтись
 * им не даёт тест `FestiveScene.test.tsx` во front.
 *
 * Всё рисунки — украшение (`aria-hidden`), смысл несут заголовок и подпись.
 * Движение отключается у тех, кто попросил систему его убрать.
 */
export type FestiveOccasion =
  | 'NEW_YEAR' | 'MARCH_8' | 'NAURYZ' | 'RAMADAN' | 'SUMMER' | 'BACK_TO_SCHOOL' | 'BLACK_FRIDAY';

const SERIF = "'PT Serif', Georgia, serif";

interface Look {
  background: string;
  title: string;
  subtitle: string;
  titleShadow?: string;
}

const LOOKS = palette.looks as Record<FestiveOccasion, Look>;

/** Характер заголовка у повода: шрифт и начертание. Цвета — в палитре. */
const TITLE_STYLE: Partial<Record<FestiveOccasion, CSSProperties>> = {
  MARCH_8: { fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700 },
  RAMADAN: { fontFamily: SERIF, fontWeight: 700 },
  BACK_TO_SCHOOL: { fontFamily: SERIF, fontStyle: 'italic' },
  BLACK_FRIDAY: { textTransform: 'uppercase', fontWeight: 900, letterSpacing: '.04em' },
};

const NY = palette.NEW_YEAR;
const M8 = palette.MARCH_8;
const NZ = palette.NAURYZ;
const RM = palette.RAMADAN;
const SM = palette.SUMMER;
const BS = palette.BACK_TO_SCHOOL;
const BF = palette.BLACK_FRIDAY;

/** Разброс мелких частиц: левый край в процентах, размер, длительность, задержка. */
const SPREAD: [number, number, number, number][] = [
  [3, 4, 7, 0], [9, 3, 9, 2.1], [16, 5, 8, 4.2], [22, 3, 10, 1.3], [29, 4, 7.5, 3.3], [35, 3, 9, 0.7],
  [42, 5, 8.5, 2.6], [48, 3, 10, 4.8], [55, 4, 7, 1.8], [61, 3, 9.5, 3.9], [68, 5, 8, 0.4], [74, 3, 10, 2.9],
  [80, 4, 7.5, 4.4], [86, 3, 9, 1.1], [92, 5, 8, 3.1], [97, 3, 9.5, 0.2],
];

const CSS = `
.qfs { position: relative; isolation: isolate; overflow: hidden; }
.qfs-deco { position: absolute; pointer-events: none; }
@keyframes qfs-fall { from { translate: 0 -12px; } to { translate: 14px 150px; } }
@keyframes qfs-petal { from { translate: 0 -14px; rotate: 0deg; } to { translate: -30px 150px; rotate: 320deg; } }
@keyframes qfs-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes qfs-twinkle { 0%, 100% { opacity: .25; scale: .8; } 50% { opacity: 1; scale: 1.15; } }
@keyframes qfs-spin { to { rotate: 360deg; } }
@keyframes qfs-sway { 0%, 100% { rotate: -5deg; } 50% { rotate: 5deg; } }
@keyframes qfs-wave { to { translate: -50% 0; } }
@keyframes qfs-tape { to { background-position: 56px 0; } }
@keyframes qfs-fly { 0% { translate: -60px 40px; rotate: -8deg; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { translate: 110vw -30px; rotate: 6deg; opacity: 0; } }
@keyframes qfs-glow { 0%, 100% { filter: ${RM.glow}; } 50% { filter: ${RM.glowStrong}; } }
.qfs-fall { animation: qfs-fall linear infinite; }
.qfs-petal { animation: qfs-petal linear infinite; }
.qfs-blink { animation: qfs-blink 1.6s ease-in-out infinite; }
.qfs-twinkle { animation: qfs-twinkle 2.8s ease-in-out infinite; }
.qfs-spin { animation: qfs-spin 40s linear infinite; }
.qfs-sway { animation: qfs-sway 3.6s ease-in-out infinite; transform-origin: 50% 0; }
.qfs-wave { animation: qfs-wave 9s linear infinite; }
.qfs-tape { animation: qfs-tape 1.4s linear infinite; }
.qfs-fly { animation: qfs-fly 11s ease-in-out infinite; }
.qfs-glow { animation: qfs-glow 3.2s ease-in-out infinite; }
/* compact (phone): minor details hide, large ones shrink toward their corner */
.qfs[data-compact] .qfs-minor { display: none; }
.qfs[data-compact] .qfs-shrink { scale: .7; }
@media (prefers-reduced-motion: reduce) {
  .qfs * { animation: none !important; }
}
`;

const hidden = { 'aria-hidden': true } as const;

function NewYear() {
  const bulbs = NY.bulbs;
  return (
    <>
      {SPREAD.map(([left, size, duration, delay], index) => (
        <span key={index} {...hidden} className="qfs-deco qfs-fall"
          style={{ left: `${left}%`, top: -8, width: size, height: size, borderRadius: '50%', background: NY.snow, opacity: 0.85, animationDuration: `${duration}s`, animationDelay: `-${delay}s` }} />
      ))}
      <svg {...hidden} className="qfs-deco" viewBox="0 0 1000 30" preserveAspectRatio="none" style={{ left: 0, top: 0, width: '100%', height: 30 }}>
        <path d="M0 4 Q50 28 100 4 T200 4 T300 4 T400 4 T500 4 T600 4 T700 4 T800 4 T900 4 T1000 4" fill="none" stroke={NY.wire} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: 10 }, (_, index) => (
        <span key={index} {...hidden} className="qfs-deco qfs-blink"
          style={{ left: `calc(${5 + index * 10}% - 5px)`, top: 14, width: 10, height: 14, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: bulbs[index % 4], boxShadow: `0 0 10px 2px ${bulbs[index % 4]}`, animationDelay: `${(index % 4) * 0.4}s` }} />
      ))}
      <svg {...hidden} className="qfs-deco qfs-shrink" viewBox="0 0 140 110" style={{ transformOrigin: '100% 100%', right: `calc(var(--qfs-r) + 12px)`, bottom: 0, width: 140, height: 110 }}>
        {[[30, 1], [92, 1.25]].map(([x, s], index) => (
          <g key={index} transform={`translate(${x} ${110 - 96 * s}) scale(${s})`}>
            <rect x="-5" y="80" width="10" height="16" fill={NY.trunk} />
            <path d="M0 0 L26 34 H12 L32 60 H14 L36 84 H-36 L-14 60 H-32 L-12 34 H-26 Z" fill={NY.tree} />
            <path d="M-26 34 H-12 L-4 30 L4 36 L12 34 H26 L20 28 H-20 Z M-32 60 H-14 L-4 55 L6 61 L14 60 H32 L25 53 H-25 Z" fill={NY.snowcap} opacity=".9" />
            <path d="M0 -12 L3 -4 L11 -4 L5 1 L7 9 L0 4 L-7 9 L-5 1 L-11 -4 L-3 -4 Z" fill={NY.star} className="qfs-blink" />
          </g>
        ))}
      </svg>
    </>
  );
}

function March8() {
  return (
    <>
      {SPREAD.slice(0, 10).map(([left, size, duration, delay], index) => (
        <span key={index} {...hidden} className="qfs-deco qfs-petal"
          style={{ left: `${left + 4}%`, top: -10, width: size + 6, height: size + 3, borderRadius: '70% 0 70% 0', background: M8.petals[index % 2], opacity: 0.85, animationDuration: `${duration + 2}s`, animationDelay: `-${delay}s` }} />
      ))}
      <span {...hidden} className="qfs-deco qfs-minor"
        style={{ right: `calc(var(--qfs-r) + 150px)`, top: -30, fontFamily: SERIF, fontSize: 170, fontWeight: 700, lineHeight: 1, color: 'transparent', WebkitTextStroke: `2px ${M8.eight}`, opacity: 0.45, rotate: '-8deg' }}>8</span>
      <svg {...hidden} className="qfs-deco qfs-sway qfs-shrink" viewBox="0 0 130 120" style={{ transformOrigin: '50% 100%', right: `calc(var(--qfs-r) + 16px)`, bottom: -6, width: 130, height: 120 }}>
        <path d="M65 118 C60 90 40 70 34 48 M65 118 C65 88 66 64 66 40 M65 118 C72 92 90 72 98 50" fill="none" stroke={M8.stem} strokeWidth="3" strokeLinecap="round" />
        <path d="M58 100 C44 92 34 80 30 66 C46 72 56 84 58 100 Z M72 98 C86 90 96 80 100 66 C84 72 74 84 72 98 Z" fill={M8.leaf} />
        {([[34, 40], [66, 30], [98, 42]] as const).map(([x, y], index) => (
          <path key={index} transform={`translate(${x} ${y})`} d="M-11 -2 C-12 -16 -6 -22 -4 -22 C-2 -16 0 -14 0 -14 C0 -14 2 -16 4 -22 C6 -22 12 -16 11 -2 C10 8 4 12 0 12 C-4 12 -10 8 -11 -2 Z" fill={M8.tulips[index]} />
        ))}
        <path d="M44 104 L86 104 L78 90 L52 90 Z" fill={M8.wrap} opacity=".85" />
      </svg>
    </>
  );
}

function Nauryz() {
  const ornament = (y: number, flip: boolean) => (
    <svg {...hidden} className="qfs-deco" style={{ left: 0, [flip ? 'bottom' : 'top']: 0, width: '100%', height: 16 }} key={y}>
      <defs>
        <pattern id={`qfs-muiz-${flip ? 'b' : 't'}`} width="44" height="16" patternUnits="userSpaceOnUse">
          <path d={flip
            ? 'M0 0 C0 12 12 12 12 6 C12 2 8 2 8 5 M44 0 C44 12 32 12 32 6 C32 2 36 2 36 5 M12 6 H32'
            : 'M0 16 C0 4 12 4 12 10 C12 14 8 14 8 11 M44 16 C44 4 32 4 32 10 C32 14 36 14 36 11 M12 10 H32'}
            fill="none" stroke={NZ.ornament} strokeWidth="2" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="16" fill={`url(#qfs-muiz-${flip ? 'b' : 't'})`} />
    </svg>
  );
  return (
    <>
      {ornament(0, false)}
      {ornament(1, true)}
      <svg {...hidden} className="qfs-deco qfs-shrink" viewBox="-60 -60 120 120" style={{ transformOrigin: '100% 100%', right: `calc(var(--qfs-r) + 20px)`, bottom: -62, width: 150, height: 150 }}>
        <g className="qfs-spin" style={{ transformOrigin: '0 0', transformBox: 'view-box' }}>
          {Array.from({ length: 16 }, (_, index) => (
            <rect key={index} x="-2" y="-58" width="4" height="16" rx="2" fill={NZ.rays} transform={`rotate(${index * 22.5})`} />
          ))}
        </g>
        <circle r="34" fill={NZ.sun} />
        <circle r="34" fill="none" stroke={NZ.sunRing} strokeWidth="3" opacity=".6" />
      </svg>
      <svg {...hidden} className="qfs-deco qfs-minor" viewBox="0 0 60 60" style={{ right: `calc(var(--qfs-r) + 176px)`, top: 22, width: 60, height: 60, opacity: 0.35 }}>
        <circle cx="30" cy="30" r="26" fill="none" stroke={NZ.shanyrak} strokeWidth="3" />
        <path d="M8 30 H52 M30 8 V52 M14 14 L46 46 M46 14 L14 46" stroke={NZ.shanyrak} strokeWidth="2" />
        <circle cx="30" cy="30" r="9" fill="none" stroke={NZ.shanyrak} strokeWidth="3" />
      </svg>
    </>
  );
}

function Ramadan() {
  const lantern = (x: number, drop: number, delay: number) => (
    <svg {...hidden} key={x} className="qfs-deco qfs-sway" viewBox="0 0 30 90" style={{ right: `calc(var(--qfs-r) + ${x}px)`, top: 0, width: 30, height: 30 + drop, animationDelay: `${delay}s` }}>
      <line x1="15" y1="0" x2="15" y2={drop} stroke={RM.string} strokeWidth="1.2" />
      <g transform={`translate(0 ${drop})`}>
        <path d="M9 0 H21 L24 6 H6 Z" fill={RM.cap} />
        <path d="M6 6 H24 L27 22 L22 30 H8 L3 22 Z" fill={RM.body} />
        <path d="M9 9 H21 L23 21 L19 27 H11 L7 21 Z" fill={RM.light} className="qfs-blink" />
        <path d="M11 30 H19 L15 36 Z" fill={RM.cap} />
      </g>
    </svg>
  );
  return (
    <>
      {SPREAD.map(([left, size, , delay], index) => (
        <span key={index} {...hidden} className="qfs-deco qfs-twinkle"
          style={{ left: `${left}%`, top: `${12 + ((index * 37) % 60)}%`, width: size - 1, height: size - 1, borderRadius: '50%', background: RM.stars, animationDelay: `${delay}s` }} />
      ))}
      <svg {...hidden} className="qfs-deco qfs-glow qfs-minor" viewBox="0 0 80 80" style={{ right: `calc(var(--qfs-r) + 150px)`, top: 10, width: 70, height: 70 }}>
        <path d="M52 8 A32 32 0 1 0 72 58 A26 26 0 1 1 52 8 Z" fill={RM.moon} />
        <path d="M62 24 L64 30 L70 30 L65 34 L67 40 L62 36 L57 40 L59 34 L54 30 L60 30 Z" fill={RM.moon} />
      </svg>
      {lantern(24, 26, 0)}
      {lantern(62, 12, 0.6)}
      {lantern(100, 34, 1.2)}
      <svg {...hidden} className="qfs-deco qfs-shrink" viewBox="0 0 240 50" preserveAspectRatio="xMaxYMax meet" style={{ transformOrigin: '100% 100%', right: `calc(var(--qfs-r) + 0px)`, bottom: 0, width: 240, height: 50 }}>
        <path d="M0 50 V40 H40 V30 C40 18 60 14 64 30 V40 H90 V22 C90 4 130 4 130 22 V40 H150 V28 C150 16 170 16 170 28 V40 H200 V18 H204 V8 H206 V18 H210 V40 H240 V50 Z" fill={RM.mosque} opacity=".9" />
      </svg>
    </>
  );
}

function Summer() {
  const wave = (color: string, height: number, duration: number, opacity: number) => (
    <div {...hidden} className="qfs-deco" style={{ left: 0, bottom: 0, width: '100%', height, overflow: 'hidden' }}>
      <svg className="qfs-wave" viewBox="0 0 1200 40" preserveAspectRatio="none" style={{ width: '200%', height: '100%', display: 'block', animationDuration: `${duration}s`, opacity }}>
        <path d="M0 20 Q75 0 150 20 T300 20 T450 20 T600 20 T750 20 T900 20 T1050 20 T1200 20 V40 H0 Z" fill={color} />
      </svg>
    </div>
  );
  return (
    <>
      <svg {...hidden} className="qfs-deco qfs-shrink" viewBox="-60 -60 120 120" style={{ transformOrigin: '100% 0', right: `calc(var(--qfs-r) + 34px)`, top: -26, width: 130, height: 130 }}>
        <g className="qfs-spin" style={{ transformOrigin: '0 0', transformBox: 'view-box' }}>
          {Array.from({ length: 12 }, (_, index) => (
            <path key={index} d="M-5 -34 L0 -56 L5 -34 Z" fill={SM.rays} transform={`rotate(${index * 30})`} />
          ))}
        </g>
        <circle r="28" fill={SM.sun} />
      </svg>
      <svg {...hidden} className="qfs-deco qfs-minor" viewBox="0 0 80 30" style={{ right: `calc(var(--qfs-r) + 200px)`, top: 18, width: 80, height: 30 }}>
        <path d="M4 14 Q12 6 18 14 Q24 6 32 14 M46 22 Q52 16 57 22 Q62 16 68 22" fill="none" stroke={SM.gulls} strokeWidth="2" strokeLinecap="round" />
      </svg>
      {wave(SM.waveBack, 26, 12, 0.7)}
      {wave(SM.waveFront, 16, 8, 1)}
    </>
  );
}

function BackToSchool() {
  return (
    <>
      <div {...hidden} className="qfs-deco" style={{ inset: 0, boxShadow: BS.frame, borderRadius: 'inherit' }} />
      <svg {...hidden} className="qfs-deco qfs-minor" viewBox="0 0 260 110" style={{ right: `calc(var(--qfs-r) + 120px)`, top: 0, width: 260, height: 110, opacity: 0.55 }}>
        <g fill="none" stroke={BS.chalk} strokeWidth="1.6" strokeLinecap="round" fontFamily={SERIF} fontStyle="italic">
          <text x="10" y="34" fill={BS.chalk} stroke="none" fontSize="22">A B C</text>
          <text x="120" y="30" fill={BS.chalk} stroke="none" fontSize="18">2 + 2 = 4</text>
          <text x="70" y="86" fill={BS.chalk} stroke="none" fontSize="18">a² + b² = c²</text>
          <path d="M220 60 L226 72 L240 74 L230 83 L233 97 L220 90 L207 97 L210 83 L200 74 L214 72 Z" />
          <path d="M10 60 Q30 50 50 60 T90 60" />
        </g>
      </svg>
      <svg {...hidden} className="qfs-deco qfs-shrink" viewBox="0 0 120 40" style={{ transformOrigin: '100% 100%', right: `calc(var(--qfs-r) + 14px)`, bottom: 10, width: 120, height: 40, rotate: '-14deg' }}>
        <rect x="18" y="12" width="84" height="16" fill={BS.pencil} />
        <rect x="18" y="12" width="84" height="5" fill={BS.pencilLight} />
        <rect x="102" y="12" width="12" height="16" rx="3" fill={BS.eraser} />
        <rect x="98" y="12" width="6" height="16" fill={BS.ferrule} />
        <path d="M18 12 L2 20 L18 28 Z" fill={BS.wood} />
        <path d="M7 17.5 L2 20 L7 22.5 Z" fill={BS.lead} />
      </svg>
      <svg {...hidden} className="qfs-deco qfs-fly" viewBox="0 0 40 24" style={{ left: 0, top: 4, width: 32, height: 20 }}>
        <path d="M0 12 L40 0 L22 24 L18 15 Z" fill={BS.plane} />
        <path d="M18 15 L40 0 L14 13 Z" fill={BS.planeFold} />
      </svg>
    </>
  );
}

function BlackFriday() {
  const tape = (edge: 'top' | 'bottom') => (
    <div {...hidden} className="qfs-deco qfs-tape"
      style={{ left: 0, [edge]: 0, width: '100%', height: 10, background: BF.tape, backgroundSize: '56px 10px' }} />
  );
  return (
    <>
      {tape('top')}
      {tape('bottom')}
      <span {...hidden} className="qfs-deco qfs-minor"
        style={{ right: `calc(var(--qfs-r) + 150px)`, top: -24, fontSize: 150, fontWeight: 900, lineHeight: 1, color: 'transparent', WebkitTextStroke: `2px ${BF.accent}`, opacity: 0.4, textShadow: BF.percentShadow }}>%</span>
      <svg {...hidden} className="qfs-deco qfs-sway qfs-shrink" viewBox="0 0 70 110" style={{ right: `calc(var(--qfs-r) + 36px)`, top: 10, width: 70, height: 110 }}>
        <line x1="35" y1="0" x2="35" y2="24" stroke={BF.string} strokeWidth="1.2" />
        <path d="M20 24 H50 L60 40 V96 H10 V40 Z" fill={BF.accent} />
        <circle cx="35" cy="36" r="4" fill={BF.ink} />
        <text x="35" y="76" textAnchor="middle" fontSize="26" fontWeight="900" fill={BF.ink}>%</text>
      </svg>
    </>
  );
}

const SCENES: Record<FestiveOccasion, () => ReactNode> = {
  NEW_YEAR: NewYear,
  MARCH_8: March8,
  NAURYZ: Nauryz,
  RAMADAN: Ramadan,
  SUMMER: Summer,
  BACK_TO_SCHOOL: BackToSchool,
  BLACK_FRIDAY: BlackFriday,
};

export function isFestiveOccasion(code: string): code is FestiveOccasion {
  return code in LOOKS;
}

/**
 * Сцена праздника: декорации повода, поздравление и подпись.
 * `action` — кнопка справа (в кабинете клиента — «спрятать до завтра»).
 */
export function FestiveScene({ occasion, title, subtitle, action, compact = false }: {
  occasion: FestiveOccasion;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const look = LOOKS[occasion];
  const Scene = SCENES[occasion];
  return (
    <div className="qfs" data-occasion={occasion} data-compact={compact ? '' : undefined}
      // Рисунки справа отступают на ширину кнопки: иначе она ложится на ёлку или букет.
      style={{ background: look.background, minHeight: compact ? 92 : 116, ['--qfs-r' as string]: action ? (compact ? '44px' : '60px') : '0px' }}>
      <style>{CSS}</style>
      <Scene />
      <div style={{
        position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minHeight: compact ? 92 : 116,
        padding: compact ? '22px 16px 14px' : '26px 32px 18px', boxSizing: 'border-box',
        maxWidth: compact ? 'calc(100% - 150px)' : 'calc(100% - 300px)',
      }}>
        <span style={{ color: look.title, fontSize: compact ? 20 : 28, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-.01em', textShadow: look.titleShadow, ...TITLE_STYLE[occasion] }}>
          {title}
        </span>
        {subtitle ? (
          <span style={{ color: look.subtitle, fontSize: compact ? 12.5 : 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </span>
        ) : null}
      </div>
      {action ? (
        <div style={{ position: 'absolute', top: compact ? 6 : 10, right: compact ? 4 : 10, zIndex: 1, color: look.title }}>{action}</div>
      ) : null}
    </div>
  );
}
