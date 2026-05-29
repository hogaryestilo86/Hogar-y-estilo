/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Product, ProductMedia, BankDetails } from "../types";
import { Plus, Sparkles, AlertCircle, FileVideo, FileImage, Trash2, CheckCircle, ArrowRightLeft, Eye, ShoppingCart, TrendingUp, Clock, Phone, Mail, Award, Check } from "lucide-react";

interface AdminPanelProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  adminEmail: string;
  onAdminEmailChange: (email: string) => void;
  storeMetrics: {
    viewsCount: number;
    abandonedCartCount: number;
    purchasesCount: number;
    pendingDispatchesCount: number;
  };
  pendingOrders: any[];
  onMarkOrderAsShipped: (orderId: string) => void;
  bankDetails: BankDetails;
  onBankDetailsChange: (details: BankDetails) => void;
  onDeleteOrder: (orderId: string) => void;
  onResetMetrics: () => void;
}

export default function AdminPanel({
  products,
  onAddProduct,
  onDeleteProduct,
  adminEmail,
  onAdminEmailChange,
  storeMetrics,
  pendingOrders,
  onMarkOrderAsShipped,
  bankDetails,
  onBankDetailsChange,
  onDeleteOrder,
  onResetMetrics,
}: AdminPanelProps) {
  const [title, setTitle] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [category, setCategory] = useState("Cocina");
  const [description, setDescription] = useState("");
  const [featuresText, setFeaturesText] = useState(""); // Comma separated key features
  const [featured, setFeatured] = useState(false);

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setProcessingMedia(true);
    const updatedMedia: ProductMedia[] = [...mediaList];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileSizeInMB = file.size / (1024 * 1024);

      // Validate format
      const isPhoto = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
      const isVideo = ["video/mp4", "video/webm"].includes(file.type);

      if (!isPhoto && !isVideo) {
        alert(`El archivo "${file.name}" no posee un formato permitido.\nSolo se admiten imágenes (JPG, PNG, WebP) o videos (MP4, WebM).`);
        continue;
      }

      // Check size restrictions
      if (isPhoto && fileSizeInMB > 5) {
        alert(`La imagen "${file.name}" supera el límite máximo de 5MB (Tamaño actual: ${fileSizeInMB.toFixed(2)}MB).\nPor favor, optimiza o reduce el tamaño de la imagen.`);
        continue;
      }

      if (isVideo && fileSizeInMB > 50) {
        alert(`El video "${file.name}" supera el límite máximo de 50MB (Tamaño actual: ${fileSizeInMB.toFixed(2)}MB).\nUtiliza contenedores comprimidos o duraciones más cortas.`);
        continue;
      }

      // Safe asynchronous read-out with URL.createObjectURL or FileReader as requested
      // We will use URL.createObjectURL because it is instantaneous and works nicely in local previews:
      const objectUrl = URL.createObjectURL(file);
      updatedMedia.push({
        type: isVideo ? "video" : "image",
        url: objectUrl,
      });
    }

    setMediaList(updatedMedia);
    setProcessingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMediaItem = (index: number) => {
    const backup = [...mediaList];
    const item = backup[index];
    if (item && item.url.startsWith("blob:")) {
      URL.revokeObjectURL(item.url); // Clean out garbage collection memory leak
    }
    backup.splice(index, 1);
    setMediaList(backup);
  };

  const optimizeDescriptionWithGemini = async () => {
    if (!description.trim() && !title.trim()) {
      alert("Por favor, ingresa al menos un título tentativo o algunas notas descriptivas simples primero.");
      return;
    }

    setOptimizing(true);
    setAiError("");

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
        throw new Error("El motor inteligente de Gemini requiere que el servidor full-stack esté encendido. Si estás en modo estático (Vercel/GitHub Pages), esta funcionalidad no está disponible.");
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

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !basePrice.trim() || !description.trim()) {
      alert("Por favor completa los campos principales (Título, Precio Base y Descripción).");
      return;
    }

    const priceNum = parseFloat(basePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("Por favor ingresa un precio válido mayor a cero.");
      return;
    }

    // Default placeholder if no media was loaded
    const productMedia: ProductMedia[] = mediaList.length > 0
      ? mediaList
      : [
          {
            type: "image",
            url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=85",
          }
        ];

    const featuresArray = featuresText
      ? featuresText.split(",").map((f) => f.trim()).filter((f) => f.length > 0)
      : ["Producto de fabricación artesanal cuidada", "Diseño de vanguardia", "Garantía oficial Hogar y Estilo"];

    const newProduct: Product = {
      id: `prod-custom-${Date.now()}`,
      title: title.trim(),
      basePrice: priceNum,
      category: category,
      description: description.trim(),
      features: featuresArray,
      media: productMedia,
      isCustom: true,
      featured: featured,
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
    setCategory("Cocina");
    setDescription("");
    setFeaturesText("");
    setMediaList([]);
    setFeatured(false);
    alert(`¡El producto "${newProduct.title}" ha sido creado con éxito y ya está mapeado en la tienda online!`);
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
        <button
          type="button"
          onClick={() => {
            if (confirm("¿Estás seguro de que deseas restablecer todas las estadísticas de visitas y carritos a 0 para comenzar tu negocio desde cero?")) {
              onResetMetrics();
            }
          }}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 hover:text-red-700 border border-brand-300 hover:border-red-200 text-brand-800 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
          <span>Restablecer estadísticas a 0</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
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

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-brand-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-brand-900 text-brand-100 rounded-xl shrink-0">
            <Clock className="w-6 h-6 text-brand-300" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest leading-none">Por Despachar</p>
            <h4 className="font-serif text-2xl font-black text-brand-900 mt-1 flex items-center gap-1.5">
              <span>{storeMetrics.pendingDispatchesCount}</span>
              {storeMetrics.pendingDispatchesCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </h4>
            <p className="text-[10px] text-brand-500 font-semibold mt-1">Pendientes de logística</p>
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
            Aquí puedes ver los datos de contacto, facturación, dirección y lista de compra de tus clientes. Puedes dar de alta cada despacho presionando el botón de acción de logística.
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
                  <th className="px-5 py-3.5">Metodo de Pago / Total</th>
                  <th className="px-5 py-3.5 text-center">Estatus / Logística</th>
                  <th className="px-5 py-3.5 text-center">Eliminar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100 bg-white">
                {pendingOrders.map((order: any) => {
                  const subtotal = order.items.reduce((acc: number, item: any) => acc + (item.product.basePrice * item.quantity), 0);
                  const isTransfer = order.details.paymentMethod === "transfer";
                  const priceToPay = isTransfer ? Math.round(subtotal * 0.85) : subtotal;
                  
                  return (
                    <tr key={order.id} className="hover:bg-brand-50/30 transition-colors">
                      <td className="px-5 py-4 space-y-1">
                        <p className="font-bold text-brand-900 text-sm">{order.details.fullName}</p>
                        <div className="flex flex-col gap-0.5 text-[11px] text-brand-500 font-light">
                          <span className="flex items-center gap-1 shrink-0"><Mail className="w-3 h-3 text-brand-400" /> {order.details.email}</span>
                          <span className="flex items-center gap-1 shrink-0"><Phone className="w-3 h-3 text-brand-400" /> {order.details.phone}</span>
                        </div>
                        <a 
                          href={`https://wa.me/54${order.details.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-green-50 hover:bg-green-150 border border-green-200 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded mt-1 shadow-2xs"
                        >
                          💬 Chatear WhatsApp
                        </a>
                      </td>
                      <td className="px-5 py-4 leading-relaxed font-light text-[11px]">
                        <p className="font-semibold text-brand-900 text-xs">{order.details.address}</p>
                        <p className="text-brand-500">{order.details.city} ({order.details.zipCode})</p>
                        <p className="text-[10px] bg-brand-100 text-brand-800 px-2 py-0.5 rounded mt-1.5 inline-block font-semibold">Correo Argentino</p>
                      </td>
                      <td className="px-5 py-4 space-y-1">
                        {order.items.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="bg-brand-800 text-brand-100 font-mono text-[9.5px] px-1 py-0.5 rounded-sm font-semibold">{item.quantity}x</span>
                            <span className="font-medium text-brand-950 font-sans line-clamp-1">{item.product.title}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-5 py-4 space-y-1">
                        <p className="text-sm font-black text-brand-950 font-serif">{formatCurrency(priceToPay)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm inline-block ${isTransfer ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-brand-100 border border-brand-200 text-brand-800'}`}>
                          {isTransfer ? '15% Off Trsf' : '3 Cuotas Sin Int.'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {order.status === "pending" ? (
                          <div className="flex flex-col items-center gap-2">
                             <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                               <Clock className="w-3 h-3 animate-spin text-amber-600" /> Pendiente
                             </span>
                             <button
                               onClick={() => onMarkOrderAsShipped(order.id)}
                               className="bg-brand-800 hover:bg-black text-white font-bold text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-md shadow-xs cursor-pointer hover:scale-105 active:scale-95 transition-all animate-none"
                             >
                               🚚 Despachar Pedido
                             </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold bg-green-100 text-green-800 border border-green-200 shadow-2xs">
                            <Check className="w-3.5 h-3.5 text-green-600" /> Despachado
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el pedido de ${order.details.fullName}?`)) {
                              onDeleteOrder(order.id);
                            }
                          }}
                          className="p-1.5 text-brand-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Eliminar este pedido"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN CONFIGURACIÓN EMAIL NOTIFICACIONES (Requerimiento de email del comprador) */}
      <div className="bg-white p-6 rounded-2xl border border-brand-200 shadow-xs space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-brand-900 flex items-center gap-2">
              <span>📬 Configuración de Notificaciones por Email</span>
              <span className="text-[9px] uppercase tracking-wider bg-green-100 text-green-800 font-sans py-0.5 px-2 rounded-full font-bold">Activo</span>
            </h3>
            <p className="text-xs text-brand-600 font-light mt-1">
              <strong>Simple y Directo:</strong> No requiere ninguna configuración técnica compleja ni datos de servidores (sin SMTP ni contraseñas). Solo ingresa tu correo personal o comercial para recibir un resumen automático de cada pedido detallado.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 max-w-lg items-end pt-1">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold text-brand-700 uppercase tracking-widest mb-1.5">
              Tu Email de Notificaciones (Propietario de la Tienda)
            </label>
            <input
              type="email"
              required
              placeholder="ejemplo@correo.com"
              value={adminEmail}
              onChange={(e) => onAdminEmailChange(e.target.value)}
              className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800 text-brand-900"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!adminEmail || !adminEmail.includes("@")) {
                alert("Por favor ingresa una dirección de correo válida.");
                return;
              }
              alert(`¡Canal de Notificaciones Configurado!\n\nDe ahora en adelante, cada vez que un cliente concrete una compra en la tienda, todos los datos llegaran directamente a: ${adminEmail}`);
            }}
            className="bg-brand-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition-all active:scale-95 duration-150 h-[38px] flex items-center justify-center whitespace-nowrap shadow-sm select-none"
          >
            Guardar Email de Enlace
          </button>
        </div>
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
                alert("¡Datos Bancarios Guardados!\n\nLos compradores verán exactamente estas coordenadas cuando seleccionen pagar con Transferencia.");
              }}
              className="w-full bg-brand-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition-all active:scale-95 duration-150 h-[38px] flex items-center justify-center shadow-sm select-none"
            >
              Confirmar Datos de Cuenta
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Creation Form block (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-brand-200 p-5 sm:p-6 shadow-sm">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-brand-900 mb-6 flex items-center gap-1.5 border-b border-brand-100 pb-3">
              <Plus className="w-6 h-6 text-brand-800" />
              Cargar Nuevo Producto Premium
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-5">
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
                    Categoría *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden text-brand-900 font-medium"
                  >
                    <option value="Cocina">Cocina</option>
                    <option value="Hogar">Hogar</option>
                    <option value="Belleza">Belleza</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Iluminación">Iluminación</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Price and Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-800 uppercase tracking-widest mb-1.5">
                    Precio Base de Costo * (ARS)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 42000"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 font-medium"
                  />
                  <p className="text-[10px] text-brand-500 mt-1 italic">
                    El sistema de precios calcula las 3 cuotas y el 15% de descuento automáticamente.
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
              <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-4 flex items-center gap-3 select-none">
                <input
                  type="checkbox"
                  id="featured-product-checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4.5 h-4.5 text-brand-900 border-brand-300 rounded focus:ring-brand-800 focus:ring-offset-0 cursor-pointer accent-brand-900"
                />
                <label htmlFor="featured-product-checkbox" className="cursor-pointer text-xs sm:text-sm font-medium text-brand-800 flex flex-col select-none">
                  <strong className="text-brand-900">✨ Marcar como Destacado para la Vitrina</strong>
                  <span className="text-xs text-brand-600 font-light mt-0.5">Si marcas esta casilla, el producto aparecerá arriba en la parte superior del inicio como una atracción deslizable horizontalmente.</span>
                </label>
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

                {/* File preview gallery */}
                {mediaList.length > 0 && (
                  <div className="bg-brand-100 p-4 rounded-xl border border-brand-200 space-y-3">
                    <p className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Archivos a incorporar ({mediaList.length}):</p>
                    <div className="flex flex-wrap gap-3">
                      {mediaList.map((item, index) => (
                        <div key={index} className="relative w-20 h-20 bg-white border border-brand-300 rounded-lg overflow-hidden group">
                          {item.type === "video" ? (
                            <video src={item.url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={item.url} alt="Vista previa" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          )}
                          <button
                            type="button"
                            onClick={() => removeMediaItem(index)}
                            className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            aria-label="Remove media"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
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
              </div>

              {/* Submit triggers */}
              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="bg-brand-900 hover:bg-black text-brand-100 font-bold text-xs sm:text-sm tracking-wider uppercase py-3 px-6 rounded-lg flex items-center gap-1.5 shadow-md hover:shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Publicar e Incorporar Producto</span>
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
              Visualiza tus productos de inventario. Puedes remover tus cargas personalizadas presionando el icono correspondiente.
            </p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {products.map((item) => {
                const listPrice = item.basePrice;
                const transferPrice = Math.round(listPrice * 0.85);

                return (
                  <div 
                    key={item.id}
                    className="flex bg-brand-50 rounded-lg p-2.5 border border-brand-200 items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.media[0]?.url || "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15"}
                        alt={item.title}
                        className="w-12 h-12 rounded object-cover border border-brand-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h5 className="text-xs font-serif font-bold text-brand-900 line-clamp-1">{item.title}</h5>
                        <p className="text-[10px] text-brand-500 mt-0.5 uppercase tracking-wide">{item.category}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-brand-800">{formatCurrency(listPrice)}</span>
                          <span className="text-[9px] bg-green-50 border border-green-200 text-green-700 px-1 rounded">15% OFF transf.</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete actions for all products */}
                    <button
                      onClick={() => onDeleteProduct(item.id)}
                      className="p-1.5 text-brand-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0"
                      title="Borrar de la tienda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
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
              <p>✔ Envío sugerido: Correo Argentino</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
