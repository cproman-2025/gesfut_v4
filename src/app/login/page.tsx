
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { db } from '@/lib/database';
import PublicPageGuard from '@/components/auth/public-page-guard';
import { Loader2 } from 'lucide-react';
import type { Club, AppSettings } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [registrationEnabled, setRegistrationEnabled] = useState(false); 
  const router = useRouter();
  const { toast } = useToast();
  const { signIn } = useAuth();
  const [authLogoUrl, setAuthLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsSettingsLoading(true);
      setLogoLoading(true);
      try {
        const settings = await db.select('app_settings', { id: 'global' });
        let settingsData: AppSettings | null = null;
        if (settings.length > 0) {
          settingsData = settings[0] as AppSettings;
          setRegistrationEnabled(settingsData.is_registration_enabled === true);
        } else {
          setRegistrationEnabled(false);
        }

        if (settingsData?.auth_pages_custom_logo_url) {
            setAuthLogoUrl(settingsData.auth_pages_custom_logo_url);
        } else {
            let logoClubId = settingsData?.auth_pages_logo_club_id;
            let clubLogo: string | null = null;

            if (logoClubId && logoClubId !== 'none') {
                const clubs = await db.select('clubs', { id: logoClubId });
                if (clubs.length > 0) {
                    clubLogo = (clubs[0] as Club).logo_url || null;
                }
            }
            
            if (!clubLogo) {
                const defaultClubs = await db.select('clubs', { is_default: true });
                if (defaultClubs.length > 0) {
                    clubLogo = (defaultClubs[0] as Club).logo_url || null;
                }
            }
            setAuthLogoUrl(clubLogo);
        }

      } catch (error) {
        console.error("Error fetching initial data for login page:", error);
        setRegistrationEnabled(false); 
        setAuthLogoUrl(null);
      } finally {
        setIsSettingsLoading(false);
        setLogoLoading(false);
      }
    };
    fetchInitialData();
  }, []);


  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (!email || !password) {
      toast({
        title: "Campos Incompletos",
        description: "Por favor, introduce tu email y contraseña.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }


    try {
      await signIn(email, password);
      toast({
        title: "Inicio de Sesión Exitoso",
        description: "¡Bienvenido de nuevo!",
      });
      const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/';
      router.push(redirectUrl); 
    } catch (error: any) {
      console.error("Error durante el inicio de sesión:", error.code);
      const errorMessage = error.message || "Error de autenticación";
      
      toast({
        title: "Error de Inicio de Sesión",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const logoToDisplay = authLogoUrl || "https://placehold.co/138x138.png?text=CLUB";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-purple-400 to-indigo-500 p-4 text-primary-foreground dark:from-cyan-950 dark:via-teal-900 dark:to-green-950">
        <div className="w-full max-w-sm space-y-6">
            <div className="flex justify-center mb-4">
                {logoLoading ? (
                    <div className="h-[225px] w-[225px] bg-white/20 rounded-lg animate-pulse"></div>
                ) : (
                    <Image
                        src={logoToDisplay}
                        alt="Logo del Club"
                        width={225}
                        height={225}
                        className="rounded-lg object-contain"
                        data-ai-hint="club logo"
                        unoptimized={logoToDisplay.startsWith('https://placehold.co') || logoToDisplay.startsWith('data:')}
                    />
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email" className="sr-only">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="bg-white/90 text-slate-900 dark:bg-background/95 dark:text-foreground placeholder:text-slate-500 dark:placeholder:text-muted-foreground border-0 h-12 text-base focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password" className="sr-only">Contraseña</Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="bg-white/90 text-slate-900 dark:bg-background/95 dark:text-foreground placeholder:text-slate-500 dark:placeholder:text-muted-foreground border-0 h-12 text-base focus:ring-2 focus:ring-primary"
                    />
                </div>
                 <div className="text-right text-sm">
                    <Link href="/forgot-password" className="text-purple-200 hover:text-white dark:text-primary-foreground/80 dark:hover:text-primary-foreground hover:underline">
                        ¿Has olvidado tu contraseña?
                    </Link>
                </div>
                <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 dark:bg-blue-950 dark:hover:bg-blue-900 text-white font-semibold text-base" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Acceder
                </Button>
            </form>
             <div className="text-center">
                {isSettingsLoading ? (
                    <div className="h-5 w-48 mx-auto bg-black/10 animate-pulse rounded-md"></div>
                ) : registrationEnabled ? (
                    <p className="text-sm text-purple-200 dark:text-primary-foreground/80">
                        ¿No tienes cuenta?{' '}
                        <Link href="/register" className="font-semibold text-white hover:underline dark:text-primary dark:hover:underline">
                        Regístrate
                        </Link>
                    </p>
                ) : (
                    <p className="text-xs text-purple-300 dark:text-primary-foreground/60 text-center">
                    El registro de nuevos usuarios está deshabilitado.
                    </p>
                )}
            </div>
        </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PublicPageGuard>
      <LoginPageContent />
    </PublicPageGuard>
  );
}
