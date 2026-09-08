"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-foreground/50">Loading ForgeBoard...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
      <h1 className="text-4xl font-bold tracking-tight">Welcome to ForgeBoard</h1>
      <p className="text-lg text-foreground/70 max-w-lg">
        The ultimate issue tracking platform. A clean, resilient foundation is now established.
      </p>
      
      {user ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 rounded-lg border border-border bg-background shadow-sm">
            <p className="font-medium text-primary">Authenticated as: {user.name}</p>
          </div>
          <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
        </div>
      ) : (
        <div className="flex gap-4">
          <Link href="/login">
            <Button>Log In</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">Sign Up</Button>
          </Link>
        </div>
      )}
    </main>
  );
}
