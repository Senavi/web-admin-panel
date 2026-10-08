'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/ui/select';

export interface SimpleOption {
  readonly value: string;
  readonly label: string;
}

/** Single-value select with a plain value/onChange API. */
export function SimpleSelect({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SimpleOption[];
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (typeof next === 'string') onChange(next);
      }}
      items={options.map((option) => ({ value: option.value, label: option.label }))}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
