/** DEMO VIEW: replace with your project's pages. */
import type { PageViewProps } from '@/core/content/page-route';

import { CtaBand } from '../sections/cta-band';
import { FeaturesSection } from '../sections/features';
import { HeroSection } from '../sections/hero';
import { StatsSection } from '../sections/stats';

export function HomeView({ content, locale }: PageViewProps<'home'>) {
  return (
    <>
      <HeroSection content={content.hero} />
      <FeaturesSection content={content.features} />
      <StatsSection content={content.stats} locale={locale} />
      <CtaBand content={content.cta} />
    </>
  );
}
