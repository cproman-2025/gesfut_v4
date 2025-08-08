
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSidebar, SidebarLink as NewSidebarLink } from '@/components/ui/sidebar';
import { mainNavItems, secondaryNavItems, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useState, useEffect, useMemo } from 'react';
import { getActiveUserClub } from '@/lib/placeholder-data';
import type { User, Club, AppSettings } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Separator } from '../ui/separator';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const NavLink: React.FC<{ item: NavItem }> = ({ item }) => {
  const pathname = usePathname();
  const isActive = item.segment === null ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <NewSidebarLink
        link={{
            label: item.label,
            href: item.href,
            icon: <item.icon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        }}
        className={cn(
            isActive && "bg-neutral-200 dark:bg-neutral-700"
        )}
   />
  );
};

export const Logo: React.FC<{ club?: Club }> = ({ club }) => {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black dark:text-white"
    >
        {club?.logoUrl ? (
            <Avatar className="h-6 w-6 shrink-0 rounded-sm">
                <AvatarImage src={club.logoUrl} alt={`${club.name} logo`} />
                <AvatarFallback className="text-xs bg-muted text-muted-foreground">{club.name?.[0]}</AvatarFallback>
            </Avatar>
        ) : (
             <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
        )}
      
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-black dark:text-white font-headline"
      >
        {club?.name || 'GesFUT'}
      </motion.span>
    </Link>
  );
};
export const LogoIcon: React.FC<{ club?: Club }> = ({ club }) => {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black dark:text-white"
    >
        {club?.logoUrl ? (
            <Avatar className="h-6 w-6 shrink-0 rounded-sm">
                <AvatarImage src={club.logoUrl} alt={`${club.name} logo`} />
                <AvatarFallback className="text-xs bg-muted text-muted-foreground">{club.name?.[0]}</AvatarFallback>
            </Avatar>
        ) : (
            <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
        )}
    </Link>
  );
};


export function MainSidebar() {
  const [activeClub, setActiveClub] = useState<Club | undefined>(undefined);
  const { userProfile, permissions, isLoading: authIsLoading, isPermissionsLoading, logout } = useAuth();
  const { open } = useSidebar();


  useEffect(() => {
    const fetchClubData = async () => {
        if (userProfile?.clubId) {
            const clubDoc = await getDoc(doc(db, "clubs", userProfile.clubId));
            if (clubDoc.exists()) setActiveClub({id: clubDoc.id, ...clubDoc.data()} as Club);
        } else if (userProfile?.role === 'Administrador') {
             const defaultClub = await getActiveUserClub(undefined);
             setActiveClub(defaultClub);
        } else {
             setActiveClub(undefined);
        }
    };
    if (userProfile) {
        fetchClubData();
    }
  }, [userProfile]);
  
  const visibleMainNavItems = useMemo(() => {
    // If auth is still loading, user profile doesn't exist, or permissions are loading (and user is not admin)
    // return an empty array to prevent premature rendering.
    if (authIsLoading || !userProfile || (isPermissionsLoading && userProfile.role !== 'Administrador')) {
        return [];
    }
    
    // Admin sees all main nav items, regardless of permissions loading state
    if (userProfile.role === 'Administrador') {
        return mainNavItems;
    }

    // For other roles, filter based on loaded permissions
    if (permissions) {
        return mainNavItems.filter(item => {
            if (item.href === '/') return true; // Dashboard is always visible
            const allowedRoles = permissions[item.href] || [];
            return allowedRoles.includes(userProfile.role);
        });
    }
    
    // Fallback while permissions are loading for non-admin users
    return [];
  }, [userProfile, permissions, authIsLoading, isPermissionsLoading]);

  const visibleSecondaryNavItems = useMemo(() => {
    if (authIsLoading || !userProfile || (isPermissionsLoading && userProfile.role !== 'Administrador')) {
        return [];
    }
    
    if (userProfile.role === 'Administrador') {
        return secondaryNavItems;
    }

    if (permissions) {
       return secondaryNavItems.filter(item => {
        const allowedRoles = permissions[item.href] || [];
        return allowedRoles.includes(userProfile.role);
      });
    }

    return [];
  }, [userProfile, permissions, authIsLoading, isPermissionsLoading]);
  
  const handleLogout = async () => {
    await logout();
  };


  if (authIsLoading || (isPermissionsLoading && userProfile?.role !== 'Administrador')) {
    return (
        <div className="flex flex-col flex-1 overflow-y-auto">
            <Skeleton className="h-10 w-32 m-2" />
            <div className="mt-8 flex flex-col gap-2 p-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md mb-1" />)}
            </div>
        </div>
    );
  }
  
  return (
    <>
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {open ? <Logo club={activeClub} /> : <LogoIcon club={activeClub}/>}
            <div className="mt-8 flex flex-col gap-2">
                {visibleMainNavItems.map((link, idx) => (
                    <NavLink key={idx} item={link} />
                ))}
                {visibleSecondaryNavItems.length > 0 && (
                    <>
                        <Separator className="my-2 bg-neutral-300 dark:bg-neutral-700" />
                        {visibleSecondaryNavItems.map((link, idx) => (
                            <NavLink key={idx} item={link} />
                        ))}
                    </>
                )}
            </div>
        </div>

        <div>
            {userProfile ? (
                 <NewSidebarLink
                    link={{
                        label: userProfile.name,
                        href: "/profile",
                        icon: (
                        <Avatar className="h-7 w-7 shrink-0 rounded-full">
                            <AvatarImage src={userProfile.avatarUrl || `https://placehold.co/40x40.png?text=${userProfile.name[0]}`} />
                            <AvatarFallback>{userProfile.name[0]}</AvatarFallback>
                        </Avatar>
                        ),
                    }}
                />
            ) : (
                <NewSidebarLink
                    link={{
                        label: "Iniciar Sesión",
                        href: "/login",
                        icon: <LogOut className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
                    }}
                />
            )}
        </div>
    </>
  );
}
