const CACHE_VERSION = 'v2';
const CACHE_NAME = `savebox-shell-${CACHE_VERSION}`;
const APP_SHELL = [
  '/',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

const DB_NAME = 'savebox_local_db';
const DB_VERSION = 2;
const STORE_FILES = 'files';
const STORE_HISTORY = 'history';
const STORE_SETTINGS = 'settings';
const STORE_HANDLES = 'handles';
const STORE_BG_JOBS = 'bg_jobs';

function openVaultDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        const filesStore = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        filesStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const historyStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
        historyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_BG_JOBS)) {
        db.createObjectStore(STORE_BG_JOBS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetBgJob(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_BG_JOBS, 'readonly');
    const req = tx.objectStore(STORE_BG_JOBS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function idbPutRecord(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDeleteBgJob(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_BG_JOBS, 'readwrite');
    tx.objectStore(STORE_BG_JOBS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function broadcastToClients(payload) {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  for (const client of clientList) {
    client.postMessage(payload);
  }
}

/* -------------------------------------------------------------------------- */
/* Install & Activate Lifecycle (OTA Update Ready)                            */
/* -------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );
  // Note: Do NOT force skipWaiting() automatically so PwaUpdater can detect waiting SW
  // and prompt user with "Update Available - Click to Refresh".
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_OLD_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Fetch Strategy                                                             */
/* -------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass API streams, extraction, speed tests, and non-GET requests
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
    )
  );
});

/* -------------------------------------------------------------------------- */
/* Background Fetch API (True Background Downloads when App is Closed/Locked) */
/* -------------------------------------------------------------------------- */
self.addEventListener('backgroundfetchsuccess', (event) => {
  const bgReg = event.registration;
  event.waitUntil(
    (async () => {
      const db = await openVaultDB();
      const jobMeta = await idbGetBgJob(db, bgReg.id);
      const records = await bgReg.matchAll();

      const blobs = [];
      let detectedMime = jobMeta?.mimeType || 'video/mp4';

      for (const record of records) {
        const response = await record.responseReady;
        const ct = response.headers.get('content-type');
        if (ct && !ct.includes('octet-stream')) {
          detectedMime = ct;
        }
        const partBlob = await response.blob();
        blobs.push(partBlob);
      }

      const finalBlob =
        blobs.length === 1
          ? blobs[0]
          : new Blob(blobs, { type: detectedMime });

      const title = jobMeta?.title || 'Downloaded Media';
      const qualityLabel = jobMeta?.qualityLabel || 'HD';
      const mediaType = jobMeta?.mediaType || 'video';
      const ext = jobMeta?.ext || (mediaType === 'audio' ? 'mp3' : 'mp4');

      const storedItem = {
        id: bgReg.id,
        name: `${title} (${qualityLabel})`,
        mediaType,
        folder: mediaType,
        ext,
        mimeType: detectedMime,
        qualityLabel,
        platform: jobMeta?.platform || 'generic',
        sourceUrl: jobMeta?.sourceUrl || '',
        sizeBytes: finalBlob.size,
        durationSeconds: jobMeta?.durationSeconds || 0,
        tags: [jobMeta?.platform || 'generic', qualityLabel, 'background-fetch'],
        hidden: false,
        createdAt: jobMeta?.createdAt || Date.now(),
        blob: finalBlob,
        thumbnail: jobMeta?.thumbnail || '',
      };

      await idbPutRecord(db, STORE_FILES, storedItem);

      const historyItem = {
        id: bgReg.id,
        title,
        sourceUrl: jobMeta?.sourceUrl || '',
        platform: jobMeta?.platform || 'generic',
        mediaType,
        qualityLabel,
        ext,
        sizeBytes: finalBlob.size,
        status: 'completed',
        createdAt: Date.now(),
      };

      await idbPutRecord(db, STORE_HISTORY, historyItem);
      await idbDeleteBgJob(db, bgReg.id);

      await event.updateUI({
        title: `Saved: ${title}`,
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      });

      await broadcastToClients({
        type: 'BG_FETCH_COMPLETED',
        id: bgReg.id,
        title,
        sizeBytes: finalBlob.size,
      });
    })().catch(async (err) => {
      await event
        .updateUI({
          title: 'Background download save failed',
        })
        .catch(() => undefined);
      await broadcastToClients({
        type: 'BG_FETCH_FAILED',
        id: bgReg.id,
        error: err && err.message ? err.message : 'Storage error',
      });
    })
  );
});

self.addEventListener('backgroundfetchfail', (event) => {
  const bgReg = event.registration;
  event.waitUntil(
    (async () => {
      const db = await openVaultDB();
      const jobMeta = await idbGetBgJob(db, bgReg.id);
      if (jobMeta) {
        await idbPutRecord(db, STORE_HISTORY, {
          id: bgReg.id,
          title: jobMeta.title,
          sourceUrl: jobMeta.sourceUrl,
          platform: jobMeta.platform,
          mediaType: jobMeta.mediaType,
          qualityLabel: jobMeta.qualityLabel,
          ext: jobMeta.ext,
          sizeBytes: 0,
          status: 'failed',
          createdAt: Date.now(),
        });
        await idbDeleteBgJob(db, bgReg.id);
      }

      await event
        .updateUI({
          title: `Failed: ${jobMeta?.title || 'Media Download'}`,
        })
        .catch(() => undefined);

      await broadcastToClients({
        type: 'BG_FETCH_FAILED',
        id: bgReg.id,
        error: bgReg.failureReason || 'Background fetch failed',
      });
    })()
  );
});

self.addEventListener('backgroundfetchabort', (event) => {
  const bgReg = event.registration;
  event.waitUntil(
    (async () => {
      const db = await openVaultDB();
      await idbDeleteBgJob(db, bgReg.id);
      await broadcastToClients({
        type: 'BG_FETCH_ABORTED',
        id: bgReg.id,
      });
    })()
  );
});

self.addEventListener('backgroundfetchclick', (event) => {
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })()
  );
});
