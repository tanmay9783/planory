/**
 * storage.js — Planory Local-First Storage Layer
 *
 * Primary:  Dexie.js (IndexedDB) for instant offline reads/writes
 * Sync:     Background Sync Engine (Firebase)
 * Memory:   In-memory Cache for synchronous UI access
 */

import { localDB, createSyncRecord } from '../db/database.js';
import { syncPendingChanges } from '../db/syncEngine.js';

const _cache = new Map();
let _cacheLoaded = false;

// ── 1. Preload Cache from Dexie on Startup ───────────────
export async function preloadCache() {
  if (_cacheLoaded) return;
  try {
    const records = await localDB.kv_store.toArray();
    records.forEach(record => {
      // Ignore records marked as deleted
      if (!record.deleted) {
        try {
          _cache.set(record.id, JSON.parse(record.value));
        } catch {
          _cache.set(record.id, record.value);
        }
      }
    });
    _cacheLoaded = true;
    console.log(`[Storage] Preloaded ${_cache.size} keys from Dexie instantly.`);
  } catch (error) {
    console.error('[Storage] Failed to preload Dexie cache:', error);
    _cacheLoaded = true; // prevent infinite loading loop
  }
}

// ── 2. Listen for Cloud Updates ──────────────────────────
// When Sync Engine pulls newer data from Firebase, update cache
window.addEventListener('planory:cloud_update', async (e) => {
  const { key } = e.detail;
  try {
    const record = await localDB.kv_store.get(key);
    if (record && !record.deleted) {
      const parsedValue = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
      _cache.set(key, parsedValue);
      // Optional: Dispatch a global event here if UI needs to re-render immediately
      window.dispatchEvent(new Event('planory:data_changed'));
    } else if (record && record.deleted) {
      _cache.delete(key);
    }
  } catch (err) {
    console.error('[Storage] Error processing cloud update for', key, err);
  }
});

// ── 3. PUBLIC API (Synchronous UI Access) ────────────────

/**
 * Read (Instant) — Returns from memory cache.
 */
export function getStorageItem(key, defaultValue) {
  if (_cache.has(key)) {
    return _cache.get(key);
  }
  return defaultValue;
}

/**
 * Write (Instant Local, Background Sync)
 */
export function setStorageItem(key, value) {
  // 1. Update UI Cache instantly
  _cache.set(key, value);

  // 2. Wrap payload with Sync metadata
  const record = createSyncRecord(key, value);

  // 3. Write to local Dexie database (Async, don't await)
  localDB.kv_store.put(record).then(() => {
    // 4. Tell Sync Engine to push pending changes to Firebase
    syncPendingChanges();
  }).catch(err => {
    console.error('[Storage] Failed to save to local Dexie:', err);
  });
}

/**
 * Delete (Soft Delete for Sync)
 */
export function removeStorageItem(key) {
  // 1. Remove from instant cache
  _cache.delete(key);

  // 2. Mark as deleted in local database
  const record = createSyncRecord(key, null);
  record.deleted = true;

  localDB.kv_store.put(record).then(() => {
    syncPendingChanges();
  }).catch(err => {
    console.error('[Storage] Failed to mark as deleted in Dexie:', err);
  });
}
