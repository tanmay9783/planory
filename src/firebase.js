import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBzLsJvKNh_avdTYIepp5GVM3vS63Ms51k",
  authDomain: "planory-b8838.firebaseapp.com",
  projectId: "planory-b8838",
  storageBucket: "planory-b8838.firebasestorage.app",
  messagingSenderId: "348036257730",
  appId: "1:348036257730:web:ae75094f9df969ae32a85b",
  measurementId: "G-MT0DWV6NDC"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage for offline persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore with local cache for offline-first capabilities
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});

export { app, auth, db };
