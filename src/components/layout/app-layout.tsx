
"use client";

import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarBody, MobileSidebar } from '@/components/ui/sidebar';
import { MainSidebar } from './main-sidebar';
import { MainHeader } from './main-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { PageLayout } from './page-layout'; 

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTacticsPage = pathname === '/tactics';
  const { authUser } = useAuth();

  // If it's the tactics page, render it directly without the main layout
  if (isTacticsPage) {
    return <>{children}</>;
  }
  
  return (
    <TooltipProvider delayDuration={0}>
       <SidebarProvider>
          <div className="flex h-screen bg-background text-foreground">
            {/* Desktop Sidebar */}
            <Sidebar>
                <SidebarBody className="justify-between gap-10">
                    <MainSidebar />
                </SidebarBody>
            </Sidebar>

            <div className="flex flex-1 flex-col overflow-y-hidden">
              <MainHeader />
                <PageLayout>
                  {children}
                </PageLayout>
            </div>
            
            {/* Mobile Sidebar - Placed here to be within the provider but outside the main flex flow */}
            {authUser && (
                <MobileSidebar>
                    <MainSidebar />
                </MobileSidebar>
            )}
          </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
