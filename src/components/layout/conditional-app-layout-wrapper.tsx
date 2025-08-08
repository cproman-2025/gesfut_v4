
"use client";

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppLayout } from './app-layout';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export default function ConditionalAppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authUser, isLoading } = useAuth();

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isPublicPath || !authUser) {
    return <>{children}</>;
  }
  
  return <AppLayout>{children}</AppLayout>;
}
