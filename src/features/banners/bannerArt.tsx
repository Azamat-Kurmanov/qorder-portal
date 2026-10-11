import type { CSSProperties, ReactNode } from 'react';
import type { SlideColors } from './bannerTheme';
import palette from './bannerPalette.json';

/**
 * Иллюстрации шаблонов баннера — своя у каждого из 48.
 *
 * Прежде слайд без фото показывал общий силуэт сумки, а темы — простой
 * значок, и десяток шаблонов выглядели одинаково. Здесь у каждого свой
 * сюжет: ёлка с подарками у Нового года, юрта у Наурыза, торт у дня
 * рождения, кошелёк с монетами у кэшбэка, фургон у доставки.
 *
 * Поле 200×200. Главный предмет — цвета схемы слайда (`c.circleBg` и
 * оттенки `c.stack`), детали — постоянной палитрой `art`: иллюстрация
 * всегда в тон баннеру. Все рисунки — украшение, диктору не читаются.
 *
 * Одна и та же копия лежит в редакторе продавца (`front`) и в кабинете
 * клиента (`portal`): продавец видит ровно то, что увидит покупатель.
 */
const P = palette.art;

type Parts = { A: string; Ai: string; s0: string; s1: string; s2: string };

/** Мягкая тень под предметом — он стоит, а не висит. */
const Ground = ({ y = 178, w = 64 }: { y?: number; w?: number }) => <ellipse cx="100" cy={y} rx={w} ry="9" fill={P.shadow} />;

/** Четырёхлучевая искра. */
const Spark = ({ x, y, r = 8, fill = P.gold }: { x: number; y: number; r?: number; fill?: string }) => (
  <path d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`} fill={fill} />
);

const Coin = ({ x, y, r = 14 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={P.goldDeep} />
    <circle cx={x - 2} cy={y - 2} r={r - 2} fill={P.gold} />
    <circle cx={x - 2} cy={y - 2} r={r - 7} fill="none" stroke={P.goldDeep} strokeWidth="2" />
  </g>
);

const Star = ({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return <polygon points={pts} fill={fill} />;
};

const Bag = ({ x, y, w, h, fill, handle = P.ink }: { x: number; y: number; w: number; h: number; fill: string; handle?: string }) => (
  <g>
    <path d={`M${x + w * 0.3} ${y}V${y - h * 0.22}a${w * 0.2} ${w * 0.2} 0 0 1 ${w * 0.4} 0V${y}`} fill="none" stroke={handle} strokeWidth="4" strokeLinecap="round" />
    <rect x={x} y={y} width={w} height={h} rx="6" fill={fill} />
    <rect x={x} y={y} width={w * 0.22} height={h} rx="6" fill={P.glass} opacity=".35" />
  </g>
);

const Box = ({ x, y, w, h, fill, tape = P.gold }: { x: number; y: number; w: number; h: number; fill: string; tape?: string }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="4" fill={fill} />
    <rect x={x} y={y} width={w} height={h * 0.18} rx="4" fill={P.shadow} />
    <rect x={x + w * 0.42} y={y} width={w * 0.16} height={h} fill={tape} opacity=".85" />
  </g>
);

const Gift = ({ x, y, w, fill, ribbon }: { x: number; y: number; w: number; fill: string; ribbon: string }) => (
  <g>
    <rect x={x} y={y + w * 0.28} width={w} height={w * 0.72} rx="5" fill={fill} />
    <rect x={x - w * 0.06} y={y + w * 0.16} width={w * 1.12} height={w * 0.2} rx="4" fill={fill} />
    <rect x={x + w * 0.43} y={y + w * 0.16} width={w * 0.14} height={w * 0.84} fill={ribbon} />
    <path d={`M${x + w / 2} ${y + w * 0.17}c-${w * 0.1}-${w * 0.2}-${w * 0.36}-${w * 0.22}-${w * 0.3}-${w * 0.02}c${w * 0.04} ${w * 0.08} ${w * 0.2} ${w * 0.06} ${w * 0.3} ${w * 0.02}zm0 0c${w * 0.1}-${w * 0.2} ${w * 0.36}-${w * 0.22} ${w * 0.3}-${w * 0.02}c-${w * 0.04} ${w * 0.08}-${w * 0.2} ${w * 0.06}-${w * 0.3} ${w * 0.02}z`} fill={ribbon} />
  </g>
);

const Hanger = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <path d={`M${x} ${y - 16}a6 6 0 1 1 6 6v6L${x + w / 2} ${y + 14}H${x - w / 2}L${x + 6} ${y - 4}`} fill="none" stroke={P.grayDeep} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
);

const Dress = ({ x, y, fill }: { x: number; y: number; fill: string }) => (
  <g>
    <path d={`M${x - 14} ${y}h28l-4 22 26 58H${x - 42}l26-58z`} fill={fill} />
    <path d={`M${x - 18} ${y + 22}h36`} stroke={P.glass} strokeWidth="4" />
  </g>
);

const Calendar = ({ x, y, w, fill, mark }: { x: number; y: number; w: number; fill: string; mark?: ReactNode }) => (
  <g>
    <rect x={x} y={y} width={w} height={w * 0.9} rx="10" fill={P.white} />
    <rect x={x} y={y} width={w} height={w * 0.24} rx="10" fill={fill} />
    <rect x={x} y={y + w * 0.14} width={w} height={w * 0.1} fill={fill} />
    <rect x={x + w * 0.22} y={y - 8} width="7" height="18" rx="3" fill={P.ink} />
    <rect x={x + w * 0.7} y={y - 8} width="7" height="18" rx="3" fill={P.ink} />
    {Array.from({ length: 9 }, (_, i) => (
      <rect key={i} x={x + w * 0.12 + (i % 3) * w * 0.28} y={y + w * 0.34 + Math.floor(i / 3) * w * 0.18} width={w * 0.18} height={w * 0.11} rx="3" fill={P.gray} />
    ))}
    {mark}
  </g>
);

const Tag = ({ x, y, fill, text }: { x: number; y: number; fill: string; text?: string }) => (
  <g transform={`rotate(-14 ${x} ${y})`}>
    <path d={`M${x} ${y}h54l18 22-18 22H${x}z`} fill={fill} />
    <circle cx={x + 58} cy={y + 22} r="5" fill={P.white} />
    {text ? <text x={x + 26} y={y + 30} textAnchor="middle" fontSize="20" fontWeight="900" fill={P.white}>{text}</text> : null}
  </g>
);

/* ----------------------------------------------------------------------------
 * Сюжеты шаблонов
 * ------------------------------------------------------------------------- */

const ART: Record<string, (p: Parts) => ReactNode> = {
  /* Базовые */
  SALE: ({ A, s1 }) => (
    <>
      <Ground w={70} />
      <Bag x={34} y={78} w={62} h={96} fill={s1} />
      <Bag x={88} y={64} w={76} h={110} fill={A} handle={P.ink} />
      <Tag x={104} y={34} fill={P.red} text="%" />
      <Spark x={40} y={50} r={10} />
    </>
  ),
  NEW_ITEM: ({ A, s1 }) => (
    <>
      <Ground />
      <path d="M44 108h112v66H44z" fill={s1} />
      <path d="M44 108l22-24h68l22 24z" fill={A} />
      <Hanger x={100} y={60} w={50} />
      <Dress x={100} y={74} fill={A} />
      <Spark x={48} y={60} /><Spark x={158} y={72} r={6} fill={P.white} />
    </>
  ),
  BULK: ({ A, s1, s2 }) => (
    <>
      <Ground w={80} />
      <rect x="30" y="164" width="140" height="10" rx="3" fill={P.brown} />
      <Box x={34} y={112} w={62} h={52} fill={s1} />
      <Box x={100} y={112} w={62} h={52} fill={A} />
      <Box x={66} y={60} w={62} h={52} fill={s2} />
      <text x="97" y="96" textAnchor="middle" fontSize="18" fontWeight="900" fill={P.ink}>×10</text>
    </>
  ),

  /* Раскладки */
  SPLIT: ({ A, s1 }) => (
    <>
      <Ground w={72} />
      <path d="M40 40h120M52 40v134M148 40v134" stroke={P.grayDeep} strokeWidth="5" strokeLinecap="round" />
      <Dress x={78} y={60} fill={A} />
      <path d="M108 58h40v70h-40z" fill={s1} />
      <path d="M108 58l20 14 20-14" fill="none" stroke={P.white} strokeWidth="4" />
    </>
  ),
  FULL_PHOTO: ({ A, s1 }) => (
    <>
      <rect x="24" y="44" width="152" height="112" rx="16" fill={P.ink} />
      <rect x="70" y="32" width="46" height="20" rx="6" fill={P.ink} />
      <circle cx="100" cy="100" r="40" fill={s1} />
      <circle cx="100" cy="100" r="28" fill={A} />
      <circle cx="90" cy="90" r="9" fill={P.glass} />
      <circle cx="152" cy="62" r="6" fill={P.gold} />
    </>
  ),
  CENTERED: ({ A }) => (
    <>
      <Star x={100} y={100} r={44} fill={A} />
      <Spark x={40} y={50} r={12} /><Spark x={160} y={150} r={10} fill={P.pink} /><Spark x={156} y={44} r={7} fill={P.sky} />
      <circle cx="46" cy="150" r="6" fill={P.gold} />
    </>
  ),
  FLASH_SALE: ({ A }) => (
    <>
      <Ground w={50} />
      <circle cx="100" cy="100" r="62" fill={P.white} />
      <circle cx="100" cy="100" r="54" fill="none" stroke={A} strokeWidth="8" />
      <rect x="92" y="28" width="16" height="12" rx="3" fill={A} />
      <path d="M104 58L78 108h24l-8 36 30-52h-24z" fill={P.gold} stroke={P.goldDeep} strokeWidth="3" strokeLinejoin="round" />
    </>
  ),
  PRICE_TAG: ({ A }) => (
    <>
      <Ground w={50} />
      <path d="M100 20C80 20 74 44 90 56" fill="none" stroke={P.grayDeep} strokeWidth="3" />
      <g transform="rotate(-12 100 110)">
        <path d="M60 60h80v112H60z" fill={A} />
        <path d="M60 60l40-22 40 22z" fill={A} />
        <circle cx="100" cy="58" r="8" fill={P.white} />
        <text x="100" y="128" textAnchor="middle" fontSize="42" fontWeight="900" fill={P.white}>%</text>
      </g>
      <Coin x={150} y={160} /><Coin x={46} y={150} r={11} />
    </>
  ),
  SEASON: ({ A, s1 }) => (
    <>
      <path d="M100 176C100 130 96 90 110 40" fill="none" stroke={P.brown} strokeWidth="6" strokeLinecap="round" />
      {[[70, 70, -30, A], [134, 62, 30, s1], [66, 118, -40, P.leaf], [134, 112, 40, P.gold]].map(([x, y, r, f], i) => (
        <path key={i} d="M0 0c10-26 44-26 54 0-10 22-44 22-54 0z" fill={f as string} transform={`translate(${x} ${y}) rotate(${r})`} />
      ))}
    </>
  ),
  ANNOUNCEMENT: ({ A }) => (
    <>
      <Ground w={50} />
      <path d="M44 86h24l66-36v100l-66-36H44z" fill={A} />
      <rect x="40" y="84" width="30" height="34" rx="6" fill={P.ink} />
      <path d="M60 118l10 40h16l-8-40z" fill={P.ink} />
      <path d="M150 76q16 24 0 48M162 62q26 38 0 76" fill="none" stroke={P.gold} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  DELIVERY: ({ A, s1 }) => (
    <>
      <Ground y={174} w={80} />
      <path d="M22 70h98v84H22z" fill={A} />
      <path d="M120 96h36l22 28v30h-58z" fill={s1} />
      <path d="M128 102h24l14 20h-38z" fill={P.sky} />
      <circle cx="54" cy="158" r="14" fill={P.ink} /><circle cx="54" cy="158" r="6" fill={P.gray} />
      <circle cx="148" cy="158" r="14" fill={P.ink} /><circle cx="148" cy="158" r="6" fill={P.gray} />
      <Box x={40} y={44} w={36} h={28} fill={P.gold} tape={P.brown} />
      <path d="M4 96h12M0 112h14" stroke={P.white} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  GIFT: ({ A }) => (
    <>
      <Ground />
      <Gift x={48} y={48} w={104} fill={A} ribbon={P.gold} />
      <Spark x={36} y={52} /><Spark x={166} y={66} r={6} fill={P.pink} />
    </>
  ),
  CIRCLE_PHOTO: ({ A, s1 }) => (
    <>
      <Ground w={68} />
      <path d="M36 96h128l-14 76H50z" fill={A} />
      <path d="M58 96L86 44M142 96L114 44" stroke={P.brown} strokeWidth="6" strokeLinecap="round" />
      <circle cx="78" cy="88" r="16" fill={P.red} /><circle cx="104" cy="84" r="16" fill={P.gold} /><circle cx="128" cy="90" r="14" fill={P.leaf} />
      <path d="M44 120h112M46 144h108" stroke={s1} strokeWidth="5" />
    </>
  ),
  MINIMAL: ({ A, s1 }) => (
    <>
      <Ground w={40} />
      <path d="M84 176c-18-26-10-62 16-70 26 8 34 44 16 70z" fill={A} />
      <path d="M100 106V50M100 70l-18-16M100 60l16-14" stroke={P.leafDeep} strokeWidth="4" strokeLinecap="round" />
      <circle cx="82" cy="54" r="8" fill={s1} /><circle cx="116" cy="46" r="7" fill={P.pink} />
    </>
  ),
  LAST_DAYS: ({ A }) => (
    <>
      <Ground w={46} />
      <rect x="54" y="26" width="92" height="12" rx="6" fill={P.brown} />
      <rect x="54" y="162" width="92" height="12" rx="6" fill={P.brown} />
      <path d="M64 38h72c0 40-30 44-30 62s30 22 30 62H64c0-40 30-44 30-62S64 78 64 38z" fill={P.glass} stroke={A} strokeWidth="4" />
      <path d="M76 60h48c-6 20-24 24-24 34-0-10-18-14-24-34z" fill={P.gold} />
      <path d="M72 158c8-24 20-30 28-30s20 6 28 30z" fill={P.gold} />
    </>
  ),
  STRIPE: ({ A }) => (
    <>
      <g transform="rotate(-10 100 100)">
        <path d="M24 66h152v68H24z" fill={A} />
        <circle cx="24" cy="100" r="12" fill={P.shadow} /><circle cx="176" cy="100" r="12" fill={P.shadow} />
        <path d="M60 66v68" stroke={P.white} strokeWidth="3" strokeDasharray="6 6" />
        <text x="118" y="112" textAnchor="middle" fontSize="34" fontWeight="900" fill={P.white}>SALE</text>
      </g>
      <Spark x={44} y={40} /><Spark x={160} y={164} r={7} fill={P.pink} />
    </>
  ),
  BIG_TITLE: ({ A }) => (
    <>
      <circle cx="100" cy="100" r="70" fill={A} opacity=".35" />
      <Star x={100} y={100} r={58} fill={P.gold} />
      <Spark x={36} y={40} r={12} fill={P.white} /><Spark x={170} y={40} r={9} /><Spark x={162} y={166} r={11} fill={P.pink} />
    </>
  ),
  BUNDLE: ({ A, s1, s2 }) => (
    <>
      <Ground w={70} />
      <Box x={40} y={104} w={56} h={70} fill={s1} />
      <Box x={104} y={104} w={56} h={70} fill={s2} />
      <Box x={72} y={48} w={56} h={56} fill={A} />
      <path d="M36 138h128" stroke={P.red} strokeWidth="6" />
      <path d="M100 138c-14-16-32-10-24 2 6 6 20 2 24-2zm0 0c14-16 32-10 24 2-6 6-20 2-24-2z" fill={P.red} />
    </>
  ),

  /* Праздники и поводы */
  NEW_YEAR: ({ A }) => (
    <>
      <Ground w={72} />
      <rect x="92" y="150" width="16" height="24" fill={P.brown} />
      <path d="M100 30l40 50h-18l30 40h-20l32 36H36l32-36H48l30-40H60z" fill={P.leaf} />
      <path d="M78 80h44M66 120h68" stroke={P.gold} strokeWidth="4" strokeLinecap="round" />
      <circle cx="84" cy="100" r="7" fill={P.red} /><circle cx="118" cy="96" r="7" fill={A} /><circle cx="100" cy="136" r="7" fill={P.sky} />
      <Star x={100} y={28} r={14} fill={P.gold} />
      <Gift x={20} y={140} w={36} fill={A} ribbon={P.gold} />
      <Gift x={146} y={146} w={30} fill={P.red} ribbon={P.white} />
    </>
  ),
  WINTER: ({ A }) => (
    <>
      <Ground w={60} />
      <circle cx="100" cy="140" r="38" fill={P.white} />
      <circle cx="100" cy="82" r="28" fill={P.white} />
      <path d="M72 64h56v-8H72zM80 56V28h40v28z" fill={P.ink} />
      <rect x="80" y="44" width="40" height="8" fill={A} />
      <path d="M100 86l22 6-22 4z" fill={P.gold} />
      <circle cx="90" cy="76" r="3" fill={P.ink} /><circle cx="110" cy="76" r="3" fill={P.ink} />
      <path d="M76 106q24 14 48 0l6 16-8 2-4-10q-18 8-36 0l-4 10-8-2z" fill={A} />
      <circle cx="100" cy="132" r="4" fill={P.ink} /><circle cx="100" cy="150" r="4" fill={P.ink} />
      <Spark x={40} y={50} r={8} fill={P.white} /><Spark x={164} y={60} r={6} fill={P.white} />
    </>
  ),
  NAURYZ: ({ A }) => (
    <>
      <Ground w={78} />
      <path d="M28 174V112q72-70 144 0v62z" fill={P.white} />
      <path d="M28 112q72-70 144 0" fill="none" stroke={A} strokeWidth="10" />
      <path d="M86 174v-44q14-14 28 0v44z" fill={A} />
      <path d="M40 140c10-10 22-10 22 2 0 8-10 8-10 2M160 140c-10-10-22-10-22 2 0 8 10 8 10 2" fill="none" stroke={P.gold} strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="64" r="10" fill={P.gold} />
      <path d="M100 26v14M72 34l6 12M128 34l-6 12" stroke={P.gold} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  MARCH_8: ({ A }) => (
    <>
      <path d="M100 176c-4-40-26-70-40-86M100 176c0-44 0-80 2-104M100 176c6-40 26-68 40-86" fill="none" stroke={P.leafDeep} strokeWidth="4" strokeLinecap="round" />
      <path d="M70 176h60l-12-44H82z" fill={P.cream} />
      {[[60, 86, A], [102, 64, P.pink], [140, 86, P.red]].map(([x, y, f], i) => (
        <path key={i} d="M-16 0c-2-18 6-26 8-26 2 8 8 10 8 10s6-2 8-10c2 0 10 8 8 26-2 12-10 16-16 16s-14-4-16-16z" fill={f as string} transform={`translate(${x} ${y})`} />
      ))}
      <path d="M78 110c-10-2-18 4-20 12 10 2 18-2 20-12zM122 108c10-2 18 4 20 12-10 2-18-2-20-12z" fill={P.leaf} />
      <text x="100" y="164" textAnchor="middle" fontSize="22" fontWeight="900" fill={A}>8</text>
    </>
  ),
  BLACK_FRIDAY: () => (
    <>
      <Ground w={60} />
      <Bag x={52} y={70} w={96} h={104} fill={P.ink} handle={P.ink} />
      <path d="M108 86L88 126h18l-6 30 26-42h-18z" fill={P.gold} />
      <Tag x={120} y={40} fill={P.gold} />
      <Spark x={40} y={52} r={9} fill={P.gold} />
    </>
  ),
  BACK_TO_SCHOOL: ({ A, s1 }) => (
    <>
      <Ground w={60} />
      <path d="M58 70c0-30 84-30 84 0v96q0 10-10 10H68q-10 0-10-10z" fill={A} />
      <path d="M72 120h56v36H72z" fill={s1} />
      <path d="M80 56q20-24 40 0" fill="none" stroke={P.ink} strokeWidth="5" />
      <path d="M72 120h56" stroke={P.ink} strokeWidth="3" />
      <g transform="rotate(20 150 60)"><rect x="140" y="20" width="12" height="70" fill={P.gold} /><path d="M140 90l6 14 6-14z" fill={P.cream} /><rect x="140" y="16" width="12" height="8" fill={P.pink} /></g>
      <g transform="rotate(-18 44 80)"><rect x="38" y="40" width="10" height="60" fill={P.sky} /><path d="M38 100l5 12 5-12z" fill={P.cream} /></g>
    </>
  ),
  SUMMER: ({ A }) => (
    <>
      <path d="M0 160q50-14 100 0t100 0v40H0z" fill={P.gold} opacity=".6" />
      <circle cx="152" cy="46" r="22" fill={P.gold} />
      <path d="M100 176V60" stroke={P.brown} strokeWidth="5" strokeLinecap="round" />
      <path d="M30 80q70-60 140 0z" fill={A} />
      <path d="M53 80q24-40 47-40t47 40" fill="none" stroke={P.white} strokeWidth="4" />
      <path d="M40 150l18-40 18 40z" fill={P.pink} /><circle cx="58" cy="106" r="10" fill={P.cream} />
    </>
  ),
  RAMADAN: () => (
    <>
      <path d="M150 30a36 36 0 1 0 22 60 30 30 0 1 1-22-60z" fill={P.gold} />
      <Star x={132} y={56} r={9} fill={P.gold} />
      <path d="M78 0v34" stroke={P.goldDeep} strokeWidth="3" />
      <path d="M62 34h32l6 10H56z" fill={P.goldDeep} />
      <path d="M56 44h44l8 60-14 20H62l-14-20z" fill={P.gold} />
      <path d="M64 52h28l6 46-10 14H68l-10-14z" fill={P.cream} opacity=".85" />
      <path d="M70 124h16l-8 14z" fill={P.goldDeep} />
      <Spark x={34} y={150} r={7} fill={P.gold} /><Spark x={164} y={140} r={5} fill={P.cream} />
    </>
  ),
  NIGHT_SALE: ({ A }) => (
    <>
      <path d="M130 24a44 44 0 1 0 30 76 36 36 0 1 1-30-76z" fill={P.cream} />
      <path d="M16 176v-40h24v-24h26v64zm60 0v-60h30v60zm40 0v-44h22v-20h28v64z" fill={P.ink} />
      {[[30, 150], [84, 130], [126, 150], [150, 136]].map(([x, y], i) => <rect key={i} x={x} y={y} width="6" height="8" fill={P.gold} />)}
      <Bag x={120} y={100} w={40} h={50} fill={A} handle={P.cream} />
      <Spark x={40} y={40} r={6} fill={P.white} /><Spark x={70} y={70} r={4} fill={P.white} />
    </>
  ),
  BIRTHDAY: ({ A, s1 }) => (
    <>
      <Ground w={70} />
      <rect x="40" y="120" width="120" height="54" rx="8" fill={A} />
      <rect x="54" y="80" width="92" height="44" rx="8" fill={s1} />
      <path d="M54 92q12 14 23 0t23 0 23 0 23 0" fill="none" stroke={P.white} strokeWidth="6" strokeLinecap="round" />
      <path d="M40 134q15 16 30 0t30 0 30 0 30 0" fill="none" stroke={P.cream} strokeWidth="6" strokeLinecap="round" />
      {[78, 100, 122].map((x, i) => (
        <g key={x}><rect x={x - 3} y="54" width="6" height="26" rx="2" fill={[P.sky, P.pink, P.gold][i]} /><path d={`M${x} 40q7 8 0 14q-7-6 0-14z`} fill={P.gold} /></g>
      ))}
    </>
  ),
  GIVEAWAY: ({ A }) => (
    <>
      <Ground w={60} />
      <path d="M100 150l-30 26h60z" fill={P.goldDeep} />
      <path d="M62 40h76v34c0 30-18 50-38 50S62 104 62 74z" fill={P.gold} />
      <path d="M62 52H40c0 26 14 34 24 36M138 52h22c0 26-14 34-24 36" fill="none" stroke={P.gold} strokeWidth="7" />
      <rect x="92" y="124" width="16" height="28" fill={P.goldDeep} />
      <Star x={100} y={80} r={16} fill={A} />
      {[[30, 40, P.pink], [168, 36, P.sky], [24, 110, A], [172, 112, P.red]].map(([x, y, f], i) => <rect key={i} x={x as number} y={y as number} width="10" height="16" rx="2" fill={f as string} transform={`rotate(${i * 35} ${x} ${y})`} />)}
    </>
  ),
  LOYALTY: ({ A, s1 }) => (
    <>
      <Ground w={70} />
      <g transform="rotate(-10 100 100)">
        <rect x="30" y="56" width="140" height="92" rx="12" fill={A} />
        <rect x="30" y="76" width="140" height="18" fill={P.ink} opacity=".7" />
        <rect x="44" y="110" width="40" height="26" rx="5" fill={P.gold} />
        <path d="M140 130c-12-10-20-16-20-24a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 8-8 14-12 24z" fill={P.pink} />
      </g>
      <Star x={160} y={40} r={16} fill={s1} />
    </>
  ),
  GIFT_CARD: ({ A }) => (
    <>
      <Ground w={70} />
      <g transform="rotate(8 100 100)">
        <rect x="26" y="58" width="148" height="92" rx="12" fill={A} />
        <path d="M26 104h148M100 58v92" stroke={P.gold} strokeWidth="10" />
        <path d="M100 104c-14-22-40-20-34-4 4 8 20 8 34 4zm0 0c14-22 40-20 34-4-4 8-20 8-34 4z" fill={P.gold} />
        <text x="150" y="140" textAnchor="middle" fontSize="16" fontWeight="900" fill={P.white}>5000</text>
      </g>
    </>
  ),
  CASHBACK: ({ A }) => (
    <>
      <Ground w={70} />
      <path d="M36 80h118q12 0 12 12v72q0 10-12 10H36q-10 0-10-10V92q0-12 10-12z" fill={A} />
      <path d="M130 112h40v34h-40q-8 0-8-8v-18q0-8 8-8z" fill={P.ink} opacity=".8" />
      <circle cx="140" cy="128" r="6" fill={P.gold} />
      <Coin x={70} y={58} /><Coin x={104} y={40} r={12} /><Coin x={136} y={60} r={10} />
      <path d="M60 30q40-28 90 4" fill="none" stroke={P.leaf} strokeWidth="6" strokeLinecap="round" />
      <path d="M150 34l-14-2 8 12z" fill={P.leaf} />
    </>
  ),
  PREORDER: ({ A }) => (
    <>
      <Ground w={60} />
      <Calendar x={38} y={40} w={96} fill={A} />
      <Box x={112} y={116} w={56} h={52} fill={P.gold} tape={P.brown} />
      <circle cx="140" cy="60" r="18" fill={P.leaf} /><path d="M131 60l7 7 12-14" fill="none" stroke={P.white} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  WEEKEND: ({ A }) => (
    <>
      <circle cx="146" cy="52" r="26" fill={P.gold} />
      <Calendar x={30} y={60} w={100} fill={A} mark={(
        <g><circle cx="94" cy="118" r="16" fill={P.pink} opacity=".85" /><circle cx="122" cy="118" r="16" fill={P.pink} opacity=".85" /></g>
      )} />
      <path d="M126 150h44v20q0 10-10 10h-24q-10 0-10-10z" fill={P.white} />
      <path d="M170 156q12 0 10 10-2 8-10 6" fill="none" stroke={P.white} strokeWidth="4" />
      <path d="M140 140q-6-8 0-14M152 140q-6-8 0-14" fill="none" stroke={P.grayDeep} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  SCHEDULE: ({ A }) => (
    <>
      <Ground w={60} />
      <circle cx="100" cy="100" r="64" fill={P.white} />
      <circle cx="100" cy="100" r="64" fill="none" stroke={A} strokeWidth="10" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x="98" y="44" width="4" height={i % 3 ? 6 : 12} fill={P.ink} transform={`rotate(${i * 30} 100 100)`} />)}
      <path d="M100 100V62M100 100l28 16" stroke={P.ink} strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="100" r="6" fill={P.red} />
    </>
  ),
  RESTOCK: ({ A, s1 }) => (
    <>
      <Ground w={76} />
      <path d="M24 90l76-44 76 44v84H24z" fill={s1} />
      <path d="M44 110h112v64H44z" fill={P.ink} opacity=".8" />
      <Box x={52} y={134} w={40} h={40} fill={P.gold} tape={P.brown} />
      <Box x={100} y={134} w={40} h={40} fill={A} />
      <path d="M150 96V52M136 66l14-14 14 14" fill="none" stroke={P.leaf} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  WHOLESALE: ({ A, s1 }) => (
    <>
      <Ground w={84} />
      <rect x="20" y="164" width="96" height="8" fill={P.brown} />
      <Box x={22} y={122} w={44} h={42} fill={s1} /><Box x={70} y={122} w={44} h={42} fill={A} /><Box x={46} y={80} w={44} h={42} fill={P.gold} tape={P.brown} />
      <path d="M128 176V80M128 150h32v-30h-14" fill="none" stroke={P.ink} strokeWidth="6" strokeLinecap="round" />
      <path d="M140 110h36v48h-36z" fill={P.gold} />
      <circle cx="142" cy="170" r="10" fill={P.ink} /><circle cx="174" cy="170" r="10" fill={P.ink} />
    </>
  ),
  BESTSELLER: ({ A }) => (
    <>
      <Ground w={54} />
      <rect x="66" y="150" width="68" height="24" rx="4" fill={P.brown} />
      <rect x="90" y="120" width="20" height="32" fill={P.goldDeep} />
      <path d="M58 30h84v40c0 30-20 52-42 52S58 100 58 70z" fill={P.gold} />
      <path d="M58 44H36c0 28 16 38 28 40M142 44h22c0 28-16 38-28 40" fill="none" stroke={P.gold} strokeWidth="7" />
      <text x="100" y="86" textAnchor="middle" fontSize="36" fontWeight="900" fill={A}>1</text>
      <Spark x={34} y={30} r={9} /><Spark x={170} y={120} r={7} fill={P.white} />
    </>
  ),
  ECO: ({ A }) => (
    <>
      <Ground w={50} />
      <path d="M66 120h68l-8 56H74z" fill={P.brown} />
      <rect x="60" y="112" width="80" height="14" rx="4" fill={P.brown} />
      <path d="M100 112V60" stroke={P.leafDeep} strokeWidth="5" />
      <path d="M100 80c-30 0-44-20-44-40 30 0 44 16 44 40z" fill={P.leaf} />
      <path d="M100 66c26 0 40-16 40-36-26 0-40 14-40 36z" fill={A} />
      <path d="M150 150a22 22 0 1 1 18-34" fill="none" stroke={P.leaf} strokeWidth="5" strokeLinecap="round" />
      <path d="M170 104l-2 14-12-6z" fill={P.leaf} />
    </>
  ),
  HANDMADE: ({ A, s1 }) => (
    <>
      <Ground w={60} />
      <circle cx="92" cy="122" r="48" fill={A} />
      <path d="M52 100q40 20 80-6M48 128q46 20 88-10M60 154q34 12 66-10" fill="none" stroke={s1} strokeWidth="5" strokeLinecap="round" />
      <path d="M130 80l44-60M146 90l40-56" stroke={P.brown} strokeWidth="6" strokeLinecap="round" />
      <path d="M140 124q30 10 36 40" fill="none" stroke={A} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  INSTALLMENT: ({ A }) => (
    <>
      <Ground w={70} />
      <g transform="rotate(-8 100 100)">
        <rect x="26" y="60" width="140" height="88" rx="12" fill={A} />
        <rect x="42" y="82" width="30" height="22" rx="4" fill={P.gold} />
        <path d="M42 128h24M74 128h24M106 128h24" stroke={P.white} strokeWidth="6" strokeLinecap="round" />
      </g>
      <circle cx="152" cy="54" r="30" fill={P.white} />
      <path d="M152 54V24a30 30 0 0 1 26 45z" fill={P.leaf} />
      <path d="M152 54l26 15a30 30 0 0 1-40 12z" fill={P.gold} />
    </>
  ),
  PICKUP: ({ A, s1 }) => (
    <>
      <Ground w={78} />
      <rect x="30" y="80" width="140" height="94" fill={P.cream} />
      <path d="M22 80h156l-10-34H32z" fill={A} />
      <path d="M22 80q13 16 26 0t26 0 26 0 26 0 26 0 26 0" fill={s1} />
      <rect x="46" y="104" width="44" height="70" rx="4" fill={P.sky} />
      <rect x="104" y="104" width="50" height="40" rx="4" fill={P.sky} />
      <Bag x={112} y={140} w={30} h={34} fill={P.gold} />
    </>
  ),
  PROMO_CODE: ({ A }) => (
    <>
      <g transform="rotate(-8 100 100)">
        <path d="M24 64h152v26a10 10 0 0 0 0 20v26H24v-26a10 10 0 0 0 0-20z" fill={A} />
        <path d="M70 64v72" stroke={P.white} strokeWidth="3" strokeDasharray="6 6" />
        <text x="122" y="108" textAnchor="middle" fontSize="24" fontWeight="900" fill={P.white}>CODE</text>
      </g>
      <circle cx="44" cy="160" r="12" fill="none" stroke={P.grayDeep} strokeWidth="5" />
      <circle cx="76" cy="164" r="12" fill="none" stroke={P.grayDeep} strokeWidth="5" />
      <path d="M52 152l40-40M68 156l-26-40" stroke={P.grayDeep} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  COLLECTION: ({ A, s1 }) => (
    <>
      <Ground w={72} />
      <path d="M36 40h128" stroke={P.grayDeep} strokeWidth="5" strokeLinecap="round" />
      <Hanger x={66} y={60} w={40} /><Dress x={66} y={74} fill={A} />
      <Hanger x={134} y={60} w={40} />
      <path d="M116 74h36l6 18-8 4v70h-32v-70l-8-4z" fill={s1} />
      <ellipse cx="100" cy="160" rx="26" ry="8" fill={P.brown} /><path d="M86 160q14-26 28 0z" fill={P.brown} />
    </>
  ),
  REVIEWS: ({ A }) => (
    <>
      <path d="M24 44q0-12 12-12h128q12 0 12 12v76q0 12-12 12H74l-34 28 6-28H36q-12 0-12-12z" fill={P.white} />
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} x={48 + i * 26} y={82} r={12} fill={P.gold} />)}
      <circle cx="160" cy="150" r="22" fill={A} />
      <path d="M150 150l7 7 13-14" fill="none" stroke={P.white} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  B2B: ({ A, s1 }) => (
    <>
      <Ground w={78} />
      <path d="M26 176V60h60v116zM96 176V34h76v142z" fill={s1} />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={(i % 2 ? 150 : 110) - (i % 2 ? 12 : 0)} y={48 + Math.floor(i / 2) * 20} width="16" height="12" fill={P.sky} />)}
      <rect x="40" y="76" width="32" height="10" fill={P.sky} /><rect x="40" y="96" width="32" height="10" fill={P.sky} />
      <rect x="52" y="128" width="88" height="48" rx="8" fill={A} />
      <path d="M80 128v-10h32v10" fill="none" stroke={P.ink} strokeWidth="5" />
      <rect x="52" y="146" width="88" height="6" fill={P.ink} opacity=".5" />
    </>
  ),
  GRAND_OPENING: ({ A }) => (
    <>
      <path d="M20 100q80 30 160 0" fill="none" stroke={A} strokeWidth="16" strokeLinecap="round" />
      <path d="M100 100c-24-34-60-24-46-4 8 10 30 8 46 4zm0 0c24-34 60-24 46-4-8 10-30 8-46 4z" fill={A} />
      <path d="M92 104l-18 44 18-8 8 16 6-48z" fill={A} />
      <circle cx="126" cy="146" r="12" fill="none" stroke={P.grayDeep} strokeWidth="5" />
      <circle cx="150" cy="140" r="12" fill="none" stroke={P.grayDeep} strokeWidth="5" />
      <path d="M132 136l20-42M146 130l-10-40" stroke={P.gray} strokeWidth="6" strokeLinecap="round" />
      <Spark x={40} y={44} /><Spark x={160} y={40} r={7} fill={P.pink} /><Spark x={30} y={150} r={6} fill={P.sky} />
    </>
  ),
  TRADE_IN: ({ A, s1 }) => (
    <>
      <Ground w={70} />
      <rect x="30" y="54" width="54" height="100" rx="10" fill={s1} />
      <rect x="36" y="64" width="42" height="74" rx="4" fill={P.ink} opacity=".7" />
      <rect x="116" y="44" width="58" height="112" rx="10" fill={A} />
      <rect x="122" y="54" width="46" height="84" rx="4" fill={P.sky} />
      <path d="M86 70q16-20 30-6M114 134q-16 20-30 6" fill="none" stroke={P.gold} strokeWidth="6" strokeLinecap="round" />
      <path d="M118 58l-2 12-10-4zM82 146l2-12 10 4z" fill={P.gold} />
    </>
  ),
};

/**
 * Иллюстрация шаблона в поле 200×200 — содержимое `<svg viewBox="0 0 200 200">`.
 * Шаблон без своей (новый, ещё не нарисованный) получает иллюстрацию распродажи.
 */
export function Art({ template, c }: { template: string; c: SlideColors }) {
  const draw = ART[template] ?? ART.SALE;
  return <>{draw({ A: c.circleBg, Ai: c.circleFg, s0: c.stack[0], s1: c.stack[1], s2: c.stack[2] })}</>;
}

/** Иллюстрация готовым `<svg>`: для мест, где рисунок стоит сам по себе. */
export function ArtSvg({ template, c, className, style }: {
  template: string;
  c: SlideColors;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" data-art="" className={className} style={style}>
      <Art template={template} c={c} />
    </svg>
  );
}

/** Шаблоны, у которых есть своя иллюстрация, — для проверки, что никого не забыли. */
export const ART_TEMPLATES = Object.keys(ART);
