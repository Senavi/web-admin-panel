/**
 * PROJECT: the project's part of `/storybook` (staff only; docs/CUSTOMIZING.md
 * § Storybook). Core renders the token sections (colors, fonts, text styles,
 * spacing, radii, shadows); the sections exported here show the real
 * components of this site. Add or remove entries as the design grows; keep
 * buttons, form fields and icons complete: it is the project's living style
 * guide.
 */
import {
  ArrowRightIcon,
  ChartColumnIcon,
  ClockIcon,
  GlobeIcon,
  ImageIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ZapIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { StorybookSection } from '@/core/storybook/slot';

import {
  type ButtonSize,
  buttonClasses,
  type ButtonState,
  type ButtonVariant,
} from './components/ui/button-styles';
import { cx } from './components/ui/cn';
import {
  choiceClasses,
  controlClasses,
  LABEL_CLASS,
  textareaClasses,
} from './components/ui/form-styles';
import { Container, Section } from './components/ui/layout';
import { Heading, Text } from './components/ui/typography';

// ── Shared bits ──────────────────────────────────────────────────────────────

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-caption text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

const BUTTON_VARIANTS: readonly ButtonVariant[] = [
  'primary',
  'secondary',
  'tertiary',
  'ghost',
  'link',
];
const BUTTON_STATES = ['default', 'hover', 'focus', 'disabled'] as const;
const BUTTON_SIZES: readonly ButtonSize[] = ['sm', 'md', 'lg'];

function StateButton({
  variant,
  state,
  size,
  children,
}: {
  variant: ButtonVariant;
  state: (typeof BUTTON_STATES)[number];
  size?: ButtonSize;
  children: ReactNode;
}) {
  const forced: ButtonState | undefined =
    state === 'hover' || state === 'focus' ? state : undefined;
  return (
    <button
      type="button"
      className={buttonClasses(variant, undefined, { size, state: forced })}
      disabled={state === 'disabled'}
    >
      {children}
    </button>
  );
}

function Buttons() {
  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-body-sm">
          <caption className="sr-only">Button variants in every state</caption>
          <thead>
            <tr className="text-start text-caption text-muted-foreground">
              <th scope="col" className="py-2 pe-4 text-start">
                Variant
              </th>
              {BUTTON_STATES.map((state) => (
                <th key={state} scope="col" className="px-2 py-2 text-start">
                  {state}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUTTON_VARIANTS.map((variant) => (
              <tr key={variant} className="border-thin border-t border-border">
                <th scope="row" className="py-3 pe-4 text-start">
                  {variant}
                </th>
                {BUTTON_STATES.map((state) => (
                  <td key={state} className="px-2 py-3">
                    <StateButton variant={variant} state={state}>
                      Button
                    </StateButton>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-inverse p-6 text-inverse-foreground">
        <span className="text-label">inverse (on dark)</span>
        {BUTTON_STATES.map((state) => (
          <StateButton key={state} variant="inverse" state={state}>
            Button
          </StateButton>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        {BUTTON_SIZES.map((size) => (
          <Cell key={size} label={`size ${size}`}>
            <StateButton variant="primary" state="default" size={size}>
              Button
            </StateButton>
          </Cell>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <Cell label="with icon (leading)">
          <button type="button" className={buttonClasses('primary')}>
            <MailIcon aria-hidden className="size-4" />
            Write to us
          </button>
        </Cell>
        <Cell label="with icon (trailing)">
          <button type="button" className={buttonClasses('secondary')}>
            Read more
            <ArrowRightIcon aria-hidden className="size-4" />
          </button>
        </Cell>
        <Cell label="icon link">
          <a href="#buttons" className={buttonClasses('link')}>
            All posts
            <ArrowRightIcon aria-hidden className="size-4" />
          </a>
        </Cell>
      </div>
    </div>
  );
}

// ── Form fields ──────────────────────────────────────────────────────────────

function FieldFrame({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
      {help ? (
        <Text id={`${id}-help`} variant="caption" tone="muted">
          {help}
        </Text>
      ) : null}
      {error ? (
        <Text id={`${id}-error`} variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </div>
  );
}

function FormFields() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <FieldFrame id="sb-input" label="Input" help="Help text under the field.">
        <input
          id="sb-input"
          className={controlClasses()}
          placeholder="Placeholder"
          aria-describedby="sb-input-help"
        />
      </FieldFrame>
      <FieldFrame id="sb-input-focus" label="Input (focus)">
        <input
          id="sb-input-focus"
          className={controlClasses({ focused: true })}
          defaultValue="Focused"
        />
      </FieldFrame>
      <FieldFrame id="sb-input-error" label="Input (error)" error="Enter a valid email address.">
        <input
          id="sb-input-error"
          className={controlClasses({ invalid: true })}
          defaultValue="not-an-email"
          aria-invalid="true"
          aria-describedby="sb-input-error-error"
        />
      </FieldFrame>
      <FieldFrame id="sb-input-disabled" label="Input (disabled)">
        <input
          id="sb-input-disabled"
          className={controlClasses()}
          defaultValue="Disabled"
          disabled
        />
      </FieldFrame>
      <FieldFrame id="sb-textarea" label="Textarea">
        <textarea
          id="sb-textarea"
          className={textareaClasses()}
          rows={4}
          placeholder="Tell us more"
        />
      </FieldFrame>
      <FieldFrame id="sb-textarea-error" label="Textarea (error)" error="This is required.">
        <textarea
          id="sb-textarea-error"
          className={textareaClasses({ invalid: true })}
          rows={4}
          aria-invalid="true"
          aria-describedby="sb-textarea-error-error"
        />
      </FieldFrame>
      <FieldFrame id="sb-select" label="Select">
        <select id="sb-select" className={controlClasses()} defaultValue="">
          <option value="">Choose…</option>
          <option value="general">General question</option>
          <option value="project">New project</option>
        </select>
      </FieldFrame>
      <FieldFrame id="sb-select-disabled" label="Select (disabled)">
        <select id="sb-select-disabled" className={controlClasses()} disabled>
          <option>Disabled</option>
        </select>
      </FieldFrame>

      <fieldset className="flex flex-col gap-3">
        <legend className={cx(LABEL_CLASS, 'mb-2')}>Checkbox</legend>
        {[
          { id: 'sb-check', label: 'Unchecked', checked: false, disabled: false },
          { id: 'sb-check-on', label: 'Checked', checked: true, disabled: false },
          { id: 'sb-check-off', label: 'Disabled', checked: false, disabled: true },
        ].map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <input
              id={item.id}
              type="checkbox"
              className={choiceClasses()}
              defaultChecked={item.checked}
              disabled={item.disabled}
            />
            <label htmlFor={item.id} className="text-body-sm">
              {item.label}
            </label>
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={cx(LABEL_CLASS, 'mb-2')}>Radio</legend>
        {[
          { id: 'sb-radio-a', label: 'First option', disabled: false },
          { id: 'sb-radio-b', label: 'Second option', disabled: false },
          { id: 'sb-radio-c', label: 'Disabled option', disabled: true },
        ].map((item, index) => (
          <div key={item.id} className="flex items-start gap-3">
            <input
              id={item.id}
              type="radio"
              name="sb-radio"
              className={choiceClasses()}
              defaultChecked={index === 0}
              disabled={item.disabled}
            />
            <label htmlFor={item.id} className="text-body-sm">
              {item.label}
            </label>
          </div>
        ))}
      </fieldset>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

/** Icon library of the site and the icons it uses (add new ones here). */
const ICON_LIBRARY = 'lucide-react';
const ICONS: ReadonlyArray<{ name: string; Icon: LucideIcon }> = [
  { name: 'ArrowRight', Icon: ArrowRightIcon },
  { name: 'ChartColumn', Icon: ChartColumnIcon },
  { name: 'Clock', Icon: ClockIcon },
  { name: 'Globe', Icon: GlobeIcon },
  { name: 'Image', Icon: ImageIcon },
  { name: 'LayoutTemplate', Icon: LayoutTemplateIcon },
  { name: 'Mail', Icon: MailIcon },
  { name: 'MapPin', Icon: MapPinIcon },
  { name: 'Phone', Icon: PhoneIcon },
  { name: 'ShieldCheck', Icon: ShieldCheckIcon },
  { name: 'Zap', Icon: ZapIcon },
];

function Icons() {
  return (
    <div className="flex flex-col gap-4">
      <Text>
        Library: <code>{ICON_LIBRARY}</code>. Decorative icons are hidden from screen readers (
        <code>aria-hidden</code>); an icon that carries meaning gets a text label.
      </Text>
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {ICONS.map(({ name, Icon }) => (
          <li
            key={name}
            className="flex flex-col items-center gap-2 rounded-lg border-thin border-border p-4"
          >
            <Icon aria-hidden className="size-6" />
            <span className="text-caption text-muted-foreground">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Other primitives ─────────────────────────────────────────────────────────

const TEXT_TONES = ['default', 'muted', 'primary', 'danger'] as const;
const SECTION_TONES = ['default', 'surface', 'accent', 'inverse'] as const;

function Primitives() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-h5">Text tones</h3>
        {TEXT_TONES.map((tone) => (
          <Text key={tone} tone={tone}>
            {tone}: The quick brown fox jumps over the lazy dog.
          </Text>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-h5">Headings</h3>
        <Heading level={2}>Heading level 2</Heading>
        <Heading level={3} variant="h5">
          Level 3 styled as h5
        </Heading>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-h5">Section tones</h3>
        <div className="overflow-hidden rounded-lg border-thin border-border">
          {SECTION_TONES.map((tone) => (
            <Section key={tone} tone={tone} spacing="tight">
              <Container>
                <Text
                  variant="label"
                  className={tone === 'inverse' ? 'text-inverse-foreground' : ''}
                >
                  Section tone: {tone}
                </Text>
              </Container>
            </Section>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-h5">Card</h3>
        <div className="flex max-w-prose flex-col gap-3 rounded-lg border-thin border-border bg-background p-6 shadow-sm">
          <span className="inline-flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <ZapIcon aria-hidden className="size-6" />
          </span>
          <Heading level={3} variant="h5">
            Card title
          </Heading>
          <Text variant="body-sm" tone="muted">
            A short text under the title.
          </Text>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-h5">Contact details</h3>
        <ul className="flex flex-col gap-2">
          <li className="flex items-center gap-2 text-body-sm">
            <PhoneIcon aria-hidden className="size-4" /> +380 44 000 00 00
          </li>
          <li className="flex items-center gap-2 text-body-sm">
            <MapPinIcon aria-hidden className="size-4" /> 12 Example Street
          </li>
        </ul>
      </div>
    </div>
  );
}

/** The project's sections, in order. */
export const storybookSections: readonly StorybookSection[] = [
  {
    id: 'buttons',
    title: 'Buttons',
    description: 'Variants in every state, sizes, with an icon. Hover and focus are forced here.',
    render: () => <Buttons />,
  },
  {
    id: 'form-fields',
    title: 'Form fields',
    description: 'Input, textarea, select, checkbox and radio with error and disabled states.',
    render: () => <FormFields />,
  },
  {
    id: 'icons',
    title: 'Icons',
    render: () => <Icons />,
  },
  {
    id: 'primitives',
    title: 'Other primitives',
    description: 'Text tones, headings, section tones and patterns the pages are built from.',
    render: () => <Primitives />,
  },
];
