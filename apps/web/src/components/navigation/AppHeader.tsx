"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ChevronRight, LogOut } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function AppHeader({ breadcrumbs = [], actions }: AppHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-xs">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Left: Brand and Breadcrumbs */}
        <div className="flex items-center space-x-3 overflow-hidden">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-90 transition-opacity shrink-0"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-extrabold text-sm shadow-xs">
              FB
            </div>
            <span className="hidden sm:inline-block">ForgeBoard</span>
          </Link>

          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm overflow-hidden">
              <ChevronRight className="h-4 w-4 text-foreground/40 shrink-0" />
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight className="h-4 w-4 text-foreground/40 shrink-0" />}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="truncate text-foreground/70 hover:text-foreground font-medium transition-colors max-w-[120px] sm:max-w-[200px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate font-semibold text-foreground max-w-[140px] sm:max-w-[240px]">
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right: Actions and User Controls */}
        <div className="flex items-center space-x-3 shrink-0">
          {actions}

          {user && (
            <div className="flex items-center space-x-3 pl-2 border-l border-border">
              <div className="hidden md:flex flex-col text-right text-xs">
                <span className="font-semibold text-foreground truncate max-w-[140px]">
                  {user.name}
                </span>
                <span className="text-foreground/60 truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={logout}
                className="h-8 px-2.5 text-xs text-foreground/70 hover:text-foreground flex items-center gap-1.5"
                title="Log out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
