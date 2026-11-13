import type {
  AppSettings,
  BackgroundFetchJobMeta,
  DownloadHistoryRecord,
  StoredFileItem,
} from '@/types/media';

const DB_NAME = 'savebox_local_db';
const DB_VERSION = 2;
const STORE_FILES = 'files';
const STORE_HISTORY = 'history';
const STORE_SETTINGS = 'settings';
const STORE_HANDLES = 'handles';
const STORE_BG_JOBS = 'bg_jobs';

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'ar',
  theme: 'dark',
  dynamicAccent: 'ocean',
  directDownload: false,
  concurrentLimit: 2,
  speedLimitKBps: 0,
  saveFolderName: null,
  touchIdEnabled: false,
  touchIdCredentialId: null,
  pinHash: null,
  notificationsEnabled: true,
  soundOrPushEnabled: true,
  notifyOnComplete: true,
  notifyOnFail: true,
  notificationSound: 'chime',
  defaultMediaType: 'video',
  defaultVideoQuality: '720p',
  defaultAudioBitrate: 192,
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment'));
      return;
    }
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

export async function saveBgJobMeta(job: BackgroundFetchJobMeta): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_BG_JOBS, 'readwrite');
    tx.objectStore(STORE_BG_JOBS).put(job);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBgJobMeta(id: string): Promise<BackgroundFetchJobMeta | null> {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_BG_JOBS, 'readonly');
    const req = tx.objectStore(STORE_BG_JOBS).get(id);
    req.onsuccess = () => resolve((req.result as BackgroundFetchJobMeta) || null);
    req.onerror = () => resolve(null);
  });
}

export async function deleteBgJobMeta(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_BG_JOBS, 'readwrite');
    tx.objectStore(STORE_BG_JOBS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const req = tx.objectStore(STORE_SETTINGS).get('app_settings');
      req.onsuccess = () => {
        if (req.result?.value) {
          resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key: 'app_settings', value: settings });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveFileItem(item: StoredFileItem): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllFiles(): Promise<StoredFileItem[]> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const req = tx.objectStore(STORE_FILES).getAll();
      req.onsuccess = () => {
        const items = (req.result as StoredFileItem[]) || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteFileItem(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addHistoryRecord(record: DownloadHistoryRecord): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    tx.objectStore(STORE_HISTORY).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllHistory(): Promise<DownloadHistoryRecord[]> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_HISTORY, 'readonly');
      const req = tx.objectStore(STORE_HISTORY).getAll();
      req.onsuccess = () => {
        const list = (req.result as DownloadHistoryRecord[]) || [];
        list.sort((a, b) => b.createdAt - a.createdAt);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function clearAllHistory(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    tx.objectStore(STORE_HISTORY).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// File System Access API Directory Handle Persistence
export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readwrite');
    tx.objectStore(STORE_HANDLES).put({ key: 'save_root_dir', handle });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_HANDLES, 'readonly');
      const req = tx.objectStore(STORE_HANDLES).get('save_root_dir');
      req.onsuccess = () => resolve(req.result?.handle ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function pickDeviceSaveFolder(): Promise<{
  supported: boolean;
  folderName: string | null;
  handle: FileSystemDirectoryHandle | null;
}> {
  const win = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  };

  if (typeof win.showDirectoryPicker !== 'function') {
    return { supported: false, folderName: null, handle: null };
  }

  const handle = await win.showDirectoryPicker({ mode: 'readwrite' });
  await saveDirectoryHandle(handle);
  return { supported: true, folderName: handle.name, handle };
}

export async function writeBlobToDeviceFolder(
  mediaType: 'video' | 'audio',
  filename: string,
  blob: Blob
): Promise<string | null> {
  try {
    const rootHandle = await getSavedDirectoryHandle();
    if (!rootHandle) return null;

    const handleWithPerm = rootHandle as FileSystemDirectoryHandle & {
      queryPermission?: (desc: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
      requestPermission?: (desc: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
    };

    if (handleWithPerm.queryPermission) {
      let perm = await handleWithPerm.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && handleWithPerm.requestPermission) {
        perm = await handleWithPerm.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return null;
    }

    // Automatically route video into "video" subfolder and audio into "audio" subfolder
    const subFolderName = mediaType === 'video' ? 'video' : 'audio';
    const subDir = await rootHandle.getDirectoryHandle(subFolderName, {
      create: true,
    });
    const safeName = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const fileHandle = await subDir.getFileHandle(safeName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return `${rootHandle.name}/${subFolderName}/${safeName}`;
  } catch {
    return null;
  }
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

export interface StorageEstimateInfo {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  vaultBytes: number;
}

export async function getStorageEstimateInfo(): Promise<StorageEstimateInfo> {
  const files = await getAllFiles();
  const vaultBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const quotaBytes = estimate.quota || 0;
      const usedBytes = estimate.usage || vaultBytes;
      const availableBytes = Math.max(0, quotaBytes - usedBytes);
      return { usedBytes, quotaBytes, availableBytes, vaultBytes };
    } catch {
      // fallback below
    }
  }
  return {
    usedBytes: vaultBytes,
    quotaBytes: 0,
    availableBytes: 0,
    vaultBytes,
  };
}

export function exportHistoryToCsv(records: DownloadHistoryRecord[]): void {
  const headers = [
    'ID',
    'Title',
    'URL',
    'Platform',
    'Type',
    'Quality',
    'Format',
    'Size (Bytes)',
    'Status',
    'Downloaded At',
  ];

  const escapeCsv = (value: string | number) => {
    const str = String(value ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) =>
    [
      r.id,
      r.title,
      r.sourceUrl,
      r.platform,
      r.mediaType,
      r.qualityLabel,
      r.ext.toUpperCase(),
      r.sizeBytes,
      r.status,
      new Date(r.createdAt).toISOString(),
    ]
      .map(escapeCsv)
      .join(',')
  );

  // UTF-8 BOM (\uFEFF) ensures Microsoft Excel opens Arabic & Unicode cleanly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerBrowserDownload(blob, `savebox-history-${dateTag}.csv`);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}
