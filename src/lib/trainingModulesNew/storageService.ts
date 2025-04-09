import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Storage Service for client-side data persistence using IndexedDB.
 */

// Define a key prefix to avoid collisions
const STORAGE_PREFIX = 'helf_';

// Define storage keys
export const STORAGE_KEYS = {
  SESSION_DATA: (id: number | string) => `${STORAGE_PREFIX}session_${id}`,
  LAST_ACTIVE_SESSION: `${STORAGE_PREFIX}lastActiveSessionId`,
  CURRENT_SESSION_NAME: `${STORAGE_PREFIX}currentSessionName`,
};

// Interface for the data stored for each session
export interface SessionStorageData {
  session: any; // Consider defining a stricter type for session
  exercises: any[]; // Consider defining a stricter type for exercises
  lastUpdated: string;
}

// --- IndexedDB Configuration ---
const DB_NAME = 'HelfTrainingDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessionData';

// Define the database schema using idb's DBSchema
interface HelfDBSchema extends DBSchema {
  [STORE_NAME]: {
    key: string; // The key will be like 'helf_session_123'
    value: SessionStorageData & { id: string }; // Stored value includes the key as 'id'
    indexes: { lastUpdated: string };
  };
}

// --- DB Initialization & Management ---
let dbPromise: Promise<IDBPDatabase<HelfDBSchema>> | null = null;

/**
 * Gets the IndexedDB database instance, initializing it if necessary.
 * Reuses the connection.
 */
function getDb(): Promise<IDBPDatabase<HelfDBSchema>> {
  if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB is not supported in this browser.'));
  }

  if (!dbPromise) {
    dbPromise = openDB<HelfDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
        // Create the session data store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          // Create index for potential future use (e.g., cleanup by date)
          store.createIndex('lastUpdated', 'lastUpdated');
          console.log('Created IndexedDB object store:', STORE_NAME);
        }
        // Handle other potential version upgrades here in the future
      },
      blocked() {
        console.warn('IndexedDB open request blocked, possibly due to other open tabs.');
        // Optionally inform the user or retry
      },
      blocking() {
        console.warn('IndexedDB connection is blocking a version upgrade.');
        // Close the connection if necessary, although idb handles this well
      },
      terminated() {
        console.warn('IndexedDB connection terminated unexpectedly. Re-initializing.');
        // Reset the promise to allow re-initialization on next access
        dbPromise = null;
      },
    }).catch(error => {
      console.error("Failed to open IndexedDB:", error);
      dbPromise = null; // Reset promise on failure
      throw error; // Re-throw the error
    });
  }
  return dbPromise;
}

// --- IndexedDB Data Operations ---

/**
 * Save session data to IndexedDB.
 * Throws an error if saving fails.
 */
export async function saveSessionData(sessionId: number | string, data: SessionStorageData): Promise<void> {
  try {
    const db = await getDb();
    const storeData = {
      id: STORAGE_KEYS.SESSION_DATA(sessionId), // Use the keyPath 'id'
      ...data
    };
    await db.put(STORE_NAME, storeData);
    console.log('Saved session data to IndexedDB:', storeData.id);
  } catch (error) {
    console.error(`Error saving session ${sessionId} to IndexedDB:`, error);
    // Let the error propagate - no localStorage fallback
    throw new Error(`Failed to save session ${sessionId} to IndexedDB.`);
  }
}

/**
 * Load session data from IndexedDB.
 * Returns null if not found. Throws an error if loading fails.
 */
export async function loadSessionData(sessionId: number | string): Promise<SessionStorageData | null> {
  try {
    const db = await getDb();
    const dbKey = STORAGE_KEYS.SESSION_DATA(sessionId);
    const storedData = await db.get(STORE_NAME, dbKey);

    if (storedData) {
      // Omit the 'id' field (which is our key) from the returned data
      const { id, ...sessionData } = storedData;
      console.log('Loaded session data from IndexedDB:', dbKey);
      return sessionData as SessionStorageData;
    } else {
      console.log('No session data found in IndexedDB for key:', dbKey);
      return null;
    }
  } catch (error) {
    console.error(`Error loading session ${sessionId} from IndexedDB:`, error);
    // Let the error propagate
    throw new Error(`Failed to load session ${sessionId} from IndexedDB.`);
  }
}

/**
 * Delete specific session data from IndexedDB.
 * Throws an error if deletion fails.
 */
export async function deleteSessionData(sessionId: number | string): Promise<void> {
  try {
    const db = await getDb();
    const dbKey = STORAGE_KEYS.SESSION_DATA(sessionId);
    await db.delete(STORE_NAME, dbKey);
    console.log('Deleted session data from IndexedDB:', dbKey);
  } catch (error) {
    console.error(`Error deleting session ${sessionId} from IndexedDB:`, error);
    // Let the error propagate
    throw new Error(`Failed to delete session ${sessionId} from IndexedDB.`);
  }
}

/**
 * Clear ALL data from the sessionData store in IndexedDB.
 * Throws an error if clearing fails.
 */
export async function clearAllSessionData(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
    console.log('Cleared all session data from IndexedDB store:', STORE_NAME);
  } catch (error) {
    console.error('Error clearing IndexedDB store:', error);
    // Let the error propagate
    throw new Error('Failed to clear all session data from IndexedDB.');
  }
}

// --- localStorage / sessionStorage Utilities (Kept separate as they serve different purposes) ---

/**
 * Save the ID of the last active session to localStorage.
 */
export function saveLastActiveSessionId(sessionId: number | string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_SESSION, sessionId.toString());
  } catch (e) {
    console.error('Error saving last active session ID to localStorage:', e);
  }
}

/**
 * Get the ID of the last active session from localStorage.
 */
export function getLastActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_SESSION);
  } catch (e) {
    console.error('Error getting last active session ID from localStorage:', e);
    return null;
  }
}

/**
 * Set a value in sessionStorage.
 * Note: sessionStorage is cleared when the browser tab is closed.
 */
export function setSessionValue(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
    // Removed custom event dispatch - rely on standard component state/effects
  } catch (e) {
    console.error('Error setting sessionStorage value:', e);
  }
}

/**
 * Get a value from sessionStorage.
 */
export function getSessionValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.error('Error getting sessionStorage value:', e);
    return null;
  }
}

/**
 * Remove a value from sessionStorage.
 */
export function removeSessionValue(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
    // Removed custom event dispatch
  } catch (e) {
    console.error('Error removing sessionStorage value:', e);
  }
}