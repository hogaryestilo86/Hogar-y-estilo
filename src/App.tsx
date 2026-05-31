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
import { INITIAL_PRODUCTS, PRESET_REVIEWS } from "./data";
import { Product, CartItem, BankDetails } from "./types";
import { Instagram, Star, Landmark, ShieldCheck, Heart, ArrowRight, MessageCircle, Play, Sparkles, Filter, Check, Gift, Volume2, VolumeX, Truck, ShoppingCart } from "lucide-react";

// Helper to resolve image urls, stripping the local server proxy prefix if run in static hosts (Vercel, GitHub Pages)
export function resolveImageUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("/api/image-proxy?url=")) {
    return decodeURIComponent(url.replace("/api/image-proxy?url=", ""));
  }
  return url;
}

export default function App() {
  // Main states with deep local storage recovery
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem("store_products_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { /* ignore */ }
    }
    return INITIAL_PRODUCTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("store_products_list", JSON.stringify(products));
    } catch (e) {
      console.warn("No se pudo persistir la lista de productos en el almacenamiento local por límite de cuota (datos multimedia de gran tamaño):", e);
      // We don't want to show an annoying alert/toast constantly on every render, but we log it for diagnostic
    }
  }, [products]);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"shop" | "admin">("shop");
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

  // Calculamos los productos destacados dinámicamente para la vitrina deslizable manualmente
  const showcasePhotos = products
    .filter(p => p && p.featured)
    .map(p => ({
      url: p.media?.[0]?.url || "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=85",
      type: p.media?.[0]?.type || "image",
      title: p.title,
      desc: p.description
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
  // Dynamic Orders Database (Requerimiento 6 de Control de envíos) - Empieza vacío para ser completamente prolijo y profesional
  const [pendingOrders, setPendingOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem("store_pending_orders_list");
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { /* ignore */ }
    }
    return [];
  });

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

  // Safe side effects persistence sync
  useEffect(() => {
    try {
      localStorage.setItem("store_metrics_data", JSON.stringify(storeMetrics));
    } catch (e) {
      console.warn("Storage error for storeMetrics:", e);
    }
  }, [storeMetrics]);

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

  // Page Views automatic mount increment
  useEffect(() => {
    setStoreMetrics((prev: any) => ({
      ...prev,
      viewsCount: prev.viewsCount + 1,
    }));
  }, []);

  // Admin access control states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState("");

  // Categories query set (Herramientas, Iluminación, Destacados, etc.)
  const categories = ["Todos", "Destacados", "Cocina", "Hogar", "Belleza", "Herramientas", "Iluminación", "Niños"];

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
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
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

  // Searching filter and categories
  const filteredProducts = (products || []).filter((p) => {
    if (!p) return false;
    const titleStr = p.title || "";
    const categoryStr = p.category || "";
    const descStr = p.description || "";

    const matchesSearch =
      titleStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      categoryStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      descStr.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      selectedCategory === "Todos" ||
      (selectedCategory === "Destacados" && p.featured) ||
      p.category === selectedCategory;

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

      {/* Main Content Areas */}
      <main className="flex-grow">
        {activeTab === "shop" ? (
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 sm:p-8 rounded-2xl border border-brand-200 shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="bg-brand-100 p-3 rounded-xl text-brand-800">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-brand-900 text-sm">Garantía Asegurada</h4>
                    <p className="text-xs text-brand-600 mt-1 font-light leading-relaxed">
                      Si el producto llega dañado u oxidado por el transporte, enviamos un repuesto de forma gratuita en 48hs hábiles.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 border-y md:border-y-0 md:border-x border-brand-100 py-4 md:py-0 md:px-6">
                  <div className="bg-brand-100 p-3 rounded-xl text-brand-800">
                    <Star className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-brand-900 text-sm">Calidad y Estilo Únicos</h4>
                    <p className="text-xs text-brand-600 mt-1 font-light leading-relaxed">
                      Seleccionamos los mejores productos de decoración, bazar y organización para lograr un hogar cálido, ordenado y con personalidad.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-brand-100 p-3 rounded-xl text-brand-800">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-brand-900 text-sm">15% Off de Transferencia</h4>
                    <p className="text-xs text-green-700 mt-1 font-semibold leading-relaxed">
                      Mantenemos la tasa impositiva baja. Pagando directamente por transferencia se bonifica un 15% inmediato.
                    </p>
                  </div>
                </div>
              </div>
            </section>



            {/* MAIN PORTAFOLIO PRODUCT GRID */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2" id="productos">
              {products.length === 0 ? (
                <div className="text-center py-20 px-6 bg-white rounded-2xl border border-brand-200">
                  <div className="h-16 w-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto text-brand-800">
                    <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
                  </div>
                  <h4 className="font-serif text-xl sm:text-2xl font-bold text-brand-900 mt-5">
                    No hay productos disponibles por el momento
                  </h4>
                  <p className="text-xs sm:text-sm text-brand-500 font-light mt-2 max-w-md mx-auto">
                    Estamos actualizando nuestro catálogo exclusivo de Hogar & Estilo con nuevos productos selectos elegidos para tus espacios cotidianos. ¡Te invitamos a volver pronto!
                  </p>
                  {isAdminAuthenticated && (
                    <button
                      onClick={() => {
                        setActiveTab("admin");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="mt-6 bg-brand-800 hover:bg-brand-900 text-white px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <span>Cargar Primer Producto</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
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
                        <p className="text-xs text-brand-500 font-light mt-0.5">Los favoritos de nuestros clientes, seleccionados por su estilo y funcionalidad.</p>
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
                            <p className="text-xs text-brand-500 font-light mt-0.5">Explorá nuestra cuidada selección esencial en promoción para tus ambientes cotidianos.</p>
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
                          {["Cocina", "Hogar", "Belleza", "Herramientas", "Iluminación", "Niños"].map((catName) => {
                            const catProducts = filteredProducts.filter((p) => p.category === catName);
                            if (catProducts.length === 0) return null;
                            
                            let emoji = "📦";
                            if (catName === "Cocina") emoji = "🍳";
                            else if (catName === "Hogar") emoji = "🛋️";
                            else if (catName === "Belleza") emoji = "💅";
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
                  <div className="bg-brand-50/50 p-6 rounded-2xl border border-brand-100 space-y-4 shadow-xs relative transition-all hover:translate-y-[-2px] hover:shadow-xs">
                    <div className="absolute top-4 right-4 text-3xl font-black font-serif text-brand-900">01</div>
                    <div className="p-3 bg-brand-900 text-brand-100 rounded-xl inline-block">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-base font-bold text-brand-950">Elegí tus favoritos</h4>
                      <p className="text-xs text-brand-600 font-light leading-relaxed">
                        Navegá por nuestro catálogo de cocina, organizadores o cuidado personal, seleccioná tus artículos favoritos y agregalos al carrito.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-brand-50/50 p-6 rounded-2xl border border-brand-100 space-y-4 shadow-xs relative transition-all hover:translate-y-[-2px] hover:shadow-xs">
                    <div className="absolute top-4 right-4 text-3xl font-black font-serif text-brand-900">02</div>
                    <div className="p-3 bg-brand-900 text-brand-100 rounded-xl inline-block">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-base font-bold text-brand-950">Completá tus datos</h4>
                      <p className="text-xs text-brand-600 font-light leading-relaxed">
                        Ingresá tus datos reales para el despacho y seleccioná el medio de pago preferido (tenés 15% de descuento por transferencia bancaria).
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-brand-50/50 p-6 rounded-2xl border border-brand-100 space-y-4 shadow-xs relative transition-all hover:translate-y-[-2px] hover:shadow-xs">
                    <div className="absolute top-4 right-4 text-3xl font-black font-serif text-brand-900">03</div>
                    <div className="p-3 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white rounded-xl inline-block">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-serif text-base font-bold text-brand-950">Avisanos en Instagram</h4>
                      <p className="text-xs text-brand-600 font-light leading-relaxed">
                        Escribinos a nuestra cuenta oficial <a href="https://instagram.com/deco.home.rosario" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-900 underline hover:text-black">@deco.home.rosario</a> adjuntando tu número de pedido y el comprobante o captura de pago (si elegiste realizar una transferencia bancaria) para que coordinemos tu despacho al instante.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        ) : (
          /* Administration Dashboard Tab Integrated (Requerimiento 3) */
          <AdminPanel
            products={products}
            onAddProduct={handleAddCustomProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            adminEmail={adminEmail}
            onAdminEmailChange={handleAdminEmailChange}
            adminPhone={adminPhone}
            onAdminPhoneChange={handleAdminPhoneChange}
            storeMetrics={storeMetrics}
            pendingOrders={pendingOrders}
            bankDetails={bankDetails}
            onBankDetailsChange={setBankDetails}
            onDeleteOrder={handleDeleteOrder}
            onResetMetrics={handleResetMetrics}
            showToast={showToast}
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
                  Los precios publicados corresponden a pagos con tarjeta de débito o crédito (en hasta 3 cuotas sin interés, sin recargos ocultos). El descuento especial del 15% off se aplica de forma exclusiva si elegís abonar vía Transferencia Bancaria. <strong className="text-brand-100 font-semibold">Importante:</strong> Si abonás vía transferencia, es obligatorio enviar el comprobante de pago junto con tu número de orden a nuestro Instagram para realizar el despacho correspondiente.
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
                if (password.toLowerCase() === "admin" || password === "1234") {
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
