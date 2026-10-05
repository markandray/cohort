'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  href: string;
  label: string;
  roles?: string[]; // omit = visible to every logged-in user
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
    <nav className="border-b px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold">
          Cohort
        </Link>
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'font-semibold underline' : 'text-gray-600 hover:text-black'}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-sm">
        {isLoading ? null : user ? (
          <>
            <span className="text-gray-500">{user.role}</span>
            <button onClick={handleLogout} className="border rounded px-3 py-1">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="underline">
              Log in
            </Link>
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}