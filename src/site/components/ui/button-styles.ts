import { cx } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'link' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';
/** Forces a state's look (storybook): hover and focus are otherwise pointer / keyboard driven. */
export type ButtonState = 'hover' | 'focus';

/**
 * One entry per variant. `base` never changes with state; `rest` and `hover` are
 * the state-dependent utilities. Literal class names, so Tailwind sees them all.
 */
const VARIANT: Record<
  ButtonVariant,
  { base: string; rest: string; hover: string; forcedHover: string }
> = {
  primary: {
    base: 'text-primary-foreground',
    rest: 'bg-primary',
    hover: 'hover:bg-primary-hover',
    forcedHover: 'bg-primary-hover',
  },
  secondary: {
    base: 'border-thin border-border text-foreground',
    rest: 'bg-background',
    hover: 'hover:bg-surface-muted',
    forcedHover: 'bg-surface-muted',
  },
  tertiary: {
    base: 'text-accent-foreground',
    rest: 'bg-accent',
    hover: 'hover:bg-surface-muted',
    forcedHover: 'bg-surface-muted',
  },
  ghost: {
    base: 'text-foreground',
    rest: 'bg-transparent',
    hover: 'hover:bg-surface-muted',
    forcedHover: 'bg-surface-muted',
  },
  link: {
    base: 'underline underline-offset-4',
    rest: 'text-primary',
    hover: 'hover:text-primary-hover',
    forcedHover: 'text-primary-hover',
  },
  inverse: {
    base: 'text-inverse',
    rest: 'bg-inverse-foreground',
    hover: 'hover:bg-accent',
    forcedHover: 'bg-accent',
  },
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4',
  md: 'min-h-11 px-6',
  lg: 'min-h-12 px-8',
};
/** Links look like text: no height or padding of their own. */
const LINK_SIZE = 'px-0';

const FOCUS = 'outline-thick outline-offset-2 outline-focus-ring';

/** Classes of buttons and button-styled links (client-safe). */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  className?: string,
  options: { size?: ButtonSize; state?: ButtonState } = {},
): string {
  const { base, rest, hover, forcedHover } = VARIANT[variant];
  const forcedHovered = options.state === 'hover';
  return cx(
    'text-button inline-flex items-center justify-center gap-2 rounded-full transition-colors duration-normal ease-standard disabled:cursor-not-allowed disabled:opacity-60',
    variant === 'link' ? LINK_SIZE : SIZE[options.size ?? 'md'],
    base,
    forcedHovered ? forcedHover : [rest, hover].join(' '),
    options.state === 'focus' && FOCUS,
    className,
  );
}
