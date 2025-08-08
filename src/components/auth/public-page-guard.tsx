
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton'; // Para un placeholder de carga

interface PublicPageGuardProps {
  children: React.ReactNode;
}

export default function PublicPageGuard({ children }: PublicPageGuardProps) {
  const { authUser, userProfile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return; // Espera a que termine la carga del estado de autenticación
    }

    // Redirige fuera de las páginas públicas solo si el usuario está completamente autenticado (auth y perfil)
    if (authUser && userProfile) {
      router.replace('/');
    }
  }, [authUser, userProfile, isLoading, router]);

  // Muestra un esqueleto si está cargando o si el usuario ya está logueado (y esperando la redirección)
  if (isLoading || (authUser && userProfile)) {
     return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-secondary p-4">
        <div className="w-full max-w-md space-y-6">
            <Skeleton className="h-16 w-16 mx-auto rounded-lg" />
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-full mx-auto" />
            <div className="space-y-4 pt-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
      </div>
    );
  }

  // Si no está cargando y no hay un usuario completamente logueado, muestra la página pública
  return <>{children}</>;
}
