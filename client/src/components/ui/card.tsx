import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface', className)} {...props} />
  );
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-line/60 text-ink',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <ul className="divide-y divide-line">{children}</ul>
    </Card>
  );
}

export function ListRow({
  primary,
  secondary,
  trailing,
  href,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{primary}</p>
        {secondary && <p className="truncate text-sm text-muted">{secondary}</p>}
      </div>
      {trailing}
    </>
  );
  const rowClass = 'flex items-center justify-between gap-4 px-4 py-3';

  return (
    <li>
      {href ? (
        <Link href={href} className={cn(rowClass, 'transition-colors hover:bg-canvas')}>
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}