import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Building2,
  Camera,
  CircleHelp,
  ClipboardList,
  Eye,
  FileText,
  Heart,
  LayoutGrid,
  LayoutTemplate,
  MapPin,
  MessageCircleQuestion,
  Package,
  PenLine,
  Send,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tag,
  ThumbsUp,
  Truck,
  Wallet,
  Zap,
  type IconComponent,
} from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { cn } from '../../ui/cn';

type GuideScreen =
  | 'catalog' | 'item' | 'checkout' | 'orders' | 'order' | 'favorites' | 'promotions'
  | 'templates' | 'questions' | 'reviews' | 'delivery' | 'profile'
  | 'ordersAnswer' | 'ordersReady' | 'ordersSeller' | 'ordersDone' | 'ordersCancelled' | 'questionsArchive';

/** Какая инструкция у экрана. Экрана нет в списке — нет и кнопки: пустая инструкция хуже никакой. */
function screenOf(pathname: string): GuideScreen | null {
  if (pathname.startsWith('/catalog/')) return 'item';
  if (pathname.startsWith('/orders/')) return 'order';
  const exact: Record<string, GuideScreen> = {
    '/catalog': 'catalog',
    '/checkout': 'checkout',
    '/orders': 'orders',
    '/favorites': 'favorites',
    '/promotions': 'promotions',
    '/templates': 'templates',
    '/questions': 'questions',
    '/reviews': 'reviews',
    '/delivery': 'delivery',
    '/profile': 'profile',
  };
  return exact[pathname] ?? null;
}

/**
 * Шаг инструкции: знак для схемы и — если шаг про конкретную кнопку — ключ
 * её подписи. Текст шага — `guide.<экран>.sN`, подпись к знаку схемы — `fN`.
 * Кнопку «Показать» ищут по подписи из тех же переводов, что и сам экран:
 * служебные метки пришлось бы помнить при каждой правке экрана.
 */
interface GuideStep {
  icon: IconComponent;
  target?: string;
}

const STEPS: Record<GuideScreen, GuideStep[]> = {
  catalog: [
    { icon: LayoutGrid },
    { icon: ShoppingCart, target: 'catalog.toCart' },
    { icon: Zap, target: 'catalog.quickOrder' },
    { icon: Send, target: 'cart.open' },
  ],
  item: [{ icon: Camera }, { icon: ShoppingCart, target: 'item.add' }, { icon: Wallet }, { icon: MessageCircleQuestion, target: 'questions.ask' }],
  checkout: [{ icon: ClipboardList }, { icon: Truck }, { icon: Send, target: 'checkout.send' }, { icon: Wallet }],
  orders: [
    { icon: ClipboardList },
    { icon: ThumbsUp, target: 'orders.v2.open' },
    { icon: MessageCircleQuestion, target: 'orders.ask' },
    { icon: LayoutTemplate, target: 'orders.again' },
  ],
  order: [{ icon: FileText }, { icon: ThumbsUp, target: 'orders.agree' }, { icon: Wallet, target: 'orders.invoice' }, { icon: MessageCircleQuestion, target: 'orders.toAll' }],
  favorites: [{ icon: Heart }, { icon: ShoppingCart, target: 'favorites.addAvailable' }],
  promotions: [{ icon: Tag }, { icon: Wallet }, { icon: Eye }],
  templates: [
    { icon: LayoutTemplate },
    { icon: ClipboardList, target: 'orders.repeat' },
    { icon: PenLine, target: 'templates.save' },
    { icon: ShoppingCart, target: 'templates.toCart' },
  ],
  questions: [
    { icon: MessageCircleQuestion },
    { icon: Send, target: 'questions.sendMessage' },
    { icon: Package },
    { icon: MessageCircleQuestion },
  ],
  reviews: [{ icon: Star }, { icon: ShieldCheck }, { icon: PenLine }],
  delivery: [{ icon: Truck }, { icon: ClipboardList }, { icon: MapPin }],
  ordersAnswer: [{ icon: ThumbsUp }, { icon: MessageCircleQuestion, target: 'orders.v2.open' }],
  ordersReady: [{ icon: MapPin }, { icon: Package }],
  ordersSeller: [{ icon: ClipboardList }, { icon: MessageCircleQuestion, target: 'orders.ask' }],
  ordersDone: [{ icon: Star }, { icon: LayoutTemplate, target: 'orders.again' }],
  ordersCancelled: [{ icon: ClipboardList }],
  questionsArchive: [{ icon: MessageCircleQuestion }],
  profile: [{ icon: Building2 }, { icon: FileText, target: 'profile.company.fill' }, { icon: ShieldCheck }],
};

/** Куда идти, когда на экране всё сделано, — ссылка блока «Что дальше». `null` — дальше на этом же экране. */
const NEXT_HREF: Record<GuideScreen, string | null> = {
  catalog: '/checkout', item: '/checkout', checkout: '/orders', orders: null, order: '/orders', favorites: '/checkout',
  promotions: '/catalog', templates: '/checkout', questions: '/catalog', reviews: '/catalog', delivery: '/catalog', profile: '/catalog',
  ordersAnswer: null, ordersReady: null, ordersSeller: null, ordersDone: '/checkout', ordersCancelled: '/catalog', questionsArchive: '/questions',
};

/**
 * Фильтры и вкладки экрана со своей инструкцией — по выбранной кнопке на
 * экране: подпись берётся из тех же переводов, что и сама кнопка.
 */
const DOM_TABS: Partial<Record<GuideScreen, [GuideScreen, string][]>> = {
  orders: [
    ['ordersAnswer', 'orders.v2.filters.answer'], ['ordersReady', 'orders.v2.filters.ready'], ['ordersSeller', 'orders.v2.filters.seller'],
    ['ordersDone', 'orders.v2.filters.done'], ['ordersCancelled', 'orders.v2.filters.cancelled'],
  ],
  questions: [['questionsArchive', 'questions.archive.title']],
};

function refineScreen(base: GuideScreen, t: (key: string) => string): GuideScreen {
  const tabs = DOM_TABS[base];
  if (!tabs) return base;
  const selected = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"], [aria-pressed="true"]'))
    .filter((el) => !el.closest('[role="dialog"]'))
    .map((el) => `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`.toLowerCase());
  const hit = tabs.find(([, key]) => selected.some((label) => label.includes(t(key).toLowerCase())));
  return hit ? hit[0] : base;
}

const CLICKABLE = 'button, a, [role="tab"], [role="radio"]';

/**
 * Кнопка на экране с этой подписью — сначала точное совпадение, затем
 * вхождение («В корзину» — и у «В корзину · 2 мешка»). Из видимых: у экрана
 * бывают две копии одного (стол и телефон). Сама инструкция в поиск не входит.
 */
function findTarget(label: string): HTMLElement | null {
  const wanted = label.trim().toLowerCase();
  const all = Array.from(document.querySelectorAll<HTMLElement>(CLICKABLE)).filter((el) => !el.closest('[role="dialog"]'));
  const named = (el: HTMLElement) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const matches = [...all.filter((el) => named(el) === wanted), ...all.filter((el) => named(el).includes(wanted))];
  return matches.find((el) => el.getClientRects().length > 0) ?? matches[0] ?? null;
}

/** Подсветка держится три вспышки — достаточно, чтобы найти глазами. */
const SPOT_MS = 3200;

function spotlight(el: HTMLElement) {
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  el.classList.add('qo-help-spot');
  window.setTimeout(() => el.classList.remove('qo-help-spot'), SPOT_MS);
}

/** Ширина пузыря прохода — и отступ от краёв экрана, ближе которого он не встаёт. */
const BUBBLE_W = 320;
const EDGE = 16;

/**
 * Проход по шагам: пузырь рядом с кнопкой, о которой шаг, и рамка вокруг неё.
 * Шаги — те же, что в инструкции, но только те, чья кнопка есть на экране:
 * пузырь, указывающий в пустоту, сбивает сильнее, чем пропущенный шаг.
 * Пузырь не модальный: экран под ним живой, кнопку из шага можно нажать сразу.
 */
function Tour({ screen, steps, onEnd }: { screen: GuideScreen; steps: { key: string; target: string }[]; onEnd: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    const el = findTarget(t(step.target));
    if (!el) return undefined;
    el.scrollIntoView?.({ block: 'center' });
    el.classList.add('qo-help-spot');
    const place = () => setRect(el.getBoundingClientRect());
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      el.classList.remove('qo-help-spot');
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [step.target, t]);

  useEffect(() => {
    next.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onEnd(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onEnd]);

  if (!rect) return null;
  // Под кнопкой, если снизу хватает места, иначе над ней; по ширине — не за краем экрана.
  const below = rect.bottom + 220 < window.innerHeight;
  const left = Math.min(Math.max(rect.left, EDGE), window.innerWidth - BUBBLE_W - EDGE);
  const last = index === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-label={t('guide.tour.step', { n: index + 1, total: steps.length })}
      className="fixed z-[60] flex flex-col gap-3 rounded-[var(--radius-tile)] border border-hairline bg-surface p-4 shadow-float"
      style={{
        width: Math.min(BUBBLE_W, window.innerWidth - 2 * EDGE),
        left: Math.max(EDGE, left),
        ...(below ? { top: rect.bottom + 12 } : { bottom: window.innerHeight - rect.top + 12 }),
      }}
    >
      <span className="text-xs font-semibold text-ink-muted">{t('guide.tour.step', { n: index + 1, total: steps.length })}</span>
      <p className="text-body leading-relaxed text-ink">{t(`guide.${screen}.${step.key}`)}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onEnd} className="text-caption text-ink-muted hover:text-ink">
          {t('guide.tour.close')}
        </button>
        <span className="ml-auto" />
        {index > 0 ? (
          <button type="button" onClick={() => setIndex(index - 1)}
            className="h-10 rounded-[var(--radius-control)] border border-hairline px-3 text-caption font-semibold text-ink">
            {t('guide.tour.back')}
          </button>
        ) : null}
        <button ref={next} type="button" onClick={() => (last ? onEnd() : setIndex(index + 1))}
          className="h-10 rounded-[var(--radius-control)] bg-accent px-4 text-caption font-semibold text-on-accent">
          {t(last ? 'guide.tour.done' : 'guide.tour.next')}
        </button>
      </div>
    </div>
  );
}

/**
 * «Как этим пользоваться» — кнопка в шапке и короткая инструкция к текущему
 * экрану покупателя: схема из знаков, понятная без чтения, и шаги простыми
 * словами. «Показать на экране» закрывает лист и обводит кнопку, о которой шаг;
 * кнопки, которой сейчас на экране нет, «Показать» не обещает.
 */
export function HelpGuide({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState<{ key: string; target: string }[] | null>(null);
  // Выбранный значок схемы — какой шаг показан под ней. Каждое открытие — с первого шага.
  const [active, setActive] = useState(0);
  const base = screenOf(pathname);
  // Фильтр или вкладка экрана определяются в момент открытия — они живут на экране, не в адресе.
  const [opened, setOpened] = useState<GuideScreen | null>(null);
  const screen = open && opened ? opened : base;

  if (!screen) return null;
  const steps = STEPS[screen].map((step, index) => ({ ...step, key: `s${index + 1}`, flow: `f${index + 1}` }));
  const shown = (target?: string) => (open && target ? findTarget(t(target)) !== null : false);

  // Проход — когда на экране есть хотя бы две кнопки из шагов: для одной хватает «Показать».
  const tourSteps = open
    ? steps.filter((step): step is typeof step & { target: string } => Boolean(step.target && findTarget(t(step.target))))
    : [];

  const show = (target: string) => {
    setOpen(false);
    // Лист уезжает с анимацией — подсветка ставится, когда он уже не закрывает экран.
    window.setTimeout(() => {
      const el = findTarget(t(target));
      if (el) spotlight(el);
    }, 250);
  };

  return (
    <>
      <button
        type="button"
        aria-label={t('guide.button')}
        title={t('guide.button')}
        onClick={() => { setActive(0); setOpened(base ? refineScreen(base, t) : null); setOpen(true); }}
        className={cn(
          'relative inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)]',
          'text-ink-muted transition-all duration-300 hover:bg-ink/5 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          className,
        )}
      >
        <CircleHelp className="size-5" aria-hidden="true" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={t('guide.title', { screen: t(`guide.${screen}.title`) })}>
        <div className="flex w-full max-w-xl flex-col gap-4">
          {tourSteps.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                // Лист уезжает с анимацией — проход начинается, когда он уже не закрывает экран.
                const list = tourSteps.map(({ key, target }) => ({ key, target }));
                window.setTimeout(() => setTouring(list), 250);
              }}
              className="inline-flex h-11 items-center gap-2 self-start rounded-[var(--radius-control)] bg-accent px-4 text-body font-semibold text-on-accent"
            >
              <ArrowRight className="size-4" aria-hidden="true" />
              {t('guide.tour.start')}
            </button>
          ) : null}
          {/*
            Схема: путь экрана знаками. Каждый знак — вкладка: нажали — ниже
            только этот шаг: что сделать, что получится, пример и что дальше.
          */}
          <div role="tablist" aria-label={t('guide.flow')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') setActive(Math.min(active + 1, steps.length - 1));
              if (event.key === 'ArrowLeft') setActive(Math.max(active - 1, 0));
            }}
            className="flex flex-wrap items-start gap-y-3 rounded-[var(--radius-tile)] bg-accent-soft/60 p-3">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-start">
                {index > 0 ? (
                  <ArrowRight aria-hidden="true" className="mx-1 mt-3 size-3.5 text-ink-muted" />
                ) : null}
                <button
                  type="button"
                  role="tab"
                  id={`guide-tab-${index}`}
                  aria-selected={index === active}
                  aria-controls="guide-step"
                  tabIndex={index === active ? 0 : -1}
                  onClick={() => setActive(index)}
                  className="flex w-16 flex-col items-center gap-1 text-center"
                >
                  <span className={cn(
                    'flex size-10 items-center justify-center rounded-full',
                    index === active ? 'bg-accent text-on-accent ring-2 ring-accent ring-offset-2' : 'bg-surface text-accent',
                  )}>
                    <step.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className={cn('text-2xs leading-tight', index === active ? 'font-bold text-ink' : 'text-ink-muted')}>
                    {index + 1}. {t(`guide.${screen}.${step.flow}`)}
                  </span>
                </button>
              </div>
            ))}
          </div>
          {(() => {
            const step = steps[active];
            const n = active + 1;
            const has = (key: string) => i18n.exists(`guide.${screen}.${key}${n}`);
            return (
              <div role="tabpanel" id="guide-step" aria-labelledby={`guide-tab-${active}`} className="flex flex-col gap-3">
                <span className="text-xs font-semibold text-ink-muted">{t('guide.tour.step', { n, total: steps.length })}</span>
                <p className="text-body font-semibold leading-relaxed text-ink">{t(`guide.${screen}.s${n}`)}</p>
                {has('r') ? (
                  <p className="flex items-start gap-2 text-sm leading-relaxed text-ink">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" />
                    <span><b className="font-semibold">{t('guide.result')}</b> {t(`guide.${screen}.r${n}`)}</span>
                  </p>
                ) : null}
                {has('e') ? (
                  <div className="flex flex-col gap-1 rounded-[var(--radius-control)] bg-accent-soft/50 px-3 py-2 text-sm leading-relaxed text-ink-muted">
                    <b className="font-semibold text-ink">{t('guide.example')}</b>
                    {t(`guide.${screen}.e${n}`)}
                  </div>
                ) : null}
                {/* «Дальше» — что делать после этого шага: без него инструкция обрывается. */}
                {has('d') ? (
                  <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-accent">
                    <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    {t(`guide.${screen}.d${n}`)}
                  </p>
                ) : null}
                {step.target && shown(step.target) ? (
                  <button
                    type="button"
                    onClick={() => show(step.target!)}
                    className="qo-hit inline-flex h-9 items-center gap-1.5 self-start rounded-full border border-hairline px-3 text-caption font-semibold text-accent hover:border-accent"
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    {t('guide.show')}
                  </button>
                ) : null}
                <div className="flex items-center gap-2 pt-1">
                  {active > 0 ? (
                    <button type="button" onClick={() => setActive(active - 1)}
                      className="h-10 rounded-[var(--radius-control)] border border-hairline px-3 text-sm font-semibold text-ink">
                      ← {t('guide.tour.back')}
                    </button>
                  ) : null}
                  {active < steps.length - 1 ? (
                    <button type="button" onClick={() => setActive(active + 1)}
                      className="ml-auto h-10 rounded-[var(--radius-control)] bg-accent px-4 text-sm font-semibold text-on-accent">
                      {t('guide.tour.next')} →
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })()}
          {i18n.exists(`guide.${screen}.next`) ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius-tile)] border border-accent bg-accent-soft/50 px-4 py-3">
              <b className="text-sm font-bold text-ink">{t('guide.nextTitle')}</b>
              <span className="text-sm leading-relaxed text-ink">{t(`guide.${screen}.next`)}</span>
              {NEXT_HREF[screen] ? (
                <Link to={NEXT_HREF[screen]!} onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 self-start text-sm font-semibold text-accent">
                  {t('guide.go')}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </Sheet>
      {touring ? <Tour screen={screen} steps={touring} onEnd={() => setTouring(null)} /> : null}
    </>
  );
}

/**
 * «Как пользоваться» в строке заголовка страницы — на телефоне: шапки оболочки там нет.
 * На мониторе та же кнопка стоит в шапке (ClientBar), поэтому здесь она скрыта.
 */
export function PageHelp({ className }: { className?: string }) {
  return (
    // На телефоне — компактно (просьба владельца 2026-11-06): значок справки не теснит заголовок и переключатели.
    <HelpGuide className={cn('size-9 rounded-[0.75rem] border-2 border-line bg-surface lg:hidden [&_svg]:size-[1.125rem]', className)} />
  );
}
