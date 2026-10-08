import Image from 'next/image';

import type { ResolvedImage } from '@/core/content/define';

import { cx } from './cn';

/**
 * Content image rendered with next/image: intrinsic size (no layout shift),
 * blur placeholder, responsive `sizes`. Pass `priority` for the LCP image.
 */
export function SiteImage({
  image,
  sizes,
  priority = false,
  className,
}: {
  image: ResolvedImage | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) return null;
  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      priority={priority}
      placeholder={image.blurDataURL ? 'blur' : 'empty'}
      blurDataURL={image.blurDataURL ?? undefined}
      className={cx('h-auto w-full', className)}
    />
  );
}
