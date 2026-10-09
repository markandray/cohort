'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { buttonStyles } from '@/components/ui/button';
import { PageContainer } from '@/components/ui/page';

export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer width="narrow">
        <p className="text-center text-muted">Loading...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow" className="pt-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Cohort</h1>
      <p className="mt-2 text-muted">Classes, assignments, notes and study groups in one place.</p>
      <div className="mt-8">
        {user ? (
          <Link href="/dashboard" className={buttonStyles()}>
            Go to dashboard
          </Link>
        ) : (
          <p className="text-sm text-muted">Log in or sign up to get started.</p>
        )}
      </div>
    </PageContainer>
  );
}