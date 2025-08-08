
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
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Club, AppSettings } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { Separator } from '@/components/ui/separator';

function RegisterPageContent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [registrationEnabled, setRegistrationEnabled] = useState(false); 
  const router = useRouter();
  const { toast } = useToast();
  const { signUp } = useAuth();
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
          setRegistrationEnabled(true);
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
        console.error("Error fetching initial data for register page:", error);
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

    if (!registrationEnabled) {
        toast({
            title: "Registro Deshabilitado",
            description: "El registro de nuevos usuarios está actualmente deshabilitado.",
            variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    if (!name || !email || !password || !confirmPassword) {
      toast({
        title: "Campos Incompletos",
        description: "Por favor, rellena todos los campos.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error de Contraseña",
        description: "Las contraseñas no coinciden.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      toast({
        title: "Contraseña Débil",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }


    try {
      await signUp(email, password, name);
      toast({
        title: "Registro Exitoso",
        description: "¡Tu cuenta ha sido creada! Serás redirigido al dashboard.",
      });
      router.push('/'); 

    } catch (error: any) {
      console.error("Error durante el registro:", error);
      const errorMessage = error.message || "Error durante el registro";
      toast({
        title: "Error de Registro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logoToDisplay = authLogoUrl || "https://placehold.co/138x138.png?text=CLUB";

  if (isSettingsLoading || logoLoading) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-400 to-indigo-500 p-4 dark:from-cyan-950 dark:via-teal-900 dark:to-green-950">
             <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
    );
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-purple-400 to-indigo-500 p-4 text-primary-foreground dark:from-cyan-950 dark:via-teal-900 dark:to-green-950">
        <div className="w-full max-w-sm space-y-6">
             <div className="flex justify-center mb-4">
                 <Link href="/login">
                   <Image
                    src={logoToDisplay}
                    alt="Logo del Club"
                    width={225}
                    height={225}
                    className="rounded-lg object-contain"
                    data-ai-hint="club logo"
                    unoptimized={logoToDisplay.startsWith('https://placehold.co') || logoToDisplay.startsWith('data:')}
                  />
                 </Link>
             </div>

            {!registrationEnabled ? (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive text-white dark:text-destructive-foreground">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Registro Deshabilitado</AlertTitle>
                <AlertDescription>
                    El registro de nuevos usuarios está deshabilitado. Contacta con el administrador del club.
                </AlertDescription>
                </Alert>
            ) : (
                <>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                        id="name"
                        type="text"
                        placeholder="Nombre Completo*"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isLoading || !registrationEnabled}
                        className="bg-white/90 text-slate-900 dark:bg-background/95 dark:text-foreground placeholder:text-slate-500 dark:placeholder:text-muted-foreground border-0 h-12 text-base focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Input
                        id="email"
                        type="email"
                        placeholder="Email*"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading || !registrationEnabled}
                        className="bg-white/90 text-slate-900 dark:bg-background/95 dark:text-foreground placeholder:text-slate-500 dark:placeholder:text-muted-foreground border-0 h-12 text-base focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Input
                        id="password"
                        type="password"
                        placeholder="Contraseña (mín. 6 caracteres)*"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading || !registrationEnabled}
                        className="bg-white/90 text-slate-900 dark:bg-background/95 dark:text-foreground placeholder:text-slate-500 dark:placeholder:text-muted-foreground border-0 h-12 text-base focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirmar Contraseña*"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading || !registrationEnabled}
                        className="bg-white/90 text-slate-900 dark:bg-background/95 dark:text-foreground placeholder:text-slate-500 dark:placeholder:text-muted-foreground border-0 h-12 text-base focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 dark:bg-blue-950 dark:hover:bg-blue-900 text-white font-semibold text-base" disabled={isLoading || !registrationEnabled}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Registrarse
                    </Button>
                </form>
                </>
            )}
            <div className="text-center">
                <p className="text-sm text-purple-200 dark:text-primary-foreground/80">
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/login" className="font-semibold text-white hover:underline dark:text-primary dark:hover:underline">
                    Inicia sesión aquí
                    </Link>
                </p>
            </div>
        </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <PublicPageGuard>
      <RegisterPageContent />
    </PublicPageGuard>
  );
}
