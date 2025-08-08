

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, limit, writeBatch, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; 
import type { User as FirestoreUserProfile, UserRole, AppSettings } from '@/types';
import { mainNavItems } from '@/lib/navigation';

interface AuthContextType {
  authUser: FirebaseUser | null;
  userProfile: FirestoreUserProfile | null;
  isLoading: boolean;
  permissions: AppSettings['menuPermissions'] | null;
  isPermissionsLoading: boolean;
  logout: () => Promise<void>;
  fetchUserProfile: (uid: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<AppSettings['menuPermissions'] | null>(null);
  const [globalSettings, setGlobalSettings] = useState<AppSettings | null>(null);
  const [isPermissionsLoading, setIsPermissionLoading] = useState(true);

  const fetchGlobalSettings = useCallback(async () => {
      setIsPermissionLoading(true);
      try {
        const settingsDocRef = doc(db, "appSettings", "global");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const settings = docSnap.data() as AppSettings;
          setPermissions(settings.menuPermissions || {});
          setGlobalSettings(settings);
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

  const internalFetchAndSetUserProfile = useCallback(async (currentAuthUser: FirebaseUser, appSettings: AppSettings | null) => {
    const uid = currentAuthUser.uid;
    const emailFromAuth = currentAuthUser.email;

    if (!emailFromAuth) {
      console.error("AuthProvider: Auth user has no email. Cannot fetch or create profile.");
      setUserProfile(null);
      return;
    }
    
    const email = emailFromAuth.toLowerCase().trim();
    const userDocRef = doc(db, "users", uid);

    try {
        const userDocSnap = await getDoc(userDocRef);
        let finalProfileData: FirestoreUserProfile | null = null;

        if (userDocSnap.exists()) {
            finalProfileData = { id: userDocSnap.id, ...userDocSnap.data() } as FirestoreUserProfile;
            console.log(`AuthProvider: Profile for UID ${uid} found and loaded.`);
        } else {
            console.log(`AuthProvider: No profile for UID ${uid}. Checking for a pre-created account with email ${email}.`);
            
            const usersByEmailQuery = query(collection(db, "users"), where("email", "==", email), limit(1));
            const existingUserSnap = await getDocs(usersByEmailQuery);

            if (!existingUserSnap.empty) {
                const preCreatedDoc = existingUserSnap.docs[0];
                const preCreatedData = preCreatedDoc.data();
                console.log(`AuthProvider: Pre-created account found (Doc ID: ${preCreatedDoc.id}). Migrating data to new UID: ${uid}.`);

                const batch = writeBatch(db);
                const newProfileData = {
                    ...preCreatedData,
                    status: 'Active',
                    updatedAt: serverTimestamp(),
                    createdAt: preCreatedData.createdAt || serverTimestamp()
                };
                batch.set(userDocRef, newProfileData);
                batch.delete(preCreatedDoc.ref);
                await batch.commit();

                finalProfileData = { id: uid, ...newProfileData } as FirestoreUserProfile;
                console.log(`AuthProvider: Account for ${email} successfully claimed and activated for UID ${uid}.`);

            } else {
                console.log(`AuthProvider: No pre-created account found for ${email}. Creating default 'Jugador' profile.`);
                const defaultName = currentAuthUser.displayName || email.split('@')[0];
                
                const newUserProfileData = {
                    name: defaultName,
                    email: email,
                    role: 'Jugador' as UserRole,
                    status: 'Active' as 'Active',
                    avatarUrl: currentAuthUser.photoURL || `https://placehold.co/40x40.png?text=${defaultName[0]?.toUpperCase() || 'U'}`,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                await setDoc(userDocRef, newUserProfileData);
                finalProfileData = { id: uid, ...newUserProfileData } as FirestoreUserProfile;
                console.log(`AuthProvider: Firestore profile for ${email} (UID: ${uid}) CREATED and SET.`);
            }
        }
        
        setUserProfile(finalProfileData);

        if (finalProfileData) {
            const lightThemeToApply = finalProfileData.lightTheme || appSettings?.defaultLightTheme || 'default';
            const darkThemeToApply = finalProfileData.darkTheme || appSettings?.defaultDarkTheme || 'dark';
            
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

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        await internalFetchAndSetUserProfile(user, globalSettings);
      } else {
        setUserProfile(null);
        // On logout, apply default themes from settings if they exist
        const defaultLight = globalSettings?.defaultLightTheme || 'default';
        const defaultDark = globalSettings?.defaultDarkTheme || 'dark';
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
      if (!auth || !auth.app) {
        console.warn("AuthProvider: auth object not initialized, cannot sign out.");
        throw new Error("Auth service not available.");
      }
      await auth.signOut();
    } catch (error) {
      console.error("AuthProvider: Error signing out: ", error);
      throw error;
    }
  };

  const fetchUserProfile = useCallback(async (uid: string) => {
    if (authUser && authUser.uid === uid) {
      await internalFetchAndSetUserProfile(authUser, globalSettings);
    } else if (authUser && authUser.uid !== uid) {
      console.warn("AuthProvider: fetchUserProfile called for a UID that doesn't match current authUser.");
    } else {
       console.warn("AuthProvider: fetchUserProfile called without an active authUser.");
    }
  }, [authUser, internalFetchAndSetUserProfile, globalSettings]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error during Google Sign-In:", error);
        throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ authUser, userProfile, isLoading, permissions, isPermissionsLoading, logout, fetchUserProfile, signInWithGoogle }}>
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
