import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '../../../ui/cn';
import { Eyebrow, HeroButton, HeroCountdown, HeroPhoto, INK, heroTitle, type HeroProps } from './parts';

/*
 * Баннеры на цвете магазина: градиент, лента, стекло, постер, полосы
 * склада, неон, бегущая строка и двухцветный. Цвета — токенами шаблона
 * (`--color-shop`, `--color-accent2`, `--color-brand-deep`), смешанными
 * `color-mix` по формулам макета: `mix(a, b, t)` макета — это
 * `color-mix(in srgb, a (1−t), b)`.
 */

const PAD = (compact: boolean) => (compact ? 'px-6 py-7' : 'px-10 py-9');
/** Полупрозрачная белая подложка надписи на цвете — как в макете. */
const CHIP = 'rounded-[var(--radius-chip)] bg-white/18 px-[11px] py-[5px]';

/** Градиент: фирменный цвет в глубину, пятно второго цвета, кольца и штамп скидки. */
export function GradientHero({ data, compact, onAction, hidden }: HeroProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn('relative overflow-hidden rounded-[var(--radius-template)] text-white', PAD(compact))}
      style={{
        background: 'radial-gradient(55% 95% at 85% 15%, color-mix(in srgb, var(--color-accent2) 70%, var(--color-shop)), transparent 70%), '
          + 'linear-gradient(120deg, var(--color-shop), var(--color-brand-deep))',
        boxShadow: '0 24px 40px -30px var(--color-brand-deep)',
      }}
    >
      <span aria-hidden="true" className="absolute -bottom-[130px] right-[20%] size-[300px] rounded-full border border-[color-mix(in_srgb,white_28%,var(--color-shop))]" />
      <span aria-hidden="true" className="absolute -bottom-[86px] right-[25%] size-[210px] rounded-full border border-[color-mix(in_srgb,white_22%,var(--color-shop))]" />
      <div className="relative flex items-center gap-7">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Eyebrow className={CHIP}>{data.badge}</Eyebrow>
          <h2 className={heroTitle(compact)}>{data.title}</h2>
          {data.text && !compact ? <p className="max-w-[460px] text-body leading-normal opacity-85">{data.text}</p> : null}
          <span className="flex flex-wrap gap-2.5">
            <HeroButton onClick={onAction} hidden={hidden} className="bg-white" >
              <span style={{ color: INK }}>{data.button}</span>
            </HeroButton>
            {compact ? null : (
              <Link
                to="/promotions"
                tabIndex={hidden ? -1 : 0}
                className="flex h-[2.875rem] items-center rounded-[var(--radius-small)] border border-[color-mix(in_srgb,white_50%,var(--color-shop))] px-5 text-sm font-bold text-white hover:bg-white/10"
              >
                {t('design.allDeals')}
              </Link>
            )}
          </span>
        </div>
        {data.stamp && !compact ? (
          <span
            className="flex size-[132px] shrink-0 -rotate-10 flex-col items-center justify-center rounded-full bg-accent2 text-accent2-ink"
            style={{ boxShadow: `0 16px 30px -14px ${INK}` }}
          >
            <b className="text-[2.5rem] font-black leading-none tracking-[-0.03em]">{data.stamp}</b>
            <span className="text-caption font-bold">{t('design.stamp')}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Лента: скидка моноширинно, заголовок, отсчёт и кнопка — одной строкой. */
export function BandHero({ data, compact, onAction, hidden }: HeroProps) {
  return (
    <div
      className={cn('qo-tile flex items-center gap-6 rounded-[var(--radius-template)] px-7 py-[22px] text-white', compact && 'flex-wrap')}
      style={{ background: 'linear-gradient(90deg, var(--color-shop) 50%, color-mix(in srgb, var(--color-shop) 60%, var(--color-accent2)))' }}
    >
      {data.stamp ? <span className="font-mono text-[2.875rem] font-bold leading-none text-accent2">{data.stamp}</span> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Eyebrow className="text-[color-mix(in_srgb,white_70%,var(--color-shop))]">{data.badge}</Eyebrow>
        <h2 className={heroTitle(compact, 'text-2xl', 'text-xl')}>{data.title}</h2>
      </div>
      {compact ? null : <HeroCountdown endsAt={data.endsAt} tone="dark" small />}
      <HeroButton onClick={onAction} hidden={hidden} className="bg-white"><span style={{ color: INK }}>{data.button}</span></HeroButton>
    </div>
  );
}

/** Стекло: матовая плашка поверх тёмного свечения, кнопка светится вторым цветом. */
export function GlassHero({ data, compact, onAction, hidden }: HeroProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-template)] p-[22px] text-white"
      style={{
        background: `radial-gradient(55% 110% at 92% 0%, color-mix(in srgb, var(--color-accent2) 80%, ${INK}), transparent 62%), `
          + 'radial-gradient(70% 110% at 5% 100%, var(--color-shop), transparent 66%), '
          + `color-mix(in srgb, var(--color-brand-deep) 45%, ${INK})`,
      }}
    >
      <div className="relative flex items-center justify-between gap-6 rounded-[max(var(--radius-small),8px)] border border-white/14 bg-white/7 px-7 py-[26px] backdrop-blur-[14px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Eyebrow className="text-accent2">{data.badge}</Eyebrow>
          <h2 className={heroTitle(compact)}>{data.title}</h2>
          {data.text && !compact ? <p className="max-w-[460px] text-body leading-normal opacity-85">{data.text}</p> : null}
          <HeroButton onClick={onAction} hidden={hidden} className="bg-accent2 text-accent2-ink shadow-[0_0_26px_-4px_var(--color-accent2)]">
            {data.button}
          </HeroButton>
        </div>
        {compact ? null : <HeroCountdown endsAt={data.endsAt} tone="dark" />}
      </div>
    </div>
  );
}

/** Постер: огромная скидка вторым цветом набок и крупный заголовок. */
export function PosterHero({ data, compact, onAction, hidden }: HeroProps) {
  return (
    <div
      className={cn('relative min-h-[230px] overflow-hidden rounded-[var(--radius-template)] bg-shop text-on-shop', PAD(compact))}
      style={{ boxShadow: '0 24px 40px -30px var(--color-brand-deep)' }}
    >
      <span
        aria-hidden="true"
        className={cn('qo-heading absolute -right-2.5 top-1/2 whitespace-nowrap text-accent2', compact ? 'text-[9.375rem]' : 'text-[13.125rem]', 'leading-[0.8]')}
        style={{ transform: 'translateY(-50%) rotate(-6deg)', textShadow: '6px 6px 0 var(--color-brand-deep)' }}
      >
        {data.stamp ?? '%'}
      </span>
      <div className="relative flex max-w-[56%] flex-col gap-3.5">
        <Eyebrow className="rounded-[var(--radius-chip)] bg-accent2 px-[11px] py-[5px]" style={{ color: INK }}>{data.badge}</Eyebrow>
        <h2 className={heroTitle(compact, 'text-[2.5rem]', 'text-[1.75rem]')}>{data.title}</h2>
        <HeroButton onClick={onAction} hidden={hidden} className="bg-white font-black [text-transform:var(--heading-case)]">
          <span style={{ color: INK }}>{data.button}</span>
        </HeroButton>
      </div>
    </div>
  );
}

/** Полосы склада: жёлто-чёрная лента сверху и снизу, моноширинная скидка. */
export function StripesHero({ data, compact, onAction, hidden }: HeroProps) {
  const stripes = { background: `repeating-linear-gradient(-45deg, var(--color-accent2) 0 14px, ${INK} 14px 28px)` };
  return (
    <div
      className="qo-tile overflow-hidden rounded-[var(--radius-template)] text-white"
      style={{ background: `color-mix(in srgb, ${INK} 65%, var(--color-shop))` }}
    >
      <div aria-hidden="true" className="h-3" style={stripes} />
      <div className={cn('flex items-center gap-6 px-[30px] py-[26px]', compact && 'flex-wrap')}>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Eyebrow className="rounded-[var(--radius-chip)] bg-accent2 px-[11px] py-[5px]" style={{ color: INK }}>{data.badge}</Eyebrow>
          <h2 className={heroTitle(compact)}>{data.title}</h2>
          {data.text && !compact ? <p className="max-w-[460px] text-body leading-normal opacity-85">{data.text}</p> : null}
        </div>
        {data.stamp ? <span className="font-mono text-[3.625rem] font-bold leading-none text-accent2">{data.stamp}</span> : null}
        <HeroButton onClick={onAction} hidden={hidden} className="bg-accent2 font-mono uppercase">
          <span style={{ color: INK }}>{data.button}</span>
        </HeroButton>
      </div>
      <div aria-hidden="true" className="h-3" style={stripes} />
    </div>
  );
}

/** Неон: тёмная плашка в градиентной рамке и светящийся заголовок. */
export function NeonHero({ data, compact, onAction, hidden }: HeroProps) {
  return (
    <div
      className="rounded-[var(--radius-template)] p-0.5"
      style={{
        background: 'linear-gradient(120deg, var(--color-shop), var(--color-accent2), var(--color-shop))',
        boxShadow: '0 0 40px -12px var(--color-accent2)',
      }}
    >
      <div
        className={cn('flex items-center justify-between gap-7 rounded-[max(0px,calc(var(--radius-template)-2px))] text-white', PAD(compact))}
        style={{ background: `color-mix(in srgb, ${INK} 75%, var(--color-brand-deep))` }}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <Eyebrow className="text-accent2">{data.badge}</Eyebrow>
          <h2 className={heroTitle(compact)} style={{ textShadow: '0 0 18px var(--color-accent2)' }}>{data.title}</h2>
          {data.text && !compact ? <p className="max-w-[460px] text-body leading-normal opacity-85">{data.text}</p> : null}
          <HeroButton
            onClick={onAction}
            hidden={hidden}
            className="border-[1.5px] border-accent2 bg-transparent text-accent2 shadow-[inset_0_0_16px_-6px_var(--color-accent2),0_0_16px_-6px_var(--color-accent2)]"
          >
            {data.button}
          </HeroButton>
        </div>
        {compact ? null : <HeroCountdown endsAt={data.endsAt} tone="dark" />}
      </div>
    </div>
  );
}

/** Бегущая строка предложений и цветная плашка под ней. */
export function TickerHero({ data, compact, onAction, hidden }: HeroProps) {
  const words = [data.title, data.stamp, data.badge].filter(Boolean).join('  ✦  ');
  return (
    <div className="qo-tile flex flex-col overflow-hidden rounded-[var(--radius-template)]">
      <div
        aria-hidden="true"
        className="flex h-10 items-center gap-7 overflow-hidden whitespace-nowrap bg-accent2 px-4 text-sm font-extrabold uppercase tracking-[0.06em]"
        style={{ color: INK }}
      >
        <span>{words}</span><span>✦</span><span>{words}</span><span>✦</span><span>{words}</span>
      </div>
      <div className={cn('flex items-center justify-between gap-6 bg-shop px-[30px] py-6 text-on-shop', compact && 'flex-wrap')}>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className={heroTitle(compact, 'text-[2rem]', 'text-2xl')}>{data.title}</h2>
          {data.text && !compact ? <p className="max-w-[460px] text-body leading-normal opacity-85">{data.text}</p> : null}
        </div>
        {data.stamp ? <span className="text-[3.75rem] font-black leading-none tracking-[-0.04em] text-accent2">{data.stamp}</span> : null}
        <HeroButton onClick={onAction} hidden={hidden} className="bg-accent2"><span style={{ color: INK }}>{data.button}</span></HeroButton>
      </div>
    </div>
  );
}

/** Двухцветный: градиент от цвета магазина ко второму и снимок, окрашенный в тон. */
export function DuotoneHero({ data, compact, onAction, hidden }: HeroProps) {
  const photo = data.images[0];
  return (
    <div
      className={cn('relative flex min-h-[260px] items-center overflow-hidden rounded-[var(--radius-template)] text-white', PAD(compact))}
      style={{ background: 'linear-gradient(125deg, var(--color-shop) 0%, color-mix(in srgb, var(--color-shop) 50%, var(--color-accent2)) 55%, var(--color-accent2) 100%)' }}
    >
      {photo && !compact ? (
        <span
          className="absolute right-10 top-1/2 flex w-[300px] overflow-hidden rounded-[var(--radius-template)] opacity-90 mix-blend-luminosity"
          style={{ transform: 'translateY(-50%) rotate(4deg)', boxShadow: `0 30px 50px -30px ${INK}` }}
        >
          <HeroPhoto image={photo} className="h-[240px]" />
        </span>
      ) : null}
      <div className={cn('relative flex flex-col gap-3.5', compact ? 'max-w-full' : 'max-w-[55%]')}>
        <Eyebrow className={CHIP}>{data.badge}</Eyebrow>
        <h2 className={heroTitle(compact, 'text-[2.75rem]', 'text-[1.75rem]')}>{data.title}</h2>
        {data.text && !compact ? <p className="max-w-[460px] text-body leading-normal opacity-85">{data.text}</p> : null}
        <HeroButton onClick={onAction} hidden={hidden} className="bg-white"><span style={{ color: INK }}>{data.button}</span></HeroButton>
      </div>
    </div>
  );
}
