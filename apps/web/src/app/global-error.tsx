"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Global Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-2xl border border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/40 shadow-xs space-y-5">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Critical Application Error
            </h1>
            <p className="text-xs text-foreground/70 leading-relaxed">
              A fatal error occurred. Please refresh or try again.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <Button
              onClick={() => reset()}
              className="text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restart Application</span>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
