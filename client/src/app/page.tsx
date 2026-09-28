'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return <p className="text-center mt-16">Loading...</p>;
  }

  return (
    <div className="max-w-sm mx-auto mt-16 text-center">
      {user ? (
        <>
          <p className="mb-4">
            Logged in as <strong>{user.role}</strong> (id: {user.id})
          </p>
          <button onClick={logout} className="bg-black text-white rounded px-3 py-2">
            Log out
          </button>
        </>
      ) : (
        <>
          <p className="mb-4">Not logged in</p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="underline">Log in</Link>
            <Link href="/signup" className="underline">Sign up</Link>
          </div>
        </>
      )}
    </div>
  );
}