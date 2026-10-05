'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-center mt-16">Loading...</p>;
  }

  return (
    <div className="max-w-sm mx-auto mt-16 text-center space-y-4">
      <h1 className="text-2xl font-bold">Cohort</h1>
      {user ? (
        <Link href="/dashboard" className="inline-block bg-black text-white rounded px-3 py-2">
          Go to dashboard
        </Link>
      ) : (
        <p className="text-gray-600">Log in or sign up to get started.</p>
      )}
    </div>
  );
}