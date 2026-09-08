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

interface ValidationErrorDetail {
  path: (string | number)[];
  message: string;
}

interface ApiValidationErrorData {
  code?: string;
  details?: ValidationErrorDetail[];
}

export default function RegisterPage() {
  const { user, isLoading, register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
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
      await register({ name, email, password });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const errorData = err.data as ApiValidationErrorData | undefined;
        if (errorData?.code === 'VALIDATION_ERROR' && Array.isArray(errorData.details)) {
          const firstZodError = errorData.details[0];
          setError(firstZodError ? `${firstZodError.path.join('.')}: ${firstZodError.message}` : 'Validation error');
        } else {
          setError(err.message || 'Registration failed');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed');
      }
      setIsSubmitting(false);
    }
  };

  if (isLoading || user) {
    return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <AuthCard title="Create an account" description="Sign up to start using ForgeBoard">
        <FormError message={error} />
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">Full Name</label>
            <Input 
              id="name"
              type="text" 
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing up...' : 'Sign up'}
          </Button>
        </form>
        
        <div className="mt-6 text-center text-sm text-foreground/70">
          Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link>
        </div>
      </AuthCard>
    </main>
  );
}
