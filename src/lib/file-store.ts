"use client";

const DB_NAME = "makershelf-files";
const STORE_NAME = "project-files";
const THUMBNAIL_STORE_NAME = "project-thumbnails";
const DB_VERSION = 2;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains(THUMBNAIL_STORE_NAME)) {
        database.createObjectStore(THUMBNAIL_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => reject(new Error("IndexedDB ist blockiert."));
    request.onerror = () => reject(request.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
  });
}

export async function putStoredThumbnail(cacheKey: string, blob: Blob) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(THUMBNAIL_STORE_NAME, "readwrite");
    const request = transaction.objectStore(THUMBNAIL_STORE_NAME).put(blob, cacheKey);
    request.onerror = () => {
      reject(request.error ?? new Error("Thumbnail konnte nicht gespeichert werden."));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Thumbnail konnte nicht gespeichert werden."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Thumbnail konnte nicht gespeichert werden."));
    };
  });
}

export async function getStoredThumbnail(cacheKey: string) {
  const database = await openDatabase();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = database.transaction(THUMBNAIL_STORE_NAME, "readonly");
    const request = transaction.objectStore(THUMBNAIL_STORE_NAME).get(cacheKey);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error("Thumbnail konnte nicht gelesen werden."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function putStoredFile(fileId: string, blob: Blob) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).put(blob, fileId);
    request.onerror = () => {
      reject(request.error ?? new Error("Datei konnte nicht gespeichert werden."));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Datei konnte nicht gespeichert werden."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Datei konnte nicht gespeichert werden."));
    };
  });
}

export async function getStoredFile(fileId: string) {
  const database = await openDatabase();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(fileId);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error("Datei konnte nicht gelesen werden."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function deleteStoredFile(fileId: string) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(fileId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Datei konnte nicht entfernt werden."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Datei konnte nicht entfernt werden."));
    };
  });
}

export async function listStoredFileKeys(prefix = "") {
  const database = await openDatabase();
  return new Promise<string[]>((resolve, reject) => {
    const keys: string[] = [];
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).openKeyCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(keys);
        return;
      }

      const key = String(cursor.primaryKey);
      if (!prefix || key.startsWith(prefix)) {
        keys.push(key);
      }

      cursor.continue();
    };

    request.onerror = () =>
      reject(request.error ?? new Error("Dateischluessel konnten nicht gelesen werden."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function deleteStoredFilesByPrefix(prefix: string) {
  if (!prefix) {
    return;
  }

  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openKeyCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      const key = String(cursor.primaryKey);
      if (key.startsWith(prefix)) {
        store.delete(cursor.primaryKey);
      }

      cursor.continue();
    };

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Dateispeicher konnte nicht bereinigt werden."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Dateispeicher konnte nicht bereinigt werden."));
    };
  });
}

export async function clearStoredFiles() {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Dateispeicher konnte nicht geleert werden."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Dateispeicher konnte nicht geleert werden."));
    };
  });
}

export async function makeStoredFileObjectUrl(fileId: string) {
  const blob = await getStoredFile(fileId);
  if (!blob) {
    return "";
  }

  return URL.createObjectURL(blob);
}
