import React from 'react';

export const AuthCard = ({ title, description, children }: { title: string, description?: string, children: React.ReactNode }) => {
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-background border border-border rounded-xl shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-foreground/60 mt-2">{description}</p>}
      </div>
      {children}
    </div>
  );
};
