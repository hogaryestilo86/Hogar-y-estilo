/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Product } from "../types";
import { ShoppingCart, Star, Sparkles, CreditCard, ArrowRightLeft, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";
import { ResolvedImage, ResolvedVideo, getCategoryPlaceholder } from "../indexedDbMedia";

interface ProductCardProps {
  key?: string;
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onBuyNow: (product: Product) => void;
}

export default function ProductCard({
  product,
  onAddToCart,
  onViewDetails,
  onBuyNow,
}: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // Cards start muted for silent grid scrolling
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Auto price variables
  const listPrice = product?.basePrice || 0;
  const installmentPrice = Math.round(listPrice / 3);
  const transferPrice = Math.round(listPrice * 0.85);

  const mediaList = product?.media || [];
  const activeMedia = mediaList[mediaIndex] || mediaList[0] || { type: "image", url: getCategoryPlaceholder(product?.category) };
  const hasMultipleMedia = mediaList.length > 1;

  const handleMouseEnter = () => {
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  const handlePrevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mediaList.length <= 1) return;
    setMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
  };

  const handleNextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mediaList.length <= 1) return;
    setMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
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
    <div
      id={`product-card-${product.id}`}
      className="bg-brand-900 border border-brand-800 rounded-xl shadow-lg hover:shadow-2xl hover:border-brand-600 transition-all duration-300 flex flex-col group overflow-hidden h-full text-white"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Product Image / Video Section */}
      <div 
        className="relative w-full h-64 sm:h-72 bg-brand-50 overflow-hidden cursor-pointer"
        onClick={() => onViewDetails(product)}
      >
        {/* Badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
          {product.basePrice >= 50000 && (
            <span className="bg-emerald-600/95 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md shadow-md">
              Envío Gratis
            </span>
          )}
        </div>

        {/* Media display */}
        <div className="w-full h-full relative">
          {activeMedia.type === "video" ? (
            <div className="w-full h-full relative">
              <ResolvedVideo
                ref={videoRef}
                src={activeMedia.url}
                backupUrl={activeMedia.backupUrl}
                className="w-full h-full object-contain bg-white p-2"
                autoPlay
                muted={isMuted}
                loop
                playsInline
              />
              {/* Botón flotante para silenciar/activar sonido en tarjetas */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // Evita abrir los detalles al tocar el silenciador
                  setIsMuted(!isMuted);
                }}
                className="absolute bottom-3 right-3 z-30 bg-black/65 hover:bg-black/90 text-white p-1.5 rounded-full shadow-lg border border-white/25 transition-all active:scale-90 flex items-center justify-center cursor-pointer pointer-events-auto hover:scale-105"
                title={isMuted ? "Activar sonido" : "Silenciar"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-200" /> : <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />}
              </button>
            </div>
          ) : (
            <ResolvedImage
              src={activeMedia.url}
              backupUrl={activeMedia.backupUrl}
              alt={product.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain bg-white p-2 transition-transform duration-700 ease-out group-hover:scale-105"
            />
          )}
        </div>

        {/* Carousel Arrow buttons */}
        {hasMultipleMedia && (
          <>
            <button
              type="button"
              onClick={handlePrevMedia}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 bg-brand-900/90 hover:bg-brand-950 text-white p-2 rounded-full shadow-md backdrop-blur-xs transition-all active:scale-90 hover:scale-105 flex items-center justify-center cursor-pointer border border-brand-800"
              title="Imagen Anterior"
            >
              <ChevronLeft className="w-4 h-4 text-brand-100 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={handleNextMedia}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 bg-brand-900/90 hover:bg-brand-950 text-white p-2 rounded-full shadow-md backdrop-blur-xs transition-all active:scale-90 hover:scale-105 flex items-center justify-center cursor-pointer border border-brand-800"
              title="Siguiente Imagen"
            >
              <ChevronRight className="w-4 h-4 text-brand-100 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Floating Indicator Dots for gallery (Interactive with tap/click) */}
        {hasMultipleMedia && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/60 px-2.5 py-1.5 rounded-full backdrop-blur-xs transition-opacity duration-300 pointer-events-auto">
            {mediaList.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMediaIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  idx === mediaIndex ? "bg-white w-4" : "bg-white/40 hover:bg-white/70"
                }`}
                title={`Ir a imagen ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Quick View Overlay (on Hover) */}
        <div className="absolute inset-0 bg-brand-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
          <span className="bg-brand-900/95 text-white text-xs font-bold tracking-wider uppercase px-4.5 py-2.5 rounded-full shadow-lg backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 scale-95 hover:scale-100 border border-brand-800">
            Ver Detalles
          </span>
        </div>
      </div>

      {/* Product Information Details */}
      <div className="p-4 sm:p-5 flex flex-col grow justify-between">
        {/* Category & Stars */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] tracking-widest text-brand-300 uppercase font-bold">
              {product.category}
            </span>
            <div className="flex items-center gap-1 bg-brand-850 px-2 py-0.5 rounded-md border border-brand-800">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-white">
                {(product?.reviews || []).length > 0 
                  ? ((product.reviews || []).reduce((acc, r) => acc + r.rating, 0) / (product.reviews || []).length).toFixed(1) 
                  : "5.0"}
              </span>
            </div>
          </div>

          <h3 
            onClick={() => onViewDetails(product)}
            className="font-serif text-lg sm:text-xl font-bold text-white hover:text-brand-300 cursor-pointer transition-colors line-clamp-1 mb-2"
          >
            {product.title}
          </h3>

          <p className="text-xs sm:text-sm text-brand-200 font-light line-clamp-2 md:line-clamp-3 mb-4 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Premium Pricing Lógica */}
        <div className="mt-2 border-t border-brand-800 pt-3">
          {/* Base regular lists price */}
          <div className="flex items-baseline justify-between">
            <span className="text-brand-400 text-xs font-light">Precio de lista:</span>
            <div className="flex flex-col items-end">
              {product.beforePrice && product.beforePrice > listPrice && (
                <span className="text-xs line-through text-red-400 font-semibold leading-none mb-0.5">
                  {formatCurrency(product.beforePrice)}
                </span>
              )}
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-serif leading-none">
                {formatCurrency(listPrice)}
              </span>
            </div>
          </div>

          {product.beforePrice && product.beforePrice > listPrice && (
            <div className="flex justify-end mt-1.5">
              <span className="bg-amber-450 text-brand-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-amber-350 inline-flex items-center gap-1 shadow-sm animate-pulse">
                🔥 ¡Ahorrás {formatCurrency(product.beforePrice - listPrice)}!
              </span>
            </div>
          )}

          {/* installment calculation (3 installments without interest) */}
          <div className="flex items-center gap-1.5 text-xs text-brand-200 mt-2">
            <CreditCard className="w-3.5 h-3.5 text-brand-300 shrink-0" />
            <span>
              Llevatelo en <strong className="text-white">3 cuotas de {formatCurrency(installmentPrice)} sin interés</strong>
            </span>
          </div>

          {/* transfer discount (15% cash discount, bold green) */}
          <div className="flex flex-col gap-1 text-xs mt-2 bg-emerald-950/45 p-2.5 rounded-xl border border-emerald-800/40">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Transferencia: <strong className="text-sm font-black text-emerald-250">{formatCurrency(transferPrice)}</strong> (¡<strong className="text-emerald-300 font-extrabold">15% OFF</strong>!)
              </span>
            </div>
            <div className="text-[10px] text-emerald-300/80 font-normal pl-5 leading-none">
              💡 Pagando por Transferencia ahorrás <strong className="font-bold text-emerald-200">{formatCurrency(listPrice - transferPrice)}</strong> más
            </div>
          </div>
        </div>

        {/* Buy Now & Add to Cart Action Buttons set */}
        <div className="space-y-2 mt-4">
          <button
            id={`btn-buynow-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onBuyNow(product);
            }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-brand-950 font-black text-xs sm:text-sm tracking-wider uppercase py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.01]"
          >
            <Sparkles className="w-4 h-4 text-brand-950 animate-pulse" />
            <span>Comprar ahora</span>
          </button>
          
          <button
            id={`btn-add-${product.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="w-full bg-brand-800 hover:bg-brand-750 text-white border border-brand-700 font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-brand-350" />
            <span>Agregar al carrito</span>
          </button>
        </div>
      </div>
    </div>
  );
}
