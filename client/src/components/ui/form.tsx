import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const controlStyles =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-accent';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(controlStyles, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={5} className={cn(controlStyles, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(controlStyles, className)} {...props} />;
}

// A real <label> wrapping the control, so clicking the label focuses the control
// and screen readers announce it (placeholders are not labels).
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="text-sm font-normal text-muted">{hint}</span>}
      {error && <span className="text-sm font-normal text-danger">{error}</span>}
    </label>
  );
}