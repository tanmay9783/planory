import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * Custom hook to sync a specific storage key with Firestore.
 * Matches the logic used in the web app's getStorageItem / setStorageItem.
 */
export function useFirestoreData(storageKey, defaultValue = []) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', user.uid, 'appData', storageKey);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        if (cloudData.value && !cloudData.deleted) {
          try {
            const parsed = typeof cloudData.value === 'string' 
              ? JSON.parse(cloudData.value) 
              : cloudData.value;
            setData(parsed || defaultValue);
          } catch (e) {
            console.error(`[Sync] Failed to parse ${storageKey}:`, e);
          }
        } else {
          setData(defaultValue);
        }
      } else {
        setData(defaultValue);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [storageKey]);

  // Write function that mimics local storage but writes to Firestore
  const saveData = async (newData) => {
    const user = auth.currentUser;
    if (!user) return;

    // Optimistic UI update
    setData(newData);

    const docRef = doc(db, 'users', user.uid, 'appData', storageKey);
    await setDoc(docRef, {
      id: storageKey,
      value: JSON.stringify(newData),
      updated_at: Date.now(),
      deleted: false
    }, { merge: true });
  };

  return [data, saveData, loading];
}
