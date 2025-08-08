
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, type Firestore, connectFirestoreEmulator } from 'firebase/firestore';

// --- Configuration Values ---
const firebaseConfigValues = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check for required values. This check runs on both client and server.
const configIsValid = 
    firebaseConfigValues.apiKey &&
    firebaseConfigValues.projectId &&
    firebaseConfigValues.authDomain;

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!configIsValid) {
  console.error("CRITICAL: Firebase config is invalid. Required environment variables (API Key, Project ID, Auth Domain) are missing. Firebase services will not be initialized.");
} else {
  // Initialize Firebase App (Singleton Pattern)
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfigValues);
      console.log("Firebase App Initialized successfully.");
    } catch (e) {
      console.error("CRITICAL: Firebase initializeApp() failed.", e);
    }
  } else {
    app = getApp();
  }
}

// Initialize other Firebase services if the app was initialized
// We check for `app.name` because an uninitialized app won't have it.
if (app! && app.name) {
    auth = getAuth(app);
    db = getFirestore(app);

    // --- Emulator Connection (Development ONLY) ---
    // This code block will only run in a development environment where
    // process.env.NODE_ENV is 'development'. It connects Firebase services
    // to local emulators, which is crucial for preventing issues like
    // "auth/unauthorized-domain" without needing to whitelist domains.
    if (typeof window !== 'undefined' && window.location.hostname === "localhost") {
        try {
            console.log("Connecting to Firebase Emulators...");
            connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
            connectFirestoreEmulator(db, "localhost", 8080);
            console.log("Successfully connected to Firebase Emulators.");
        } catch (error) {
            console.error("Error connecting to Firebase emulators:", error);
        }
    }
} else {
    // If services couldn't be initialized, create mock objects to prevent crashes on import
    // This is a failsafe; the configIsValid check should prevent this.
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
}

export { app, auth, db, GoogleAuthProvider };
