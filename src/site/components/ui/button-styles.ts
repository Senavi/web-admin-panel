import { cx } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'inverse';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border-thin border-border bg-background text-foreground hover:bg-surface-muted',
  inverse: 'bg-inverse-foreground text-inverse hover:bg-accent',
};

/** Classes of buttons and button-styled links (client-safe). */
export function buttonClasses(variant: ButtonVariant = 'primary', className?: string): string {
  return cx(
    'text-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 transition-colors duration-normal ease-standard disabled:opacity-60',
    VARIANT_CLASS[variant],
    className,
  );
}
