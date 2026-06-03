/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShoppingBag, Search, ShieldAlert, Sparkles, Sofa } from "lucide-react";

interface HeaderProps {
  cartCount: number;
  onCartToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: "shop" | "admin" | "tracker";
  onTabChange: (tab: "shop" | "admin" | "tracker") => void;
  isAdminAuthenticated?: boolean;
  onTriggerAdminLogin?: () => void;
}

export default function Header({
  cartCount,
  onCartToggle,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  isAdminAuthenticated = false,
  onTriggerAdminLogin,
}: HeaderProps) {
  const [logoClicks, setLogoClicks] = React.useState(0);

  React.useEffect(() => {
    if (logoClicks > 0 && logoClicks < 5) {
      const t = setTimeout(() => setLogoClicks(0), 8000);
      return () => clearTimeout(t);
    }
  }, [logoClicks]);

  React.useEffect(() => {
    if (logoClicks >= 5) {
      setLogoClicks(0);
      if (isAdminAuthenticated) {
        onTabChange("admin");
      } else {
        onTriggerAdminLogin?.();
      }
    }
  }, [logoClicks, isAdminAuthenticated, onTabChange, onTriggerAdminLogin]);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLogoClicks((prev) => prev + 1);
  };

  return (
    <header className="sticky top-0 z-40 bg-header-bg/95 backdrop-blur-md border-b border-neutral-800 shadow-sm transition-all duration-300">
      {/* Top Banner */}
      <div className="bg-neutral-950 text-text-crema text-center text-[10px] sm:text-[11px] py-2 tracking-widest font-normal uppercase flex items-center justify-center gap-2 px-4 shadow-sm flex-wrap border-b border-neutral-800">
        <span className="flex items-center gap-1">🚚 Envío Inmediato Gratis desde $50.000 (Entrega 2-5 días)</span>
        <span className="text-neutral-700">•</span>
        <span className="flex items-center gap-1.5"><span className="text-sky-400">💳</span> Compra 100% Protegida por Mercado Pago</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand Name */}
        <div 
          className="flex items-center gap-2 cursor-pointer select-none touch-manipulation pointer-events-auto active:opacity-80 transition-opacity"
          onClick={handleLogoClick}
          id="brand-logo-trigger"
        >
          <div className="bg-[#DCB48D] text-black p-2 rounded-lg pointer-events-none">
            <Sofa className="w-5 sm:w-6 h-5 sm:h-6" />
          </div>
          <div className="pointer-events-none text-left">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-wide text-text-crema">
              Hogar & Estilo
            </h1>
            <p className="text-[10px] tracking-[0.25em] text-[#DCB48D] uppercase">
              Cocina, Bazar & Organización Funcional
            </p>
          </div>
        </div>

        {/* Dynamic Navigation Tabs & Search & Actions */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4 grow md:grow-0">
          {/* Main Action Tabs */}
          <div className="flex bg-neutral-900/80 p-1 rounded-full border border-neutral-800">
            <button
              id="btn-nav-shop"
              onClick={() => onTabChange("shop")}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all cursor-pointer ${
                activeTab === "shop"
                  ? "bg-[#DCB48D] text-black shadow-sm"
                  : "text-text-crema/80 hover:text-text-crema hover:bg-[#DCB48D]/20"
              }`}
            >
              Tienda
            </button>
            <button
              id="btn-nav-tracker"
              onClick={() => onTabChange("tracker")}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all cursor-pointer ${
                activeTab === "tracker"
                  ? "bg-[#DCB48D] text-black shadow-sm"
                  : "text-text-crema/80 hover:text-text-crema hover:bg-[#DCB48D]/20"
              }`}
            >
              Seguimiento
            </button>
            {isAdminAuthenticated && (
              <button
                id="btn-nav-admin"
                onClick={() => onTabChange("admin")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === "admin"
                    ? "bg-[#DCB48D]/80 text-black shadow-sm"
                    : "text-text-crema/80 hover:text-text-crema hover:bg-[#DCB48D]/20"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Administrar
              </button>
            )}
          </div>

          {/* Search bar, only active when looking at shop tab */}
          {activeTab === "shop" && (
            <div className="relative w-full sm:w-48 md:w-60">
              <input
                id="search-input"
                type="text"
                placeholder="Buscar lámpara, mesa..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-neutral-900 text-text-crema pl-9 pr-4 py-2 rounded-full text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#DCB48D] border border-neutral-800 placeholder-text-crema/40 transition-all font-light"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#DCB48D]" />
            </div>
          )}

          {/* Shopping Cart Trigger Indicator */}
          <button
            id="shopping-cart-toggle"
            onClick={onCartToggle}
            className="relative p-2.5 rounded-full hover:bg-neutral-800 text-[#DCB48D] transition-all cursor-pointer flex items-center justify-center border border-neutral-800"
            aria-label="Ver Carrito de Compras"
          >
            <ShoppingBag className="w-4 sm:w-5 h-4 sm:h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#EE6966] text-black text-[10px] md:text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
