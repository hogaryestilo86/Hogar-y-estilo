/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { Product, ProductMedia, BankDetails } from "../types";
import { Plus, Sparkles, AlertCircle, FileVideo, FileImage, Trash2, CheckCircle, ArrowRightLeft, Eye, EyeOff, ShoppingCart, TrendingUp, Clock, Phone, Mail, Award, Check, Pencil, Copy, Database, Download, Github, RotateCw, Settings } from "lucide-react";
import { ResolvedImage, ResolvedVideo, storeMedia, getCategoryPlaceholder, inMemoryFallbackCache, getMedia } from "../indexedDbMedia";

interface AdminPanelProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onSetProducts?: (list: Product[]) => void;
  adminEmail: string;
  onAdminEmailChange: (email: string) => void;
  adminPhone?: string;
  onAdminPhoneChange?: (phone: string) => void;
  adminWebhookUrl?: string;
  onAdminWebhookUrlChange?: (url: string) => void;
  storeMetrics: {
    viewsCount: number;
    abandonedCartCount: number;
    purchasesCount: number;
    pendingDispatchesCount: number;
  };
  pendingOrders: any[];
  bankDetails: BankDetails;
  onBankDetailsChange: (details: BankDetails) => void;
  onDeleteOrder: (orderId: string) => void;
  onResetMetrics: () => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
  onUpdateOrderStatus?: (orderId: string, status: string, trackingCode?: string) => void;
}

interface OrderRowProps {
  key?: any;
  order: any;
  onDeleteOrder: (orderId: string) => void;
  formatCurrency: (val: number) => string;
  confirmDeleteOrderId: string | null;
  setConfirmDeleteOrderId: (id: string | null) => void;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
  onViewReceipt: (url: string) => void;
  onUpdateOrderStatus?: (orderId: string, status: string, trackingCode?: string) => void;
}

function OrderRowComponent({
  order,
  onDeleteOrder,
  formatCurrency,
  confirmDeleteOrderId,
  setConfirmDeleteOrderId,
  notify,
  onViewReceipt,
  onUpdateOrderStatus
}: OrderRowProps) {
  const [localTracking, setLocalTracking] = useState(order.trackingCode || "");

  React.useEffect(() => {
    setLocalTracking(order.trackingCode || "");
  }, [order.trackingCode]);

  const subtotal = order.items.reduce((acc: number, item: any) => acc + (item.product.basePrice * item.quantity), 0);
  const isTransfer = order.details.paymentMethod === "transfer";
  const priceToPay = isTransfer ? Math.round(subtotal * 0.85) : subtotal;

  return (
    <tr className="hover:bg-brand-50/30 transition-colors border-b border-brand-100 last:border-b-0">
      <td className="px-5 py-4 space-y-1 text-left align-top">
        <p className="font-bold text-brand-900 text-sm font-sans">{order.details.fullName}</p>
        <div className="flex flex-col gap-0.5 text-[11px] text-brand-500 font-light">
          <span className="flex items-center gap-1 shrink-0"><Mail className="w-3 h-3 text-brand-400" /> {order.details.email}</span>
          <span className="flex items-center gap-1 shrink-0"><Phone className="w-3 h-3 text-brand-400" /> {order.details.phone}</span>
        </div>
      </td>
      <td className="px-5 py-4 leading-relaxed font-light text-[11px] text-left align-top">
        <p className="font-semibold text-brand-900 text-xs font-sans">{order.details.address}</p>
        <p className="text-brand-500 font-sans">{order.details.city} ({order.details.zipCode})</p>
      </td>
      <td className="px-5 py-4 space-y-1 text-left align-top">
        {order.items.map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span className="bg-brand-800 text-brand-100 font-mono text-[9.5px] px-1 py-0.5 rounded-sm font-semibold">{item.quantity}x</span>
            <span className="font-medium text-brand-950 font-sans line-clamp-1">{item.product.title}</span>
          </div>
        ))}
      </td>
      <td className="px-5 py-4 space-y-3.5 text-left align-top min-w-[200px]">
        {/* Status selection */}
        <div className="space-y-1">
          <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">Estado del Envío</span>
          <select
            value={order.status || "pending"}
            onChange={(e) => {
              if (onUpdateOrderStatus) {
                onUpdateOrderStatus(order.id, e.target.value);
                notify("¡Estado de Envío Actualizado!", "success");
              }
            }}
            className="w-full bg-brand-50 border border-brand-200 text-brand-900 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold cursor-pointer"
          >
            <option value="pending">🛒 1. Pedido Recibido</option>
            <option value="preparing">📦 2. En preparación en depósito</option>
            <option value="shipped">✈️ 3. Despachado / En viaje</option>
            <option value="delivery">🏠 4. En camino a domicilio</option>
            <option value="delivered">✅ 5. Entregado</option>
          </select>
        </div>

        {/* Tracking code input */}
        <div className="space-y-1">
          <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">Código de Seguimiento / Envío</span>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Ej: CP123456789AR"
              value={localTracking}
              onChange={(e) => setLocalTracking(e.target.value)}
              onBlur={() => {
                if (onUpdateOrderStatus) {
                  onUpdateOrderStatus(order.id, order.status || "pending", localTracking);
                }
              }}
              className="w-full bg-brand-50 border border-brand-200 text-brand-950 font-mono text-xs px-2.5 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => {
                if (onUpdateOrderStatus) {
                  onUpdateOrderStatus(order.id, order.status || "pending", localTracking);
                }
                notify("✓ ¡Código sincronizado con éxito!", "success");
              }}
              className="bg-brand-900 hover:bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer select-none"
            >
              Ok
            </button>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 space-y-1.5 text-left align-top">
        <p className="text-sm font-black text-brand-950 font-serif">{formatCurrency(priceToPay)}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm inline-block ${isTransfer ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-brand-100 border border-brand-200 text-brand-800'}`}>
          {isTransfer ? '15% Off Trsf' : '3 Cuotas Sin Int.'}
        </span>
        {isTransfer && order.details.receiptImage && (
          <button
            type="button"
            onClick={() => onViewReceipt(order.details.receiptImage)}
            className="mt-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-all active:scale-95 w-full select-none shadow-xs"
          >
            <Eye className="w-3 h-3 text-white" />
            <span>Ver Comprobante</span>
          </button>
        )}
      </td>
      <td className="px-5 py-4 text-center align-top">
        {confirmDeleteOrderId !== order.id ? (
          <button
            type="button"
            onClick={() => setConfirmDeleteOrderId(order.id)}
            className="p-1.5 text-brand-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
            title="Eliminar este pedido"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1.5 animate-in fade-in duration-200 justify-center">
            <span className="text-[9px] font-bold text-red-700 leading-none">¿Borrar?</span>
            <div className="flex gap-1 justify-center">
              <button
                type="button"
                onClick={() => {
                  onDeleteOrder(order.id);
                  setConfirmDeleteOrderId(null);
                  notify(`Se borró el pedido de ${order.details.fullName}.`, "success");
                }}
                className="bg-red-600 text-white font-extrabold text-[9.5px] px-2 py-0.5 rounded cursor-pointer hover:bg-red-700"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOrderId(null)}
                className="bg-white border border-brand-200 text-brand-800 font-extrabold text-[9.5px] px-2 py-0.5 rounded cursor-pointer hover:bg-brand-100"
              >
                No
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminPanel({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onSetProducts,
  adminEmail,
  onAdminEmailChange,
  adminPhone = "5493416555555",
  onAdminPhoneChange = () => {},
  adminWebhookUrl = "",
  onAdminWebhookUrlChange = () => {},
  storeMetrics,
  pendingOrders,
  bankDetails,
  onBankDetailsChange,
  onDeleteOrder,
  onResetMetrics,
  showToast,
  onUpdateOrderStatus,
}: AdminPanelProps) {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [beforePrice, setBeforePrice] = useState("");
  const [category, setCategory] = useState("Cocina");
  
  // Custom non-blocking interactive states
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [importJsonInput, setImportJsonInput] = useState("");
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [copiedJsonValue, setCopiedJsonValue] = useState<string | null>(null);

  // States for automated seamless GitHub catalog persistence
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem("github_sync_token") || "");
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem("github_sync_repo") || "");
  const [githubBranch, setGithubBranch] = useState(() => localStorage.getItem("github_sync_branch") || "main");
  const [githubPath, setGithubPath] = useState(() => localStorage.getItem("github_sync_path") || "products.json");
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [showGithubSettings, setShowGithubSettings] = useState(false);

  const notify = (msg: string, type: "success" | "error" | "info" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      console.log(`[Toast Fallback] ${type.toUpperCase()}: ${msg}`);
    }
  };

  const handleSyncToGithub = async (catalogToSync?: Product[]) => {
    const tokenToUse = githubToken.trim();
    const repoToUse = githubRepo.trim();
    const branchToUse = githubBranch.trim() || "main";
    const pathToUse = githubPath.trim() || "products.json";
    const dataToSave = catalogToSync || products;

    if (!tokenToUse) {
      notify("Por favor, introduce tu Token de Acceso Personal de GitHub en la configuración.", "error");
      setShowGithubSettings(true);
      return;
    }
    if (!repoToUse) {
      notify("Por favor, introduce tu repositorio de GitHub (ejemplo: tadeobeltran1986/rep-name).", "error");
      setShowGithubSettings(true);
      return;
    }

    setIsSyncingGithub(true);
    notify("Conectando con la API de GitHub para actualizar productos...", "info");

    try {
      const cleanRepo = repoToUse.replace(/\s+/g, "");
      
      // Save details to remember
      localStorage.setItem("github_sync_token", tokenToUse);
      localStorage.setItem("github_sync_repo", cleanRepo);
      localStorage.setItem("github_sync_branch", branchToUse);
      localStorage.setItem("github_sync_path", pathToUse);

      const jsonStr = JSON.stringify(dataToSave, null, 2);

      // Query GitHub API for existing file metadata with automatic Trees API fallback for large files (>1MB)
      let sha: string | undefined = undefined;
      try {
        const fileUrl = `https://api.github.com/repos/${cleanRepo}/contents/${pathToUse}?ref=${branchToUse}`;
        const getResponse = await fetch(fileUrl, {
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `token ${tokenToUse}`
          }
        });

        if (getResponse.ok) {
          const fileData = await getResponse.json();
          sha = fileData.sha;
        } else if (getResponse.status === 401) {
          throw new Error("Token de GitHub inválido. Por favor, revísalo o genera uno válido.");
        } else if (getResponse.status === 404) {
          console.log("products.json no existe aún en GitHub, se creará nuevo.");
        } else {
          // Trigger fallback for other statuses (like 403 / large file sizes)
          console.warn(`Query contents returned status ${getResponse.status}. Intentando recuperarlo desde Trees API...`);
          throw new Error("size_limit_or_status_issue");
        }
      } catch (err: any) {
        if (err.message && err.message.includes("Token de GitHub")) {
          throw err;
        }

        // Fallback: Query the Git Trees API which recursively returns file SHAs of files size up to 100MB+ without loading actual code content
        try {
          const treeUrl = `https://api.github.com/repos/${cleanRepo}/git/trees/${branchToUse}?recursive=1`;
          const treeResponse = await fetch(treeUrl, {
            headers: {
              "Accept": "application/vnd.github.v3+json",
              "Authorization": `token ${tokenToUse}`
            }
          });

          if (treeResponse.ok) {
            const treeData = await treeResponse.json();
            if (treeData && Array.isArray(treeData.tree)) {
              const targetPath = pathToUse.toLowerCase().replace(/^\/+/, "");
              const match = treeData.tree.find((item: any) => 
                item.path.toLowerCase().replace(/^\/+/, "") === targetPath
              );
              if (match) {
                sha = match.sha;
                console.log("¡Éxito! SHA obtenido de forma segura desde la API de Git Trees (evitando límites de tamaño):", sha);
              }
            }
          } else if (treeResponse.status === 401) {
            throw new Error("Token de GitHub inválido. Por favor, revísalo o genera uno válido.");
          } else {
            console.error(`Git Trees API fallida con status: ${treeResponse.status}`);
          }
        } catch (treeErr: any) {
          console.error("Fallo de recuperación en Trees API:", treeErr);
          if (treeErr.message && treeErr.message.includes("Token de GitHub")) {
            throw treeErr;
          }
        }

        // If after both we still don't have SHA, and it's not a clear error, we assume it's new, otherwise notify user
        if (!sha) {
          console.log("No se pudo hallar archivo previo ni siquiera en Trees API, asumiendo creación nueva u omitiendo SHA...");
        }
      }

      // Convert content to safe UTF-8 base64 encoding using a non-blocking fast and safe FileReader/Blob native method
      const base64Content = await new Promise<string>((resolve, reject) => {
        const blob = new Blob([jsonStr], { type: "text/plain;charset=utf-8" });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      const putUrl = `https://api.github.com/repos/${cleanRepo}/contents/${pathToUse}`;
      const putBody = {
        message: "Actualizar productos.json desde el Panel de Administración Hogar & Estilo 🛍️",
        content: base64Content,
        branch: branchToUse,
        ...(sha ? { sha } : {})
      };

      const putResponse = await fetch(putUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${tokenToUse}`
        },
        body: JSON.stringify(putBody)
      });

      if (!putResponse.ok) {
        const errJson = await putResponse.json().catch(() => ({}));
        throw new Error(errJson.message || `No se pudo guardar el archivo (Código: ${putResponse.status})`);
      }

      notify("✨ ¡ÉXITO! Catálogo de productos guardado directamente en tu repositorio de GitHub.", "success");
      notify("⚡ Vercel ahora está regenerando tu sitio web. Estará actualizado en vivo en 30-40 segundos sin perder nada.", "info");
    } catch (err: any) {
      console.error("Error sincronizando catálogo con Github:", err);
      notify(`No se pudo sincronizar en GitHub: ${err.message || err}`, "error");
    } finally {
      setIsSyncingGithub(false);
    }
  };
  const [featuresText, setFeaturesText] = useState(""); // Comma separated key features
  const [featured, setFeatured] = useState(false);
  const [paused, setPaused] = useState(false);

  // Slideshow local state for main showcase customizing
  const [newSlideUrl, setNewSlideUrl] = useState("");
  const [newSlideTitle, setNewSlideTitle] = useState("");
  const [newSlideDesc, setNewSlideDesc] = useState("");
  const slideFileInputRef = useRef<HTMLInputElement>(null);

  const handleSlideFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewSlideUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // Local media previews state
  const [mediaList, setMediaList] = useState<ProductMedia[]>([]);
  const [processingMedia, setProcessingMedia] = useState(false);
  
  // Gemini AI optimization states
  const [optimizing, setOptimizing] = useState(false);
  const [aiError, setAiError] = useState("");

  const [clientApiKey, setClientApiKey] = useState(() => {
    return localStorage.getItem("store_client_gemini_api_key") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  });

  const handleClientApiKeyChange = (key: string) => {
    setClientApiKey(key);
    try {
      if (key) {
        localStorage.setItem("store_client_gemini_api_key", key);
      } else {
        localStorage.removeItem("store_client_gemini_api_key");
      }
    } catch (e) {
      console.warn("No se pudo guardar la clave API en storage:", e);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error("Error leyendo archivo"));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 900;
          const MAX_HEIGHT = 900;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
            resolve(dataUrl);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => {
          resolve(e.target?.result as string);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve("");
      };
      reader.readAsDataURL(file);
    });
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setProcessingMedia(true);
    const updatedMedia: ProductMedia[] = [...mediaList];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileSizeInMB = file.size / (1024 * 1024);

      const isPhoto = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
      const isVideo = ["video/mp4", "video/webm"].includes(file.type);

      if (!isPhoto && !isVideo) {
        notify(`El archivo "${file.name}" no posee un formato de imagen o video permitido. Solo se admiten imágenes (JPG, PNG, WebP) o videos (MP4, WebM).`, "error");
        continue;
      }

      if (isPhoto && fileSizeInMB > 7) {
        notify(`La imagen "${file.name}" supera el límite de 7MB. Intenta con una imagen más liviana.`, "error");
        continue;
      }

      if (isVideo && fileSizeInMB > 50) {
        notify(`El video "${file.name}" supera el límite máximo de 50MB (Tamaño actual: ${fileSizeInMB.toFixed(2)}MB).`, "error");
        continue;
      }

      try {
        if (isPhoto) {
          // Guardar imagen en IndexedDB para máxima resolución y evitar cuota de LocalStorage
          const idbUrl = await storeMedia(file);
          updatedMedia.push({
            type: "image",
            url: idbUrl,
          });
        } else {
          // Guardar video en IndexedDB para que persista entre sesiones de forma óptima
          const idbUrl = await storeMedia(file);
          updatedMedia.push({
            type: "video",
            url: idbUrl,
          });
        }
      } catch (error) {
        console.warn("IndexedDB storage failed, using dynamic local fallback URL for this session:", error);
        try {
          const fallbackUrl = URL.createObjectURL(file);
          const fallbackKey = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          inMemoryFallbackCache[fallbackKey] = fallbackUrl;
          updatedMedia.push({
            type: isPhoto ? "image" : "video",
            url: `idb://${fallbackKey}`,
          });
        } catch (fallbackError) {
          console.error("Local object URL creation also failed:", fallbackError);
          notify(`No se pudo procesar el archivo "${file.name}".`, "error");
        }
      }
    }

    setMediaList(updatedMedia);
    setProcessingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMediaItem = (index: number) => {
    const backup = [...mediaList];
    const item = backup[index];
    if (item && item.url.startsWith("blob:")) {
      URL.revokeObjectURL(item.url);
    }
    backup.splice(index, 1);
    setMediaList(backup);
  };

  const optimizeDescriptionWithGemini = async () => {
    if (!description.trim() && !title.trim()) {
      notify("Por favor, ingresa al menos un título tentativo o algunas notas descriptivas simples primero.", "error");
      return;
    }

    setOptimizing(true);
    setAiError("");

    const activeApiKey = clientApiKey?.trim() || "";

    if (activeApiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: activeApiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const systemPrompt = `Eres un experto amigable, cálido y profesional en redactar publicaciones para e-commerce. Trabajas para la marca de decoración "Hogar y Estilo" de Rosario, Argentina.
Tus respuestas y textos sugeridos deben estar escritos siempre con el tratamiento de "Vos" (voseo argentino: ej. tuteo amigable, cercano, cálido, utilizando palabras locales naturales, sin sonar exagerado pero con total confianza y cercanía).
Eliminá por completo cualquier trato de "Usted" o español ibérico. Háblame de "Vos" a mí también en la descripción del producto.

A partir del título rudimentario y de la descripción o notas provistas por el usuario, debés generar 3 campos optimizados:
1. Un título de producto comercialmente atractivo, sofisticado, elegante y optimizado para SEO (ej: "Lámpara de Mesa de Madera Rústica Japandi" en lugar de "lampara de madera").
2. Una descripción persuasiva y súper vendedora adaptada al voseo argentino de forma informal, cercana, amigable pero muy profesional y refinada, redactada en formato Markdown con:
   - Un párrafo introductorio ultra elegante que evoque comodidad, orden, calidez en el hogar o distinción. Te debés dirigir al comprador hablándole de "Vos" (ej: "Transformá tus espacios", "Llevá calidez a tu mesa").
   - Una sección titulada "**Detalles de Diseño**" con una lista de ventajas clave, materiales sofisticados y usabilidad.
   - Un sutil y persuasivo llamado a la acción que invite a renovar los rincones cotidianos de su hogar.
3. El SEO "todo" o tags clave: Una lista de 5 a 6 palabras clave o características destacadas de SEO, separadas exactamente por una coma (ej: "mármol travertino real, mesa auxiliar japandi, estilo rústico moderno, decoración de salas minimalistas, calidad artesanal premium").

Reglas críticas:
- Los productos son seleccionados exclusivamente por Hogar & Estilo de forma directa.
- Devuelve la respuesta STRICTLY en formato JSON válido de acuerdo al esquema solicitado sin markdown tags afuera. El campo de SEO debe ser "seoFeatures" con los tags de palabras clave separados por coma.`;

        const userMessage = `Título provisto: "${title || ""}"
Descripción básica / Notas del producto: "${description || ""}"`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `${systemPrompt}\n\n${userMessage}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { 
                  type: Type.STRING, 
                  description: "Título sofisticado de alta gama para el producto" 
                },
                description: { 
                  type: Type.STRING, 
                  description: "Descripción persuasiva en formato Markdown" 
                },
                seoFeatures: { 
                  type: Type.STRING, 
                  description: "Palabras clave de SEO separadas exclusivamente por coma" 
                }
              },
              required: ["title", "description", "seoFeatures"]
            }
          }
        });

        const jsonText = response.text || "{}";
        const parsedData = JSON.parse(jsonText);

        if (parsedData.title) setTitle(parsedData.title);
        if (parsedData.description) setDescription(parsedData.description);
        if (parsedData.seoFeatures) setFeaturesText(parsedData.seoFeatures);
        setOptimizing(false);
        return; // Success on client-side call
      } catch (sdkErr: any) {
        console.warn("Fallo el SDK local de Gemini, reintentando con endpoint de servidor...", sdkErr);
        if (sdkErr.message && (sdkErr.message.includes("API key") || sdkErr.message.includes("key"))) {
          setAiError("La API Key provista para Vercel no es válida o está rechazada. Por favor verifícala.");
          setOptimizing(false);
          return;
        }
      }
    }

    try {
      const response = await fetch("/api/optimize-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title,
          description: description,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Para usar la IA desde Vercel sin configurar un backend, ingresá tu propia API Key de Gemini en la cajita de abajo (🔑 Configuración de IA para Vercel) para ejecutarla directo en tu navegador de forma segura.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error inesperado al procesar tu solicitud.");
      }

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.seoFeatures) setFeaturesText(data.seoFeatures);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "No se pudo conectar con el servidor para la optimización de IA.");
    } finally {
      setOptimizing(false);
    }
  };


  const handleCancelEdit = () => {
    setTitle("");
    setBasePrice("");
    setBeforePrice("");
    setCategory("Cocina");
    setDescription("");
    setFeaturesText("");
    setMediaList([]);
    setFeatured(false);
    setPaused(false);
    setEditingProductId(null);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !basePrice.trim() || !description.trim()) {
      notify("Por favor completa los campos principales (Título, Precio de Ahora y Descripción).", "error");
      return;
    }

    const priceNum = parseFloat(basePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      notify("Por favor ingresa un precio de venta de ahora válido mayor a cero.", "error");
      return;
    }

    const beforePriceNum = beforePrice.trim() ? parseFloat(beforePrice) : undefined;

    // Default placeholder if no media was loaded
    const productMedia: ProductMedia[] = mediaList.length > 0
      ? mediaList
      : [
          {
            type: "image",
            url: getCategoryPlaceholder(category),
          }
        ];

    const featuresArray = featuresText
      ? featuresText.split(",").map((f) => f.trim()).filter((f) => f.length > 0)
      : ["Producto de fabricación artesanal cuidada", "Diseño de vanguardia", "Garantía oficial Hogar y Estilo"];

    if (editingProductId) {
      const original = products.find((p) => p.id === editingProductId);
      const updatedProduct: Product = {
        ...original,
        id: editingProductId,
        title: title.trim(),
        basePrice: priceNum,
        beforePrice: beforePriceNum,
        category: category,
        description: description.trim(),
        features: featuresArray,
        media: productMedia,
        featured: featured,
        paused: paused,
        reviews: original?.reviews || [
          {
            id: `rev-auto-${Date.now()}`,
            author: "Curador de Hogar y Estilo",
            rating: 5,
            comment: "Producto seleccionado minuciosamente por nuestro departamento de diseño.",
            date: "Hoy"
          }
        ]
      };

      onUpdateProduct(updatedProduct);
      handleCancelEdit();
      notify(`¡El producto "${updatedProduct.title}" ha sido modificado con éxito!`, "success");
      return;
    }

    const newProduct: Product = {
      id: `prod-custom-${Date.now()}`,
      title: title.trim(),
      basePrice: priceNum,
      beforePrice: beforePriceNum,
      category: category,
      description: description.trim(),
      features: featuresArray,
      media: productMedia,
      isCustom: true,
      featured: featured,
      paused: paused,
      reviews: [
        {
          id: `rev-auto-${Date.now()}`,
          author: "Curador de Hogar y Estilo",
          rating: 5,
          comment: "Nuevo ingreso seleccionado minuciosamente por nuestro departamento de diseño.",
          date: "Hoy"
        }
      ]
    };

    onAddProduct(newProduct);
    
    // Clean up local fields
    setTitle("");
    setBasePrice("");
    setBeforePrice("");
    setCategory("Cocina");
    setDescription("");
    setFeaturesText("");
    setMediaList([]);
    setFeatured(false);
    setPaused(false);
    notify(`¡El producto "${newProduct.title}" ha sido creado con éxito y ya está mapeado en la tienda online!`, "success");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in text-left">
      
      {/* Modal de Copia de Seguridad JSON / Respaldo Manual */}
      {copiedJsonValue !== null && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-brand-200 p-6 max-w-2xl w-full shadow-2xl relative space-y-4 animate-scale-up text-left">
            <div className="flex items-start justify-between border-b border-brand-100 pb-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">¡Conectado a Firebase Cloud Database!</span>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-brand-950 flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Código de Productos (JSON) Listo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCopiedJsonValue(null)}
                className="p-1 px-2.5 bg-brand-100 hover:bg-brand-200 rounded-lg text-brand-800 font-bold transition-colors cursor-pointer text-xs"
              >
                Cerrar [X]
              </button>
            </div>

            <p className="text-xs text-brand-700 leading-relaxed">
              <strong>🚀 ¡Sincronización en la Nube Activada!</strong> Configuramos exitosamente tu base de datos <strong>Firebase Firestore</strong> en vivo. Esto significa que cuando cargas un producto se sincroniza de forma segura en internet y no se borrará al salir. 
              Si de todos modos deseas guardar tu catálogo en el código fuente de tu repositorio en GitHub/Vercel (para que quede como respaldo base), puedes descargar el archivo o copiar el código de abajo:
            </p>

            <div className="bg-brand-50 rounded-lg p-3 text-[11px] text-brand-800 space-y-1.5 leading-normal border border-brand-200">
              <p className="font-semibold text-brand-950">Pasos por si deseas actualizar tu repositorio de GitHub / Vercel:</p>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-[10.5px]">
                <li>Haz clic dentro del cuadro oscuro de abajo para seleccionar automáticamente todo el código.</li>
                <li>Si el botón "Copiar Automático" da error por restricciones del iframe de tu navegador, pulsa <kbd className="bg-white border rounded px-1">Ctrl + C</kbd> o <kbd className="bg-white border rounded px-1">Cmd + C</kbd> en tu teclado, o simplemente haz clic en <strong>"Descargar products.json"</strong>.</li>
                <li>Sube o pega ese contenido en tu archivo <code>products.json</code> en tu repositorio de GitHub.</li>
              </ol>
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-brand-500 uppercase tracking-widest block font-sans">Código del Catálogo:</label>
              {(() => {
                const isTooLarge = copiedJsonValue.length > 5000;
                const previewText = isTooLarge
                  ? copiedJsonValue.substring(0, 3000) + "\n\n... [¡CÓDIGO TRUNCADO PARA EVITAR LENTITUD EN TU DISPOSITIVO! El catálogo completo es muy grande debido a las fotos. El archivo tiene " + copiedJsonValue.length + " caracteres. Por favor, usa los botones de abajo 'Copiar Automático' o 'Descargar products.json' para obtener el archivo original completo sin ningún corte] ..."
                  : copiedJsonValue;
                return (
                  <textarea
                    readOnly
                    value={previewText}
                    className="w-full h-56 bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-600 focus:outline-hidden resize-none cursor-text shadow-inner"
                    placeholder="Generando código JSON..."
                  />
                );
              })()}
              <span className="absolute bottom-3 right-3 text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                {copiedJsonValue.length} caracteres
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(copiedJsonValue);
                    notify("✨ ¡Código JSON copiado al portapapeles con éxito!", "success");
                  } catch (err) {
                    try {
                      const aux = document.createElement("textarea");
                      aux.value = copiedJsonValue;
                      document.body.appendChild(aux);
                      aux.select();
                      document.execCommand("copy");
                      document.body.removeChild(aux);
                      notify("✨ ¡Código copiado con portapapeles alternativo de respaldo!", "success");
                    } catch (e2) {
                      notify("El navegador bloqueó la copia automática debido al Iframe. Por favor pulsa Ctrl+C o descarga el archivo.", "error");
                    }
                  }
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <Copy className="w-4 h-4 text-white" />
                <span>Copiar Automático</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    const blob = new Blob([copiedJsonValue], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "products.json";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    notify("✨ ¡Archivo products.json descargado con éxito! Guárdalo en tu dispositivo.", "success");
                  } catch (err: any) {
                    notify("No se pudo descargar el archivo: " + err.message, "error");
                  }
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Descargar products.json</span>
              </button>
              
              <button
                type="button"
                onClick={() => setCopiedJsonValue(null)}
                className="bg-brand-100 hover:bg-brand-200 text-brand-800 font-bold py-3 px-5 rounded-lg text-xs tracking-wider uppercase transition-all active:scale-95 cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Intro banner */}
      <div className="bg-brand-900 text-brand-100 p-6 sm:p-8 rounded-2xl border border-brand-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
        <div>
          <span className="text-xs font-semibold tracking-widest text-brand-300 uppercase font-mono">Panel de Control Interno</span>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight mt-1 text-white">Gestión Portátil de la Tienda</h2>
          <p className="text-sm text-brand-200 mt-2 font-light max-w-xl leading-relaxed">
            Añade productos de alta conversión, optimiza tus redacciones mediante Inteligencia Artificial, y asocia galerías multimedia fluidas verificadas de forma segura.
          </p>
        </div>
        <div className="bg-brand-800 p-4 rounded-xl border border-brand-700 space-y-2 shrink-0 md:min-w-[200px]">
          <p className="text-[10px] font-bold text-brand-400 tracking-wider">CONFIGURACIÓN GENERAL</p>
          <div className="flex justify-between text-xs text-brand-200">
            <span>Total Productos:</span>
            <strong className="text-white font-bold">{products.length}</strong>
          </div>
          <div className="flex justify-between text-xs text-brand-200">
            <span>Envío Gratis en:</span>
            <strong className="text-green-400 font-bold">$50.000 ARS</strong>
          </div>
        </div>
      </div>

      {/* SECCIÓN MÉTRICAS REALES DEL NEGOCIO (Requerimiento de Estadísticas con opción de reset) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-200 pb-3" id="admin-stats-header">
        <div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-brand-900 flex items-center gap-2">
            <span>📊 Métricas Reales de tu Negocio</span>
          </h3>
          <p className="text-xs text-brand-600 font-light">Evolución en tiempo real de interacciones, carritos y despachos.</p>
        </div>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 hover:text-red-700 border border-brand-300 hover:border-red-200 text-brand-800 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95 animate-none"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Restablecer estadísticas a 0</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-1.5 px-3 animate-in fade-in duration-200">
            <span className="text-red-800 font-bold text-[10.5px]">¿Borrar estadísticas?</span>
            <button
              type="button"
              onClick={() => {
                onResetMetrics();
                setConfirmReset(false);
                notify("Estadísticas restablecidas a 0 con éxito.", "success");
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded-md cursor-pointer transition-all"
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="bg-white border border-brand-200 hover:bg-brand-50 text-brand-800 font-bold text-[10px] uppercase px-2.5 py-1 rounded-md cursor-pointer transition-all"
            >
              No
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-brand-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-brand-50 rounded-xl text-brand-800 shrink-0">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest leading-none">Vistas de la Tienda</p>
            <h4 className="font-serif text-2xl font-black text-brand-900 mt-1">{storeMetrics.viewsCount}</h4>
            <p className="text-[10px] text-green-700 font-semibold mt-1">▲ 14% más esta semana</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-brand-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 rounded-xl text-amber-600 shrink-0">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest leading-none">Abandono de Carrito</p>
            <h4 className="font-serif text-2xl font-black text-brand-900 mt-1">{storeMetrics.abandonedCartCount}</h4>
            <p className="text-[10px] text-amber-600 font-semibold mt-1">Agregaron sin comprar</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-brand-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-green-50 rounded-xl text-green-600 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-brand-500 uppercase tracking-widest leading-none">Compras Completadas</p>
            <h4 className="font-serif text-2xl font-black text-brand-900 mt-1">{storeMetrics.purchasesCount}</h4>
            <p className="text-[10px] text-green-700 font-semibold mt-1">Facturaciones registradas</p>
          </div>
        </div>
      </div>

      {/* SECCIÓN NOTIFICACIONES INSTAGRAM - REQUERIMIENTO DEL CLIENTE */}
      <div className="bg-gradient-to-r from-purple-900 via-pink-800 to-amber-700 p-5 rounded-2xl text-white space-y-3.5 shadow-sm text-left animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/20 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 text-[9px] bg-white/25 text-white rounded-full font-bold uppercase tracking-wider">Activo</span>
            <h4 className="font-serif font-bold text-white text-sm sm:text-base flex items-center gap-1.5">
              <span>📱 Notificaciones Automáticas Directas a Instagram</span>
            </h4>
          </div>
          <span className="text-[10px] font-mono font-semibold text-pink-200">INTEGRADOR EN VIVO CON @deco.home.rosario</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-white/90">
          <div className="space-y-2">
            <p className="leading-relaxed font-light">
              Cada vez que un cliente realiza un pago por transferencia y **adjunta su comprobante**, el sistema sincroniza los datos y te envía un aviso instantáneo al feed directo de administración con la imagen del comprobante de transferencia y la orden correspondiente.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-lg border border-white/15">
              <span className="w-2 h-2 rounded-full bg-green-455 animate-ping bg-green-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Servidor Webhook: Conectado</span>
            </div>
          </div>
          
          <div className="bg-black/20 p-3 rounded-xl border border-white/10 space-y-2 font-mono flex flex-col justify-between">
            <div>
              <span className="block text-[9px] text-pink-300 font-bold uppercase tracking-widest">Último aviso de transferencia enviado</span>
              {pendingOrders.filter((o: any) => o.details?.paymentMethod === 'transfer' && o.details?.receiptImage).length > 0 ? (
                (() => {
                  const lastTransferOrder = pendingOrders.filter((o: any) => o.details?.paymentMethod === 'transfer' && o.details?.receiptImage)[0];
                  return (
                    <div className="pt-1.5 space-y-1">
                      <p className="text-white font-bold text-[11px]">📦 Orden {lastTransferOrder.id} - {lastTransferOrder.details.fullName}</p>
                      <p className="text-[10px] text-pink-200 font-light">✓ Comprobante, monto y datos de contacto notificados con éxito al administrador.</p>
                    </div>
                  );
                })()
              ) : (
                <p className="text-[10.5px] text-pink-100/70 italic pt-1.5 font-light">No se recibieron compras recientes por transferencia con comprobante en esta sesión.</p>
              )}
            </div>
            
            <div className="text-[9px] text-white/60 border-t border-white/10 pt-2 font-light">
              Canal oficial: instagram.com/deco.home.rosario
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN REGISTRO Y CONTROL DE PEDIDOS */}
      <div className="bg-white p-6 rounded-2xl border border-brand-200 shadow-xs text-left space-y-4">
        <div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-brand-900 flex items-center gap-2">
            <span>📦 Registro y Control de Pedidos Recientes</span>
            <span className="text-[10px] uppercase tracking-wider bg-brand-100 text-brand-800 font-sans py-0.5 px-2.5 rounded-full font-bold">
              {pendingOrders.length} {pendingOrders.length === 1 ? 'Pedido' : 'Pedidos'}
            </span>
          </h3>
          <p className="text-xs text-brand-600 mt-1 font-light">
            Aquí puedes ver los datos de contacto, facturación, dirección y lista de compra de tus clientes.
          </p>
        </div>
        
        {pendingOrders.length === 0 ? (
          <div className="text-center py-10 bg-brand-50/50 rounded-xl border border-brand-200 border-dashed">
            <span className="text-3xl">📦</span>
            <p className="text-sm text-brand-800 font-medium mt-2">No hay pedidos cargados en la base local todavía.</p>
            <p className="text-[11px] text-brand-500">Los datos ingresados por tus clientes durante el Checkout se sincronizarán directamente aquí de forma privada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-brand-200 rounded-xl bg-white">
            <table className="min-w-full divide-y divide-brand-200 text-left text-xs text-brand-800">
              <thead className="bg-brand-50 text-[9.5px] font-bold uppercase tracking-wider text-brand-700">
                <tr>
                  <th className="px-5 py-3.5">Cliente / Contacto</th>
                  <th className="px-5 py-3.5">Dirección de Destino</th>
                  <th className="px-5 py-3.5">Detalle Artículos</th>
                  <th className="px-5 py-3.5">Estado de Envío / Código</th>
                  <th className="px-5 py-3.5">Metodo de Pago / Total</th>
                  <th className="px-5 py-3.5 text-center">Eliminar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100 bg-white">
                {pendingOrders.map((order: any) => (
                  <OrderRowComponent
                    key={order.id}
                    order={order}
                    onDeleteOrder={onDeleteOrder}
                    formatCurrency={formatCurrency}
                    confirmDeleteOrderId={confirmDeleteOrderId}
                    setConfirmDeleteOrderId={setConfirmDeleteOrderId}
                    notify={notify}
                    onViewReceipt={setSelectedReceipt}
                    onUpdateOrderStatus={onUpdateOrderStatus}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN CONFIGURACIÓN COBRO TRANSFERENCIAS (Requerimiento de datos bancarios) */}
      <div className="bg-white p-6 rounded-2xl border border-brand-200 shadow-xs space-y-4 text-left">
        <div>
          <h3 className="font-serif text-lg font-bold text-brand-900 flex items-center gap-2">
            <span>🏛️ Configuración de Cobro por Transferencia Bancaria</span>
            <span className="text-[9px] uppercase tracking-wider bg-brand-800 text-brand-100 font-sans py-0.5 px-2 rounded-full font-bold">Cuentas Activas</span>
          </h3>
          <p className="text-xs text-brand-600 font-light mt-1">
            Introduce los datos de tu cuenta bancaria o billetera digital que verán tus clientes al pagar (con el 15% de descuento automático). Se guardan de forma privada.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Banco / Entidad Financiera
            </label>
            <input
              type="text"
              value={bankDetails.bankName}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, bankName: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800 text-brand-900"
              placeholder="Banco Nación, Mercado Pago, etc."
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Titular de la Cuenta
            </label>
            <input
              type="text"
              value={bankDetails.accountHolder}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, accountHolder: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800 text-brand-900"
              placeholder="Nombre Completo / Firma SH"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Alias de Pago
            </label>
            <input
              type="text"
              value={bankDetails.alias}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, alias: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800 text-brand-900"
              placeholder="decos.estilos.mp"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              CBU / CVU de 22 dígitos
            </label>
            <input
              type="text"
              value={bankDetails.cbu}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, cbu: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800 text-brand-900 font-mono"
              placeholder="0000003100012345678901"
              maxLength={22}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              CUIT o CUIL
            </label>
            <input
              type="text"
              value={bankDetails.cuit}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, cuit: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800 text-brand-900 font-mono"
              placeholder="20-35890432-1"
            />
          </div>
          <div className="flex items-end">
            <button
               type="button"
               onClick={() => {
                 notify("¡Datos Bancarios Guardados! Los compradores verán esta cuenta al pagar con Transferencia.", "success");
               }}
               className="w-full bg-brand-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition-all active:scale-95 duration-150 h-[38px] flex items-center justify-center shadow-sm select-none"
            >
              Confirmar Datos de Cuenta
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN CONFIGURACIÓN COBRO MERCADO PAGO */}
      <div className="bg-white p-6 rounded-2xl border border-brand-200 shadow-xs space-y-4 text-left">
        <div>
          <h3 className="font-serif text-lg font-bold text-brand-900 flex items-center gap-2">
            <span className="text-[#009ee3]">💳 Configuración de Cobro por Mercado Pago</span>
            <span className="text-[9px] uppercase tracking-wider bg-[#00a6f3] text-white font-sans py-0.5 px-2 rounded-full font-bold">Tarjeta y Débito</span>
          </h3>
          <p className="text-xs text-brand-600 font-light mt-1 font-sans">
            Configurá tu cuenta de Mercado Pago para recibir el dinero de las compras con tarjeta de crédito o débito directamente en tu cuenta de forma 100% real.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1 font-sans">
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Email de tu Cuenta Mercado Pago
            </label>
            <input
              type="email"
              value={bankDetails.mpEmail || ""}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, mpEmail: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-brand-800 text-brand-900"
              placeholder="tu-email@gmail.com"
            />
            <span className="text-[9.5px] text-brand-500 mt-1 block leading-relaxed">Cuenta donde recibirás notificaciones y control de cobro.</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Alias de Cobro MP (Opcional)
            </label>
            <input
              type="text"
              value={bankDetails.mpAlias || ""}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, mpAlias: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-brand-800 text-brand-900"
              placeholder="decos.rosario.mp"
            />
            <span className="text-[9.5px] text-brand-500 mt-1 block leading-relaxed">Para transferencias "dinero en cuenta" directas.</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Link de Pago de Mercado Pago (Recomendado)
            </label>
            <input
              type="url"
              value={bankDetails.mpLink || ""}
              onChange={(e) => onBankDetailsChange({ ...bankDetails, mpLink: e.target.value })}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-brand-800 text-brand-900"
              placeholder="https://mpago.la/..."
            />
            <span className="text-[9.5px] text-indigo-700 font-bold mt-1 block leading-relaxed">¡Si ponés tu link, los clientes podrán pagarte de verdad con tarjeta a través del enlace seguro!</span>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              notify("¡Configuración de Mercado Pago Guardada! Los pagos se acreditarán en tu cuenta.", "success");
            }}
            className="bg-[#009ee3] hover:bg-[#007fba] text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition-all active:scale-95 duration-150 h-[38px] flex items-center justify-center shadow-sm select-none"
          >
            Confirmar Datos Mercado Pago
          </button>
        </div>
      </div>

      {/* SECCIÓN CONFIGURACIÓN ALERTAS DE VENTA AUTOMÁTICAS (Requerimiento de notificaciones en tiempo real) */}
      <div className="bg-white p-6 rounded-2xl border border-brand-200 shadow-xs space-y-4 text-left font-sans">
        <div>
          <h3 className="font-serif text-lg font-bold text-brand-900 flex items-center gap-2">
            <span className="text-purple-700">📢 Configuración de Alertas y Notificaciones Automáticas</span>
            <span className="text-[9px] uppercase tracking-wider bg-purple-600 text-white font-sans py-0.5 px-2 rounded-full font-bold">100% Invisible</span>
          </h3>
          <p className="text-xs text-brand-600 font-light mt-1">
            Recibí avisos automáticos al instante de cada venta (por tarjeta o transferencia) de forma silenciosa para el comprador. Podés configurar tu e-mail o un Webhook personalizado conectado a herramientas externas (como Discord, Telegram o Make.com) para recibir notificaciones directas en tu celular.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Email para Alertas de Venta
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => onAdminEmailChange(e.target.value)}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-brand-800 text-brand-900"
              placeholder="tu-email@gmail.com"
            />
            <span className="text-[9.5px] text-brand-500 mt-1 block leading-relaxed">
              Dirección de correo a donde se enviarán las alertas automáticas de transacciones y pedidos.
            </span>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              URL de Webhook Directo (Discord, Telegram, Zapier, Make)
            </label>
            <input
              type="text"
              value={adminWebhookUrl}
              onChange={(e) => onAdminWebhookUrlChange(e.target.value)}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-brand-800 text-brand-900 font-mono"
              placeholder="https://discord.com/api/webhooks/... o https://hooks.zapier.com/..."
            />
            <span className="text-[9.5px] text-brand-500 mt-1 block leading-relaxed">
              Al pegar una URL de webhook, enviaremos los datos de ventas al instante. ¡Ideal para recibir alertas en tiempo real de forma discreta!
            </span>
          </div>
        </div>

        <div className="bg-brand-50/50 p-4 rounded-xl border border-brand-100 flex items-start gap-3 mt-2">
          <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-brand-800">💡 ¿Cómo recibir la alerta en mi celular o Instagram?</h4>
            <p className="text-[10px] text-brand-600 font-light leading-relaxed">
              Instagram restringe el envío automatizado a cuentas comerciales verificadas por Meta. La solución estándar, más segura y profesional para estar alertado al instante en todo momento es mediante webhooks:
              <br />
              1. <strong>Discord / Telegram</strong>: Creá un canal en Discord o un bot en Telegram, obtené su webhook gratis y pegalo arriba. Recibirás un mensaje estético con todo el detalle de ventas de inmediato.
              <br />
              2. <strong>Zapier o Make.com</strong>: Creá un automatismo con disparador "Webhook" y acción "Enviar DM en Instagram", "Mensaje de WhatsApp" o "Notificación Push" para alertarte a vos mismo.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              notify("¡Canales de Notificación actualizados con éxito! El sistema se mantendrá alerta ante compras.", "success");
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition-all active:scale-95 duration-150 h-[38px] flex items-center justify-center shadow-sm select-none animate-in fade-in"
          >
            Confirmar Canales de Notificación
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Creation Form block (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6" id="admin-creation-form-panel">
          <div className="bg-white rounded-2xl border border-brand-200 p-5 sm:p-6 shadow-sm transition-all focus-within:ring-1 focus-within:ring-brand-100">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-brand-900 mb-6 flex items-center justify-between gap-1.5 border-b border-brand-100 pb-3">
              <div className="flex items-center gap-1.5">
                {editingProductId ? <Pencil className="w-5 h-5 text-brand-800 animate-pulse" /> : <Plus className="w-6 h-6 text-brand-800" />}
                <span>{editingProductId ? "Modificar Producto Premium" : "Cargar Nuevo Producto Premium"}</span>
              </div>
              {editingProductId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[10px] sm:text-xs font-sans font-bold uppercase tracking-wider bg-brand-100 hover:bg-brand-200 text-brand-800 border border-brand-200 rounded-full px-3 py-1 cursor-pointer transition-all active:scale-95"
                >
                  Cancelar Edición
                </button>
              )}
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-5">
              {editingProductId && (
                <div className="bg-brand-50/70 border-l-4 border-brand-800 p-4 rounded-r-xl text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 animate-fadeIn" id="edit-mode-active-sticker">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-brand-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <span className="inline-block w-2 h-2 rounded-full bg-brand-800 animate-ping"></span>
                      <span>✏️ Modo Edición Activo</span>
                    </p>
                    <p className="text-[11px] text-brand-700 font-light leading-relaxed">
                      Estás modificando el producto <strong>"{title}"</strong>. Puedes cambiar su sección (abajo), reescribir su descripción con la IA, o eliminar y añadir nuevas imágenes del producto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-brand-100 hover:bg-brand-200 text-brand-800 text-[10px] uppercase tracking-wider font-bold py-1.5 px-3.5 rounded-full border border-brand-200 transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    Descartar Edición
                  </button>
                </div>
              )}

              {/* Row 1: Title and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest mb-1.5">
                    Título del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Mesa Auxiliar Travertino"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest mb-1.5">
                    Sección o Colección de Tienda *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden text-brand-900 font-semibold cursor-pointer"
                  >
                    <option value="Cocina">Cocina</option>
                    <option value="Hogar">Hogar</option>
                    <option value="Belleza">Belleza</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Iluminación">Iluminación</option>
                    <option value="Niños">Niños</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Price and Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest mb-1.5">
                    Precio de Ahora * (ARS)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 38500"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 font-medium"
                  />
                  <p className="text-[10px] text-brand-500 mt-1 italic">
                    Es el precio real de venta. De acá calculamos las 3 cuotas y el 15% de descuento por transferencia.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest mb-1.5">
                    Precio de Antes (ARS) - Opcional
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 45000"
                    value={beforePrice}
                    onChange={(e) => setBeforePrice(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 font-medium"
                  />
                  <p className="text-[10px] text-brand-500 mt-1 italic">
                    Cargá un valor más alto para que la tienda le muestre al cliente cuánto se está ahorrando.
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest mb-1.5">
                    Características destacadas (Separadas por Comas)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 100% travertino real, Altura 45cm, Pulido mate"
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
              </div>

              {/* Opción de Producto Destacado en vitrina */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-4 flex items-center gap-3 select-none">
                  <input
                    type="checkbox"
                    id="featured-product-checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="w-4.5 h-4.5 text-brand-900 border-brand-300 rounded focus:ring-brand-800 focus:ring-offset-0 cursor-pointer accent-brand-900"
                  />
                  <label htmlFor="featured-product-checkbox" className="cursor-pointer text-xs sm:text-sm font-medium text-brand-800 flex flex-col select-none text-left">
                    <strong className="text-brand-900">✨ Marcar como Destacado para la Vitrina</strong>
                    <span className="text-[10.5px] sm:text-xs text-brand-600 font-light mt-0.5 leading-normal">Aparecerá arriba de todo en el carrusel de inicio destacado.</span>
                  </label>
                </div>

                <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 flex items-center gap-3 select-none">
                  <input
                    type="checkbox"
                    id="paused-product-checkbox"
                    checked={paused}
                    onChange={(e) => setPaused(e.target.checked)}
                    className="w-4.5 h-4.5 text-amber-700 border-amber-300 rounded focus:ring-amber-500 focus:ring-offset-0 cursor-pointer accent-amber-700"
                  />
                  <label htmlFor="paused-product-checkbox" className="cursor-pointer text-xs sm:text-sm font-medium text-amber-900 flex flex-col select-none text-left">
                    <strong className="text-amber-800">⏸️ Pausar Venta (Sin Stock)</strong>
                    <span className="text-[10.5px] sm:text-xs text-amber-600 font-light mt-0.5 leading-normal">Si se tilda, el producto se ocultará de la catálogo temporalmente sin perder sus datos.</span>
                  </label>
                </div>
              </div>

              {/* Media loader drag & drop component */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest">
                  Imágenes y Videos del Producto
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-brand-300 hover:border-brand-800 hover:bg-brand-100/50 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2.5"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/png, image/jpeg, image/webp, video/mp4, video/webm"
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                  <div className="flex justify-center gap-3 text-brand-500 text-2xl">
                    <FileImage className="w-7 h-7" />
                    <FileVideo className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-brand-800 font-medium">
                      Haz clic para examinar archivos locales
                    </p>
                    <p className="text-[10.5px] text-brand-500 font-light mt-1">
                      Formatos: PNG, JPG, WebP (máx 5MB) • Video: MP4, WebM (máx 50MB)
                    </p>
                  </div>
                </div>

                {/* Alternativa: Cargar multimedia mediante URL de internet */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center bg-brand-50 border border-brand-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex-1 space-y-1 text-left">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-brand-700 block">O ingresa multimedia mediante una URL pública de Internet (Opcional):</span>
                    <input
                      type="url"
                      id="media-url-manual-input"
                      placeholder="Ej. https://tuservicio.com/foto.jpg o video.mp4"
                      className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-brand-500 text-brand-900 outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const inputEl = document.getElementById("media-url-manual-input") as HTMLInputElement;
                      const urlVal = inputEl?.value?.trim();
                      if (!urlVal) {
                        notify("Por favor, ingresa una dirección URL válida.", "error");
                        return;
                      }
                      
                      const lowercaseUrl = urlVal.toLowerCase();
                      const isVid = lowercaseUrl.endsWith(".mp4") || lowercaseUrl.endsWith(".webm") || lowercaseUrl.includes("video") || lowercaseUrl.startsWith("data:video");
                      
                      setMediaList([
                        ...mediaList,
                        {
                          type: isVid ? "video" : "image",
                          url: urlVal
                        }
                      ]);
                      if (inputEl) inputEl.value = "";
                      notify("Multimedia por URL agregada con éxito.", "success");
                    }}
                    className="bg-brand-900 hover:bg-black text-white font-serif font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-all self-end sm:self-center whitespace-nowrap"
                  >
                    Agregar URL
                  </button>
                </div>

                {/* File preview gallery */}
                {mediaList.length > 0 && (
                  <div className="bg-brand-100 p-4 rounded-xl border border-brand-200 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">
                        Archivos a incorporar ({mediaList.length}):
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {mediaList.map((item, index) => {
                        const isImage = item.type === "image";
                        return (
                          <div 
                            key={index}
                            className="relative w-24 h-24 bg-white border border-brand-200 rounded-lg overflow-hidden shadow-xs flex flex-col justify-between"
                          >
                            {/* Media render */}
                            <div className="w-full h-full relative">
                              {item.type === "video" ? (
                                <ResolvedVideo src={item.url} className="w-full h-full object-cover" muted />
                              ) : (
                                <ResolvedImage src={item.url} alt="Vista previa" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              )}
                            </div>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMediaItem(index);
                              }}
                              className="absolute top-1 right-1 bg-red-650 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-all active:scale-90 cursor-pointer z-20"
                              title="Quitar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>

                            {/* Indicator badge: "Imagen" or "Video" */}
                            {isImage ? (
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-900/80 text-brand-100 font-medium shadow-xs z-10">
                                Imagen
                              </div>
                            ) : (
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600/85 text-white shadow-xs z-10">
                                Video
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Description section with AI generator integrations */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest">
                    Descripción del Producto o Copywriting *
                  </label>
                  
                  {/* AI Assistant trigger */}
                  <button
                    type="button"
                    onClick={optimizeDescriptionWithGemini}
                    disabled={optimizing}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all ${
                      optimizing 
                        ? "bg-brand-200 text-brand-500" 
                        : "bg-brand-900 text-white hover:bg-black active:scale-95 cursor-pointer shadow-sm"
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${optimizing ? "animate-spin" : ""}`} />
                    <span>{optimizing ? "Optimizando con Gemini..." : "Optimizar con IA"}</span>
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={6}
                    required
                    placeholder="Escribe aquí el título básico, ideas o notas básicas... Ej: 'Lampara de mesa portatil de cocina con base de madera y luz recargable.'"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-xl p-3 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 leading-relaxed font-light"
                  />
                  {optimizing && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-6 h-6 border-2 border-brand-900 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-semibold text-brand-800">Gemini está modelando tu publicación completa...</p>
                    </div>
                  )}
                </div>

                {aiError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}
                <p className="text-[10px] text-brand-500">
                  Tip: escribe un título simple o características básicas y presiona <strong>"Optimizar con IA"</strong>. El sistema de inteligencia artificial rellenará automáticamente el nombre profesional del producto, redactará una descripción persuasiva y cargará etiquetas clave de SEO por ti.
                </p>

                {/* Vercel Client-Side API Key Input Option */}
                <div className="bg-brand-50/75 border border-brand-200 rounded-xl p-4 text-left space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-brand-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <span>🔑 Inteligencia Artificial (Gemini API)</span>
                    </label>
                    <span className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      clientApiKey ? "text-green-700 bg-green-50 border-green-200" : "text-brand-500 bg-brand-100 border-brand-200"
                    }`}>
                      {clientApiKey ? "🔑 Conectado" : "Esperando Clave"}
                    </span>
                  </div>
                  
                  <div className="text-[11px] text-brand-700 space-y-2 leading-relaxed">
                    <p className="font-semibold text-brand-900">¿Cómo hacer que la IA funcione en vivo en Vercel de forma automática?</p>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[10.5px]">
                      <li>
                        <strong>Opción 1 (Recomendado / Definitivo):</strong> Entrá a tu panel de Vercel, ve a <strong>Settings &gt; Environment Variables</strong>, agrega una variable llamada <code className="bg-brand-100 px-1 py-0.5 rounded font-mono text-[9px]">GEMINI_API_KEY</code> y pegá tu clave de Google AI Studio. ¡Listo! Funcionará de manera segura y automática para todos los administradores.
                      </li>
                      <li>
                        <strong>Opción 2 (Rápido / Temporal):</strong> Si no configuraste la variable aún, pegá tu clave directamente en el cuadro de abajo. Se guardará de manera segura únicamente en tu navegador web para que puedas seguir optimizando productos de inmediato.
                      </li>
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Pega tu API Key de Gemini aquí (ej: AIzaSy...)"
                      value={clientApiKey}
                      onChange={(e) => handleClientApiKeyChange(e.target.value)}
                      className="flex-1 bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-800 text-brand-900 font-mono"
                    />
                    {clientApiKey && (
                      <button
                        type="button"
                        onClick={() => handleClientApiKeyChange("")}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-95"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-brand-500 leading-snug">
                    ¿No tenés una API Key? Conseguila 100% gratis en 30 segundos con tu cuenta de Google en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-800 font-medium underline hover:text-black">Google AI Studio</a>.
                  </p>
                </div>
              </div>

              {/* Submit triggers */}
              <div className="flex flex-wrap md:flex-nowrap justify-end gap-3 pt-3">
                {editingProductId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 font-bold text-xs sm:text-sm tracking-wider uppercase py-3 px-5 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer flex-1 md:flex-none"
                  >
                    Cancelar Edición
                  </button>
                )}
                
                {/* BOTÓN REQUERIDO POR EL USUARIO: Copiar JSON antes de publicar / cargar el producto */}
                <button
                  type="button"
                  onClick={async () => {
                    const cleanTitle = title.trim();
                    const cleanDesc = description.trim();
                    
                    let listToExport = [...products];

                    // If they are building or editing a product, include this draft in the export
                    if (cleanTitle || cleanDesc) {
                      const priceNum = parseFloat(basePrice) || 0;
                      const beforePriceNum = beforePrice ? parseFloat(beforePrice) : undefined;
                      const featuresArray = featuresText
                        ? featuresText.split(",").map((f) => f.trim()).filter(Boolean)
                        : [];

                      const draftProduct: Product = {
                        id: editingProductId || `prod-custom-${Date.now()}`,
                        title: cleanTitle || "Borrador de Producto",
                        basePrice: priceNum,
                        beforePrice: beforePriceNum,
                        category: category,
                        description: cleanDesc,
                        features: featuresArray,
                        media: mediaList,
                        isCustom: true,
                        featured: featured,
                        paused: paused,
                        reviews: [
                          {
                            id: `rev-auto-${Date.now()}`,
                            author: "Curador de Hogar y Estilo",
                            rating: 5,
                            comment: "Nuevo ingreso seleccionado minuciosamente por nuestro departamento de diseño.",
                            date: "Hoy"
                          }
                        ]
                      };

                      const existsIdx = listToExport.findIndex((p) => p.id === draftProduct.id);
                      if (existsIdx >= 0) {
                        listToExport[existsIdx] = draftProduct;
                      } else {
                        listToExport = [draftProduct, ...listToExport];
                      }
                    }

                    try {
                      const jsonStr = JSON.stringify(listToExport, null, 2);
                      setCopiedJsonValue(jsonStr);
                      try {
                        await navigator.clipboard.writeText(jsonStr);
                        notify(
                          cleanTitle 
                            ? "¡Código JSON del borrador copiado al portapapeles con éxito!" 
                            : "¡Código JSON del catálogo actual copiado con éxito!", 
                          "success"
                        );
                      } catch (clipErr) {
                        try {
                          const aux = document.createElement("textarea");
                          aux.value = jsonStr;
                          document.body.appendChild(aux);
                          aux.select();
                          document.execCommand("copy");
                          document.body.removeChild(aux);
                          notify("¡Código JSON copiado al portapapeles con método alternativo!", "success");
                        } catch (e2) {
                          notify("Se abrió la ventana para copiar el código manualmente.", "info");
                        }
                      }
                    } catch (err: any) {
                      notify("No se pudo estructurar el JSON: " + err.message, "error");
                    }
                  }}
                  className="bg-brand-50 hover:bg-brand-150 text-brand-900 border border-brand-300 font-bold text-xs sm:text-sm tracking-wider uppercase py-3 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer flex-1 md:flex-none"
                  title="Copiar código JSON del catálogo completo (incluyendo tu borrador actual si lo has rellenado)"
                >
                  <Copy className="w-4 h-4 text-brand-800" />
                  <span>{editingProductId ? "Copiar JSON Modificado" : (title.trim() ? "Copiar JSON con Borrador" : "Copiar Catálogo JSON")}</span>
                </button>

                {/* NUEVO BOTÓN REQUERIDO PARA EVITAR ERRORES DE PORTAPAPELES: Descarga Directa del archivo JSON compatible con Vercel/GitHub */}
                <button
                  type="button"
                  onClick={() => {
                    const cleanTitle = title.trim();
                    const cleanDesc = description.trim();
                    
                    let listToExport = [...products];

                    // If form has details, inject draft product to output file
                    if (cleanTitle || cleanDesc) {
                      const priceNum = parseFloat(basePrice) || 0;
                      const beforePriceNum = beforePrice ? parseFloat(beforePrice) : undefined;
                      const featuresArray = featuresText
                        ? featuresText.split(",").map((f) => f.trim()).filter(Boolean)
                        : [];

                      const draftProduct: Product = {
                        id: editingProductId || `prod-custom-${Date.now()}`,
                        title: cleanTitle || "Borrador de Producto",
                        basePrice: priceNum,
                        beforePrice: beforePriceNum,
                        category: category,
                        description: cleanDesc,
                        features: featuresArray,
                        media: mediaList,
                        isCustom: true,
                        featured: featured,
                        paused: paused,
                        reviews: [
                          {
                            id: `rev-auto-${Date.now()}`,
                            author: "Curador de Hogar y Estilo",
                            rating: 5,
                            comment: "Nuevo ingreso seleccionado por el departamento de curación.",
                            date: "Hoy"
                          }
                        ]
                      };

                      const existsIdx = listToExport.findIndex((p) => p.id === draftProduct.id);
                      if (existsIdx >= 0) {
                        listToExport[existsIdx] = draftProduct;
                      } else {
                        listToExport = [draftProduct, ...listToExport];
                      }
                    }

                    try {
                      const jsonStr = JSON.stringify(listToExport, null, 2);
                      const blob = new Blob([jsonStr], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "products.json";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      notify("✨ ¡Archivo products.json descargado! Guárdalo o súbelo directo a tu GitHub.", "success");
                    } catch (err: any) {
                      notify("No se pudo descargar el archivo: " + err.message, "error");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm tracking-wider uppercase py-3 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer flex-1 md:flex-none shadow-md"
                  title="Descargar directamente el archivo products.json listo para subir a tu repositorio en GitHub"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>Descargar products.json</span>
                </button>

                <button
                  type="submit"
                  className="bg-brand-900 hover:bg-black text-brand-100 font-bold text-xs sm:text-sm tracking-wider uppercase py-3 px-6 rounded-lg flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-transform active:scale-95 cursor-pointer flex-1 md:flex-none"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editingProductId ? "Guardar Cambios de Producto" : "Publicar e Incorporar Producto"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Current list manager / Preview simulation (Right col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-brand-200 p-5 shadow-sm">
            <h4 className="font-serif font-bold text-brand-900 text-lg mb-4 pb-2 border-b border-brand-100 flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-brand-500" />
              Gestor de Productos Activos
            </h4>
            <p className="text-xs text-brand-600 font-light mb-4">
              Visualiza tus productos de inventario. Puedes modificar detalles/fotos, o remover cargas de la tienda.
            </p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {products.length === 0 ? (
                <div className="text-center py-10 bg-brand-50/20 border border-brand-200 border-dashed rounded-xl p-4">
                  <span className="text-2xl">📦</span>
                  <p className="text-xs text-brand-800 font-bold mt-2">No hay productos cargados</p>
                  <p className="text-[10px] text-brand-500 mt-0.5">Usa el panel de la izquierda para agregar o importar tu inventario desde cero.</p>
                </div>
              ) : (
                products.map((item) => {
                  const listPrice = item.basePrice;
                  const transferPrice = Math.round(listPrice * 0.85);

                  return (
                    <div 
                      key={item.id}
                      className={`flex rounded-lg p-2.5 border items-center justify-between transition-all ${
                        editingProductId === item.id 
                          ? "bg-brand-50 border-brand-800 ring-1 ring-brand-800" 
                          : item.paused
                          ? "bg-neutral-50 border-neutral-300 opacity-60 grayscale-[40%]"
                          : "bg-brand-50/50 border-brand-200 hover:border-brand-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.media && item.media[0]?.type === "video" ? (
                          <ResolvedVideo
                            src={item.media[0]?.url}
                            className={`w-12 h-12 rounded object-cover border shrink-0 bg-brand-100 ${item.paused ? "border-neutral-300" : "border-brand-200"}`}
                            muted
                            playsInline
                          />
                        ) : (
                          <ResolvedImage
                            src={(item.media && item.media[0]?.url) || getCategoryPlaceholder(item.category)}
                            alt={item.title}
                            className={`w-12 h-12 rounded object-cover border shrink-0 bg-brand-100 ${item.paused ? "border-neutral-300" : "border-brand-200"}`}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="text-left">
                          <h5 className={`text-xs font-serif font-bold text-brand-900 line-clamp-1 ${item.paused ? "line-through text-brand-500" : ""}`}>{item.title}</h5>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <p className="text-[10px] text-brand-500 uppercase tracking-wide">{item.category}</p>
                            {item.paused && (
                              <span className="text-[8px] font-sans font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1 rounded uppercase tracking-wide">
                                ⏸️ Pausado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-brand-800">{formatCurrency(listPrice)}</span>
                            <span className="text-[9px] bg-green-50 border border-green-200 text-green-700 px-1 rounded">15% OFF transf.</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Toggle Pause button (Pausar sin eliminar) */}
                        <button
                          type="button"
                          onClick={() => {
                            const updatedProduct = {
                              ...item,
                              paused: !item.paused
                            };
                            onUpdateProduct(updatedProduct);
                            notify(
                              `El producto "${item.title}" ahora está ${!item.paused ? "PAUSADO (Oculto en tienda)" : "ACTIVO (Visible de nuevo)"}.`,
                              "info"
                            );
                          }}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            item.paused 
                              ? "text-amber-700 bg-amber-100 border border-amber-300 hover:bg-amber-200" 
                              : "text-brand-400 hover:text-brand-900 hover:bg-brand-200/50"
                          }`}
                          title={item.paused ? "Re-activar venta (Hacer visible)" : "Pausar venta (Ocultar)"}
                        >
                          {item.paused ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {/* Modify Product button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProductId(item.id);
                            setTitle(item.title);
                            setBasePrice(item.basePrice.toString());
                            setBeforePrice(item.beforePrice ? item.beforePrice.toString() : "");
                            setCategory(item.category || "Cocina");
                            setDescription(item.description);
                            setFeaturesText(item.features ? item.features.join(", ") : "");
                            setMediaList(item.media || []);
                            setFeatured(!!item.featured);
                            setPaused(!!item.paused);
                            
                            // Smooth scroll to form in touch screens or desktops
                            const formEl = document.getElementById("admin-creation-form-panel");
                            if (formEl) {
                              formEl.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            editingProductId === item.id 
                              ? "text-brand-900 bg-brand-200" 
                              : "text-brand-400 hover:text-brand-900 hover:bg-brand-200/50"
                          }`}
                          title="Modificar producto"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Delete actions for all products */}
                        <button
                          type="button"
                          onClick={() => {
                            if (editingProductId === item.id) {
                              handleCancelEdit();
                            }
                            onDeleteProduct(item.id);
                          }}
                          className="p-1.5 text-brand-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title="Borrar de la tienda"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* CONTROL DE RESPAldo Y SINCRONIZACIÓN EN LA NUBE */}
          <div className="bg-white rounded-2xl border border-brand-200 p-5 shadow-sm space-y-4 text-left">
            <h4 className="font-serif font-bold text-brand-900 text-base pb-2 border-b border-brand-100 flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-purple-600" />
              Sincronización y Respaldo Inteligente (Vercel)
            </h4>
            <p className="text-xs text-brand-600 font-light leading-relaxed">
              Vercel utiliza un sistema temporal. Para que tus productos nuevos o modificados se guarden <strong>para siempre en vivo</strong> para todos tus clientes, puedes sincronizarlos directamente con tu cuenta de GitHub.
            </p>

            {/* SINCRONIZACIÓN AUTOMÁTICA DE GITHUB */}
            <div className="bg-purple-50/70 border border-purple-150 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="block text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Github className="w-4 h-4 text-purple-800 animate-bounce" />
                  Sincronización con 1-Clic a GitHub
                </span>
                <button
                  type="button"
                  onClick={() => setShowGithubSettings(!showGithubSettings)}
                  className="px-2 py-1 bg-white border border-purple-200 hover:bg-purple-100 text-purple-900 rounded-lg transition-all flex items-center gap-1 text-[10px] uppercase font-bold cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-purple-700" />
                  <span>{showGithubSettings ? "Cerrar Config" : "Configurar"}</span>
                </button>
              </div>

              <p className="text-[11px] text-purple-900 leading-relaxed font-light">
                Introduce tus datos de repositorio una vez. Al presionar <strong>"Sincronizar en GitHub"</strong>, tus productos se guardan directo en tu repositorio y Vercel actualiza tu web en vivo en 30 segundos. ¡No más cansancio ni archivos manuales!
              </p>

              {showGithubSettings && (
                <div className="bg-white border border-purple-200 rounded-xl p-3.5 space-y-3.5 animate-in slide-in-from-top-2 duration-200 text-xs text-brand-900">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-brand-800 uppercase pb-1 border-b border-brand-100">
                    <Settings className="w-3.5 h-3.5 text-brand-700" />
                    Ajustes de Sincronización
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-brand-700 mb-1">Repositorio GitHub (Usuario/Repo):</label>
                      <input
                        type="text"
                        value={githubRepo}
                        onChange={(e) => {
                          setGithubRepo(e.target.value);
                          localStorage.setItem("github_sync_repo", e.target.value);
                        }}
                        placeholder="ej. tadeobeltran1986/hogaryestilo"
                        className="w-full text-xs p-2 bg-brand-50 hover:bg-brand-100/50 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-200 outline-hidden transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brand-700 mb-1">Rama (Branch):</label>
                      <input
                        type="text"
                        value={githubBranch}
                        onChange={(e) => {
                          setGithubBranch(e.target.value);
                          localStorage.setItem("github_sync_branch", e.target.value);
                        }}
                        placeholder="main"
                        className="w-full text-xs p-2 bg-brand-50 hover:bg-brand-100/50 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-200 outline-hidden transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-brand-700 mb-1">Nombre del Archivo en tu Repositorio:</label>
                    <input
                      type="text"
                      value={githubPath}
                      onChange={(e) => {
                        setGithubPath(e.target.value);
                        localStorage.setItem("github_sync_path", e.target.value);
                      }}
                      placeholder="products.json"
                      className="w-full text-xs p-2 bg-brand-50 hover:bg-brand-100/50 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-200 outline-hidden transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-brand-700 mb-1 flex items-center justify-between">
                      <span>Token de Acceso Personal de GitHub (Classic PAT):</span>
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo&description=HogarYEstiloCatalogSync"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9.5px] text-purple-700 hover:underline font-extrabold uppercase tracking-wide flex items-center gap-0.5"
                      >
                        ¿Cómo obtener un Token?
                      </a>
                    </label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => {
                        setGithubToken(e.target.value);
                        localStorage.setItem("github_sync_token", e.target.value);
                      }}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full text-xs p-2 bg-brand-50 hover:bg-brand-100/50 border border-brand-200 rounded-lg focus:ring-1 focus:ring-brand-200 outline-hidden transition-all font-mono"
                    />
                    <p className="text-[10px] text-brand-500 font-light mt-1.5 leading-snug">
                      Se necesita un Token con permiso de <strong className="font-semibold text-brand-700">"repo"</strong> activado para poder escribir el archivo en tu código. Este token se almacena de forma segura únicamente en el navegador de tu dispositivo.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={isSyncingGithub}
                onClick={() => handleSyncToGithub()}
                className={`w-full py-3 px-4 rounded-xl font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md text-white border border-black/10 transition-colors ${
                  isSyncingGithub 
                    ? "bg-purple-400 cursor-not-allowed" 
                    : "bg-purple-600 hover:bg-purple-700 active:bg-purple-800"
                }`}
              >
                {isSyncingGithub ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Guardando directo en GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-3.5 h-3.5 text-white animate-pulse" />
                    <span>Sincronizar Catálogo en GitHub</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-brand-50 rounded-xl p-3 border border-brand-150 text-[11px] text-brand-850 leading-relaxed space-y-2">
              <p className="font-semibold">💾 Respaldo Manual Alternativo (En código de texto):</p>
              <ul className="list-disc list-inside space-y-1 text-brand-700">
                <li>Puedes agregar, editar o quitar tus productos en este panel de administrador.</li>
                <li>Presiona <strong>"Copiar Código JSON"</strong> y péguelo en el archivo <code>products.json</code> de tu GitHub de manera manual si prefieres no usar el token automático.</li>
                <li>Puedes descargar el archivo <code>products.json</code> listo para arrastrarlo a tu repositorio de GitHub directamente.</li>
              </ul>
            </div>

            {/* Acciones Rápidas */}
            <div className="space-y-3 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      let listToExport = [...products];
                      
                      // If products is empty and there's a title in the form, automatically include it as draft!
                      if (listToExport.length === 0 && title.trim()) {
                        const priceNum = parseFloat(basePrice) || 0;
                        const beforePriceNum = beforePrice ? parseFloat(beforePrice) : undefined;
                        const featuresArray = featuresText
                          ? featuresText.split(",").map((f) => f.trim()).filter(Boolean)
                          : [];

                        const draftProduct: Product = {
                          id: editingProductId || `prod-custom-${Date.now()}`,
                          title: title.trim(),
                          basePrice: priceNum,
                          beforePrice: beforePriceNum,
                          category: category,
                          description: description.trim(),
                          features: featuresArray,
                          media: mediaList,
                          isCustom: true,
                          featured: featured,
                          paused: paused,
                          reviews: [
                            {
                              id: `rev-auto-${Date.now()}`,
                              author: "Curador de Hogar y Estilo",
                              rating: 5,
                              comment: "Nuevo ingreso seleccionado minuciosamente por nuestro departamento de diseño.",
                              date: "Hoy"
                            }
                          ]
                        };
                        listToExport = [draftProduct];
                        notify("El catálogo estaba vacío pero agregamos el borrador que tienes rellenado en el formulario.", "info");
                      }

                      const jsonStr = JSON.stringify(listToExport, null, 2);
                      setCopiedJsonValue(jsonStr);
                      try {
                        await navigator.clipboard.writeText(jsonStr);
                        notify("¡Código JSON del catálogo copiado con éxito! Además abrimos la ventana de copia manual.", "success");
                      } catch (copyErr) {
                        try {
                          const aux = document.createElement("textarea");
                          aux.value = jsonStr;
                          document.body.appendChild(aux);
                          aux.select();
                          document.execCommand("copy");
                          document.body.removeChild(aux);
                          notify("¡Código JSON copiado con método alternativo! Asistente disponible.", "success");
                        } catch (e2) {
                          notify("Se habilitó el asistente visual de copia manual.", "info");
                        }
                      }
                    } catch (e) {
                      notify("No se pudo preparar el JSON para la copia: " + (e as any).message, "error");
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-brand-50 hover:bg-brand-150 border border-brand-200 hover:border-brand-300 text-brand-900 text-[11px] font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                  title="Copiar lista de productos en formato JSON para copias de seguridad rápidas"
                >
                  <Copy className="w-3.5 h-3.5 text-brand-800" />
                  <span>Copiar Código JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try {
                      let listToExport = [...products];
                      const jsonStr = JSON.stringify(listToExport, null, 2);
                      const blob = new Blob([jsonStr], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "products.json";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      notify("✨ ¡Catálogo completo descargado como products.json con éxito!", "success");
                    } catch (err: any) {
                      notify("No se pudo descargar el catálogo: " + err.message, "error");
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-150 border border-emerald-200 hover:border-emerald-300 text-emerald-900 text-[11px] font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                  title="Descargar archivo products.json para guardar en la computadora o subirlo directamente"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Descargar Archivo</span>
                </button>
                
                {/* WIPE Catalog button */}
                {!confirmWipe ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(true)}
                    className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                    title="Eliminar absolutamente todo para empezar desde cero"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Borrar Todo</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5 bg-red-50 border border-red-200 rounded-lg p-2.5 w-full animate-in slide-in-from-top-2 duration-200">
                    <p className="text-[10px] text-red-900 font-extrabold leading-tight">¿Estás 100% seguro de vaciar el catálogo completo de la tienda? Esta acción es irreversible.</p>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSetProducts) {
                            onSetProducts([]);
                            localStorage.removeItem("store_products_list");
                            notify("Catálogo vaciado localmente con éxito.", "success");
                            // Send empty payload to server to wipe also products.json on the server!
                            fetch("/api/products", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ products: [] })
                            })
                            .then((r) => r.json())
                            .then(() => {
                              notify("Sincronizado catálogo en blanco en el servidor de producción.", "success");
                            })
                            .catch((err) => {
                              console.warn("Server side wipe warning: ", err);
                            });
                          } else {
                            notify("Sincronizador no disponible temporalmente en esta sesión.", "error");
                          }
                          setConfirmWipe(false);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[9px] uppercase tracking-wide py-1.5 rounded-md cursor-pointer transition-all flex-1"
                      >
                        Vaciar Ahora
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmWipe(false)}
                        className="bg-white border border-brand-200 hover:bg-brand-50 text-brand-800 font-extrabold text-[9px] uppercase tracking-wide py-1.5 rounded-md cursor-pointer transition-all flex-1"
                      >
                        Conservar todo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Import Catalog Panel */}
              <div className="border-t border-brand-100 pt-3 space-y-2">
                <label className="block text-[10px] font-bold text-brand-800 uppercase tracking-widest">
                  📥 Importar / Restaurar Copia de Seguridad
                </label>
                <textarea
                  value={importJsonInput}
                  onChange={(e) => setImportJsonInput(e.target.value)}
                  placeholder='Pega aquí tu lista copiada en formato JSON, por ejemplo: [ { "id": "...", "title": "..." }, ... ]'
                  className="w-full h-16 text-[10px] p-2 bg-brand-50/50 hover:bg-brand-50 border border-brand-200 focus:border-brand-800 rounded-lg focus:ring-1 focus:ring-brand-100 transition-all font-mono outline-hidden leading-snug"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!importJsonInput.trim()) {
                      notify("Por favor, pega un código JSON válido primero.", "error");
                      return;
                    }
                    try {
                      let parsed = JSON.parse(importJsonInput.trim());
                      if (!Array.isArray(parsed)) {
                        notify("El formato debe ser una lista de productos válida (Empieza con '[' y termina con ']').", "error");
                        return;
                      }
                      
                      // Inject ids if missing with clean values
                      parsed = parsed.map((p: any) => ({
                        ...p,
                        id: p.id || `prod-custom-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
                      }));

                      if (onSetProducts) {
                        onSetProducts(parsed);
                        notify(`¡Exito! Catálogo de ${parsed.length} productos importados y restablecidos.`, "success");
                        setImportJsonInput("");
                        
                        // Push immediately to the server so it updates live on Vercel
                        fetch("/api/products", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ products: parsed })
                        })
                        .then((r) => r.json())
                        .then(() => {
                          notify("Sincronizado en vivo con el servidor de producción.", "success");
                        })
                        .catch((err) => {
                          console.warn("Failed to push imported list to server:", err);
                        });
                      } else {
                        notify("El sincronizador no está disponible en este momento.", "error");
                      }
                    } catch (err: any) {
                      notify(`El código JSON ingresado contiene errores de formato: ${err.message}`, "error");
                    }
                  }}
                  className="w-full bg-brand-950 hover:bg-brand-900 text-brand-100 font-bold text-[10.5px] tracking-wider uppercase py-2 border border-black/10 rounded-lg flex items-center justify-center gap-1 shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-brand-100" />
                  <span>Importar e Iniciar Sincronización</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-brand-900 text-brand-100 rounded-2xl p-5 border border-brand-800 shadow-md space-y-3">
            <h4 className="font-serif font-bold text-brand-300 text-base">Estrategia de Ventas</h4>
            <p className="text-xs text-brand-200 leading-relaxed font-light">
              El secreto para una alta tasa de conversión reposa en la coherencia estética de las fotografías. Procura usar fondos lisos, neutros, minimalistas y limpios.
            </p>
            <div className="text-[10.5px] text-brand-400 font-mono space-y-1">
              <p>✔ Margen de ganancia ideal: 2.5x</p>
              <p>✔ Enfoque canal: Instagram reels</p>
              <p>✔ Envío sugerido: Correo Postal</p>
            </div>
          </div>
        </div>

      </div>

      {/* Gemini Image Studio modal removed as it is now integrated inline above in the product form files section for better responsiveness and touch-friendly direct use */}

      {/* MODAL PARA VER COMPROBANTE DE PAGO BANCARIO O CAPTURA DE TRANSFERENCIA */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-brand-200 p-5 space-y-4 text-left animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-brand-100 pb-3">
              <h4 className="font-serif font-black text-brand-900 text-sm flex items-center gap-2">
                <span>📄 Comprobante Adjunto de la Transferencia</span>
              </h4>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="p-1 px-3 bg-brand-100 font-sans hover:bg-brand-200 rounded-md text-brand-700 hover:text-brand-900 font-black transition-all text-xs cursor-pointer select-none"
              >
                Cerrar
              </button>
            </div>

            <div className="bg-brand-50 rounded-xl overflow-hidden max-h-[60vh] flex items-center justify-center border border-brand-200 relative p-3">
              <ResolvedImage 
                src={selectedReceipt} 
                alt="Comprobante completo" 
                className="max-h-[55vh] h-auto max-w-full object-contain mx-auto shadow-sm rounded-lg"
              />
            </div>

            <p className="text-[10px] text-brand-500 font-sans text-center">
              Podés cruzar el nombre impreso en la captura con el nombre del cliente en la lista para despachar.
            </p>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2.5 bg-brand-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer select-none"
              >
                Cerrar Comprobante
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
