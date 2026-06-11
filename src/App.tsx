/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import HeroSlider from "./components/HeroSlider";
import ProductCard from "./components/ProductCard";
import SlideOutCart from "./components/SlideOutCart";
import ProductDetailsModal from "./components/ProductDetailsModal";
import CheckoutModal from "./components/CheckoutModal";
import AdminPanel from "./components/AdminPanel";
import OrderTracker from "./components/OrderTracker";
import { INITIAL_PRODUCTS, PRESET_REVIEWS } from "./data";
import { Product, CartItem, BankDetails } from "./types";
import { convertProductsIdbToBase64, saveProductsToIndexedDB, loadProductsFromIndexedDB, preloadProductMedia, getApiUrl } from "./indexedDbMedia";
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc, onSnapshot, disableNetwork } from "firebase/firestore";
import { db, cleanObjectForFirestore } from "./firebase";
import { Instagram, Star, Landmark, ShieldCheck, Heart, ArrowRight, MessageCircle, Play, Sparkles, Filter, Check, Gift, Volume2, VolumeX, Truck, ShoppingCart } from "lucide-react";

// Helper to resolve image urls, stripping the local server proxy prefix if run in static hosts (Vercel, GitHub Pages) and routing through high-performance CDN
export function resolveImageUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("/api/image-proxy?url=")) {
    return decodeURIComponent(url.replace("/api/image-proxy?url=", ""));
  }
  let resolvedUrl = url;
  if (resolvedUrl && !resolvedUrl.startsWith("/") && !resolvedUrl.startsWith("http") && !resolvedUrl.startsWith("data:") && !resolvedUrl.startsWith("idb://") && !resolvedUrl.startsWith("blob:")) {
    resolvedUrl = "/" + resolvedUrl;
  }

  if (resolvedUrl && (resolvedUrl.startsWith("/uploads/") || resolvedUrl.startsWith("uploads/"))) {
    const filename = resolvedUrl.split("/").pop();
    if (filename) {
      const isLocalOrPreview = window.location.hostname.includes("run.app") || 
                               window.location.hostname.includes("localhost") || 
                               window.location.hostname.includes("127.0.0.1");
      
      // Safe localStorage lookup
      let localRepo = "";
      let localBranch = "main";
      try {
        localRepo = localStorage.getItem("github_sync_repo") || "";
        localBranch = localStorage.getItem("github_sync_branch") || "main";
      } catch (_) {}

      if (!isLocalOrPreview) {
        const gConfig = (window as any).__GITHUB_CONFIG__;
        const fallbackBackend = "https://ais-pre-ph66dlmv5s32y4wf423upe-513897801395.us-east1.run.app";
        const backend = (gConfig && gConfig.backendUrl) ? gConfig.backendUrl : fallbackBackend;
        
        if (localRepo) {
          return `https://raw.githubusercontent.com/${localRepo}/${localBranch}/public/uploads/${filename}`;
        }
        return `${backend}/uploads/${filename}`;
      }

      if (localRepo) {
        return `https://raw.githubusercontent.com/${localRepo}/${localBranch}/public/uploads/${filename}`;
      }
      return `/uploads/${filename}`;
    }
  }
  return resolvedUrl;
}

// Global slugify helper to produce clean friendly URLs
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-0-9\s-]/g, "") // remove all non-alphanumeric chars except space/hyphen
    .trim()
    .replace(/\s+/g, "-") // spaces to -
    .replace(/-+/g, "-"); // merge multiple -
}

// Robust cleaner helper to completely purge old mock/trial assets from localStorage/state so only user's custom designs are loaded
const filterOutDemoProducts = (list: any[]): Product[] => {
  if (!Array.isArray(list)) return [];
  // Return list as is to preserve all custom modifications, edits, and deletions without resetting them to default shapes!
  return list.filter((p) => p && p.id && p.title);
};

let isFirestoreQuotaExceeded = false;
try {
  const quotaFlag = localStorage.getItem("firestore_quota_exceeded_date");
  if (quotaFlag === new Date().toDateString()) {
    isFirestoreQuotaExceeded = true;
    console.log("[Firestore Resiliency] Firestore is globally registered as quota-exhausted for today. Bypassing client direct connections.");
  }
} catch (_) {}

function handleFirestoreError(error: any, context: string) {
  console.warn(`[Firestore Resiliency] Error in ${context}:`, error);
  const errMsg = String(error?.message || error || "").toLowerCase();
  const errCode = String(error?.code || "").toLowerCase();
  
  if (
    errCode.includes("resource-exhausted") || 
    errCode.includes("quota") || 
    errMsg.includes("resource_exhausted") || 
    errMsg.includes("quota limit exceeded") || 
    errMsg.includes("quota exceeded") ||
    errMsg.includes("exhausted")
  ) {
    if (!isFirestoreQuotaExceeded) {
      isFirestoreQuotaExceeded = true;
      console.error("🔥 [Firestore Resiliency Alert] Firestore Free Daily Quota Exceeded! Switching client database channel to Local Offline Storage + Express Server fallback modes seamlessly.");
      try {
        localStorage.setItem("firestore_quota_exceeded_date", new Date().toDateString());
      } catch (_) {}
      try {
        disableNetwork(db).then(() => {
          console.log("[Firestore Resiliency] Firebase Firestore network disabled successfully to prevent repetitive socket polling and retry overhead.");
        }).catch((err) => {
          console.warn("[Firestore Resiliency] Minor issue disabling firestore network:", err);
        });
      } catch (e) {
        console.warn("[Firestore Resiliency] Error triggering disableNetwork:", e);
      }
    }
    // Dispatch custom event to notify React component instantly
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("firestore-quota-exceeded"));
    }
  }
}

export default function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("is_admin_mode") === "true";
    } catch (_) {
      return false;
    }
  });
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [hasUserModifiedCatalog, setHasUserModifiedCatalog] = useState<boolean>(false);
  const [brokenImageProductIds, setBrokenImageProductIds] = useState<string[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(isFirestoreQuotaExceeded);

  // Initialize event listener for modern instant quota exhaustion reactive alerts
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    return () => {
      window.removeEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    };
  }, []);

  // Resilient Domain Safeguard: Automatically redirect public visitors away from Vercel/GitHub temporary preview domains
  // or inactive URLs to the official production URL (https://hogar-y-estilo.vercel.app), protecting presentation.
  useEffect(() => {
    const hostname = window.location.hostname;
    // Do NOT trigger redirect when developing or testing inside Google AI Studio container
    const isAiStudio = hostname.includes("run.app") || hostname.includes("localhost") || hostname.includes("127.0.0.1");

    if (!isAiStudio) {
      const isOfficialProd = hostname === "hogar-y-estilo.vercel.app";
      const isVercelPreview = hostname.includes(".vercel.app") && !isOfficialProd;
      
      if (isVercelPreview) {
        console.log("⚠️ Redirigiendo desde entorno preview de Vercel al de producción oficial...");
        window.location.replace("https://hogar-y-estilo.vercel.app");
      }
    }
  }, []);

  // Synchronize the master GitHub and server URL config from Firestore on startup
  useEffect(() => {
    async function fetchGithubConfig() {
      try {
        const configSnap = await getDoc(doc(db, "settings", "github_config"));
        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData) {
            console.log("⚡ [Config Sync] Loaded master GitHub and server URL settings:", configData);
            (window as any).__GITHUB_CONFIG__ = {
              repo: configData.repo || "",
              branch: configData.branch || "main",
              backendUrl: configData.backendUrl || ""
            };
            window.dispatchEvent(new CustomEvent("github-config-loaded"));
          }
        }
      } catch (err) {
        console.warn("Could not load github_config from Firestore on startup", err);
      }
    }
    fetchGithubConfig();
  }, []);

  // Automatically register the preview server's current backend URL in Firestore
  // so that public users on Vercel or Instagram can load images from this active container!
  useEffect(() => {
    async function registerLiveBackendUrl() {
      const isCloudRun = window.location.hostname.includes("run.app") || window.location.hostname.includes("localhost");
      // Allow live development sandboxes to also register as active backends during live testing sessions
      const isLocalHostOnly = window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1");
      if (isCloudRun && !isLocalHostOnly && db) {
        try {
          const docRef = doc(db, "settings", "github_config");
          const snap = await getDoc(docRef);
          const currentData = snap.exists() ? snap.data() : {};
          if (currentData.backendUrl !== window.location.origin) {
            console.log("🔄 [App Sync] Registering active server backend URL in Firestore:", window.location.origin);
            await setDoc(docRef, {
              ...currentData,
              backendUrl: window.location.origin
            }, { merge: true });
          }
        } catch (err) {
          console.warn("Could not register live backend URL:", err);
        }
      }
    }
    const timer = setTimeout(() => {
      registerLiveBackendUrl();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Background media preloader to ensure zero-latency video/image visual styling is ready on mount!
  useEffect(() => {
    if (products && products.length > 0) {
      preloadProductMedia(products);
    }
  }, [products]);

  // Fetch products from backend server or Cloud Firestore on mount with high-performance instant-local rendering
  useEffect(() => {
    async function loadCatalog() {
      console.log("[Catalog Loader] Initializing consolidated catalog startup loader...");
      
      // 1. First, load whatever we have in local browser storage (IndexedDB & LocalStorage)
      let loadedLocal: Product[] = [];
      try {
        const idbProducts = await loadProductsFromIndexedDB();
        if (idbProducts && Array.isArray(idbProducts)) {
          loadedLocal = filterOutDemoProducts(idbProducts);
        }
      } catch (err) {
        console.warn("Read error from IndexedDB on startup:", err);
      }
      
      if (loadedLocal.length === 0) {
        const saved = localStorage.getItem("store_products_list");
        if (saved) {
          try {
            loadedLocal = filterOutDemoProducts(JSON.parse(saved));
          } catch (_) {}
        }
      }
      console.log(`[Catalog Loader] Local browser storage holds ${loadedLocal.length} products.`);

      // OPTIMIZATION: Instant non-blocking UI render of local products so users see catalog in 0ms!
      if (loadedLocal.length > 0) {
        setProducts(loadedLocal);
        setHasLoadedInitial(true);
      }

      // 2. Query cloud sources with strict timeouts to prevent hangs
      const fetchCloudAndServer = async () => {
        let loadedCloud: Product[] = [];
        const cloudMap = new Map<string, Product>();

        // Query Firestore with 2.5 second timeout
        const firestorePromise = async () => {
          if (!isFirestoreQuotaExceeded) {
            try {
              console.log("[Catalog Loader] Fetching master catalog from Cloud Firestore...");
              const docPromise = getDoc(doc(db, "settings", "catalog_master"));
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Firestore timeout")), 2500)
              );
              const docSnap = (await Promise.race([docPromise, timeoutPromise])) as any;

              let found = false;
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && data.products && Array.isArray(data.products)) {
                  data.products.forEach((p: Product) => {
                    if (p && p.id) {
                      cloudMap.set(p.id, p);
                    }
                  });
                  found = true;
                  console.log(`[Catalog Loader] Cloud Firestore catalog_master returned ${cloudMap.size} products.`);
                }
              }

              // Fallback to traditional individual collection query if catalog_master does not exist
              if (!found) {
                console.log("[Catalog Loader] catalog_master not found, falling back to products collection...");
                const collPromise = getDocs(collection(db, "products"));
                const querySnapshot = (await Promise.race([collPromise, timeoutPromise])) as any;
                querySnapshot.forEach((docSnap: any) => {
                  const p = docSnap.data() as Product;
                  if (p && p.id) {
                    cloudMap.set(p.id, p);
                  }
                });
                console.log(`[Catalog Loader] Fallback collection returned ${cloudMap.size} products.`);
              }
            } catch (fbErr) {
              console.warn("[Catalog Loader] Firestore connection timed out or failed. Falling back.", fbErr);
              handleFirestoreError(fbErr, "loadCatalog");
            }
          }
        };

        // Query Fallback local server API with 3.5 second timeout
        const serverPromise = async () => {
          try {
            console.log("[Catalog Loader] Fetching from fallback server API...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(getApiUrl("/api/products"), { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
              const data = await res.json();
              if (data && Array.isArray(data)) {
                data.forEach((p: Product) => {
                  if (p && p.id) {
                    cloudMap.set(p.id, p);
                  }
                });
                console.log(`[Catalog Loader] Backup server API retrieved ${data.length} products.`);
              }
            }
          } catch (err) {
            console.warn("[Catalog Loader] Fallback server fetch timed out or failed:", err);
          }
        };

        // Run both async fetches in parallel so they don't block each other
        await Promise.allSettled([firestorePromise(), serverPromise()]);

        loadedCloud = filterOutDemoProducts(Array.from(cloudMap.values()));

        // 3. Smart Merge conflict resolution (Combining local products with cloud products)
        if (loadedCloud.length > 0) {
          const mergedMap = new Map<string, Product>();

          // Start with local browser products as basic background baseline
          loadedLocal.forEach((p) => {
            if (p && p.id) mergedMap.set(p.id, p);
          });

          // Overwrite with prestigious, authoritative database cloud products (so cloud status/processed URLs always overwrite legacy IDB references!)
          loadedCloud.forEach((p) => {
            if (p && p.id) {
              mergedMap.set(p.id, p);
            }
          });

          const mergedList = Array.from(mergedMap.values());
          
          let deletedCustomIds = new Set<string>();
          try {
            const deletedStr = localStorage.getItem("deleted_custom_product_ids");
            if (deletedStr) {
              deletedCustomIds = new Set(JSON.parse(deletedStr));
            }
          } catch (_) {}

          const finalMerged = mergedList.filter((p) => {
            if (p.isCustom && deletedCustomIds.has(p.id)) {
              return false; // Filter out explicitly deleted custom product
            }
            return true;
          });

          const finalProducts = finalMerged.length > 0 ? finalMerged : INITIAL_PRODUCTS;
          setProducts(finalProducts);
        } else {
          // 4. Auto-heal / Fallback: If cloud was empty, fall back to local items or compiled INITIAL_PRODUCTS
          const finalProducts = loadedLocal.length > 0 ? loadedLocal : INITIAL_PRODUCTS;
          setProducts(finalProducts);

          // ONLY trigger self-healing if the user is authenticated as the admin!
          const isCurrentlyAdmin = sessionStorage.getItem("is_admin_mode") === "true";
          if (loadedLocal.length > 0 && isCurrentlyAdmin) {
            console.log("[Catalog Loader] Self-healing: Re-populating out-of-sync backend server with local catalog...");
            fetch(getApiUrl("/api/products"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ products: finalProducts })
            }).catch((err) => console.warn("[Catalog Loader] Failed to automatically sync catalog to server:", err));
          }
        }

        setHasLoadedInitial(true);
      };

      // Run parallel background cloud/server load
      fetchCloudAndServer();

      // 5. Run Base64 converter to make sure media structures are up-to-date
      convertProductsIdbToBase64(loadedLocal.length > 0 ? loadedLocal : INITIAL_PRODUCTS).then(({ updatedProducts, changed }) => {
        if (changed) {
          setProducts(updatedProducts);
          console.log("[Catalog Loader] Migrated loaded catalog images to full Base64!");
        }
      });
    }

    loadCatalog();
  }, []);

  // Sync state to local storage, IndexedDB, Firebase Firestore and fallback server whenever modified with 2.5s debouncing
  useEffect(() => {
    if (!hasLoadedInitial) return;
    if (!hasUserModifiedCatalog) {
      console.log("[Sync Loop] Bypassing automatic storage write. No modifications made yet in this session.");
      return;
    }

    let active = true;
    let syncTimer: any = null;

    async function runSync() {
      // 1. Proactively convert any local idb:// URLs in products to Base64 dataURL
      // This is crucial so that Firestore and the backup server receive proper standard images.
      const { updatedProducts, changed } = await convertProductsIdbToBase64(products);
      if (!active) return;

      if (changed) {
        console.log("[Sync Loop] Detected unconverted idb:// media. Migrating to Base64 before cloud sync.");
        setProducts(updatedProducts);
        return; // The state change will re-trigger this useEffect.
      }

      // 2. Persist to IndexedDB instantly (virtually unlimited size, client-side, ultra-fast)
      saveProductsToIndexedDB(products);

      // 3. Persist to LocalStorage instantly (5MB limit fallback)
      try {
        localStorage.setItem("store_products_list", JSON.stringify(products));
      } catch (e) {
        console.warn("No se pudo persistir la lista de productos en localStorage (es posible que exceda la cuota por las imágenes base64, pero se guardó con éxito en IndexedDB):", e);
      }

      // GUARD: Only authenticated admin can sync or write changes back to the cloud/backup databases.
      // This prevents customers' browsers from accidentally overwriting or cleaning up the authoritative database catalog!
      if (!isAdminAuthenticated) {
        console.log("[Sync Loop] Customer view detected. Bypassing cloud Firestore & backup server write operations.");
        return;
      }

      // 4. DEBOUNCE the heavy and slow cloud database network transactions by 2.5 seconds!
      // This prevents lagging the UI with repeated expensive Firebase reads/writes and HTTP fetch payloads during transitions.
      syncTimer = setTimeout(async () => {
        if (!active) return;

        // A. Persist directly to Firebase Cloud Firestore
        if (!isFirestoreQuotaExceeded) {
          try {
            console.log("[Firestore Sync] Started debounced sync of master catalog to Firestore...");
            if (!active) return;
            const cleanedProducts = cleanObjectForFirestore(products);
            const docRef = doc(db, "settings", "catalog_master");
            await setDoc(docRef, { products: cleanedProducts }, { merge: true });

            console.log(`[Firestore Sync] Debounced Firestore match successful. Synchronized entire catalog of ${products.length} products inside single-doc catalog_master.`);
          } catch (fbSyncErr) {
            console.warn("[Firestore Sync] Error during Firestore sync:", fbSyncErr);
            handleFirestoreError(fbSyncErr, "syncToCloudFirestore");
          }
        }

        // B. Persist to Express/Vercel backup server API
        try {
          console.log("[Backup Server Sync] Sending debounced update package to catalog backup API...");
          const controller = new AbortController();
          const localTimeoutId = setTimeout(() => controller.abort(), 4000);
          
          const response = await fetch(getApiUrl("/api/products"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ products }),
            signal: controller.signal
          });
          clearTimeout(localTimeoutId);
          
          if (!response.ok) {
            throw new Error(`Catalog API responded with HTTP status ${response.status}`);
          }
          const res = await response.json();
          if (!active) return;

          console.log("[Backup Server Sync] Portafolio sincronizado en el servidor:", res);

          // OPTIMIZATION: If the server successfully extracted large base64 media into static persistent server files,
          // update our frontend React state to use these URLs instead of holding the giant raw base64 string in memory.
          if (res.success && res.products && Array.isArray(res.products)) {
            let hasChanges = false;
            const currentUrls = products.flatMap(p => (p.media || []).map(m => m.url));
            const newUrls = res.products.flatMap((p: any) => (p.media || []).map((m: any) => m.url));

            if (currentUrls.length === newUrls.length) {
              for (let i = 0; i < currentUrls.length; i++) {
                if (currentUrls[i] !== newUrls[i]) {
                  hasChanges = true;
                  break;
                }
              }
            } else {
              hasChanges = true;
            }

            if (hasChanges) {
              console.log("[Media Extractor] Updating reactive state with converted server static assets:", res.products);
              setProducts(res.products);
            }
          }
        } catch (err) {
          console.warn("[Backup Server Sync] Error sending changes to backup catalog server:", err);
        }
      }, 2500);
    }

    runSync();

    return () => {
      active = false;
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
    };
  }, [products, hasLoadedInitial, isAdminAuthenticated, hasUserModifiedCatalog]);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab ] = useState<"shop" | "admin" | "tracker">("shop");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [isExpanded, setIsExpanded] = useState(false);

  // Elegant floating toast state for non-blocking notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Dynamic Google SEO and Structured Keywords Parser & Loader
  useEffect(() => {
    try {
      if (selectedProduct) {
        // Individual Product View SEO Optimization
        document.title = `${selectedProduct.title} | Hogar y Estilo`;
        
        // Dynamically create or update <meta name="description">
        let descMeta = document.querySelector('meta[name="description"]');
        if (!descMeta) {
          descMeta = document.createElement("meta");
          descMeta.setAttribute("name", "description");
          document.head.appendChild(descMeta);
        }
        const plainDesc = selectedProduct.description
          ? selectedProduct.description.replace(/[#*`_]/g, "").slice(0, 160)
          : `Detalles, especificaciones y envío de ${selectedProduct.title} en Hogar y Estilo.`;
        descMeta.setAttribute("content", `${plainDesc}...`);

        // Dynamically load Google/Bing search index keywords (SEO features)
        let keywordsMeta = document.querySelector('meta[name="keywords"]');
        if (!keywordsMeta) {
          keywordsMeta = document.createElement("meta");
          keywordsMeta.setAttribute("name", "keywords");
          document.head.appendChild(keywordsMeta);
        }
        const keywords = selectedProduct.features && selectedProduct.features.length > 0
          ? selectedProduct.features.join(", ")
          : `${selectedProduct.category.toLowerCase()}, hogar y estilo, decoración rosario, bazar premium`;
        keywordsMeta.setAttribute("content", keywords);
      } else {
        // Main Catalog Category SEO optimization
        const categoryLabel = selectedCategory === "Todos" 
          ? "Decoración y Bazar en Rosario" 
          : `${selectedCategory} - Diseño y Bazar`;
        document.title = `${categoryLabel} | Hogar y Estilo`;

        // Default or Category Description
        let descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) {
          descMeta.setAttribute(
            "content",
            `Descubrí nuestra colección premium de ${selectedCategory.toLowerCase()} en Hogar y Estilo. Envíos a todo el país. Selección de objetos de diseño para lograr un hogar cálido y único de Rosario.`
          );
        }

        // Aggregate product keywords into massive collective SEO keywords tags for Google bots
        let keywordsMeta = document.querySelector('meta[name="keywords"]');
        if (!keywordsMeta) {
          keywordsMeta = document.createElement("meta");
          keywordsMeta.setAttribute("name", "keywords");
          document.head.appendChild(keywordsMeta);
        }
        
        const productTitles = (products || [])
          .slice(0, 15)
          .map(p => p.title.toLowerCase())
          .join(", ");
        
        const baseTags = "hogar y estilo, decoración rosario, bazar rosario, organizadores de cocina, diseño nórdico, estilo japandi, envíos argentina";
        keywordsMeta.setAttribute("content", productTitles ? `${baseTags}, ${productTitles}` : baseTags);
      }

      // JSON-LD dynamic script updating for advanced Google Search listing
      let existingSchema = document.getElementById("hogar-estilo-seo-schema");
      if (existingSchema) {
        existingSchema.remove();
      }

      const script = document.createElement("script");
      script.id = "hogar-estilo-seo-schema";
      script.type = "application/ld+json";

      let schemaData: any = {};
      
      if (selectedProduct) {
        schemaData = {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": selectedProduct.title,
          "description": selectedProduct.description.replace(/[#*`_]/g, "").slice(0, 200),
          "category": selectedProduct.category,
          "image": selectedProduct.media?.map(m => m.url) || [],
          "brand": {
            "@type": "Brand",
            "name": "Hogar y Estilo"
          },
          "offers": {
            "@type": "Offer",
            "priceCurrency": "ARS",
            "price": selectedProduct.basePrice,
            "availability": selectedProduct.paused ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"
          },
          "keywords": selectedProduct.features?.join(", ") || ""
        };
      } else {
        schemaData = {
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Hogar y Estilo | Bazar y Decoración de Diseño",
          "description": "Tienda premium de dropshipping y diseño con base en Rosario, Santa Fe. Envíos con repuesto de regalo gratis en todas las compras.",
          "itemListElement": (products || []).slice(0, 12).map((p, idx) => ({
            "@type": "ListItem",
            "position": idx + 1,
            "item": {
              "@type": "Product",
              "name": p.title,
              "description": p.description.slice(0, 150).replace(/[#*`_]/g, ""),
              "image": p.media?.[0]?.url || "",
              "offers": {
                "@type": "Offer",
                "priceCurrency": "ARS",
                "price": p.basePrice
              }
            }
          }))
        };
      }

      script.textContent = JSON.stringify(schemaData);
      document.head.appendChild(script);

    } catch (seoErr) {
      console.warn("Failed to synchronize dynamic browser SEO meta parameters:", seoErr);
    }
  }, [selectedProduct, selectedCategory, products]);

  // Calculamos los productos destacados dinámicamente para la vitrina deslizable manualmente
  const showcasePhotos = products
    .filter(p => p && p.featured && !p.paused && (!brokenImageProductIds.includes(p.id) || isAdminAuthenticated))
    .map(p => ({
      url: p.media?.[0]?.url || "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=85",
      type: p.media?.[0]?.type || "image",
      backupUrl: p.media?.[0]?.backupUrl,
      title: p.title,
      desc: p.description,
      category: p.category,
      productId: p.id
    }));

  // Sticky instagram chat sim widget state
  const [showStickyChat, setShowStickyChat] = useState(true);

  // Tracking details states
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [trackerResult, setTrackerResult] = useState<any | null>(null);
  const [trackerSearchDone, setTrackerSearchDone] = useState(false);

  // Active slide index for manual presentation photos slider (Requerimiento de fotos autodesplazables cada 5 segundos)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    if (showcasePhotos.length === 0) return;
    const interval = setInterval(() => {
      setActivePhotoIndex((prev) => (prev + 1) % showcasePhotos.length);
    }, 5000); // 5 seconds interval
    return () => clearInterval(interval);
  }, [activePhotoIndex, showcasePhotos.length]);

  // Custom configured Admin Email for checkout alerts (loaded dynamically & persisted)
  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return localStorage.getItem("admin_notification_email") || "tadeobeltran1986@gmail.com";
  });

  const handleAdminEmailChange = (newEmail: string) => {
    setAdminEmail(newEmail);
    localStorage.setItem("admin_notification_email", newEmail);
  };

  // Custom configured Admin WhatsApp Phone for alerts (loaded dynamically & persisted)
  const [adminPhone, setAdminPhone] = useState<string>(() => {
    return localStorage.getItem("admin_notification_phone") || "5493416555555";
  });

  const handleAdminPhoneChange = (newPhone: string) => {
    setAdminPhone(newPhone);
    localStorage.setItem("admin_notification_phone", newPhone);
  };

  // Custom configured Admin background notification Webhook (loaded dynamically & persisted)
  const [adminWebhookUrl, setAdminWebhookUrl] = useState<string>(() => {
    return localStorage.getItem("admin_notification_webhook") || "";
  });

  const handleAdminWebhookUrlChange = (newWebhookUrl: string) => {
    setAdminWebhookUrl(newWebhookUrl);
    localStorage.setItem("admin_notification_webhook", newWebhookUrl);
  };

  // Admin access control states
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState("");

  // Analytics Metrics (Requerimiento 6 de Estadísticas)
  const [storeMetrics, setStoreMetrics] = useState(() => {
    const saved = localStorage.getItem("store_metrics_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { /* ignore */ }
    }
    return {
      viewsCount: 0,
      abandonedCartCount: 0,
      purchasesCount: 0,
      pendingDispatchesCount: 0,
    };
  });

  // Argentine common real buyer combinations for live simulation alerts (Requerimiento 4 / 7)
  // Dynamic Orders Database (Requerimiento 6 de Control de envíos)
  const [pendingOrders, setPendingOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem("store_pending_orders_list");
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { /* ignore */ }
    }
    // Pre-populate with a real sample order so that the administrator and the buyer can try the status updating loop immediately.
    return [
      {
        id: "1024",
        status: "preparing",
        trackingCode: "", // blank, so the administrator can enter CP123456789AR or similar
        items: [
          {
            quantity: 1,
            product: {
              id: "p_lamp_nordic",
              title: "Lámpara de Mesa Nórdica de Madera Real",
              basePrice: 54900,
              category: "iluminacion"
            }
          }
        ],
        details: {
          fullName: "Juan Pérez (Orden Demostración)",
          email: "juan.perez@correo.com",
          phone: "+54 341 555-1234",
          address: "Av. Pellegrini 1450, Piso 3A",
          city: "Rosario, Santa Fe",
          zipCode: "2000",
          paymentMethod: "transfer"
        },
        createdAt: new Date().toISOString()
      },
      {
        id: "1580",
        status: "shipped",
        trackingCode: "AR482103759", // Already shipped so we can test tracking ready!
        items: [
          {
            quantity: 1,
            product: {
              id: "p_bazar_set",
              title: "Set Bazar de Almacenamiento Hermético Modular",
              basePrice: 38500,
              category: "bazar"
            }
          }
        ],
        details: {
          fullName: "María Laura Gómez (Orden Demostración)",
          email: "marialaura@correo.com",
          phone: "+54 11 4321-9876",
          address: "Av. Cabildo 2400",
          city: "Capital Federal",
          zipCode: "1428",
          paymentMethod: "card"
        },
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [initialOrderId, setInitialOrderId] = useState<string>("");

  // Dynamic Bank Transfer coordinates configuration (Requerimiento de datos bancarios)
  const [bankDetails, setBankDetails] = useState<BankDetails>(() => {
    const saved = localStorage.getItem("store_bank_details");
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        // Ensure new fields exist on reload
        return {
          mpEmail: "tadeobeltran1986@gmail.com",
          mpAlias: "deco.home.rosario",
          mpLink: "",
          ...parsed
        };
      } catch (e) { /* ignore */ }
    }
    return {
      bankName: "Banco de la Nación Argentina (BNA)",
      accountHolder: "Hogar y Estilo S.H. (Rosario)",
      cbu: "0000003100012345678901",
      alias: "deco.home.rosario",
      cuit: "20-35890432-1",
      mpEmail: "tadeobeltran1986@gmail.com",
      mpAlias: "deco.home.rosario",
      mpLink: "",
    };
  });

  const lastCloudMetricsRef = React.useRef<any>(null);

  // Safe side effects persistence sync
  useEffect(() => {
    try {
      localStorage.setItem("store_metrics_data", JSON.stringify(storeMetrics));
    } catch (e) {
      console.warn("Storage error for storeMetrics:", e);
    }

    // Also sync storeMetrics with Firebase Cloud Firestore
    async function syncMetricsToCloud() {
      if (isFirestoreQuotaExceeded) {
        return;
      }
      if (
        lastCloudMetricsRef.current &&
        lastCloudMetricsRef.current.viewsCount === storeMetrics.viewsCount &&
        lastCloudMetricsRef.current.abandonedCartCount === storeMetrics.abandonedCartCount &&
        lastCloudMetricsRef.current.purchasesCount === storeMetrics.purchasesCount &&
        lastCloudMetricsRef.current.pendingDispatchesCount === storeMetrics.pendingDispatchesCount
      ) {
        // Skip writing back to the cloud because this was already identical to the last read cloud state!
        return;
      }
      try {
        lastCloudMetricsRef.current = storeMetrics;
        await setDoc(doc(db, "analytics", "global"), storeMetrics, { merge: true });
        console.log("[Firestore Analytics] Global metrics synchronized in real time:", storeMetrics);
      } catch (fbErr) {
        handleFirestoreError(fbErr, "syncMetricsToCloud");
      }
    }
    syncMetricsToCloud();
  }, [storeMetrics]);

  // Real-time Firestore subscription to update metrics instantly
  useEffect(() => {
    if (isFirestoreQuotaExceeded) {
      return () => {};
    }
    const analyticsRef = doc(db, "analytics", "global");
    const unsubscribe = onSnapshot(analyticsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const incoming = {
          viewsCount: Number(data.viewsCount || 0),
          abandonedCartCount: Number(data.abandonedCartCount || 0),
          purchasesCount: Number(data.purchasesCount || 0),
          pendingDispatchesCount: Number(data.pendingDispatchesCount || 0),
        };

        const isDifferent =
          !lastCloudMetricsRef.current ||
          lastCloudMetricsRef.current.viewsCount !== incoming.viewsCount ||
          lastCloudMetricsRef.current.abandonedCartCount !== incoming.abandonedCartCount ||
          lastCloudMetricsRef.current.purchasesCount !== incoming.purchasesCount ||
          lastCloudMetricsRef.current.pendingDispatchesCount !== incoming.pendingDispatchesCount;

        if (isDifferent) {
          lastCloudMetricsRef.current = incoming;
          setStoreMetrics(incoming);
        }
      }
    }, (err) => {
      handleFirestoreError(err, "onSnapshot real-time metrics");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("store_pending_orders_list", JSON.stringify(pendingOrders));
    } catch (e) {
      console.warn("Storage error for pendingOrders:", e);
    }
  }, [pendingOrders]);

  useEffect(() => {
    try {
      localStorage.setItem("store_bank_details", JSON.stringify(bankDetails));
    } catch (e) {
      console.warn("Storage error for bankDetails:", e);
    }
  }, [bankDetails]);

  // Page Views automatic load and global cloud increment
  useEffect(() => {
    async function loadAndIncrementViews() {
      if (isFirestoreQuotaExceeded) {
        // Instant local fallback views increment
        setStoreMetrics((prev: any) => ({
          viewsCount: (prev?.viewsCount || 0) + 1,
          abandonedCartCount: prev?.abandonedCartCount || 0,
          purchasesCount: prev?.purchasesCount || 0,
          pendingDispatchesCount: prev?.pendingDispatchesCount || 0,
        }));
        return;
      }
      try {
        const analyticsRef = doc(db, "analytics", "global");
        const docSnap = await getDoc(analyticsRef);
        
        let views = 0;
        let abandoned = 0;
        let purchases = 0;
        let pendingDispatches = 0;
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          views = data.viewsCount || 0;
          abandoned = data.abandonedCartCount || 0;
          purchases = data.purchasesCount || 0;
          pendingDispatches = data.pendingDispatchesCount || 0;
        }

        // Only increment view count if this is a real buyer/visitor (not an admin)
        const isCurrentlyAdmin = sessionStorage.getItem("is_admin_mode") === "true";
        if (!isCurrentlyAdmin) {
          views += 1;
          await setDoc(analyticsRef, {
            viewsCount: views,
            abandonedCartCount: abandoned,
            purchasesCount: purchases,
            pendingDispatchesCount: pendingDispatches,
          }, { merge: true });
        }

        const initialMetrics = {
          viewsCount: views,
          abandonedCartCount: abandoned,
          purchasesCount: purchases,
          pendingDispatchesCount: pendingDispatches,
        };
        lastCloudMetricsRef.current = initialMetrics;
        setStoreMetrics(initialMetrics);
      } catch (e) {
        handleFirestoreError(e, "loadAndIncrementViews");
        // Fallback to local increment if Firestore query fails
        setStoreMetrics((prev: any) => ({
          ...prev,
          viewsCount: (prev?.viewsCount || 0) + 1,
        }));
      }
    }
    loadAndIncrementViews();
  }, []);

  // Sync admin authentication state with sessionStorage to distinguish admin views
  useEffect(() => {
    sessionStorage.setItem("is_admin_mode", isAdminAuthenticated ? "true" : "false");
  }, [isAdminAuthenticated]);

  // Categories query set (Herramientas, Iluminación, Destacados, etc.)
  const categories = ["Todos", "Destacados", "Cocina", "Hogar", "Belleza & Cuidado Personal", "Herramientas", "Iluminación", "Niños"];

  // Handlers
  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    // Increment abandoned cart metrics (people who added to cart but haven't purchased yet this session)
    const sessionKey = `has_added_cart_${product.id}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, "true");
      setStoreMetrics((prev: any) => ({
        ...prev,
        abandonedCartCount: prev.abandonedCartCount + 1,
      }));
    }

    // Open dynamic slide-out cart drawer on add to simulate modern high-conversion e-commerce
    setIsCartOpen(true);
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === id) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== id));
  };

  const handleBuyNow = (product: Product) => {
    setCartItems([{ product, quantity: 1 }]);
    setIsCheckoutOpen(true);
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleAddCustomProduct = (newProduct: Product) => {
    setHasUserModifiedCatalog(true);
    setProducts((prev) => [newProduct, ...prev]);
    try {
      const deletedStr = localStorage.getItem("deleted_custom_product_ids");
      if (deletedStr) {
        const deletedIds = JSON.parse(deletedStr);
        const filtered = deletedIds.filter((id: string) => id !== newProduct.id);
        localStorage.setItem("deleted_custom_product_ids", JSON.stringify(filtered));
      }
    } catch (_) {}
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setHasUserModifiedCatalog(true);
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const handleDeleteProduct = (id: string) => {
    setHasUserModifiedCatalog(true);
    // Guardar el objeto completo en la papelera de reciclaje antes de filtrarlo
    const productToDelete = products.find((p) => p.id === id);
    if (productToDelete) {
      try {
        const binStr = localStorage.getItem("recycle_bin_products") || "[]";
        const bin = JSON.parse(binStr);
        if (!bin.some((p: any) => p.id === id)) {
          const updatedBin = [productToDelete, ...bin].slice(0, 15);
          localStorage.setItem("recycle_bin_products", JSON.stringify(updatedBin));
        }
      } catch (e) {
        console.warn("No se pudo guardar en la papelera", e);
      }
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
    try {
      const deletedStr = localStorage.getItem("deleted_custom_product_ids") || "[]";
      const deletedIds = JSON.parse(deletedStr);
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem("deleted_custom_product_ids", JSON.stringify(deletedIds));
      }
    } catch (e) {
      console.warn("No se pudo guardar la lista de eliminados:", e);
    }
  };

  const handleSetProducts = (newProductsOrUpdater: any) => {
    setHasUserModifiedCatalog(true);
    setProducts(newProductsOrUpdater);
  };

  const handleOrderComplete = (orderDetails: any, itemsInCart: any[], generatedOrderId?: string) => {
    const newOrder = {
      id: generatedOrderId || `ord-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString(),
      details: orderDetails,
      items: [...itemsInCart],
      status: "pending",
    };

    setPendingOrders((prev) => [newOrder, ...prev]);
    
    // Prepare a super lightweight copy of the order for fast background notification dispatch
    // Strips out multi-megabyte raw Base64 image files which can hit Vercel payload limits or stall slower mobile networks.
    const lightOrder = {
      ...newOrder,
      details: {
        ...newOrder.details,
        receiptImage: newOrder.details?.receiptImage ? "[Adjunto en Base de Datos]" : ""
      }
    };

    // Disparar Webhook / Email automático en segundo plano de forma 100% silenciosa e invisible para el comprador
    try {
      fetch(getApiUrl("/api/send-order-email"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: lightOrder,
          adminEmail,
          webhookUrl: adminWebhookUrl
        })
      })
      .then(r => r.json())
      .then(data => {
        console.log("Automatic sale notification dispatched:", data);
      })
      .catch((err) => {
        console.warn("Background notification fetch failed:", err);
      });
    } catch (e) {
      console.warn("Silent notification failed:", e);
    }
    
    // Recalculate metrics:
    // +1 Completed Purchase
    // +1 Pending Dispatches
    // -1 Abandoned Cart (since they completed it, it shouldn't count as abandoned)
    setStoreMetrics((prev: any) => ({
      ...prev,
      purchasesCount: prev.purchasesCount + 1,
      pendingDispatchesCount: prev.pendingDispatchesCount + 1,
      abandonedCartCount: Math.max(0, prev.abandonedCartCount - 1),
    }));
  };

  const handleDeleteOrder = (orderId: string) => {
    const orderToDelete = pendingOrders.find(o => o.id === orderId);
    const updatedOrders = pendingOrders.filter((ord) => ord.id !== orderId);
    setPendingOrders(updatedOrders);
    try {
      localStorage.setItem("store_pending_orders_list", JSON.stringify(updatedOrders));
    } catch (e) {
      console.warn("Storage error:", e);
    }
    
    // Si borramos un pedido pendiente, decrementamos las dispatches en cola para que duren 0
    if (orderToDelete && orderToDelete.status === "pending") {
      setStoreMetrics((prev: any) => ({
        ...prev,
        pendingDispatchesCount: Math.max(0, prev.pendingDispatchesCount - 1),
      }));
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: string, trackingCode?: string) => {
    const updatedOrders = pendingOrders.map((ord) => {
      if (ord.id === orderId) {
        return {
          ...ord,
          status,
          trackingCode: trackingCode !== undefined ? trackingCode : ord.trackingCode,
        };
      }
      return ord;
    });
    setPendingOrders(updatedOrders);
  };

  const handleResetMetrics = () => {
    const defaultStats = {
      viewsCount: 0,
      abandonedCartCount: 0,
      purchasesCount: 0,
      pendingDispatchesCount: 0,
    };
    setStoreMetrics(defaultStats);
    try {
      localStorage.setItem("store_metrics_data", JSON.stringify(defaultStats));
    } catch (e) {
      console.warn("Storage error:", e);
    }
  };

  // Secret keyboard listener to trigger admin panel access (Ctrl + Alt + A)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setShowAdminLoginModal(true);
        setAdminLoginError("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Temporary client-side runtime collection for broken images to hide them on the screen, without saving to database.
  React.useEffect(() => {
    const handleImageFailure = (e: Event) => {
      const customEvent = e as CustomEvent<{ productId: string; src?: string; backupUrl?: string }>;
      const { productId } = customEvent.detail;
      if (!productId) return;

      setBrokenImageProductIds((prev) => {
        if (prev.includes(productId)) return prev;
        console.warn(`[Image Fail Safe] Product (ID: ${productId}) has broken media. Visually pausing product in client-side runtime to preserve store professionalism.`);
        return [...prev, productId];
      });
    };

    window.addEventListener("product-image-load-failed", handleImageFailure);
    return () => window.removeEventListener("product-image-load-failed", handleImageFailure);
  }, []);

  // Reset broken image list whenever the overall products array is updated by the admin (automatic retry for any edited details)
  React.useEffect(() => {
    setBrokenImageProductIds([]);
  }, [products]);

  // Searching filter and categories
  const filteredProducts = (products || []).filter((p) => {
    if (!p) return false;
    if (p.paused) return false;
    // Keep products visible even if there is a transient file-system or network loading delay, letting our robust fallback image engine show a stylized category badge.
    const isBrokenImage = brokenImageProductIds.includes(p.id);
    const titleStr = p.title || "";
    const categoryStr = p.category || "";
    const descStr = p.description || "";

    const matchesSearch =
      titleStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      categoryStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      descStr.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = false;
    if (selectedCategory === "Todos") {
      matchesCategory = true;
    } else if (selectedCategory === "Destacados" && p.featured) {
      matchesCategory = true;
    } else if (selectedCategory === "Belleza & Cuidado Personal") {
      matchesCategory = p.category === "Belleza" || p.category === "Cuidado Personal" || p.category === "Belleza & Cuidado Personal";
    } else {
      matchesCategory = p.category === selectedCategory;
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col premium-grid-bg relative text-brand-900 font-sans selection:bg-brand-200 selection:text-brand-900 overflow-x-hidden" id="main-shop-app">
      
      {/* DECORATIVE FLOATING STICKERS (Stickers modernos y llamativos de diseño único) */}
      <div className="absolute top-28 left-4 hidden xl:block rotate-[-6deg] bg-amber-100 hover:rotate-0 hover:scale-105 transition-all text-amber-950 font-mono text-[10px] font-extrabold px-3.5 py-2 rounded-xl border-2 border-amber-300 shadow-md select-none z-30 cursor-pointer">
        🌿 15% OFF TRANSF.
      </div>
      <div className="absolute top-48 right-4 hidden xl:block rotate-[5deg] bg-sky-100 hover:rotate-0 hover:scale-105 transition-all text-sky-950 font-mono text-[10px] font-extrabold px-3.5 py-2 rounded-xl border-2 border-sky-300 shadow-md select-none z-30 cursor-pointer">
        🤝 COMPRA SEGURA MP
      </div>
      <div className="absolute bottom-1/4 left-5 hidden xl:block rotate-[8deg] bg-green-100 hover:rotate-0 hover:scale-105 transition-all text-green-950 font-mono text-[10px] font-extrabold px-3.5 py-2 rounded-xl border-2 border-green-300 shadow-md select-none z-30 cursor-pointer">
        🎨 EDICIONES EXCLUSIVAS
      </div>
      <div className="absolute bottom-1/3 right-5 hidden xl:block rotate-[-4deg] bg-rose-100 hover:rotate-0 hover:scale-105 transition-all text-rose-950 font-mono text-[10px] font-extrabold px-3.5 py-2 rounded-xl border-2 border-rose-300 shadow-md select-none z-30 cursor-pointer">
        🚚 ENVIOS GRATIS desde $50k
      </div>

      {/* 1. SEO META-INFO SEMÁNTICO */}
      {/* (Un motor de búsqueda de Google procesa la estructura semántica de HTML5 como header, main, section, article, footer) */}
      
      {/* Premium Header */}
      <Header
        cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)}
        onCartToggle={() => setIsCartOpen(!isCartOpen)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          // Auto scroll to content on tab change
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        isAdminAuthenticated={isAdminAuthenticated}
        onTriggerAdminLogin={() => {
          setShowAdminLoginModal(true);
          setAdminLoginError("");
        }}
      />

      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 py-3.5 px-4 sm:px-6 lg:px-8 text-amber-800 text-xs text-center font-medium flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 shadow-inner animate-in fade-in duration-300 z-50">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>
              <strong>Límite de cuota diaria de Firebase alcanzado.</strong> El catálogo se está sincronizando localmente y mediante copias de seguridad de GitHub de manera fluida.
            </span>
          </div>
          <a
            href="https://console.firebase.google.com/project/gen-lang-client-0389486781/firestore/databases/ai-studio-5293ee2d-c1df-4f53-96e9-eac0dcfa0ebb/data?openUpgradeDialog=true"
            target="_blank"
            referrerPolicy="no-referrer"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] text-white font-bold px-3 py-1.5 rounded-lg border-b border-amber-800 transition-all shadow-sm md:ml-2 font-mono text-[10px] uppercase tracking-wider"
          >
            Configurar Firebase / Habilitar Facturación
          </a>
        </div>
      )}

      {/* Main Content Areas */}
      <main className="flex-grow">
        {activeTab === "shop" && (
          <div className="space-y-12">
            
            {/* Elegant Hero Carousel Slider */}
            <HeroSlider 
              showcasePhotos={showcasePhotos} 
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                setIsExpanded(true);
              }} 
            />

            {/* Quality USP Grid */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Carta 1: Calidad Garantizada */}
                <div className="flex items-start gap-4 bg-amber-50/95 border border-amber-200 p-5 rounded-2xl shadow-xs">
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-800 shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-serif font-black text-amber-950 text-sm">Calidad Garantizada</h4>
                    <p className="text-xs text-amber-900 mt-1 font-semibold leading-relaxed">
                      Calidad garantizada de nuestros productos o le devolvemos su dinero de forma directa y sin complicaciones.
                    </p>
                  </div>
                </div>

                {/* Carta 2: Estilo Único */}
                <div className="flex items-start gap-4 bg-amber-50/95 border border-amber-200 p-5 rounded-2xl shadow-xs">
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-800 shrink-0">
                    <Star className="w-6 h-6 fill-amber-400 text-amber-700 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-serif font-black text-amber-950 text-sm">Estilo Único ✨</h4>
                    <p className="text-xs text-amber-900 mt-1 font-semibold leading-relaxed">
                      Seleccionamos los mejores productos de decoración, bazar y organización para lograr un hogar cálido, ordenado y con personalidad.
                    </p>
                  </div>
                </div>

                {/* Carta 3: Beneficio de Transferencia */}
                <div className="flex items-start gap-4 bg-amber-50/95 border border-amber-200 p-5 rounded-2xl shadow-xs">
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-800 shrink-0">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-serif font-black text-amber-950 text-sm">15% Off por Transferencia</h4>
                    <p className="text-xs text-amber-900 mt-1 font-semibold leading-relaxed border-l-2 border-emerald-500 pl-2">
                      Mantenemos la tasa impositiva baja. Pagando directamente por transferencia se bonifica un 15% inmediato.
                    </p>
                  </div>
                </div>
              </div>
            </section>



            {/* MAIN PORTAFOLIO PRODUCT GRID */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2" id="productos">
              {products.length === 0 ? (
                <div className="text-center py-24 px-6 bg-[#FAF9F6] rounded-2xl border border-brand-200 shadow-sm max-w-2xl mx-auto my-12 animate-in fade-in duration-500">
                  <div className="h-16 w-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto text-brand-800">
                    <Sparkles className="w-7 h-7 text-brand-900 animate-pulse" />
                  </div>
                  <h4 className="font-serif text-2xl font-bold text-brand-900 mt-6 tracking-tight">
                    Próximamente nuevos ingresos
                  </h4>
                  <p className="text-xs sm:text-sm text-brand-650 font-light mt-3 max-w-sm mx-auto leading-relaxed">
                    Estamos actualizando nuestro catálogo exclusivo. Cargando productos... Te invitamos a visitarnos nuevamente en unos minutos.
                  </p>
                  {isAdminAuthenticated ? (
                    <div className="pt-4">
                      <button
                        onClick={() => {
                          setActiveTab("admin");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="mt-4 bg-brand-900 hover:bg-black text-white px-7 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs hover:shadow-sm"
                      >
                        <span>Cargar Primer Producto</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-8 flex justify-center items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping" />
                      <span className="text-[11px] font-mono uppercase tracking-widest text-brand-500 font-bold">Actualización en tiempo real</span>
                    </div>
                  )}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-brand-200">
                  <span className="text-5xl">🌫️</span>
                  <h4 className="font-serif text-xl sm:text-2xl font-bold text-brand-900 mt-4">
                    No encontramos productos para tu búsqueda
                  </h4>
                  <p className="text-xs sm:text-sm text-brand-500 font-light mt-1.5">
                    Prueba buscando otra palabra clave o selecciona otra colección en el menú.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("Todos");
                    }}
                    className="mt-6 bg-brand-800 hover:bg-brand-900 text-white px-5 py-2 rounded-full text-xs font-medium uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Restablecer Filtros
                  </button>
                </div>
              ) : searchQuery === "" ? (
                <div className="space-y-12 text-left">
                  {/* SECCION 1: Productos Destacados (SÓLO cuando se muestra Todo) */}
                  {selectedCategory === "Todos" && filteredProducts.filter(p => p.featured).length > 0 && (
                    <div className="space-y-6" id="seccion-destacados-grilla">
                      <div className="border-l-4 border-amber-500 pl-4 py-1">
                        <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest font-bold">Selección Destacada</span>
                        <h3 className="font-serif text-2xl font-bold text-brand-900 tracking-tight">✨ Productos Estrella</h3>
                        <p className="text-xs text-brand-850 font-bold mt-0.5">Los favoritos de nuestros clientes, seleccionados por su estilo y funcionalidad.</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 font-sans">
                        {filteredProducts.filter(p => p.featured).map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={handleAddToCart}
                            onViewDetails={(p) => setSelectedProduct(p)}
                            onBuyNow={handleBuyNow}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!isExpanded ? (
                    <>
                      {/* SECCION 2: 8 Productos Destacados o En Oferta (2 filas de 4 en desktop) */}
                      {filteredProducts.filter(p => !p.featured).length > 0 && (
                        <div className="space-y-6 pt-6 border-t border-brand-100 animate-fade-in" id="seccion-resto-grilla">
                          <div className="border-l-4 border-brand-800 pl-4 py-1">
                            <span className="text-[10px] font-mono text-brand-650 uppercase tracking-widest font-bold">Oportunidades</span>
                            <h3 className="font-serif text-2xl font-bold text-brand-900 tracking-tight">🏡 Ofertas y Destacados</h3>
                            <p className="text-xs text-brand-800 font-medium mt-0.5">Explorá nuestra cuidada selección esencial en promoción para tus ambientes cotidianos.</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 font-sans">
                            {filteredProducts.filter(p => !p.featured).slice(0, 8).map((product) => (
                              <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={handleAddToCart}
                                onViewDetails={(p) => setSelectedProduct(p)}
                                onBuyNow={handleBuyNow}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* VER MÁS BUTTON */}
                      <div className="flex flex-col items-center justify-center pt-10 border-t border-brand-100 max-w-5xl mx-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setIsExpanded(true);
                            setTimeout(() => {
                              const el = document.getElementById("seccion-categorias-expandidas");
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "start" });
                              }
                            }, 150);
                          }}
                          className="bg-brand-900 hover:bg-black text-brand-100 hover:text-white font-serif font-bold text-sm tracking-wide px-8 py-4 sm:py-5 rounded-full transition-all flex items-center gap-2.5 cursor-pointer shadow-md transform hover:scale-[1.03] active:scale-[0.98]"
                        >
                          <span>Ver más categorías y productos 📂</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* SECCION CATEGORIAS EXPANIDAS (Despliega secciones por categoría y "Ver Todos") */
                    <div className="space-y-12 pt-8 border-t-2 border-dashed border-brand-200 mt-8 animate-fade-in" id="seccion-categorias-expandidas">
                      
                      {/* Category Selection Filter bar */}
                      {products.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-brand-200 pb-2">
                            <Filter className="w-4 h-4 text-brand-600" />
                            <span className="font-bold text-brand-800 text-xs uppercase tracking-widest">
                              Explorá por Secciones Especiales
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {categories.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => {
                                  setSelectedCategory(cat);
                                  setTimeout(() => {
                                    const el = document.getElementById("seccion-categorias-expandidas");
                                    if (el) {
                                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }
                                  }, 60);
                                }}
                                className={`px-4 sm:px-4.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all border cursor-pointer ${
                                  selectedCategory === cat
                                    ? "bg-brand-900 text-white border-brand-900"
                                    : "bg-white text-brand-700 hover:text-brand-900 hover:bg-brand-100 border-brand-200"
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rendering of categories inside expanded Workspace */}
                      {selectedCategory === "Todos" ? (
                        <div className="space-y-12">
                          {["Cocina", "Hogar", "Belleza & Cuidado Personal", "Herramientas", "Iluminación", "Niños"].map((catName) => {
                            const catProducts = catName === "Belleza & Cuidado Personal"
                              ? filteredProducts.filter((p) => p.category === "Belleza" || p.category === "Cuidado Personal" || p.category === "Belleza & Cuidado Personal")
                              : filteredProducts.filter((p) => p.category === catName);
                              
                            if (catProducts.length === 0) return null;
                            
                            let emoji = "📦";
                            if (catName === "Cocina") emoji = "🍳";
                            else if (catName === "Hogar") emoji = "🛋️";
                            else if (catName === "Belleza & Cuidado Personal") emoji = "🧴💄";
                            else if (catName === "Herramientas") emoji = "🛠️";
                            else if (catName === "Iluminación") emoji = "💡";
                            else if (catName === "Niños") emoji = "🧸";

                            return (
                              <div key={catName} className="space-y-6 pt-6 border-t border-brand-100">
                                <div className="border-l-4 border-brand-800 pl-4 py-1">
                                  <span className="text-[10px] font-mono text-brand-500 uppercase tracking-widest font-bold">Catálogo</span>
                                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-brand-900 tracking-tight">
                                    {emoji} Sección de {catName}
                                  </h3>
                                  <p className="text-xs text-brand-500 font-light mt-0.5 font-sans">Nuestros mejores artículos elegidos para {catName.toLowerCase()}.</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 font-sans">
                                  {catProducts.map((product) => (
                                    <ProductCard
                                      key={product.id}
                                      product={product}
                                      onAddToCart={handleAddToCart}
                                      onViewDetails={(p) => setSelectedProduct(p)}
                                      onBuyNow={handleBuyNow}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          {/* Extra Catalog Fallback items */}
                          {filteredProducts.filter(p => !p.featured).length > 8 && (
                            <div className="space-y-6 pt-6 border-t border-brand-100">
                              <div className="border-l-4 border-stone-600 pl-4 py-1">
                                <span className="text-[10px] font-mono text-brand-500 uppercase tracking-widest font-bold font-sans">Catálogo Completo</span>
                                <h3 className="font-serif text-xl sm:text-2xl font-bold text-brand-900 tracking-tight">🏡 Más de Nuestro Catálogo Completo</h3>
                                <p className="text-xs text-brand-500 font-light mt-0.5">Todos los productos adicionales que tenemos disponibles.</p>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 font-sans">
                                {filteredProducts.filter(p => !p.featured).slice(8).map((product) => (
                                  <ProductCard
                                    key={product.id}
                                    product={product}
                                    onAddToCart={handleAddToCart}
                                    onViewDetails={(p) => setSelectedProduct(p)}
                                    onBuyNow={handleBuyNow}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Single selected category inside expanded area */
                        <div className="space-y-6 text-left">
                          <div className="border-l-4 border-brand-900 pl-4 py-1">
                            <span className="text-[10px] font-mono text-brand-600 uppercase tracking-widest font-bold">
                              {selectedCategory === "Destacados" ? "Favoritos" : "Colección"}
                            </span>
                            <h3 className="font-serif text-2xl font-bold text-brand-900 tracking-tight">
                              {selectedCategory === "Destacados" ? "✨ Productos Estrella" : `Colección de ${selectedCategory}`}
                            </h3>
                            <p className="text-xs text-brand-500 font-light mt-0.5">
                              Mostrando {filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"}.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 font-sans">
                            {filteredProducts.map((product) => (
                              <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={handleAddToCart}
                                onViewDetails={(p) => setSelectedProduct(p)}
                                onBuyNow={handleBuyNow}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Collapse Button */}
                      <div className="flex justify-center pt-8 border-t border-brand-100/60 font-serif">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("productos");
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                            setTimeout(() => {
                              setIsExpanded(false);
                              setSelectedCategory("Todos");
                            }, 150);
                          }}
                          className="bg-brand-100 hover:bg-brand-200 border border-brand-300 text-brand-950 font-bold text-xs uppercase px-7 py-3 rounded-full cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.97]"
                        >
                          ▲ Contraer Categorías
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 text-left">
                  {/* Single Clean Filtered View for Active Searches */}
                  <div className="border-l-4 border-brand-900 pl-4 py-1">
                    <span className="text-[10px] font-mono text-brand-600 uppercase tracking-widest font-bold">
                      Resultados de Búsqueda
                    </span>
                    <h3 className="font-serif text-2xl font-bold text-brand-900 tracking-tight">
                      🔎 Productos Encontrados
                    </h3>
                    <p className="text-xs text-brand-500 font-light mt-0.5">
                      Mostrando {filteredProducts.length} resultados para tu búsqueda "{searchQuery}".
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 font-sans">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={handleAddToCart}
                        onViewDetails={(p) => setSelectedProduct(p)}
                        onBuyNow={handleBuyNow}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>



            {/* NEWS ANNOUNCEMENT: VOLVEMOS RENOVADOS INSTEAD OF REVIEWS */}
            <section className="bg-brand-100/60 border-y border-brand-200 py-16 text-center">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
                <span className="inline-flex items-center gap-1.5 bg-brand-800 text-white text-[10.5px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-xs">
                  <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                  <span>Una Nueva Etapa</span>
                </span>
                
                <h3 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-brand-900">
                  Volvemos Renovados
                </h3>
                
                <div className="h-1 w-16 bg-brand-800 rounded-full mx-auto" />
                
                <p className="text-sm sm:text-base text-brand-800 font-light leading-relaxed max-w-xl mx-auto">
                  Estamos de regreso para ofrecerte el mejor diseño, comodidad y organización. Renovamos por completo nuestra propuesta con utensilios de cocina selectos, organizadores de máxima funcionalidad y artículos de cuidado personal elegidos con amor.
                </p>
                
                <p className="text-xs text-brand-500 font-medium tracking-wide">
                  🚚 ¡Todos los envíos se entregan rápido de 2 a 5 días hábiles a todo el país!
                </p>
              </div>
            </section>

            {/* GUÍA DE COMPRA PASO A PASO: CÓMO COMPRAR (Requerimiento 5) */}
            <section className="bg-white py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest bg-brand-100 text-brand-800 py-1 px-3.5 rounded-full font-bold font-sans">Súper Simple</span>
                  <h3 className="font-serif text-3xl font-bold text-brand-900 tracking-tight">¿Cómo Comprar en la Tienda?</h3>
                  <div className="h-1 w-12 bg-brand-800 rounded-full mx-auto mt-2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
                  {/* Step 1 */}
                  <div className="bg-amber-50/90 p-6 rounded-2xl border border-amber-300 space-y-4 shadow-sm relative transition-all hover:translate-y-[-2px] hover:shadow-xs">
                    <div className="absolute top-4 right-4 text-3xl font-black font-serif text-amber-950">01</div>
                    <div className="p-3 bg-amber-900 text-amber-50 rounded-xl inline-block">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-base font-black text-amber-950">Elegí tus Productos</h4>
                      <p className="text-xs text-amber-950 font-semibold leading-relaxed">
                        Navegá por nuestro catálogo y seleccioná los artículos de bazar, bazar premium y decoración que más te gusten para renovar tu hogar.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-pink-50/90 p-6 rounded-2xl border border-pink-300 space-y-4 shadow-sm relative transition-all hover:translate-y-[-2px] hover:shadow-xs">
                    <div className="absolute top-4 right-4 text-3xl font-black font-serif text-pink-950">02</div>
                    <div className="p-3 bg-pink-600 text-pink-100 rounded-xl inline-block">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-base font-black text-pink-950">Agregá al Carrito</h4>
                      <p className="text-xs text-pink-950 font-semibold leading-relaxed">
                        Agregá productos al carrito para seguir comprando varios productos juntos, o tocá el botón de <strong>Comprar ahora</strong> para iniciar tu pedido de forma directa e inmediata.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-emerald-50/95 p-6 rounded-2xl border border-emerald-300 space-y-4 shadow-sm relative transition-all hover:translate-y-[-2px] hover:shadow-xs">
                    <div className="absolute top-4 right-4 text-3xl font-black font-serif text-emerald-950">03</div>
                    <div className="p-3 bg-emerald-600 text-emerald-100 rounded-xl inline-block">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-base font-black text-emerald-950">Elegí tu Forma de Pago</h4>
                      <p className="text-xs text-emerald-950 font-semibold leading-relaxed">
                        Aprovechá el beneficio de pagar por transferencia para obtener un <strong>15% de descuento inmediato</strong>, o pagá hasta en <strong>3 cuotas sin interés</strong> con tarjeta de crédito.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {activeTab === "tracker" && (
          <OrderTracker 
            pendingOrders={pendingOrders} 
            initialOrderId={initialOrderId}
          />
        )}

        {activeTab === "admin" && (
          /* Administration Dashboard Tab Integrated (Requerimiento 3) */
          <AdminPanel
            products={products}
            onAddProduct={handleAddCustomProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onSetProducts={handleSetProducts}
            adminEmail={adminEmail}
            onAdminEmailChange={handleAdminEmailChange}
            adminPhone={adminPhone}
            onAdminPhoneChange={handleAdminPhoneChange}
            adminWebhookUrl={adminWebhookUrl}
            onAdminWebhookUrlChange={handleAdminWebhookUrlChange}
            storeMetrics={storeMetrics}
            pendingOrders={pendingOrders}
            bankDetails={bankDetails}
            onBankDetailsChange={setBankDetails}
            onDeleteOrder={handleDeleteOrder}
            onResetMetrics={handleResetMetrics}
            showToast={showToast}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        )}
      </main>

      {/* FOOTER: LEGALES, SEO Y ENLACE EXCLUSIVO DE INSTAGRAM (Requerimientos 5 y 8) */}
      {activeTab === "shop" && (
        <footer className="bg-brand-900 text-brand-100 border-t border-brand-800 pt-12 pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Column 1: Brand & Instagram Contacts */}
              <div className="space-y-4">
                <h4 className="font-serif text-xl font-bold tracking-wide text-white">Hogar & Estilo</h4>
                <p className="text-xs text-brand-300 font-light leading-relaxed">
                  Selección exclusiva de productos prácticos de cocina, organizadores funcionales y artículos de cuidado personal elegidos para aportar calidez, orden y diseño a todos tus ambientes.
                </p>
                
                {/* Instagram Exclusive Link (Foco exclusivo en Instagram Requerimiento 5) */}
                <div className="space-y-1.5 pt-2">
                  <span className="block text-[10px] font-bold text-brand-400 uppercase tracking-widest">Contacto Exclusivo</span>
                  <a 
                    href="https://instagram.com/deco.home.rosario"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-brand-100 hover:text-white bg-brand-800 p-2.5 px-4 rounded-xl border border-brand-700 hover:border-brand-500 transition-colors cursor-pointer group"
                  >
                    <Instagram className="w-5 h-5 text-pink-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold">@deco.home.rosario</span>
                  </a>
                </div>
              </div>

              {/* Column 2: Políticas de Cambio y Devolución (Requerimientos 1 y 6) */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-brand-300">Cambios y Devoluciones</h5>
                <p className="text-[11px] text-brand-300 font-light leading-relaxed">
                  Nuestra prioridad es que ames tu compra. Si necesitás gestionar cualquier cambio o devolución, ¡escribinos directamente por Instagram a <a href="https://instagram.com/deco.home.rosario" target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline">@deco.home.rosario</a>! Te responderemos súper rápido para coordinarlo de forma 100% personalizada y sin trámites ni demoras.
                </p>
              </div>

              {/* Column 3: Políticas de Envío (Requerimiento 1) */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-brand-300">Envíos a todo el país</h5>
                <p className="text-[11px] text-brand-300 font-light leading-relaxed">
                  Despachamos tu pedido de forma segura a cualquier punto de la Argentina. Las compras superiores a $50.000 incluyen envío bonificado. Los plazos de entrega estimados son de 2 a 5 días hábiles, y cada paquete es embalado con máxima protección para proteger tus productos.
                </p>
              </div>

              {/* Column 4: Términos del Servicio (Requerimiento 7) */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-brand-300">Términos del Servicio</h5>
                <p className="text-[11px] text-brand-300 font-light leading-relaxed">
                  Los precios publicados corresponden a pagos con tarjeta de débito o crédito (en hasta 3 cuotas sin interés, sin recargos ocultos). El descuento especial del 15% off se aplica de forma exclusiva si elegís abonar vía Transferencia Bancaria. <strong className="text-brand-100 font-semibold">Importante:</strong> Si abonás vía transferencia bancaria, recordá adjuntar la foto o captura del comprobante durante el pago para que el sistema procese tu orden de inmediato.
                </p>
              </div>
            </div>

            {/* Bottom strip */}
            <div className="border-t border-brand-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10.5px] text-brand-400">
              <div>
                <p>© 2026 Hogar y Estilo. Todos los derechos reservados.</p>
                <p className="font-light mt-0.5 text-brand-500">Hecho de forma artesanal y optimizado para la mejor experiencia de compra.</p>
              </div>
              
              <div className="flex items-center gap-4">
                {isAdminAuthenticated && (
                  <button 
                    onClick={() => {
                      setIsAdminAuthenticated(false);
                      setActiveTab("shop");
                    }}
                    className="text-brand-300 hover:text-white transition-colors cursor-pointer text-[10.5px] font-semibold tracking-wide flex items-center gap-1.5 bg-brand-800/80 hover:bg-brand-800 py-1 px-3.5 rounded-full border border-brand-700 animate-pulse"
                  >
                    🔒 Cerrar Sesión Admin
                  </button>
                )}
                <span className="font-serif text-brand-300">Rosario, Santa Fe, Argentina</span>
              </div>
            </div>

          </div>
        </footer>
      )}

      {/* SLIDE-OUT DYNAMIC CART DRAWER */}
      <SlideOutCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* LARGE PRODUCT VIEW DETAILS MODAL */}
      <ProductDetailsModal
        product={selectedProduct}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(p) => {
          handleAddToCart(p);
          setSelectedProduct(null); // Auto close details panel
        }}
        onBuyNow={handleBuyNow}
        showToast={showToast}
      />

      {/* CHECKOUT FLOW AND CHANNELS GATEWAY */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        clearCart={handleClearCart}
        adminEmail={adminEmail}
        adminPhone={adminPhone}
        onOrderComplete={handleOrderComplete}
        bankDetails={bankDetails}
        showToast={showToast}
        onGoToTracking={(orderId) => {
          setInitialOrderId(orderId);
          setActiveTab("tracker");
        }}
      />

      {/* STICKY INSTAGRAM FLOATING ATTENTION WIDGET Chat (Requerimiento 5) */}
      {showStickyChat && (
        <a
          id="sticky-instagram-widget"
          href="https://instagram.com/deco.home.rosario"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 bg-brand-900 text-white rounded-full p-3.5 sm:p-4 shadow-2xl border border-brand-800 flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95 group animate-pulse"
          aria-label="Contáctanos vía Instagram"
        >
          <Instagram className="w-6 sm:w-7 h-6 sm:h-7 text-pink-400" />
          <span className="absolute right-full mr-2.5 bg-white text-brand-900 border border-brand-200 shadow-md font-sans text-[11px] font-semibold uppercase tracking-wider py-1 px-3 rounded-full opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">
            Asistencia en Instagram
          </span>
          <span className="absolute -top-1 -right-1 bg-green-600 h-3 w-3 rounded-full border-2 border-brand-900" />
        </a>
      )}

      {/* ADMIN PIN LOGIN MODAL (Hiding admin privileges to protect catalog and presentation) */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-brand-200 max-w-sm w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-700">
                <ShieldCheck className="w-6 h-6 text-brand-800" />
              </div>
              <h3 className="font-serif text-lg font-bold text-brand-900">
                Acceso de Administrador
              </h3>
              <p className="text-xs text-brand-600 font-light leading-relaxed">
                Ingresá la clave de acceso para ver y configurar el catálogo de productos de Hogar & Estilo.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const password = (form.elements.namedItem("admin-passcode") as HTMLInputElement).value;
                if (password.toLowerCase() === "admin" || password === "1809") {
                  setIsAdminAuthenticated(true);
                  setShowAdminLoginModal(false);
                  setActiveTab("admin");
                  setAdminLoginError("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  setAdminLoginError("Clave de acceso incorrecta. Intentá de nuevo.");
                }
              }}
              className="space-y-3"
            >
              <div>
                <input
                  name="admin-passcode"
                  type="password"
                  placeholder="Introducir clave de acceso..."
                  required
                  autoFocus
                  className="w-full bg-brand-50 text-brand-900 px-4 py-2.5 rounded-xl border border-brand-200 focus:outline-none focus:ring-1 focus:ring-brand-800 text-sm text-center font-semibold"
                />
              </div>

              {adminLoginError && (
                <p className="text-center text-[11px] text-red-600 font-medium animate-shake">
                  {adminLoginError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    setAdminLoginError("");
                  }}
                  className="flex-1 border border-brand-200 text-brand-700 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-brand-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-900 text-white py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-brand-950 transition-colors"
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM FLOATING TOAST NOTIFICATION CONTAINER WITH HIGH-CONTRAST NEUTRAL STYLE */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm bg-brand-900 text-brand-100 px-5 py-4 rounded-xl shadow-2xl border border-brand-800 flex items-center justify-between gap-4 select-none animate-bounce-short">
          <p className="text-xs font-bold font-sans flex items-center gap-2">
            <span>✨</span> {toast.message}
          </p>
          <button onClick={() => setToast(null)} className="text-brand-400 hover:text-white text-xs font-bold px-1.5 py-0.5 cursor-pointer">×</button>
        </div>
      )}

    </div>
  );
}
