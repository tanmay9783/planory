import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: Firebase config values (apiKey, etc.) are safe to expose for client-side Firebase SDKs
// because access is controlled by Firestore Security Rules — NOT by hiding the config.
// Make sure your Firestore Rules are locked down in the Firebase Console.
const firebaseConfig = {
  apiKey: "AIzaSyBzLsJvKNh_avdTYIepp5GVM3vS63Ms51k",
  authDomain: "planory-b8838.firebaseapp.com",
  projectId: "planory-b8838",
  storageBucket: "planory-b8838.firebasestorage.app",
  messagingSenderId: "348036257730",
  appId: "1:348036257730:web:ae75094f9df969ae32a85b",
  measurementId: "G-MT0DWV6NDC"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage for offline persistence, with hot-reload safety
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

// Initialize Firestore with persistent local cache for full offline support.
// Users can open the app with no internet and still see their data.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache()
  });
} catch (e) {
  db = getFirestore(app);
}

export { app, auth, db };

