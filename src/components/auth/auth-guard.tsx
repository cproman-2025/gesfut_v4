
"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { UserRole } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';


interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { authUser, userProfile, isLoading, permissions, isPermissionsLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't run auth logic until all loading is complete
    if (isLoading || isPermissionsLoading) {
      return; 
    }

    // If no user is logged in, redirect to login
    if (!authUser || !userProfile) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    
    // Admins always have access, so we can stop here for them
    if (userProfile.role === 'Administrador') {
      return;
    }

    // Use Firestore-based permissions if available
    const rolesForRoute = permissions ? permissions[pathname] : allowedRoles;
    
    // Dashboard is always allowed for any logged-in user
    if (pathname === '/') {
        return;
    }

    // Check if the user's role is in the list of allowed roles for the current route
    if (rolesForRoute && rolesForRoute.length > 0) {
      if (!userProfile.role || !rolesForRoute.includes(userProfile.role)) {
        console.warn(`AuthGuard: Acceso denegado para el rol '${userProfile.role}' a la ruta '${pathname}'. Redirigiendo a la página principal.`);
        router.replace('/'); 
      }
    } else if (permissions !== null) { // Permissions are loaded, but the route has no roles defined
      console.warn(`AuthGuard: La ruta '${pathname}' no tiene roles definidos en la configuración de permisos. Acceso denegado. Redirigiendo...`);
      router.replace('/');
    }

  }, [authUser, userProfile, isLoading, isPermissionsLoading, permissions, router, pathname, allowedRoles]);


  // Determine if we should show the content or a loader
  const hasAccess = (() => {
    if (isLoading || isPermissionsLoading) return false; // Show loader while checking
    if (!authUser || !userProfile) return false; // Will be redirected, show loader
    if (userProfile.role === 'Administrador') return true; // Admins see everything
    if (pathname === '/') return true; // Everyone sees dashboard

    const rolesForCurrentRoute = permissions ? permissions[pathname] : allowedRoles;
    if (!rolesForCurrentRoute) return false; // If no roles are defined for the route (and not admin), deny
    
    return rolesForCurrentRoute.includes(userProfile.role);
  })();


  if (!hasAccess) {
    return (
      <div className="flex flex-col space-y-3 p-6">
        <Skeleton className="h-[125px] w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
