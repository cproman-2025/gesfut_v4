

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { auth, type AuthUser } from '@/lib/auth';
import { db } from '@/lib/database';
import type { User as FirestoreUserProfile, UserRole, AppSettings } from '@/types';
import { mainNavItems } from '@/lib/navigation';

interface AuthContextType {
  authUser: AuthUser | null;
  userProfile: FirestoreUserProfile | null;
  isLoading: boolean;
  permissions: AppSettings['menuPermissions'] | null;
  isPermissionsLoading: boolean;
  logout: () => Promise<void>;
  fetchUserProfile: (uid: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const allThemeClasses = ['theme-azul-corporativo', 'theme-cohesion-marca', 'theme-azul-corporativo-dark', 'theme-cohesion-marca-dark'];

function applyThemes(lightTheme?: string, darkTheme?: string) {
    document.documentElement.classList.remove(...allThemeClasses);
    if (lightTheme && lightTheme !== 'default') {
        document.documentElement.classList.add(lightTheme);
    }
    if (darkTheme && darkTheme !== 'dark') {
        document.documentElement.classList.add(darkTheme);
    }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<AppSettings['menuPermissions'] | null>(null);
  const [globalSettings, setGlobalSettings] = useState<AppSettings | null>(null);
  const [isPermissionsLoading, setIsPermissionLoading] = useState(true);

  const fetchGlobalSettings = useCallback(async () => {
      setIsPermissionLoading(true);
      try {
        const settings = await db.select('app_settings', { id: 'global' });
        if (settings.length > 0) {
          setPermissions(settings.menuPermissions || {});
          setGlobalSettings(settings[0]);
        } else {
            const defaultPermissions: Record<string, UserRole[]> = {};
            mainNavItems.forEach(item => {
                defaultPermissions[item.href] = ['Administrador']; // Default to admin only
            });
          setPermissions(defaultPermissions); 
          setGlobalSettings({ menuPermissions: defaultPermissions });
        }
      } catch (error) {
        console.error("AuthProvider: Error fetching permissions", error);
        setPermissions({});
        setGlobalSettings({});
      } finally {
        setIsPermissionLoading(false);
      }
  }, []);

  const internalFetchAndSetUserProfile = useCallback(async (currentAuthUser: AuthUser, appSettings: AppSettings | null) => {
    const uid = currentAuthUser.uid;
    const emailFromAuth = currentAuthUser.email;

    if (!emailFromAuth) {
      console.error("AuthProvider: Auth user has no email. Cannot fetch or create profile.");
      setUserProfile(null);
      return;
    }
    
    const email = emailFromAuth.toLowerCase().trim();
    const userDocRef = doc(db, "users", uid);

        const users = await db.select('users', { id: uid });
        let finalProfileData: FirestoreUserProfile | null = null;

        if (users.length > 0) {
            finalProfileData = users[0] as FirestoreUserProfile;
            console.log(`AuthProvider: Profile for UID ${uid} found and loaded.`);
        } else {
            console.log(`AuthProvider: No profile for UID ${uid}. Checking for a pre-created account with email ${email}.`);
            
            const existingUsers = await db.select('users', { email });

            if (existingUsers.length > 0) {
                const preCreatedData = existingUsers[0];
                console.log(`AuthProvider: Pre-created account found. Migrating data to new UID: ${uid}.`);

                const newProfileData = {
                    ...preCreatedData,
                    id: uid,
                    status: 'Active',
                    updated_at: new Date().toISOString(),
                    created_at: preCreatedData.created_at || new Date().toISOString()
                };
                
                await db.update('users', preCreatedData.id, newProfileData);
                await db.delete('users', preCreatedData.id);

                finalProfileData = { id: uid, ...newProfileData } as FirestoreUserProfile;
                console.log(`AuthProvider: Account for ${email} successfully claimed and activated for UID ${uid}.`);

            } else {
                console.log(`AuthProvider: No pre-created account found for ${email}. Creating default 'Jugador' profile.`);
                const defaultName = currentAuthUser.name || email.split('@')[0];
                
                const newUserProfileData = {
                    id: uid,
                    name: defaultName,
                    email: email,
                    role: 'Jugador' as UserRole,
                    status: 'Active' as 'Active',
                    avatar_url: `https://placehold.co/40x40.png?text=${defaultName[0]?.toUpperCase() || 'U'}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                await db.insert('users', newUserProfileData);
                finalProfileData = { id: uid, ...newUserProfileData } as FirestoreUserProfile;
                console.log(`AuthProvider: Firestore profile for ${email} (UID: ${uid}) CREATED and SET.`);
            }
        }
        
        setUserProfile(finalProfileData);

        if (finalProfileData) {
            const lightThemeToApply = finalProfileData.light_theme || appSettings?.default_light_theme || 'default';
            const darkThemeToApply = finalProfileData.dark_theme || appSettings?.default_dark_theme || 'dark';
            
            localStorage.setItem('gesfut-light-theme', lightThemeToApply);
            localStorage.setItem('gesfut-dark-theme', darkThemeToApply);
            applyThemes(lightThemeToApply, darkThemeToApply);
        }

    } catch (error) {
      console.error(`AuthProvider: Error in internalFetchAndSetUserProfile for email ${email}:`, error);
      setUserProfile(null);
    }
  }, []);


  useEffect(() => {
    setIsLoading(true);
    fetchGlobalSettings(); 
  }, [fetchGlobalSettings]);

  useEffect(() => {
    if (isPermissionsLoading) return; // Wait for settings to load first

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setAuthUser(user);
      if (user) {
        await internalFetchAndSetUserProfile(user, globalSettings);
      } else {
        setUserProfile(null);
        // On logout, apply default themes from settings if they exist
        const defaultLight = globalSettings?.default_light_theme || 'default';
        const defaultDark = globalSettings?.default_dark_theme || 'dark';
        localStorage.setItem('gesfut-light-theme', defaultLight);
        localStorage.setItem('gesfut-dark-theme', defaultDark);
        applyThemes(defaultLight, defaultDark);
      }
      setIsLoading(false); 
    });
    return () => unsubscribe();
  }, [internalFetchAndSetUserProfile, isPermissionsLoading, globalSettings]);

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("AuthProvider: Error signing out: ", error);
      throw error;
    }
  };

  const fetchUserProfile = useCallback(async (uid: string) => {
    if (authUser && authUser.id === uid) {
      await internalFetchAndSetUserProfile(authUser, globalSettings);
    } else if (authUser && authUser.id !== uid) {
      console.warn("AuthProvider: fetchUserProfile called for a UID that doesn't match current authUser.");
    } else {
       console.warn("AuthProvider: fetchUserProfile called without an active authUser.");
    }
  }, [authUser, internalFetchAndSetUserProfile, globalSettings]);

  const signIn = async (email: string, password: string) => {
    await auth.signIn(email, password);
  };

  const signUp = async (email: string, password: string, name: string) => {
    await auth.signUp(email, password, name);
  };

  return (
    <AuthContext.Provider value={{ authUser, userProfile, isLoading, permissions, isPermissionsLoading, logout, fetchUserProfile, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
