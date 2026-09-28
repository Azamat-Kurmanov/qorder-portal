import { useTranslation } from 'react-i18next';
import { cn } from '../../../ui/cn';
import { Eyebrow, HeroButton, HeroPhoto, INK, heroTitle, type HeroProps } from './parts';

/*
 * Баннеры, построенные вокруг снимков: обложка лукбука во всю ширину
 * и кружки «историй» над небольшой плашкой.
 */

/** Обложка лукбука: снимок во всю ширину и заголовок поверх затемнения. */
export function FullbleedHero({ data, compact, onAction, hidden }: HeroProps) {
  const photo = data.images[0];
  return (
    <div className={cn('relative flex overflow-hidden rounded-[var(--radius-template)] text-white', compact ? 'min-h-[300px]' : 'min-h-[380px]')}>
      {photo ? <span className="absolute inset-0 flex"><HeroPhoto image={photo} className="h-full" /></span> : null}
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-88"
        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${INK} 80%, var(--color-brand-deep)), transparent 70%)` }}
      />
      <div className={cn('relative flex max-w-[620px] flex-col gap-3.5 self-end', compact ? 'px-6 py-7' : 'px-10 py-9')}>
        <Eyebrow className="text-accent2">{data.badge}</Eyebrow>
        <h2 className={cn(heroTitle(compact, 'text-[3.5rem]', 'text-[2rem]'), 'leading-none')}>{data.title}</h2>
        {data.text && !compact ? <p className="max-w-[460px] text-body leading-normal opacity-85">{data.text}</p> : null}
        <HeroButton
          onClick={onAction}
          hidden={hidden}
          className="h-auto rounded-none border-b border-white px-0 pb-1 text-caption font-semibold uppercase tracking-[0.14em] text-white hover:scale-100"
        >
          {data.button}
        </HeroButton>
      </div>
      {data.stamp && !compact ? (
        <span className="absolute right-[34px] top-[30px] font-heading text-[4rem] italic leading-none text-accent2">{data.stamp}</span>
      ) : null}
    </div>
  );
}

/** Истории: кружки рубрик со снимками над небольшой цветной плашкой — как в соцсетях. */
export function StoryHero({ data, compact, onAction, hidden }: HeroProps) {
  const { t } = useTranslation();
  const stories = [data.stamp ?? '%', ...data.chips.slice(0, compact ? 3 : 5)];
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden="true" className="flex gap-[18px] overflow-hidden">
        {stories.map((label, index) => {
          const image = data.images.length > 0 ? data.images[index % data.images.length] : undefined;
          return (
            <span key={`${label}-${index}`} className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
              <span
                className="flex size-[76px] rounded-full p-[3px]"
                style={{ background: 'conic-gradient(var(--color-shop), var(--color-accent2), var(--color-shop))' }}
              >
                <span className="flex w-full overflow-hidden rounded-full border-[3px] border-surface">
                  {index === 0 ? (
                    <span className="flex w-full items-center justify-center bg-accent2 text-lg font-black text-accent2-ink">{label}</span>
                  ) : image ? <HeroPhoto image={{ id: `${image.id}-${index}`, src: image.src }} className="h-full" /> : null}
                </span>
              </span>
              <span className="max-w-full truncate text-xs font-semibold text-ink">{index === 0 ? t('design.saleBadge') : label}</span>
            </span>
          );
        })}
      </div>
      <div
        className={cn('qo-tile flex items-center justify-between gap-5 rounded-[var(--radius-template)] px-7 py-[22px] text-white', compact && 'flex-wrap')}
        style={{ background: 'linear-gradient(110deg, var(--color-shop), color-mix(in srgb, var(--color-shop) 45%, var(--color-accent2)))' }}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow className="rounded-[var(--radius-chip)] bg-white/18 px-[11px] py-[5px] text-white">{data.badge}</Eyebrow>
          <h2 className={heroTitle(compact, 'text-[1.875rem]', 'text-2xl')}>{data.title}</h2>
        </div>
        <HeroButton onClick={onAction} hidden={hidden} className="bg-white"><span style={{ color: INK }}>{data.button}</span></HeroButton>
      </div>
    </div>
  );
}
