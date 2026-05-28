import Dexie from 'dexie';

// Initialize Local IndexedDB Database
export const localDB = new Dexie('PlanoryLocalDB');

localDB.version(1).stores({
  // Table: kv_store
  // Primary key: id (which is the storage key, e.g. 'radhe_tasks')
  // Indexes on: sync_status (to easily query pending items), updated_at
  kv_store: 'id, sync_status, updated_at'
});

/**
 * Helper to wrap raw values into the Sync Engine format
 */
export function createSyncRecord(id, value) {
  return {
    id: id,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    updated_at: Date.now(),
    sync_status: 'pending',
    deleted: false
  };
}
