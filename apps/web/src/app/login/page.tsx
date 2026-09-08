"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthCard } from '@/components/ui/AuthCard';
import { FormError } from '@/components/ui/FormError';
import Link from 'next/link';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Invalid credentials');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Invalid credentials');
      }
      setIsSubmitting(false);
    }
  };

  if (isLoading || user) {
    return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <AuthCard title="Welcome back" description="Log in to your ForgeBoard account">
        <FormError message={error} />
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <Input 
              id="email"
              type="email" 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <Input 
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </Button>
        </form>
        
        <div className="mt-6 text-center text-sm text-foreground/70">
          Don't have an account? <Link href="/register" className="text-primary hover:underline">Sign up</Link>
        </div>
      </AuthCard>
    </main>
  );
}
