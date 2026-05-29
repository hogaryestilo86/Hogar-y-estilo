/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Product } from "../types";
import { ShoppingCart, Star, Sparkles, CreditCard, ArrowRightLeft, Volume2, VolumeX } from "lucide-react";
import { ResolvedImage, ResolvedVideo, getCategoryPlaceholder } from "../indexedDbMedia";

interface ProductCardProps {
  key?: string;
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
}

export default function ProductCard({
  product,
  onAddToCart,
  onViewDetails,
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
    if (hasMultipleMedia) {
      // Switch to the second media on hover
      setMediaIndex(1);
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setMediaIndex(0);
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
      className="bg-white rounded-xl border border-brand-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group overflow-hidden h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Product Image / Video Section */}
      <div 
        className="relative w-full h-64 sm:h-72 bg-brand-100 overflow-hidden cursor-pointer"
        onClick={() => onViewDetails(product)}
      >
        {/* Badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
          {product.basePrice >= 50000 && (
            <span className="bg-green-700/90 text-brand-50 text-[10px] font-medium tracking-wider uppercase px-2.5 py-1 rounded-full shadow-sm">
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
                className="w-full h-full object-cover"
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
                className="absolute bottom-3 right-3 z-30 bg-black/60 hover:bg-black/85 text-white p-1.5 rounded-full shadow-lg border border-white/20 transition-all active:scale-90 flex items-center justify-center cursor-pointer pointer-events-auto hover:scale-105"
                title={isMuted ? "Activar sonido" : "Silenciar"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-200" /> : <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />}
              </button>
            </div>
          ) : (
            <ResolvedImage
              src={activeMedia.url}
              alt={product.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          )}
        </div>

        {/* Floating Indicator Dots for gallery */}
        {hasMultipleMedia && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20 bg-brand-900/40 px-2 py-1 rounded-full backdrop-blur-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {mediaList.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === mediaIndex ? "bg-white w-3" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Quick View Overlay (on Hover) */}
        <div className="absolute inset-0 bg-brand-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
          <span className="bg-white/95 text-brand-900 text-xs font-semibold tracking-wider uppercase px-4.5 py-2.5 rounded-full shadow-md backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 scale-95 hover:scale-100">
            Ver Detalles
          </span>
        </div>
      </div>

      {/* Product Information Details */}
      <div className="p-4 sm:p-5 flex flex-col grow justify-between">
        {/* Category & Stars */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] tracking-widest text-brand-500 uppercase font-semibold">
              {product.category}
            </span>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span className="text-xs font-medium text-brand-800">
                {(product?.reviews || []).length > 0 
                  ? ((product.reviews || []).reduce((acc, r) => acc + r.rating, 0) / (product.reviews || []).length).toFixed(1) 
                  : "5.0"}
              </span>
            </div>
          </div>

          <h3 
            onClick={() => onViewDetails(product)}
            className="font-serif text-lg sm:text-xl font-medium text-brand-900 hover:text-brand-500 cursor-pointer transition-colors line-clamp-1 mb-2"
          >
            {product.title}
          </h3>

          <p className="text-xs sm:text-sm text-brand-700 font-light line-clamp-2 md:line-clamp-3 mb-4 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Premium Pricing Lógica */}
        <div className="mt-2 border-t border-brand-100 pt-3">
          {/* Base regular lists price */}
          <div className="flex items-baseline justify-between">
            <span className="text-brand-500 text-xs font-light">Precio de lista:</span>
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-brand-900 font-serif">
              {formatCurrency(listPrice)}
            </span>
          </div>

          {/* installment calculation (3 installments without interest) */}
          <div className="flex items-center gap-1.5 text-xs text-brand-700 mt-1">
            <CreditCard className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span>
              Ver en <strong>3 cuotas de {formatCurrency(installmentPrice)} sin interés</strong>
            </span>
          </div>

          {/* transfer discount (15% cash discount, bold green) */}
          <div className="flex items-center gap-1.5 text-xs text-green-700 mt-1 bg-green-50 p-1.5 rounded-md border border-green-200">
            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
            <span>
              Transferencia: <strong className="text-sm font-extrabold">{formatCurrency(transferPrice)}</strong> (¡<strong>15% OFF</strong>!)
            </span>
          </div>
        </div>

        {/* Add to Cart Button */}
        <button
          id={`btn-add-${product.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          className="w-full mt-4 bg-brand-800 hover:bg-brand-900 text-white font-medium text-xs sm:text-sm tracking-wider uppercase py-2.5 sm:py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-sm hover:shadow-md"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Agregar al Carrito</span>
        </button>
      </div>
    </div>
  );
}
