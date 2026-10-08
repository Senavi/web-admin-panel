import {
  ChartColumnIcon,
  GlobeIcon,
  ImageIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  ShieldCheckIcon,
  ZapIcon,
} from 'lucide-react';

import type { FEATURE_ICONS } from '@/content/pages/home';

type FeatureIconName = (typeof FEATURE_ICONS)[number]['value'];

const ICONS: Record<FeatureIconName, LucideIcon> = {
  layout: LayoutTemplateIcon,
  shield: ShieldCheckIcon,
  globe: GlobeIcon,
  chart: ChartColumnIcon,
  zap: ZapIcon,
  image: ImageIcon,
};

/** Decorative icon (server-rendered SVG, no client JS). */
export function FeatureIcon({ name }: { name: FeatureIconName }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className="size-6" />;
}
