
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { auth, db } from '@/lib/firebase'; 
import { signInWithEmailAndPassword, AuthErrorCodes } from 'firebase/auth';
import PublicPageGuard from '@/components/auth/public-page-guard';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
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
  const { signInWithGoogle } = useAuth();
  const [authLogoUrl, setAuthLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsSettingsLoading(true);
      setLogoLoading(true);
      try {
        const settingsDocRef = doc(db, "appSettings", "global");
        const settingsSnap = await getDoc(settingsDocRef);
        let settingsData: AppSettings | null = null;
        if (settingsSnap.exists()) {
          settingsData = settingsSnap.data() as AppSettings;
          setRegistrationEnabled(settingsData.isRegistrationEnabled === true);
        } else {
          setRegistrationEnabled(false);
        }

        if (settingsData?.authPagesCustomLogoUrl) {
            setAuthLogoUrl(settingsData.authPagesCustomLogoUrl);
        } else {
            let logoClubId = settingsData?.authPagesLogoClubId;
            let clubLogo: string | null = null;

            if (logoClubId && logoClubId !== 'none') {
                const clubDocRef = doc(db, "clubs", logoClubId);
                const clubDocSnap = await getDoc(clubDocRef);
                if (clubDocSnap.exists()) {
                    clubLogo = (clubDocSnap.data() as Club).logoUrl || null;
                }
            }
            
            if (!clubLogo) {
                const defaultClubQuery = query(collection(db, "clubs"), where("isDefault", "==", true), limit(1));
                const clubSnapshot = await getDocs(defaultClubQuery);
                if (!clubSnapshot.empty) {
                    clubLogo = (clubSnapshot.docs[0].data() as Club).logoUrl || null;
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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
        await signInWithGoogle();
        toast({ title: "Inicio de Sesión Exitoso" });
        const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/';
        router.push(redirectUrl);
    } catch (error) {
        console.error("Error during Google sign-in", error);
        toast({ title: "Error de Inicio de Sesión", description: "No se pudo iniciar sesión con Google.", variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }

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

    if (!auth || !auth.app) { 
      toast({
        title: "Error de Inicialización",
        description: "Firebase Auth no está disponible. Revisa la consola para más detalles.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Inicio de Sesión Exitoso",
        description: "¡Bienvenido de nuevo!",
      });
      const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/';
      router.push(redirectUrl); 
    } catch (error: any) {
      console.error("Error durante el inicio de sesión:", error.code);
      let errorMessage = "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";
      
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
            errorMessage = "Email o contraseña incorrectos. Por favor, comprueba tus datos.";
            break;
          case AuthErrorCodes.USER_DELETED:
          case AuthErrorCodes.USER_DISABLED:
            errorMessage = "Tu cuenta ha sido deshabilitada o no existe.";
            break;
          case AuthErrorCodes.INVALID_EMAIL:
            errorMessage = "El formato del email no es válido.";
            break;
          case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
             errorMessage = "Acceso bloqueado temporalmente por demasiados intentos. Inténtalo más tarde.";
             break;
          default:
            console.error("Firebase Auth Error Code:", error.code, "Message:", error.message);
            break;
        }
      }
      
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
            <div className="relative">
                <Separator className="absolute top-1/2 -translate-y-1/2" />
                <p className="text-center bg-purple-500 dark:bg-teal-900 px-2 text-xs uppercase w-fit mx-auto">o</p>
            </div>
             <Button variant="outline" className="w-full h-12 bg-white/90 hover:bg-white text-slate-800 font-semibold text-base" onClick={handleGoogleSignIn} disabled>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>
                }
                 Iniciar sesión con Google
            </Button>
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
