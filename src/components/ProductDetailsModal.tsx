/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Product, ProductReview } from "../types";
import { X, Star, ShoppingCart, Check, ShieldCheck, Heart, Sparkles, MessageSquare, Plus, Send, Truck, Volume2, VolumeX } from "lucide-react";
import { ResolvedImage, ResolvedVideo, getCategoryPlaceholder } from "../indexedDbMedia";

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onBuyNow?: (product: Product) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onBuyNow,
  showToast,
}: ProductDetailsModalProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [commentName, setCommentName] = useState("");
  const [commentRating, setCommentRating] = useState(5);
  const [commentText, setCommentText] = useState("");
  const [localReviews, setLocalReviews] = useState<Record<string, ProductReview[]>>({});
  const [liked, setLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Default to unmuted so sound is enabled check

  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isOpen]);

  const notify = (msg: string, type: "success" | "error" | "info" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      console.log(`[Toast Fallback] ${type.toUpperCase()}: ${msg}`);
    }
  };

  if (!isOpen || !product) return null;

  const activeMediaList = product.media || [];

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentName.trim() || !commentText.trim()) {
      notify("Por favor completa tu nombre y tu reseña para continuar.", "error");
      return;
    }

    const newReview: ProductReview = {
      id: `rev-${Date.now()}`,
      author: commentName,
      rating: commentRating,
      comment: commentText,
      date: "Ahora mismo"
    };

    const updated = localReviews[product.id] 
      ? [newReview, ...localReviews[product.id]]
      : [newReview];

    setLocalReviews({
      ...localReviews,
      [product.id]: updated
    });

    setCommentName("");
    setCommentText("");
    setCommentRating(5);
  };

  const reviewsList = [
    ...(localReviews[product.id] || []),
    ...product.reviews
  ];

  const averageRating = reviewsList.length > 0 
    ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1)
    : "5.0";

  // Calculations
  const listPrice = product.basePrice;
  const installmentPrice = Math.round(listPrice / 3);
  const transferPrice = Math.round(listPrice * 0.85);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/80 backdrop-blur-sm">
      {/* Modal Container - Darker Sand bg with ultra high-contrast styling */}
      <div className="bg-[#d2c7b0] w-full max-w-4xl rounded-2xl border border-[#b8ad90] overflow-hidden shadow-2xl relative my-8 flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Close Button Pin and Like Button */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <button
            onClick={() => setLiked(!liked)}
            className="p-2 rounded-full bg-[#fcfbfa]/90 hover:bg-white text-rose-600 shadow-sm border border-[#b8ad90] cursor-pointer"
            aria-label="Guardar en favoritos"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-rose-600" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#fcfbfa]/90 hover:bg-white text-brand-950 hover:text-black shadow-sm border border-[#b8ad90] cursor-pointer"
            aria-label="Cerrar detalles"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Left Side: Media gallery & player */}
        <div className="w-full md:w-1/2 bg-[#eedfc9]/40 flex flex-col justify-between border-r border-[#b8ad90] p-4 sm:p-6 overflow-y-auto max-h-[40vh] md:max-h-full">
          <div className="relative w-full aspect-square rounded-xl bg-brand-950 overflow-hidden border border-[#b8ad90] flex items-center justify-center">
            {activeMediaList[activeMediaIndex]?.type === "video" ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <ResolvedVideo
                  src={activeMediaList[activeMediaIndex].url}
                  backupUrl={activeMediaList[activeMediaIndex].backupUrl}
                  category={product.category}
                  className="max-w-full max-h-full object-contain"
                  style={{ maxWidth: "100%", objectFit: "contain" }}
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  controls
                />
                {/* Botón flotante para silenciar/activar sonido */}
                <button
                  type="button"
                  onClick={(e) => {
                     e.stopPropagation();
                     setIsMuted(!isMuted);
                  }}
                  className="absolute bottom-16 right-4 z-40 bg-brand-900/90 hover:bg-black text-white p-2.5 rounded-full shadow-lg border border-brand-800 transition-all active:scale-95 flex items-center justify-center cursor-pointer hover:scale-105"
                  title={isMuted ? "Activar sonido" : "Silenciar video"}
                >
                  {isMuted ? <VolumeX className="w-5 h-5 text-red-105" /> : <Volume2 className="w-5 h-5 text-white animate-pulse" />}
                </button>
              </div>
            ) : (
              <ResolvedImage
                src={activeMediaList[activeMediaIndex]?.url || getCategoryPlaceholder(product?.category)}
                backupUrl={activeMediaList[activeMediaIndex]?.backupUrl}
                category={product?.category}
                alt={product.title}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain"
                style={{ maxWidth: "100%", objectFit: "contain" }}
              />
            )}

            {product.basePrice >= 50000 && (
              <span className="absolute top-4 left-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-green-650 text-white text-[11px] font-black tracking-widest uppercase px-3.5 py-1.5 rounded-xl shadow-lg border border-emerald-400/40 flex items-center gap-1.5 backdrop-blur-xs animate-pulse">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                🚚 ENVÍO TOTALMENTE GRATIS
              </span>
            )}
          </div>

          {/* Media thumbnails track */}
          {activeMediaList.length > 1 && (
            <div className="flex gap-2.5 mt-4 overflow-x-auto pb-1">
              {activeMediaList.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveMediaIndex(idx)}
                  className={`relative w-16 sm:w-20 aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all shrink-0 ${
                    idx === activeMediaIndex ? "border-brand-950 scale-105" : "border-[#b8ad90] hover:border-brand-950"
                  }`}
                >
                  {item.type === "video" ? (
                    <div className="w-full h-full relative bg-brand-950 flex items-center justify-center">
                      <ResolvedImage
                        src={item.backupUrl || getCategoryPlaceholder(product.category)}
                        backupUrl={item.backupUrl}
                        category={product.category}
                        alt={`Video Thumbnail`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-60 transition-transform hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
                        <span className="p-1 rounded-full bg-white/20 backdrop-blur-xs text-white">
                          <svg className="w-3 h-3 fill-white text-white" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                        <span className="text-white text-[8px] font-black tracking-widest uppercase">VÍDEO</span>
                      </div>
                    </div>
                  ) : (
                    <ResolvedImage
                      src={item.url}
                      backupUrl={item.backupUrl}
                      category={product.category}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Product properties, features, ratings & reviews */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 flex flex-col justify-between overflow-y-auto max-h-[50vh] md:max-h-full">
          <div className="space-y-4">
            {/* Category header */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest text-brand-800 bg-[#ccbfab] px-2.5 py-0.5 rounded-md uppercase font-extrabold">
                {product.category}
              </span>
              <div className="h-1.5 w-1.5 bg-[#bfae98] rounded-full" />
              <div className="flex items-center gap-0.5 bg-[#ccbfab] px-2 py-0.5 rounded-md border border-[#bfae98]">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span className="text-xs font-black text-brand-950">{averageRating} ({reviewsList.length})</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="font-serif text-2xl sm:text-3xl font-black text-brand-950 leading-tight">
              {product.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-brand-900 font-normal leading-relaxed">
              {product.description}
            </p>

            {/* Key list features */}
            {product.features && product.features.length > 0 && (
              <div className="space-y-2 mt-2">
                <h4 className="font-black text-brand-950 text-xs uppercase tracking-wider">Características Premium:</h4>
                <ul className="space-y-1.5">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-brand-900 font-bold">
                      <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 stroke-[2.5]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Micro-billing options automatic calculation */}
            <div className="border-t border-b border-[#c4bba3] py-4 my-2.5 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-brand-900 font-bold uppercase tracking-wider">Monto de Lista:</span>
                <div className="flex flex-col items-end">
                  {product.beforePrice && product.beforePrice > listPrice && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs line-through text-red-650 font-black leading-none">
                        {formatCurrency(product.beforePrice)}
                      </span>
                      <span className="bg-gradient-to-r from-[#DC2626] to-amber-600 text-white text-[9.5px] font-black px-2 py-0.5 rounded shadow-xs animate-pulse">
                        ¡AHORRÁS {formatCurrency(product.beforePrice - listPrice)}!
                      </span>
                    </div>
                  )}
                  <span className="text-2xl sm:text-3xl font-black text-brand-950 font-serif leading-none mt-1">
                    {formatCurrency(listPrice)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <div className="bg-[#ccbfab]/60 p-2.5 rounded-lg border border-[#c4bba3] text-xs">
                  <span className="text-[#3a352c] block text-[10px] uppercase font-bold">En 3 Pagos sin interés</span>
                  <strong className="text-brand-950 font-serif text-sm">3 cuotas de {formatCurrency(installmentPrice)}</strong>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg text-xs">
                  <span className="text-emerald-800 block text-[10px] uppercase font-black">15% Bonificado por Transferencia</span>
                  <strong className="text-brand-950 font-serif text-sm">{formatCurrency(transferPrice)}</strong>
                </div>
              </div>
            </div>

            {/* Delivery guarantee & support banner - Highly readable and reassuring */}
            <div className="bg-[#f2ead7] p-3.5 rounded-xl border border-[#c4bba3] space-y-3.5 text-xs text-brand-950 leading-relaxed shadow-3xs">
              <div className="flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-brand-800 shrink-0 mt-0.5" />
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <p className="font-extrabold text-brand-950">
                      Envíos Gratis a Todo el País
                    </p>
                    <span className="text-[10px] uppercase font-black text-white bg-red-600 border border-red-500 py-1 px-3 rounded-full font-sans animate-pulse shadow-sm flex items-center gap-1">
                      🚚 Conseguí envío gratis en compras de $50.000 en adelante
                    </span>
                  </div>
                  <p className="font-medium text-[11px] text-brand-900 mt-2">Embalaje de máxima seguridad. ¡Despachamos gratis en el día superando los $50.000! (Entrega rápida de 2 a 5 días hábiles).</p>
                </div>
              </div>
              <div className="h-px bg-[#c4bba3]/60 my-0.5" />
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-[#111827] flex items-center gap-1.5 font-sans text-[11.5px] tracking-wide uppercase">
                    🛡️ Compra Protegida por Mercado Pago
                  </p>
                  <p className="font-medium text-brand-900 text-[11px]">Tu dinero está 100% resguardado de forma oficial. Si tu entrega no llega impecable, te reintegramos el total de forma inmediata.</p>
                </div>
              </div>
            </div>

            {/* Volvemos Renovados Message instead of Reviews */}
            <div className="pt-5 border-t border-[#c4bba3] text-center space-y-2">
              <span className="inline-block bg-[#1e1c18] text-[#fcfbfa] text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">
                ✨ Volvemos Renovados
              </span>
              <p className="text-xs text-brand-950 font-bold leading-relaxed px-2">
                Estamos regresando renovados con colecciones exclusivas para tu hogar. Pronto habilitaremos nuevamente nuestro canal de opiniones de la comunidad. ¡Gracias por confiar en nosotros!
              </p>
            </div>

          </div>

          {/* Quick CTA bottom buttons */}
          <div className="pt-6 mt-4 border-t border-[#c4bba3] flex flex-col sm:flex-row gap-3">
            {onBuyNow && (
              <button
                onClick={() => {
                  onBuyNow(product);
                  onClose();
                }}
                className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs sm:text-sm tracking-widest uppercase py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.01]"
              >
                <Sparkles className="w-4.5 h-4.5 text-amber-300 animate-pulse" />
                <span>Comprar ahora</span>
              </button>
            )}
            <button
              onClick={() => onAddToCart(product)}
              className="flex-1 bg-[#fdf2f5] hover:bg-[#fce7ec] text-pink-700 border border-pink-300 font-extrabold text-xs sm:text-sm tracking-widest uppercase py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <ShoppingCart className="w-4.5 h-4.5 text-pink-600" />
              <span>Agregar al Carrito • {formatCurrency(listPrice)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
