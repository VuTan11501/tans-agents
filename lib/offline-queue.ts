export interface QueuePayload {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  createdAt: number
}

export interface QueuedItem extends QueuePayload {
  id: number
}

const DB_NAME = "tans-agents-offline-v1"
const DB_VERSION = 1
const STORE_NAME = "queue"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open offline queue"))
    request.onblocked = () => reject(new Error("Offline queue database upgrade is blocked"))
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        const store = transaction.objectStore(STORE_NAME)
        const request = run(store)
        let result: T | undefined

        request.onsuccess = () => {
          result = request.result
        }
        request.onerror = () => reject(request.error ?? new Error("Offline queue request failed"))
        transaction.oncomplete = () => {
          db.close()
          resolve(result as T)
        }
        transaction.onerror = () => {
          db.close()
          reject(transaction.error ?? new Error("Offline queue transaction failed"))
        }
        transaction.onabort = () => {
          db.close()
          reject(transaction.error ?? new Error("Offline queue transaction aborted"))
        }
      }),
  )
}

export async function enqueue(payload: QueuePayload): Promise<number> {
  return withStore<IDBValidKey>("readwrite", (store) => store.add(payload)).then((key) => Number(key))
}

export async function list(): Promise<QueuedItem[]> {
  return withStore<QueuedItem[]>("readonly", (store) => store.getAll())
}

export async function remove(id: number): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(id))
}

export async function count(): Promise<number> {
  return withStore<number>("readonly", (store) => store.count())
}
