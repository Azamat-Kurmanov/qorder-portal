import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
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
  type LucideIcon,
} from 'lucide-react';
import { Sheet } from '../../ui/Sheet';
import { cn } from '../../ui/cn';

type GuideScreen =
  | 'catalog' | 'item' | 'checkout' | 'orders' | 'order' | 'favorites' | 'promotions'
  | 'templates' | 'questions' | 'reviews' | 'delivery' | 'profile';

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
  icon: LucideIcon;
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
  profile: [{ icon: Building2 }, { icon: FileText, target: 'profile.company.fill' }, { icon: ShieldCheck }],
};

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

/**
 * «Как этим пользоваться» — кнопка в шапке и короткая инструкция к текущему
 * экрану покупателя: схема из знаков, понятная без чтения, и шаги простыми
 * словами. «Показать на экране» закрывает лист и обводит кнопку, о которой шаг;
 * кнопки, которой сейчас на экране нет, «Показать» не обещает.
 */
export function HelpGuide({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const screen = screenOf(pathname);

  if (!screen) return null;
  const steps = STEPS[screen].map((step, index) => ({ ...step, key: `s${index + 1}`, flow: `f${index + 1}` }));
  const shown = (target?: string) => (open && target ? findTarget(t(target)) !== null : false);

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
        onClick={() => setOpen(true)}
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
          {/* Схема: путь экрана знаками — понятна раньше, чем прочитан первый шаг. */}
          <ol aria-label={t('guide.flow')} className="m-0 flex list-none flex-wrap items-start gap-y-3 rounded-[var(--radius-tile)] bg-accent-soft/60 p-3">
            {steps.map((step, index) => (
              <li key={step.key} className="flex items-start">
                {index > 0 ? (
                  <ArrowRight aria-hidden="true" className="mx-1 mt-3 size-3.5 text-ink-muted" />
                ) : null}
                <span className="flex w-16 flex-col items-center gap-1 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-surface text-accent">
                    <step.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] leading-tight text-ink-muted">{t(`guide.${screen}.${step.flow}`)}</span>
                </span>
              </li>
            ))}
          </ol>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {steps.map((step, index) => (
              <li key={step.key} className="flex gap-3">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-2">
                  <span className="text-[15px] leading-relaxed text-ink">{t(`guide.${screen}.${step.key}`)}</span>
                  {step.target && shown(step.target) ? (
                    <button
                      type="button"
                      onClick={() => show(step.target!)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3 text-[13px] font-semibold text-accent hover:border-accent"
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      {t('guide.show')}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Sheet>
    </>
  );
}
