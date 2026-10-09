import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const widths = {
  narrow: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-5xl',
};

export function PageContainer({
  width = 'lg',
  className,
  children,
}: {
  width?: keyof typeof widths;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className={cn('mx-auto w-full px-6 py-10', widths[width], className)}>{children}</main>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Section({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">
          {title}
          {count !== undefined && <span className="ml-2 font-normal text-muted">{count}</span>}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}