import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:bg-ink/85',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas',
  danger: 'border border-line-strong bg-surface text-danger hover:bg-danger-soft',
  ghost: 'text-muted hover:bg-line/50 hover:text-ink',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

// Exported separately so a <Link> can look like a button.
export function buttonStyles({
  variant = 'primary',
  size = 'md',
}: { variant?: Variant; size?: Size } = {}) {
  return cn(base, variants[variant], sizes[size]);
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}