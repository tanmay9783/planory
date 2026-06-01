import { localDB } from './database.js';
import { db, auth } from './firebase.js';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

let _unsubscribeSync = null;
let _isSyncing = false;

/**
 * Push local pending changes to Firebase
 */
export async function syncPendingChanges() {
  if (_isSyncing || !navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return; // Cannot sync without being logged in

  _isSyncing = true;
  try {
    // 1. Find all local records that need to sync
    const pendingRecords = await localDB.kv_store
      .where('sync_status')
      .equals('pending')
      .toArray();

    if (pendingRecords.length === 0) {
      _isSyncing = false;
      return;
    }

    console.log(`[SyncEngine] Pushing ${pendingRecords.length} changes to cloud...`);

    // 2. Push to Firestore
    for (const record of pendingRecords) {
      try {
        const docRef = doc(db, 'users', user.uid, 'appData', record.id);
        
        // Remove local-only status before pushing
        const payload = { ...record };
        delete payload.sync_status;

        await setDoc(docRef, payload, { merge: true });

        // 3. Update local status to synced
        await localDB.kv_store.update(record.id, { sync_status: 'synced' });
      } catch (err) {
        console.error(`[SyncEngine] Failed to sync record: ${record.id}`, err);
        // Leave as 'pending' for next retry
      }
    }
  } catch (error) {
    console.error('[SyncEngine] Sync cycle failed:', error);
  } finally {
    _isSyncing = false;
  }
}

/**
 * Start listening to Cloud changes (Pull)
 */
export function startRealtimeSync() {
  const user = auth.currentUser;
  if (!user) return;

  if (_unsubscribeSync) {
    _unsubscribeSync();
  }

  console.log('[SyncEngine] Subscribing to Cloud realtime updates...');
  const appDataRef = collection(db, 'users', user.uid, 'appData');

  _unsubscribeSync = onSnapshot(appDataRef, async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const cloudData = change.doc.data();
        const localRecord = await localDB.kv_store.get(cloudData.id);
        
        if (localRecord && localRecord.sync_status === 'pending') {
          // Conflict detected!
          console.log(`[SyncEngine] Conflict detected for key: ${cloudData.id}. Merging...`);
          const mergedValue = resolveSyncConflict(cloudData.id, localRecord, cloudData);
          
          await localDB.kv_store.put({
            id: cloudData.id,
            value: typeof mergedValue === 'string' ? mergedValue : JSON.stringify(mergedValue),
            updated_at: Math.max(localRecord.updated_at, cloudData.updated_at) + 1,
            sync_status: 'pending', // Queue back to cloud soon
            deleted: false
          });
          
          window.dispatchEvent(new CustomEvent('planory:cloud_update', { 
            detail: { key: cloudData.id } 
          }));
          
          setTimeout(syncPendingChanges, 1000);
        } else if (!localRecord || cloudData.updated_at > localRecord.updated_at) {
          console.log(`[SyncEngine] Cloud update received for ${cloudData.id}`);
          await localDB.kv_store.put({
            ...cloudData,
            sync_status: 'synced'
          });
          
          window.dispatchEvent(new CustomEvent('planory:cloud_update', { 
            detail: { key: cloudData.id } 
          }));
        }
      }
    });
  });
}

function resolveSyncConflict(key, localRecord, cloudData) {
  let localVal = null;
  let cloudVal = null;

  try {
    localVal = typeof localRecord.value === 'string' ? JSON.parse(localRecord.value) : localRecord.value;
  } catch (e) {
    localVal = localRecord.value;
  }

  try {
    cloudVal = typeof cloudData.value === 'string' ? JSON.parse(cloudData.value) : cloudData.value;
  } catch (e) {
    cloudVal = cloudData.value;
  }

  if (!localVal || !cloudVal) {
    return cloudData.updated_at > localRecord.updated_at ? cloudVal : localVal;
  }

  const collectionKeys = ['tasks', 'user_habits', 'expenses', 'hydration_logs', 'notes', 'notes_drafts'];

  if (collectionKeys.includes(key) && Array.isArray(localVal) && Array.isArray(cloudVal)) {
    const uniqueIdKey = (key === 'notes') ? 'date' : 'id';
    const mergedMap = new Map();

    cloudVal.forEach(item => {
      if (item && item[uniqueIdKey]) {
        mergedMap.set(item[uniqueIdKey], item);
      }
    });

    localVal.forEach(item => {
      if (item && item[uniqueIdKey]) {
        const cloudItem = mergedMap.get(item[uniqueIdKey]);
        if (cloudItem) {
          const mergedItem = { ...cloudItem, ...item };
          if (cloudItem.completed || item.completed) {
            mergedItem.completed = true;
          }
          mergedMap.set(item[uniqueIdKey], mergedItem);
        } else {
          mergedMap.set(item[uniqueIdKey], item);
        }
      }
    });

    return Array.from(mergedMap.values());
  }

  if (typeof localVal === 'object' && typeof cloudVal === 'object') {
    if (key === 'gamification') {
      const maxLvl = Math.max(localVal.level || 1, cloudVal.level || 1);
      const maxXp = Math.max(localVal.xp || 0, cloudVal.xp || 0);
      return { level: maxLvl, xp: maxXp };
    }
    if (key === 'hydration') {
      const maxWater = Math.max(localVal.water || 0, cloudVal.water || 0);
      const maxTarget = Math.max(localVal.target || 2000, cloudVal.target || 2000);
      return { water: maxWater, target: maxTarget };
    }
    if (key === 'unlocked_seeds') {
      const localSeeds = Array.isArray(localVal) ? localVal : ['oak'];
      const cloudSeeds = Array.isArray(cloudVal) ? cloudVal : ['oak'];
      return Array.from(new Set([...localSeeds, ...cloudSeeds]));
    }
    if (key === 'focus_coins') {
      return Math.max(parseInt(localVal) || 0, parseInt(cloudVal) || 0);
    }
    return { ...cloudVal, ...localVal };
  }

  return cloudData.updated_at > localRecord.updated_at ? cloudVal : localVal;
}

/**
 * Stop Sync (on logout)
 */
export function stopRealtimeSync() {
  if (_unsubscribeSync) {
    _unsubscribeSync();
    _unsubscribeSync = null;
  }
}

// Auto-sync when internet reconnects
window.addEventListener('online', () => {
  console.log('[SyncEngine] Internet restored. Triggering sync queue...');
  syncPendingChanges();
});
