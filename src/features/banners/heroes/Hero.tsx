import type { ComponentType } from 'react';
import type { TemplateStyle } from '../../../supplier/cabinetDesign';
import { BandHero, DuotoneHero, GlassHero, GradientHero, NeonHero, PosterHero, StripesHero, TickerHero } from './ColorHeroes';
import { CollageHero, EditorialHero, MagazineHero, MinimalHero, SplitHero } from './PanelHeroes';
import { FullbleedHero, StoryHero } from './PhotoHeroes';
import type { HeroProps } from './parts';

export type { HeroData, HeroImage, HeroProps } from './parts';

const HEROES: Record<TemplateStyle['hero'], ComponentType<HeroProps>> = {
  gradient: GradientHero,
  split: SplitHero,
  band: BandHero,
  glass: GlassHero,
  editorial: EditorialHero,
  poster: PosterHero,
  stripes: StripesHero,
  minimal: MinimalHero,
  magazine: MagazineHero,
  fullbleed: FullbleedHero,
  collage: CollageHero,
  neon: NeonHero,
  story: StoryHero,
  ticker: TickerHero,
  duotone: DuotoneHero,
};

/**
 * Главный баннер витрины в характере шаблона (`style.hero`).
 *
 * Обёртка помечена видом баннера: по нему тесты и снимки проверяют,
 * что шаблон дошёл до витрины, не разбирая оформления.
 */
export function Hero({ hero, ...props }: HeroProps & { hero: TemplateStyle['hero'] }) {
  const Component = HEROES[hero] ?? GradientHero;
  return (
    <div data-testid="template-hero" data-hero={hero}>
      <Component {...props} />
    </div>
  );
}
