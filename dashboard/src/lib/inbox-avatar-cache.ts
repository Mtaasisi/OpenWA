const DB_NAME = 'openwa-inbox-avatars';
const DB_VERSION = 2;
const STORE = 'avatars';

/** Retry "no profile photo" after this — avoids locking out contacts on transient engine failures. */
const ABSENT_MAX_AGE_MS = 30 * 60 * 1000;

export type AvatarCacheStatus = 'hit' | 'absent' | 'miss';

type AvatarRecord = {
  key: string;
  blob?: Blob;
  absent?: boolean;
  updatedAt: number;
};

function avatarKey(sessionId: string, chatId: string): string {
  return `${sessionId}:${chatId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open avatar cache'));
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getCachedAvatarStatus(
  sessionId: string,
  chatId: string,
): Promise<AvatarCacheStatus> {
  if (typeof indexedDB === 'undefined') return 'miss';
  try {
    const db = await openDb();
    return await new Promise<AvatarCacheStatus>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const request = store.get(avatarKey(sessionId, chatId));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const row = request.result as AvatarRecord | undefined;
        if (!row) {
          resolve('miss');
          return;
        }
        if (row.absent && Date.now() - row.updatedAt < ABSENT_MAX_AGE_MS) {
          resolve('absent');
          return;
        }
        if (row.blob) {
          resolve('hit');
          return;
        }
        resolve('miss');
      };
      tx.oncomplete = () => db.close();
    });
  } catch {
    return 'miss';
  }
}

export async function getCachedAvatarBlob(
  sessionId: string,
  chatId: string,
): Promise<Blob | null> {
  const status = await getCachedAvatarStatus(sessionId, chatId);
  if (status !== 'hit') return null;
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const request = store.get(avatarKey(sessionId, chatId));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const row = request.result as AvatarRecord | undefined;
        resolve(row?.blob ?? null);
      };
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function putCachedAvatarAbsent(sessionId: string, chatId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const record: AvatarRecord = {
        key: avatarKey(sessionId, chatId),
        absent: true,
        updatedAt: Date.now(),
      };
      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
  } catch {
    /* best-effort */
  }
}

/** Drop a stale negative cache entry (e.g. CDN proved a photo exists). */
export async function clearCachedAvatarAbsent(sessionId: string, chatId: string): Promise<void> {
  const status = await getCachedAvatarStatus(sessionId, chatId);
  if (status !== 'absent') return;
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.delete(avatarKey(sessionId, chatId));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
  } catch {
    /* best-effort */
  }
}

export async function putCachedAvatarBlob(
  sessionId: string,
  chatId: string,
  blob: Blob,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const record: AvatarRecord = {
        key: avatarKey(sessionId, chatId),
        blob,
        absent: false,
        updatedAt: Date.now(),
      };
      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
  } catch {
    /* best-effort */
  }
}
