import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
const db = getFirestore(app);
const auth = getAuth(app);

// Enable built-in Firestore offline persistence as a backup measure
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('Multiple tabs open, Firestore persistence disabled in this tab');
  } else if (err.code == 'unimplemented') {
    console.warn('Browser does not support Firestore persistence');
  }
});

export { app, db, auth };
