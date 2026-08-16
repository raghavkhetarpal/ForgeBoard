import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'ForgeBoard',
  description: 'Multi-tenant project management platform with GitHub integration and real-time collaboration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
