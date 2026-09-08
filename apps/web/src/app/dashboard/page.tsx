"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  // Basic Route Protection
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  }

  return (
    <main className="flex-1 flex flex-col p-8 space-y-6">
      <div className="flex justify-between items-center pb-6 border-b border-border">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Button variant="secondary" onClick={logout}>Log out</Button>
      </div>
      
      <div>
        <p className="text-lg">Welcome, <span className="font-semibold">{user.name}</span>!</p>
        <p className="text-foreground/70">Your authenticated session is active.</p>
      </div>
    </main>
  );
}
