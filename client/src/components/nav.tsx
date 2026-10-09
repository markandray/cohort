'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/card';
import { Button, buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/classes', label: 'Classes' },
  { href: '/notes', label: 'Notes' },
  { href: '/admin/invites', label: 'Invites', roles: ['ADMIN'] },
];

export default function Nav() {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const visibleItems = user
    ? NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role))
    : [];

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-1">
          <Link href="/" className="mr-4 font-semibold tracking-tight">
            Cohort
          </Link>
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-line/60 font-medium text-ink' : 'text-muted hover:text-ink'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? null : user ? (
            <>
              <Badge>{user.role}</Badge>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                Log in
              </Link>
              <Link href="/signup" className={buttonStyles({ size: 'sm' })}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}