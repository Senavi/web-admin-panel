'use client';

import type { ComponentType } from 'react';

import { type AnyField, FieldKind } from '@/core/content/fields';

import { ImageControl } from './image-control';
import { ListControl } from './list-control';
import { RichTextControl } from './rich-text-control';
import {
  BooleanControl,
  ColorControl,
  EmailControl,
  LinkControl,
  NumberControl,
  PhoneControl,
  SelectControl,
  TextareaControl,
  TextControl,
} from './scalar-controls';
import type { FieldControlProps } from './types';

/**
 * Field kind → editor control. To add a field type, register its control here
 * (docs/CONTENT_SCHEMA.md § Adding a field type).
 */
export const FIELD_CONTROLS: {
  [K in FieldKind]: ComponentType<FieldControlProps<Extract<AnyField, { kind: K }>>>;
} = {
  [FieldKind.Text]: TextControl,
  [FieldKind.Textarea]: TextareaControl,
  [FieldKind.RichText]: RichTextControl,
  [FieldKind.Image]: ImageControl,
  [FieldKind.Link]: LinkControl,
  [FieldKind.List]: ListControl,
  [FieldKind.Boolean]: BooleanControl,
  [FieldKind.Number]: NumberControl,
  [FieldKind.Select]: SelectControl,
  [FieldKind.Color]: ColorControl,
  [FieldKind.Email]: EmailControl,
  [FieldKind.Phone]: PhoneControl,
};

export function FieldControl(props: FieldControlProps) {
  const Control = FIELD_CONTROLS[props.field.kind] as ComponentType<FieldControlProps>;
  return <Control {...props} />;
}
