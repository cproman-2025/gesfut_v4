
"use client";

import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { PT_Sans, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from '@/contexts/auth-context';
import ConditionalAppLayoutWrapper from '@/components/layout/conditional-app-layout-wrapper';
import { PageHeaderProvider } from '@/contexts/page-header-context';
import Script from 'next/script';

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-pt-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const applyThemesFromLocalStorage = `
    (function() {
      try {
        const lightTheme = localStorage.getItem('gesfut-light-theme');
        const darkTheme = localStorage.getItem('gesfut-dark-theme');
        const allThemes = ['theme-azul-corporativo', 'theme-cohesion-marca', 'theme-azul-corporativo-dark', 'theme-cohesion-marca-dark'];
        
        allThemes.forEach(t => document.documentElement.classList.remove(t));

        if (lightTheme && lightTheme !== 'default') {
          document.documentElement.classList.add(lightTheme);
        }
        
        if (darkTheme && darkTheme !== 'dark') {
          document.documentElement.classList.add(darkTheme);
        }

      } catch (e) {
        console.error('Failed to apply themes from localStorage', e);
      }
    })();
  `;


  return (
    <html lang="es" className={`${ptSans.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <title>A.D. Alhóndiga - Gestión de Equipos de Fútbol</title>
        <meta name="description" content="Aplicación integral para la gestión de equipos de fútbol A.D. Alhóndiga." />
        <meta name="theme-color" content="#29ABE2" />
      </head>
      <body className="font-body antialiased">
        <Script id="theme-initializer" strategy="beforeInteractive">
          {applyThemesFromLocalStorage}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <PageHeaderProvider>
              <ConditionalAppLayoutWrapper>
                {children}
              </ConditionalAppLayoutWrapper>
            </PageHeaderProvider>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
