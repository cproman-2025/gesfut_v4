
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
import { sendPasswordResetEmail, AuthErrorCodes } from 'firebase/auth';
import PublicPageGuard from '@/components/auth/public-page-guard';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import type { Club, AppSettings } from '@/types';

function ForgotPasswordPageContent() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [authLogoUrl, setAuthLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(true);

  useEffect(() => {
    const fetchAuthLogo = async () => {
      setLogoLoading(true);
      try {
        const settingsDocRef = doc(db, "appSettings", "global");
        const settingsSnap = await getDoc(settingsDocRef);
        let settingsData: AppSettings | null = null;
        if (settingsSnap.exists()) {
            settingsData = settingsSnap.data() as AppSettings;
        }

        if (settingsData?.authPagesCustomLogoUrl) {
            setAuthLogoUrl(settingsData.authPagesCustomLogoUrl);
        } else {
            let logoClubId: string | undefined = settingsData?.authPagesLogoClubId;
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
        console.error("Error fetching auth logo:", error);
        setAuthLogoUrl(null); 
      } finally {
        setLogoLoading(false);
      }
    };
    fetchAuthLogo();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setEmailSent(false);

    if (!email) {
      toast({
        title: "Email Requerido",
        description: "Por favor, introduce tu dirección de email.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Email Enviado",
        description: "Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.",
      });
      setEmailSent(true);
    } catch (error: any) {
      console.error("Error al enviar email de restablecimiento:", error);
      let errorMessage = "Ocurrió un error al intentar enviar el email de restablecimiento.";
       if (error.code) {
        switch (error.code) {
          case AuthErrorCodes.INVALID_EMAIL:
            errorMessage = "El formato del email no es válido.";
            break;
          case AuthErrorCodes.USER_DELETED: 
             errorMessage = "No se encontró ninguna cuenta con esa dirección de email.";
            break;
          default:
            errorMessage = `Error: ${error.message}`;
        }
      }
      toast({
        title: "Error",
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
            <div className="text-center">
                <h1 className="text-2xl font-bold font-headline text-white">Restablecer Contraseña</h1>
                <p className="text-purple-200 dark:text-primary-foreground/80 mt-2">
                    {emailSent 
                    ? "Revisa tu bandeja de entrada (y spam) para el enlace."
                    : "Introduce tu email y te enviaremos un enlace para restablecer tu contraseña."
                    }
                </p>
            </div>

          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-white/90 text-slate-900 dark:bg-background/95 dark:text-foreground placeholder:text-slate-500 dark:placeholder:text-muted-foreground border-0 h-12 text-base focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 dark:bg-blue-950 dark:hover:bg-blue-900 text-white font-semibold text-base" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Enviando...' : 'Enviar Email'}
              </Button>
            </form>
          ) : (
            <div className="text-center p-4 bg-primary/20 rounded-lg">
              <p className="font-semibold text-white">¡Email enviado correctamente!</p>
            </div>
          )}
        
            <div className="text-center">
                <Link href="/login" className="text-sm text-purple-200 hover:text-white dark:text-primary-foreground/80 dark:hover:text-primary-foreground hover:underline flex items-center justify-center">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Iniciar Sesión
                </Link>
            </div>
        </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <PublicPageGuard>
      <ForgotPasswordPageContent />
    </PublicPageGuard>
  );
}
