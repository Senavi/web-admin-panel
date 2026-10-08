/**
 * PROJECT: default share image (1200×630), used when a page and the site have no
 * uploaded share image. Lives in theme/ because the image renderer (satori)
 * needs inline styles; colors come from the generated design tokens.
 */
import type { OgImageData } from '@/core/seo/og-data';

import { tokens } from './tokens.generated';

export function OgTemplate({ title, siteName }: OgImageData) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: `linear-gradient(135deg, ${tokens.color.brand950}, ${tokens.color.brand700})`,
        color: tokens.color.neutral0,
      }}
    >
      <div style={{ display: 'flex', fontSize: 32, opacity: 0.85 }}>{siteName}</div>
      <div
        style={{
          display: 'flex',
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          width: 120,
          height: 8,
          borderRadius: 4,
          background: tokens.color.brand300,
        }}
      />
    </div>
  );
}
