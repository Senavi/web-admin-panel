import { cx } from './cn';

/** Text-like controls (input, textarea, select): one look, shared by every form. */
const CONTROL =
  'text-body w-full rounded-md border-thin border-border bg-background px-4 py-2 text-foreground disabled:cursor-not-allowed disabled:opacity-60';
const CONTROL_INVALID = 'border-danger';
const FOCUS = 'outline-thick outline-offset-2 outline-focus-ring';
/** Single-line controls keep the same height as buttons. */
const SINGLE_LINE = 'min-h-11';

export interface ControlOptions {
  readonly invalid?: boolean;
  /** Forces the focus look (storybook). */
  readonly focused?: boolean;
  readonly className?: string;
}

/** Classes of input / select (single line). */
export function controlClasses({ invalid, focused, className }: ControlOptions = {}): string {
  return cx(CONTROL, SINGLE_LINE, invalid && CONTROL_INVALID, focused && FOCUS, className);
}

/** Classes of textarea (multi line). */
export function textareaClasses({ invalid, focused, className }: ControlOptions = {}): string {
  return cx(CONTROL, invalid && CONTROL_INVALID, focused && FOCUS, className);
}

/** Classes of a checkbox or radio. */
export function choiceClasses(className?: string): string {
  return cx(
    'mt-1 size-5 accent-primary disabled:cursor-not-allowed disabled:opacity-60',
    className,
  );
}

/** The `label` text style used above every control. */
export const LABEL_CLASS = 'text-label';
