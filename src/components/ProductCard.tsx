/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Product } from "../types";
import { ShoppingCart, Star, Sparkles, CreditCard, ArrowRightLeft, Volume2, VolumeX, ChevronLeft, ChevronRight, Play, X, Video, Instagram } from "lucide-react";
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
  const [modalOpen, setModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Monitor detail modal open state dynamically to stop rendering video elements in background
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isOpen = document.body.classList.contains("modal-open");
      setModalOpen(isOpen);
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    setModalOpen(document.body.classList.contains("modal-open"));

    return () => observer.disconnect();
  }, []);

  // Auto price variables
  const listPrice = product?.basePrice || 0;
  const installmentPrice = Math.round(listPrice / 3);
  const transferPrice = Math.round(listPrice * 0.85);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const mediaList = product?.media || [];
  
  // Prioritize image assets for card display, but allow fallback to video backup posters instead of forcing a default placeholder
  const imageMediaList = mediaList.filter(item => item && item.type === "image");
  
  const displayMediaList = imageMediaList.length > 0
    ? imageMediaList
    : (mediaList.length > 0
        ? mediaList
        : [{ type: "image", url: getCategoryPlaceholder(product?.category), backupUrl: undefined }]);

  const activeMedia = displayMediaList[mediaIndex] || displayMediaList[0] || { type: "image", url: getCategoryPlaceholder(product?.category), backupUrl: undefined };
  const hasMultipleMedia = displayMediaList.length > 1;

  const handleMouseEnter = () => {
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  const handlePrevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayMediaList.length <= 1) return;
    setMediaIndex((prev) => (prev > 0 ? prev - 1 : displayMediaList.length - 1));
  };

  const handleNextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayMediaList.length <= 1) return;
    setMediaIndex((prev) => (prev < displayMediaList.length - 1 ? prev + 1 : 0));
  };

  // Find if there is any local/remote video asset attached to this product for the floating bubble
  const videoItem = mediaList.find(item => item && item.type === "video");
  const hasVideo = !!videoItem;

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
      className="bg-[#ded7c4] border border-[#c4bba3] rounded-2xl shadow-sm hover:shadow-xl transition-all duration-350 flex flex-col group overflow-hidden h-full text-brand-950"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Product Image / Video Section */}
      <div 
        className="relative w-full h-[360px] sm:h-[400px] bg-[#d4cbba] overflow-hidden cursor-pointer border-b border-[#c4bba3]"
        onClick={() => onViewDetails(product)}
      >
        {/* Badges - Highly Eye-catching gradient badges inviting high conversions */}
        <div className="absolute top-3 left-0 right-0 z-20 px-3 flex flex-col gap-1.5 items-center justify-center pointer-events-none">
          {product.basePrice >= 50000 ? (
            <>
              <span className="w-full text-center bg-gradient-to-r from-emerald-600 via-emerald-700 to-green-600 text-white text-[10.5px] font-black tracking-wider uppercase px-3 py-1.5 rounded-xl shadow-lg border border-emerald-400/40 flex items-center justify-center gap-1.5 backdrop-blur-xs animate-pulse">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                🚚 ¡ENVÍO GRATIS!
              </span>
              {product.beforePrice && product.beforePrice > listPrice && (
                <span className="w-full text-center bg-gradient-to-r from-[#DC2626] to-amber-600 text-white text-[10.5px] font-black tracking-wider uppercase px-3 py-1.5 rounded-xl shadow-md border border-rose-500/40 flex items-center justify-center gap-1 backdrop-blur-xs">
                  🔥 ¡AHORRÁS {formatCurrency(product.beforePrice - listPrice)}!
                </span>
              )}
            </>
          ) : (
            product.beforePrice && product.beforePrice > listPrice && (
              <span className="max-w-[90%] text-center bg-gradient-to-r from-red-650 via-[#DC2626] to-amber-600 text-white text-[10.5px] font-black tracking-wider uppercase px-4 py-1.5 rounded-xl shadow-lg border border-rose-500/40 flex items-center justify-center gap-1.5 backdrop-blur-xs mx-auto animate-pulse">
                🔥 ¡AHORRÁS {formatCurrency(product.beforePrice - listPrice)}!
              </span>
            )
          )}
        </div>

        {/* Media display */}
        <div className={`w-full h-full relative ${
          (product.basePrice >= 50000 || (product.beforePrice && product.beforePrice > listPrice)) ? "pt-[76px]" : "pt-2"
        } pb-2`}>
          <ResolvedImage
            productId={product.id}
            src={activeMedia.type === "video" ? (activeMedia.backupUrl || activeMedia.url) : activeMedia.url}
            backupUrl={activeMedia.backupUrl}
            category={product.category}
            alt={product.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain bg-brand-950 p-1.5 transition-transform duration-700 ease-out group-hover:scale-105"
          />

          {/* Floating and pulsating interactive video bubble above the photo */}
          {hasVideo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Avoid triggering standard product details drawer
                setShowVideoModal(true);
              }}
              className="absolute bottom-4 left-4 z-40 bg-pink-650 hover:bg-pink-700 text-white text-[10px] font-black tracking-widest pl-2 bg-gradient-to-r from-pink-600 to-rose-600 border border-pink-400 pl-3 pr-4 py-2.5 rounded-full shadow-2xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer select-none pointer-events-auto"
              title="Click para ver video del producto"
            >
              <span className="flex items-center justify-center p-1 rounded-full bg-yellow-400 text-rose-950 animate-pulse">
                <Play className="w-2.5 h-2.5 fill-current" />
              </span>
              <span>VER VIDEO 🎬</span>
            </button>
          )}
        </div>

        {/* Carousel Arrow buttons */}
        {hasMultipleMedia && (
          <>
            <button
               type="button"
               onClick={handlePrevMedia}
               className="absolute left-2.5 top-1/2 -translate-y-1/2 z-30 bg-white/95 hover:bg-white text-brand-950 p-2 rounded-full shadow-md backdrop-blur-xs transition-all active:scale-90 hover:scale-105 flex items-center justify-center cursor-pointer border border-[#c4bba3]"
               title="Imagen Anterior"
            >
              <ChevronLeft className="w-4 h-4 text-brand-950 stroke-[2.5]" />
            </button>
            <button
               type="button"
               onClick={handleNextMedia}
               className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 bg-white/95 hover:bg-white text-brand-950 p-2 rounded-full shadow-md backdrop-blur-xs transition-all active:scale-90 hover:scale-105 flex items-center justify-center cursor-pointer border border-[#c4bba3]"
               title="Siguiente Imagen"
            >
              <ChevronRight className="w-4 h-4 text-brand-950 stroke-[2.5]" />
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
          <span className="bg-brand-950/95 text-white text-xs font-black tracking-widest uppercase px-5 py-3 rounded-full shadow-lg backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 scale-95 hover:scale-100 border border-brand-800">
            Ver Detalles
          </span>
        </div>
      </div>

      {/* Product Information Details */}
      <div className="p-4 sm:p-5 flex flex-col grow justify-between">
        {/* Category & Stars */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] tracking-widest text-brand-800 uppercase font-extrabold bg-[#cdbfab] px-2 py-0.5 rounded-md">
              {product.category}
            </span>
            <div className="flex items-center gap-1 bg-[#ccbfab] px-2 py-0.5 rounded-md border border-[#bfae98]">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span className="text-xs font-black text-brand-950">
                {(product?.reviews || []).length > 0 
                  ? ((product.reviews || []).reduce((acc, r) => acc + r.rating, 0) / (product.reviews || []).length).toFixed(1) 
                  : "5.0"}
              </span>
            </div>
          </div>

          <h3 
            onClick={() => onViewDetails(product)}
            className="font-serif text-lg sm:text-xl font-bold text-brand-950 hover:text-brand-800 cursor-pointer transition-colors line-clamp-1 mb-2"
          >
            {product.title}
          </h3>

          <p className="text-xs sm:text-sm text-brand-900 font-normal line-clamp-2 md:line-clamp-3 mb-4 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Premium Pricing Lógica */}
        <div className="mt-2 border-t border-[#c4bba3] pt-3">
          {/* Base regular lists price */}
          <div className="flex items-baseline justify-between">
            <span className="text-brand-800 text-xs font-bold">Precio de lista:</span>
            <div className="flex flex-col items-end">
              {product.beforePrice && product.beforePrice > listPrice && (
                <span className="text-xs line-through text-red-600 font-extrabold leading-none mb-0.5">
                  {formatCurrency(product.beforePrice)}
                </span>
              )}
              <span className="text-xl sm:text-2xl font-black tracking-tight text-brand-950 font-serif leading-none">
                {formatCurrency(listPrice)}
              </span>
            </div>
          </div>

          {product.beforePrice && product.beforePrice > listPrice && (
            <div className="flex justify-end mt-1.5">
              <span className="bg-gradient-to-r from-red-50 to-amber-50 text-red-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-red-200 inline-flex items-center gap-1 shadow-xs animate-pulse">
                🔥 ¡Ahorrás {formatCurrency(product.beforePrice - listPrice)}!
              </span>
            </div>
          )}

          {/* installment calculation (3 installments without interest) */}
          <div className="flex items-center gap-1.5 text-xs text-brand-900 mt-2 font-medium">
            <CreditCard className="w-3.5 h-3.5 text-brand-750 shrink-0" />
            <span>
              Llevatelo en <strong className="text-brand-950 font-black">3 cuotas de {formatCurrency(installmentPrice)} sin interés</strong>
            </span>
          </div>

          {/* transfer discount (15% cash discount, bold green) */}
          <div className="flex flex-col gap-1 text-xs mt-2 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Transferencia: <strong className="text-sm font-black text-emerald-950">{formatCurrency(transferPrice)}</strong> (¡<strong className="text-emerald-700 font-black">15% OFF</strong>!)
              </span>
            </div>
            <div className="text-[10px] text-emerald-800/90 font-bold pl-5 leading-none">
              💡 Pagando por Transferencia ahorrás <strong className="font-extrabold text-emerald-940">{formatCurrency(listPrice - transferPrice)}</strong> más
            </div>
          </div>
        </div>

        {/* Dynamic CTAs - Unified Consultation and Instant Purchase blocks to guarantee conversion */}
        <div className="space-y-1.5 mt-2.5">
          {/* Social direct messaging query styled as a smaller, non-invasive Instagram gradient button */}
          <div className="flex justify-center">
            <a
              id={`btn-stock-instagram-${product.id}`}
              href={`https://instagram.com/deco.home.rosario`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="inline-flex max-w-max mx-auto bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:brightness-110 text-white font-black text-[7.5px] scale-95 tracking-wider uppercase py-0.5 px-2 rounded items-center justify-center gap-1 transition-all text-center cursor-pointer shadow-3xs transform active:scale-95 border-0"
              title="Consultar Stock del producto por Instagram"
            >
              <Instagram className="w-2.5 h-2.5 text-white" />
              <span>Consultar Stock 📱</span>
            </a>
          </div>

          {/* Standard instant purchase hooks - Free of barriers (thin & full width stacked layout) */}
          <div className="flex flex-col gap-1 pt-0.5">
            <button
              id={`btn-buynow-${product.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onBuyNow(product);
              }}
              className="w-full bg-pink-400 hover:bg-pink-500 text-white font-black text-[11px] tracking-wider uppercase py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all transform active:scale-95 cursor-pointer shadow-2xs"
            >
              <span>Comprar ahora 🛍️</span>
            </button>
            
            <button
              id={`btn-add-${product.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10.5px] tracking-wide uppercase py-1 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all transform active:scale-95 cursor-pointer shadow-2xs border-0"
            >
              <span>Agregar al Carrito 🛒</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Video Modal Lightbox - Expands beautifully and plays with sound */}
      {showVideoModal && videoItem && (
        <div 
          className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex flex-col justify-center items-center p-4 transition-all duration-300"
          onClick={(e) => {
            e.stopPropagation();
            setShowVideoModal(false);
          }}
        >
          {/* Close button inside modal */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowVideoModal(false);
            }}
            className="absolute top-5 right-5 z-[260] p-3 text-white bg-black/60 hover:bg-black/90 border border-white/20 rounded-full transition-all active:scale-95 hover:scale-110 cursor-pointer flex items-center justify-center shadow-lg"
            title="Cerrar reproductor"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Large video player container */}
          <div 
            className="relative w-full max-w-2xl aspect-[9/16] sm:max-h-[85vh] flex items-center justify-center bg-black/50 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ResolvedVideo
              src={videoItem.url}
              backupUrl={videoItem.backupUrl}
              category={product.category}
              className="w-full h-full object-contain"
              autoPlay
              controls
              playsInline
            />
          </div>

          {/* Video Metadata / Details banner */}
          <div className="text-center mt-5 max-w-md px-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-black text-lg tracking-tight">{product.title}</h3>
            <p className="text-pink-300/90 text-xs mt-1.5 font-mono uppercase tracking-widest flex items-center justify-center gap-1.5">
              <span>🎬 Video de Demostración</span>
              <span>•</span>
              <span>Categoría: {product.category}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
