import { useTranslation } from 'react-i18next';
import { cn } from '../../../ui/cn';
import { Eyebrow, HeroButton, HeroPhoto, INK, heroTitle, useTimeLeft, type HeroProps } from './parts';

/*
 * Светлые баннеры на панели и бумаге кабинета: разворот с фото, журнальная
 * полоса, строгая лента, обложка журнала и коллаж. Текст — чернилами темы,
 * поэтому в тёмной теме они темнеют вместе с кабинетом.
 */

const PAD = (compact: boolean) => (compact ? 'px-6 py-7' : 'px-10 py-9');
/** Кнопка-слово с подчёркиванием — у журнальных баннеров. */
const WORD = 'h-auto rounded-none border-b px-0 pb-1 text-caption font-semibold uppercase tracking-[0.12em]';

/** Разворот: текст на панели слева, справа снимок набок на подсвеченном фоне и штамп скидки. */
export function SplitHero({ data, compact, onAction, hidden }: HeroProps) {
  const photo = data.images[0];
  return (
    <div className={cn('qo-tile grid overflow-hidden rounded-[var(--radius-template)] bg-surface', compact ? 'grid-cols-1' : 'grid-cols-[1.1fr_1fr]')}>
      <div className={cn('flex flex-col justify-center gap-3.5', PAD(compact))}>
        <Eyebrow className="text-accent">{data.badge}</Eyebrow>
        <h2 className={cn(heroTitle(compact), 'text-ink')}>{data.title}</h2>
        {data.text && !compact ? <p className="text-body leading-normal text-ink-muted">{data.text}</p> : null}
        <HeroButton onClick={onAction} hidden={hidden} className="bg-accent text-on-accent shadow-[0_12px_20px_-14px_var(--color-brand-deep)]">
          {data.button}
        </HeroButton>
      </div>
      {compact ? null : (
        <div
          className="relative flex min-h-[250px] items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-glow), color-mix(in srgb, var(--color-accent2) 50%, var(--color-canvas)))' }}
        >
          {photo ? (
            <span className="flex w-[56%] -rotate-3 overflow-hidden rounded-[var(--radius-template)]" style={{ boxShadow: `0 24px 40px -22px ${INK}` }}>
              <HeroPhoto image={photo} className="h-[210px]" />
            </span>
          ) : null}
          {data.stamp ? (
            <span
              className="absolute bottom-[12%] left-[10%] flex size-[88px] -rotate-12 items-center justify-center rounded-full bg-accent2 text-accent2-ink"
              style={{ boxShadow: `0 12px 22px -12px ${INK}` }}
            >
              <b className="text-2xl font-black">{data.stamp}</b>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Журнальная полоса: линейки сверху и снизу, курсивный заголовок и снимок со штампом. */
export function EditorialHero({ data, compact, onAction, hidden }: HeroProps) {
  const photo = data.images[0];
  return (
    <div className={cn('grid items-stretch gap-[30px] border-y border-ink py-[26px]', compact ? 'grid-cols-1' : 'grid-cols-[1.3fr_1fr]')}>
      <div className="flex flex-col justify-center gap-4">
        <Eyebrow className="text-ink-muted">{data.badge}</Eyebrow>
        <h2 className={cn(heroTitle(compact, 'text-5xl', 'text-[1.875rem]'), 'italic text-ink')}>{data.title}</h2>
        {data.text && !compact ? <p className="text-body leading-relaxed text-ink-muted">{data.text}</p> : null}
        <HeroButton onClick={onAction} hidden={hidden} className={cn(WORD, 'border-ink text-ink hover:scale-100')}>
          {data.button}
        </HeroButton>
      </div>
      {compact || !photo ? null : (
        <div className="relative flex">
          <HeroPhoto image={photo} className="h-[270px] rounded-[var(--radius-small)]" />
          {data.stamp ? (
            <span className="absolute -left-[18px] top-[18px] border border-ink bg-surface px-3.5 py-2 font-heading text-title italic text-ink">
              {data.stamp}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Строгая лента: огромный тонкий заголовок и слово-ссылка, никакого фона. */
export function MinimalHero({ data, compact, onAction, hidden }: HeroProps) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-hairline pb-6 pt-[22px]">
      <div className="flex max-w-[680px] flex-col gap-3.5">
        <Eyebrow className="text-ink-muted">{data.badge}</Eyebrow>
        <h2 className={cn(heroTitle(compact, 'text-[3.5rem]', 'text-[2rem]'), 'leading-none text-ink')} style={{ fontWeight: 300 }}>
          {data.title}
          {data.stamp ? <span className="font-semibold text-sale"> {data.stamp}</span> : null}
        </h2>
      </div>
      <HeroButton
        onClick={onAction}
        hidden={hidden}
        className="h-auto shrink-0 rounded-none border-b border-ink px-0 pb-0.5 text-sm font-medium text-ink hover:scale-100"
      >
        {data.button}
      </HeroButton>
    </div>
  );
}

/** Обложка журнала: номер выпуска-скидка, заголовок с курсивной подводкой и снимок набок. */
export function MagazineHero({ data, compact, onAction, hidden }: HeroProps) {
  const { t } = useTranslation();
  const photo = data.images[0];
  return (
    <div
      className={cn(
        'qo-tile grid items-center gap-[30px] rounded-[var(--radius-template)] bg-surface',
        compact ? 'grid-cols-1' : 'grid-cols-[auto_1fr_auto]',
        PAD(compact),
      )}
    >
      {compact ? null : (
        <span className="flex flex-col items-center border-r border-hairline pr-[26px] leading-[0.9]">
          <span className="text-caption uppercase tracking-[0.2em] text-ink-muted">{t('design.issue')}</span>
          <b className="font-heading text-[5.75rem] italic text-accent2">{data.stamp ?? '№1'}</b>
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <Eyebrow className="text-accent">{data.badge}</Eyebrow>
        <h2 className={cn(heroTitle(compact, 'text-[2.75rem]', 'text-[1.75rem]'), 'text-ink')}>{data.title}</h2>
        {data.text && !compact ? <p className="font-heading text-base italic leading-normal text-ink-muted">{data.text}</p> : null}
        <HeroButton onClick={onAction} hidden={hidden} className="bg-accent text-on-accent">{data.button}</HeroButton>
      </div>
      {compact || !photo ? null : (
        <span className="flex w-[230px] rotate-2 overflow-hidden rounded-[var(--radius-small)]" style={{ boxShadow: `0 22px 36px -24px ${INK}` }}>
          <HeroPhoto image={photo} className="h-[270px]" />
        </span>
      )}
    </div>
  );
}

/** Коллаж: три снимка лавкой и текст рядом, скидка — на третьем снимке. */
export function CollageHero({ data, compact, onAction, hidden }: HeroProps) {
  const { t } = useTranslation();
  const left = useTimeLeft(data.endsAt);
  const [a, b, c] = [data.images[0], data.images[1] ?? data.images[0], data.images[2] ?? data.images[0]];
  return (
    <div className={cn('qo-tile grid gap-[22px] rounded-[var(--radius-template)] bg-surface p-[18px]', compact ? 'grid-cols-1' : 'grid-cols-[1fr_1.05fr]')}>
      {compact || !a ? null : (
        <div className="grid min-h-[280px] grid-cols-[1.2fr_1fr] grid-rows-2 gap-2.5">
          <span className="row-span-2 flex overflow-hidden rounded-[var(--radius-small)]"><HeroPhoto image={a} className="h-full" /></span>
          <span className="flex overflow-hidden rounded-[var(--radius-small)]"><HeroPhoto image={b} className="h-full" /></span>
          <span className="relative flex overflow-hidden rounded-[var(--radius-small)]">
            <HeroPhoto image={c} className="h-full" />
            {data.stamp ? (
              <span
                className="absolute inset-0 flex items-center justify-center text-[2.125rem] font-black text-white opacity-92"
                style={{ background: `color-mix(in srgb, var(--color-shop) 90%, ${INK})` }}
              >
                {data.stamp}
              </span>
            ) : null}
          </span>
        </div>
      )}
      <div className="flex flex-col justify-center gap-3.5 px-3.5">
        <Eyebrow className="text-accent">{data.badge}</Eyebrow>
        <h2 className={cn(heroTitle(compact), 'text-ink')}>{data.title}</h2>
        {data.text && !compact ? <p className="text-body leading-normal text-ink-muted">{data.text}</p> : null}
        <span className="flex flex-wrap items-center gap-2.5">
          <HeroButton onClick={onAction} hidden={hidden} className="bg-accent text-on-accent">{data.button}</HeroButton>
          {left && !compact ? <span className="text-caption text-ink-muted">{t('design.endsIn', { days: left.days })}</span> : null}
        </span>
      </div>
    </div>
  );
}
