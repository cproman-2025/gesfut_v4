
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
import { createUserWithEmailAndPassword, AuthErrorCodes } from 'firebase/auth'; 
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
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
          setRegistrationEnabled(true);
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        toast({
          title: "Registro Exitoso",
          description: "¡Tu cuenta ha sido creada! Serás redirigido al inicio de sesión.",
        });
        router.push('/login'); 
      } else {
        throw new Error("No se pudo obtener la información del usuario después del registro.");
      }

    } catch (error: any) {
      console.error("Error durante el registro:", error);
      let errorMessage = "Ocurrió un error durante el registro. Inténtalo de nuevo.";
      if (error.code) {
        switch (error.code) {
          case AuthErrorCodes.EMAIL_EXISTS:
            errorMessage = "Este email ya está registrado. Intenta iniciar sesión.";
            break;
          case AuthErrorCodes.WEAK_PASSWORD:
            errorMessage = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
            break;
          case AuthErrorCodes.INVALID_EMAIL:
            errorMessage = "El formato del email no es válido.";
            break;
          default:
            errorMessage = `Error: ${error.message}`;
        }
      }
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
                <div className="relative">
                    <Separator className="absolute top-1/2 -translate-y-1/2" />
                    <p className="text-center bg-purple-500 dark:bg-teal-900 px-2 text-xs uppercase w-fit mx-auto">o</p>
                </div>
                <Button variant="outline" className="w-full h-12 bg-white/90 hover:bg-white text-slate-800 font-semibold text-base" onClick={handleGoogleSignIn} disabled>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                    <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>
                    }
                     Registrarse con Google
                </Button>
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
