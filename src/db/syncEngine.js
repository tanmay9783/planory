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
        
        // Check if cloud version is newer than local
        const localRecord = await localDB.kv_store.get(cloudData.id);
        
        if (!localRecord || cloudData.updated_at > localRecord.updated_at) {
          console.log(`[SyncEngine] Cloud update received for ${cloudData.id}`);
          await localDB.kv_store.put({
            ...cloudData,
            sync_status: 'synced'
          });
          
          // Dispatch event so UI can re-render if needed
          window.dispatchEvent(new CustomEvent('planory:cloud_update', { 
            detail: { key: cloudData.id } 
          }));
        }
      }
    });
  });
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
