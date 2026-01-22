/**
 * Persistent Identity Layer
 * Links fingerprint to persistent visitor ID via:
 * 1. Signed first-party cookie
 * 2. LocalStorage backup
 * 3. IndexedDB for additional persistence
 *
 * This allows visitor identification even when fingerprints change
 * due to browser updates or configuration changes.
 */

const COOKIE_NAME = '_fp_vid';
const STORAGE_KEY = '_fp_visitor_id';
const IDB_DB_NAME = 'fingerprint_identity';
const IDB_STORE_NAME = 'identity';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

/**
 * Parsed persistent identity structure
 */
export interface PersistentIdentity {
  visitorId: string;
  signature: string;
  createdAt: number;
  source: 'cookie' | 'storage' | 'indexeddb' | 'new';
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

/**
 * Set a cookie with proper attributes for persistence
 */
function setCookie(name: string, value: string, maxAge: number): void {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookie access denied
  }
}

/**
 * Delete a cookie
 */
function deleteCookie(name: string): void {
  try {
    document.cookie = `${name}=; max-age=0; path=/`;
  } catch {
    // Cookie access denied
  }
}

/**
 * Parse a signed identity string
 * Format: visitorId.signature.timestamp
 */
function parseSignedId(
  signedId: string
): { visitorId: string; signature: string; createdAt: number } | null {
  const parts = signedId.split('.');
  if (parts.length !== 3) return null;

  const createdAt = parseInt(parts[2], 10);
  if (isNaN(createdAt)) return null;

  return {
    visitorId: parts[0],
    signature: parts[1],
    createdAt,
  };
}

/**
 * Create a signed identity string
 */
function createSignedId(
  visitorId: string,
  signature: string,
  createdAt: number = Date.now()
): string {
  return `${visitorId}.${signature}.${createdAt}`;
}

/**
 * Open IndexedDB connection
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get value from IndexedDB
 */
async function getFromIndexedDB(key: string): Promise<string | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };

      request.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Set value in IndexedDB
 */
async function setInIndexedDB(key: string, value: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(value, key);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // IndexedDB access denied
  }
}

/**
 * Delete value from IndexedDB
 */
async function deleteFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.delete(key);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // IndexedDB access denied
  }
}

/**
 * Get or create persistent visitor ID
 * Checks all storage locations in order of preference
 */
export async function getPersistentIdentity(): Promise<PersistentIdentity | null> {
  // 1. Try cookie first (most reliable for same-site)
  const cookieId = getCookie(COOKIE_NAME);
  if (cookieId) {
    const parsed = parseSignedId(cookieId);
    if (parsed) {
      return { ...parsed, source: 'cookie' };
    }
  }

  // 2. Try localStorage
  try {
    const storageId = localStorage.getItem(STORAGE_KEY);
    if (storageId) {
      const parsed = parseSignedId(storageId);
      if (parsed) {
        // Restore cookie from storage
        setCookie(COOKIE_NAME, storageId, COOKIE_MAX_AGE);
        return { ...parsed, source: 'storage' };
      }
    }
  } catch {
    // localStorage blocked
  }

  // 3. Try IndexedDB
  try {
    const idbId = await getFromIndexedDB(STORAGE_KEY);
    if (idbId) {
      const parsed = parseSignedId(idbId);
      if (parsed) {
        // Restore cookie and storage
        setCookie(COOKIE_NAME, idbId, COOKIE_MAX_AGE);
        try {
          localStorage.setItem(STORAGE_KEY, idbId);
        } catch {
          // localStorage blocked
        }
        return { ...parsed, source: 'indexeddb' };
      }
    }
  } catch {
    // IndexedDB blocked
  }

  return null;
}

/**
 * Store persistent identity (called after server confirms visitor ID)
 * Stores in all available locations for redundancy
 */
export async function setPersistentIdentity(
  visitorId: string,
  signature: string
): Promise<void> {
  const signedId = createSignedId(visitorId, signature, Date.now());

  // Store in all available locations
  setCookie(COOKIE_NAME, signedId, COOKIE_MAX_AGE);

  try {
    localStorage.setItem(STORAGE_KEY, signedId);
  } catch {
    // localStorage blocked
  }

  try {
    await setInIndexedDB(STORAGE_KEY, signedId);
  } catch {
    // IndexedDB blocked
  }
}

/**
 * Clear persistent identity from all storage locations
 * Useful for logout or privacy reset
 */
export async function clearPersistentIdentity(): Promise<void> {
  deleteCookie(COOKIE_NAME);

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage blocked
  }

  try {
    await deleteFromIndexedDB(STORAGE_KEY);
  } catch {
    // IndexedDB blocked
  }
}

/**
 * Check if persistent identity exists without fully parsing it
 */
export function hasPersistentIdentity(): boolean {
  // Quick check - just see if any storage has a value
  if (getCookie(COOKIE_NAME)) return true;

  try {
    if (localStorage.getItem(STORAGE_KEY)) return true;
  } catch {
    // localStorage blocked
  }

  return false;
}

/**
 * Get diagnostic information about identity storage availability
 */
export async function getIdentityStorageStatus(): Promise<{
  cookieAvailable: boolean;
  localStorageAvailable: boolean;
  indexedDBAvailable: boolean;
  hasCookie: boolean;
  hasLocalStorage: boolean;
  hasIndexedDB: boolean;
}> {
  let cookieAvailable = false;
  let localStorageAvailable = false;
  let indexedDBAvailable = false;

  // Test cookie access
  try {
    const testName = '_fp_test';
    setCookie(testName, 'test', 1);
    cookieAvailable = getCookie(testName) === 'test';
    deleteCookie(testName);
  } catch {
    cookieAvailable = false;
  }

  // Test localStorage
  try {
    const testKey = '_fp_test';
    localStorage.setItem(testKey, 'test');
    localStorageAvailable = localStorage.getItem(testKey) === 'test';
    localStorage.removeItem(testKey);
  } catch {
    localStorageAvailable = false;
  }

  // Test IndexedDB
  try {
    const db = await openIndexedDB();
    db.close();
    indexedDBAvailable = true;
  } catch {
    indexedDBAvailable = false;
  }

  return {
    cookieAvailable,
    localStorageAvailable,
    indexedDBAvailable,
    hasCookie: !!getCookie(COOKIE_NAME),
    hasLocalStorage: (() => {
      try {
        return !!localStorage.getItem(STORAGE_KEY);
      } catch {
        return false;
      }
    })(),
    hasIndexedDB: !!(await getFromIndexedDB(STORAGE_KEY)),
  };
}
