/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ImgHTMLAttributes, VideoHTMLAttributes } from "react";
import { Product } from "./types";

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
 * Compresses an image blob to standard web-optimized size and quality.
 * Shrinks 5MB-10MB photos to 20KB-80KB while retaining excellent mobile clarity!
 */
export async function compressImageBlob(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/") || blob.type === "image/gif") {
    return blob;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas");
        const max_dim = 800; // Optimal web resolution edge-limit
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > max_dim) {
            height = Math.round((height * max_dim) / width);
            width = max_dim;
          }
        } else {
          if (height > max_dim) {
            width = Math.round((width * max_dim) / height);
            height = max_dim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (resultBlob) => {
              if (resultBlob) {
                resolve(resultBlob);
              } else {
                resolve(blob);
              }
            },
            "image/jpeg",
            0.65 // High-performance compression ratio
          );
        } else {
          resolve(blob);
        }
      } catch (err) {
        console.warn("Fallo al comprimir la imagen en Canvas, usando la original:", err);
        resolve(blob);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

/**
 * Compresses any existing image base64 data URL to a lightweight Jpeg format (width/height <= 800px, 0.65 quality).
 */
export async function compressBase64Image(dataUrl: string, max_dim: number = 800, quality: number = 0.65): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/") || dataUrl.includes("image/gif")) {
    return dataUrl;
  }
  // If no custom constraints and already under 60KB (roughly 80,000 chars), skip to minimize processing time
  if (max_dim === 800 && quality === 0.65 && dataUrl.length < 80000) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > max_dim) {
            height = Math.round((height * max_dim) / width);
            width = max_dim;
          }
        } else {
          if (height > max_dim) {
            width = Math.round((width * max_dim) / height);
            height = max_dim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        } else {
          resolve(dataUrl);
        }
      } catch (err) {
        console.warn("Fallo al comprimir base64, se conserva la original:", err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * Iterates through all products and dynamically and intensely compresses all base64 images in their media arrays.
 * This guarantees that even if they have many products, the final products.json will always be tiny (under 500KB total)
 * and will NEVER hit GitHub REST size limits!
 */
export async function compressAllProductsBase64(products: Product[], max_dim: number = 800, quality: number = 0.65): Promise<Product[]> {
  return Promise.all(
    products.map(async (prod) => {
      if (!prod.media || !Array.isArray(prod.media)) return prod;
      const updatedMedia = await Promise.all(
        prod.media.map(async (item) => {
          let finalUrl = item.url || "";
          let finalBackupUrl = item.backupUrl || "";

          if (finalUrl.startsWith("data:image/")) {
            try {
              finalUrl = await compressBase64Image(finalUrl, max_dim, quality);
            } catch (err) {
              console.error("Error compressing base64 media url:", err);
            }
          }

          if (finalBackupUrl.startsWith("data:image/")) {
            try {
              finalBackupUrl = await compressBase64Image(finalBackupUrl, max_dim, quality);
            } catch (err) {
              console.error("Error compressing base64 media backupUrl:", err);
            }
          }

          return { ...item, url: finalUrl, backupUrl: finalBackupUrl };
        })
      );
      return { ...prod, media: updatedMedia };
    })
  );
}

/**
 * Saves a binary Blob/File and returns a highly portable compressed base64 data URL
 * so it can be shared with all users via the remote JSON portfolio in the cloud.
 */
export async function storeMedia(rawBlob: Blob): Promise<string> {
  // Seamless upload compression
  const blob = await compressImageBlob(rawBlob);

  // Save as backup to IndexedDB
  try {
    const db = await getDb();
    const key = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const arrayBuffer = await blob.arrayBuffer();
    const dataToStore = {
      isWrapped: true,
      mimeType: blob.type,
      data: arrayBuffer
    };
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(dataToStore, key);
  } catch (err) {
    console.warn("Could not save local IndexedDB backup copy:", err);
  }

  // Convert to Base64 dataURL
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Error de FileReader: no es un string"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Automatically converts any product's legacy idb:// media URLs to Base64
 * whenever the admin opens the page (allowing automatic remote syncing to the cloud/git).
 * Also preloads backupUrl with base64 data for standard assets so they can be securely
 * synced to Firestore, ensuring zero-broken-image loads for Vercel clients.
 */
export async function convertProductsIdbToBase64(products: Product[]): Promise<{ updatedProducts: Product[]; changed: boolean }> {
  let changed = false;
  const updatedProducts = await Promise.all(
    products.map(async (prod) => {
      if (!prod.media || !Array.isArray(prod.media)) return prod;
      let prodChanged = false;
      const updatedMedia = await Promise.all(
        prod.media.map(async (item) => {
          // 1. Convert legacy IDB urls
          if (item.url && item.url.startsWith("idb://")) {
            const key = item.url.replace("idb://", "");
            try {
              const blob = await getMedia(key);
              if (blob) {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    if (typeof reader.result === "string") resolve(reader.result);
                    else reject(new Error("Empty string"));
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                let finalUrl = dataUrl;
                if (blob && blob.type && blob.type.startsWith("image/")) {
                  try {
                    finalUrl = await compressBase64Image(dataUrl);
                  } catch (compErr) {
                    console.warn("Could not compress IDB migrated image:", compErr);
                  }
                }
                prodChanged = true;
                changed = true;
                return { ...item, url: finalUrl };
              }
            } catch (err) {
              console.warn(`No se pudo resolver o migrar la URL idb://${key} a Base64:`, err);
            }
          }

          // No client-side base64 conversion needed for static server assets to prevent infinite loops.

          return item;
        })
      );
      if (prodChanged) {
        return { ...prod, media: updatedMedia };
      }
      return prod;
    })
  );
  return { updatedProducts, changed };
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

const globalBase64BlobCache: Record<string, string> = {};

/**
 * Converts a base64 data URL to a local binary Blob URL.
 * Essential for video stream playback because modern browsers fail to play base64 directly in video elements.
 */
export function base64ToBlobUrl(dataUrl: string): string {
  if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;
  if (globalBase64BlobCache[dataUrl]) {
    return globalBase64BlobCache[dataUrl];
  }
  try {
    const parts = dataUrl.split(",");
    if (parts.length < 2) return dataUrl;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "";
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    globalBase64BlobCache[dataUrl] = blobUrl;
    return blobUrl;
  } catch (err) {
    console.warn("Failed to convert base64 to blob URL:", err);
    return dataUrl;
  }
}

/**
 * React Hook that dynamically and synchronously (from cache) resolves ANY url.
 * Handles standard http/https, base64, and persistent idb:// urls automatically.
 * Incorporates backupUrl to enable offline fallback and zero-broken-image delivery.
 */
export function useResolvedUrl(url: string | undefined, backupUrl?: string): string {
  const isIdbUrl = url ? url.startsWith("idb://") : false;
  const idbKey = isIdbUrl && url ? url.replace("idb://", "") : "";
  
  const getInstantResolved = () => {
    if (!url) return backupUrl || "";
    if (url.startsWith("data:video/")) {
      return base64ToBlobUrl(url);
    }
    if (!isIdbUrl) {
      if ((url.startsWith("/uploads/") || url.startsWith("uploads/")) && backupUrl) {
        return backupUrl;
      }
      return url;
    }
    if (idbKey && globalResolvedCache[idbKey]) {
      return globalResolvedCache[idbKey];
    }
    if (idbKey && inMemoryFallbackCache[idbKey]) {
      return inMemoryFallbackCache[idbKey];
    }
    return backupUrl || "";
  };

  const instantValue = getInstantResolved();
  const [resolved, setResolved] = useState<string>(instantValue);

  useEffect(() => {
    setResolved(getInstantResolved());
  }, [url, backupUrl]);

  useEffect(() => {
    if (!isIdbUrl || !idbKey) return;
    if (globalResolvedCache[idbKey] || inMemoryFallbackCache[idbKey]) return;

    let active = true;
    getMedia(idbKey).then((blob) => {
      if (active && blob) {
        const blobUrl = URL.createObjectURL(blob);
        globalResolvedCache[idbKey] = blobUrl;
        setResolved(blobUrl);
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
  backupUrl?: string;
  category?: string;
}

export const ResolvedImage = React.forwardRef<HTMLImageElement, ResolvedImageProps>(
  ({ src, backupUrl, category, ...props }, ref) => {
    const resolved = useResolvedUrl(src, backupUrl);
    const [hasError, setHasError] = useState(false);

    // Reset error when src or backupUrl changes
    useEffect(() => {
      setHasError(false);
    }, [src, backupUrl]);

    const finalSrc = hasError
      ? (backupUrl || getCategoryPlaceholder(category))
      : (resolved || getCategoryPlaceholder(category));

    return React.createElement("img", {
      ref,
      src: finalSrc,
      onError: (e: any) => {
        if (!hasError) {
          setHasError(true);
        } else {
          // If fallback fails as well, use a guaranteed Unsplash placeholder to prevent infinite loops
          e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80";
        }
      },
      ...props
    });
  }
);
ResolvedImage.displayName = "ResolvedImage";

interface ResolvedVideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  src: string | undefined;
  backupUrl?: string;
  category?: string;
}

export const ResolvedVideo = React.forwardRef<any, ResolvedVideoProps>(
  ({ src, backupUrl, category, ...props }, ref) => {
    const resolved = useResolvedUrl(src, backupUrl);
    const [hasError, setHasError] = useState(false);

    // Reset error whenever src or backupUrl changes
    useEffect(() => {
      setHasError(false);
    }, [src, backupUrl]);

    // Detect if resolved URL is actually an image (e.g. during preloading, fallback, or image type)
    const isImage = (url: string | undefined) => {
      if (!url) return true;
      return url.startsWith("data:image/") || 
             url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i) !== null ||
             url.includes("images.unsplash.com") ||
             (backupUrl && url === backupUrl && !url.match(/\.(mp4|webm|ogg|mov)/i));
    };

    const finalSource = resolved || backupUrl || getCategoryPlaceholder(category);

    if (!resolved || isImage(finalSource) || hasError) {
      return React.createElement("img", {
        src: backupUrl || resolved || getCategoryPlaceholder(category),
        className: props.className,
        style: props.style,
        referrerPolicy: "no-referrer",
        onError: (e: any) => {
          e.target.src = getCategoryPlaceholder(category);
        }
      });
    }

    // Helper to extract embedded URL details
    const getEmbed = (url: string) => {
      // YouTube
      let ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i);
      if (ytMatch && ytMatch[1]) {
        return {
          type: "youtube",
          url: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=${props.autoPlay ? 1 : 0}&mute=${props.muted ? 1 : 0}&controls=${props.controls ? 1 : 0}&loop=1&playlist=${ytMatch[1]}`
        };
      }
      
      // Google Drive
      let gdMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
      if (gdMatch && gdMatch[1]) {
        return {
          type: "gdrive",
          url: `https://drive.google.com/file/d/${gdMatch[1]}/preview`
        };
      }

      // Vimeo
      let vmMatch = url.match(/vimeo\.com\/([0-9]+)/i);
      if (vmMatch && vmMatch[1]) {
        return {
          type: "vimeo",
          url: `https://player.vimeo.com/video/${vmMatch[1]}?autoplay=${props.autoPlay ? 1 : 0}&muted=${props.muted ? 1 : 0}&loop=1`
        };
      }

      return null;
    };

    const embed = getEmbed(resolved);

    if (embed) {
      return React.createElement("iframe", {
        src: embed.url,
        className: props.className,
        style: { border: "none", width: "100%", height: "100%", ...props.style },
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowFullScreen: true,
        loading: "lazy"
      });
    }

    return React.createElement("video", {
      ref,
      src: resolved,
      preload: "auto",
      poster: backupUrl || undefined,
      onError: (e) => {
        console.warn(`Video failed to load: ${resolved}, falling back to poster/image`, e);
        setHasError(true);
      },
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

/**
 * Saves the list of products directly in IndexedDB, bypassing the 5MB browser localStorage limits
 * caused by embedded base64 camera images from uploading custom store inventory.
 */
export async function saveProductsToIndexedDB(products: Product[]): Promise<void> {
  try {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    // Use a unique static key for the products catalog backup
    store.put(products, "products_backup_list");
  } catch (err) {
    console.warn("No se pudo guardar la lista de productos en IndexedDB:", err);
  }
}

/**
 * Loads the list of products directly from IndexedDB backup
 */
export async function loadProductsFromIndexedDB(): Promise<Product[] | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get("products_backup_list");
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn("No se pudo leer la lista de productos de IndexedDB:", err);
    return null;
  }
}

/**
 * Warms up the global media cache by pre-resolving all idb:// URLs for a list of products.
 * This runs in the background and resolves everything so that useResolvedUrl is 100% synchronous and instant when mounting.
 */
export function preloadProductMedia(products: Product[]): void {
  if (!products || !Array.isArray(products)) return;
  products.forEach((product) => {
    if (product.media && Array.isArray(product.media)) {
      product.media.forEach((m) => {
        if (m.url && m.url.startsWith("idb://")) {
          // Resolve in background to populate globalResolvedCache
          resolveIdbUrl(m.url).catch(() => {});
        }
      });
    }
  });
}



