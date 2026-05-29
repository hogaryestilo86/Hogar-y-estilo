/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ImgHTMLAttributes, VideoHTMLAttributes } from "react";

const DB_NAME = "StoreCustomMediaDb";
const STORE_NAME = "media";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error("Fallo al inicializar IndexedDB para archivos multimedia:", request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

export const inMemoryFallbackCache: Record<string, string> = {};

/**
 * Saves a binary Blob/File to IndexedDB and returns a persistent idb:// url
 */
export async function storeMedia(blob: Blob): Promise<string> {
  const db = await getDb();
  const key = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Convert blob to ArrayBuffer to prevent DataCloneError in iframe sandboxes & Safari structured clone restricts
  let dataToStore: any;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    dataToStore = {
      isWrapped: true,
      mimeType: blob.type,
      data: arrayBuffer
    };
  } catch (err) {
    console.warn("Could not wrap blob inside ArrayBuffer, storing raw blob:", err);
    dataToStore = blob;
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(dataToStore, key);

      request.onsuccess = () => {
        resolve(`idb://${key}`);
      };

      request.onerror = () => {
        console.error("Error al guardar archivo en IndexedDB:", request.error);
        reject(request.error);
      };
    } catch (txnError) {
      console.error("Transacción fallida en IndexedDB:", txnError);
      reject(txnError);
    }
  });
}

/**
 * Retrieves a binary Blob from IndexedDB by its key
 */
export async function getMedia(key: string): Promise<Blob | null> {
  const db = await getDb();

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // If stored as raw clone-safe object
        if (result && typeof result === "object" && result.isWrapped && result.data instanceof ArrayBuffer) {
          try {
            resolve(new Blob([result.data], { type: result.mimeType }));
          } catch (e) {
            console.error("Error reconstructing blob from ArrayBuffer wrapper:", e);
            resolve(null);
          }
        } else if (result instanceof Blob) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error("Error al leer archivo de IndexedDB:", request.error);
        resolve(null);
      };
    } catch (e) {
      console.error("Error leyendo de IndexedDB:", e);
      resolve(null);
    }
  });
}

/**
 * Deletes media from IndexedDB
 */
export async function deleteMedia(url: string): Promise<void> {
  if (!url || !url.startsWith("idb://")) return;
  const key = url.replace("idb://", "");
  const db = await getDb();

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

// Global cache to keep object URLs alive and avoid duplicate creations during a session
const globalResolvedCache: Record<string, string> = {};

/**
 * Resolves an idb:// URL into a session-active blob: URL
 */
export async function resolveIdbUrl(url: string | undefined): Promise<string> {
  if (!url) return "";
  if (!url.startsWith("idb://")) return url;

  const key = url.replace("idb://", "");
  if (globalResolvedCache[key]) {
    return globalResolvedCache[key];
  }

  // Check in-memory fallback cache first
  if (inMemoryFallbackCache[key]) {
    return inMemoryFallbackCache[key];
  }

  const blob = await getMedia(key);
  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    globalResolvedCache[key] = blobUrl;
    return blobUrl;
  }

  // Fallback image if not found
  return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=82";
}

/**
 * React Hook that dynamically and synchronously (from cache) resolves ANY url.
 * Handles standard http/https, base64, and persistent idb:// urls automatically.
 */
export function useResolvedUrl(url: string | undefined): string {
  const [resolved, setResolved] = useState<string>(() => {
    if (!url) return "";
    if (!url.startsWith("idb://")) return url;
    
    const key = url.replace("idb://", "");
    if (globalResolvedCache[key]) {
      return globalResolvedCache[key];
    }
    if (inMemoryFallbackCache[key]) {
      return inMemoryFallbackCache[key];
    }
    return ""; // loading placeholder
  });

  useEffect(() => {
    if (!url) {
      setResolved("");
      return;
    }

    if (!url.startsWith("idb://")) {
      setResolved(url);
      return;
    }

    let active = true;
    resolveIdbUrl(url).then((res) => {
      if (active) {
        setResolved(res);
      }
    });

    return () => {
      active = false;
    };
  }, [url]);

  return resolved;
}

interface ResolvedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string | undefined;
}

export const ResolvedImage = React.forwardRef<HTMLImageElement, ResolvedImageProps>(
  ({ src, ...props }, ref) => {
    const resolved = useResolvedUrl(src);
    const finalSrc = resolved || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=82";
    return React.createElement("img", {
      ref,
      src: finalSrc || null,
      ...props
    });
  }
);
ResolvedImage.displayName = "ResolvedImage";

interface ResolvedVideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  src: string | undefined;
}

export const ResolvedVideo = React.forwardRef<HTMLVideoElement, ResolvedVideoProps>(
  ({ src, ...props }, ref) => {
    const resolved = useResolvedUrl(src);
    return React.createElement("video", {
      ref,
      src: resolved || null,
      ...props
    });
  }
);
ResolvedVideo.displayName = "ResolvedVideo";

export function getCategoryPlaceholder(category: string | undefined): string {
  const cat = (category || "").toLowerCase();
  if (cat.includes("cocina")) {
    return "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=85";
  }
  if (cat.includes("hogar") || cat.includes("estilo")) {
    return "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=85";
  }
  if (cat.includes("belleza") || cat.includes("cuidado")) {
    return "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=85";
  }
  if (cat.includes("herramientas") || cat.includes("organizador")) {
    return "https://images.unsplash.com/photo-1581781894086-661f171488b7?auto=format&fit=crop&w=800&q=85";
  }
  if (cat.includes("iluminación") || cat.includes("iluminacion")) {
    return "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=85";
  }
  return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=82";
}


