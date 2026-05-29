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
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  showToast,
}: ProductDetailsModalProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [commentName, setCommentName] = useState("");
  const [commentRating, setCommentRating] = useState(5);
  const [commentText, setCommentText] = useState("");
  const [localReviews, setLocalReviews] = useState<Record<string, ProductReview[]>>({});
  const [liked, setLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Default to unmuted so sound is enabled check

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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-brand-900/60 backdrop-blur-xs">
      {/* Modal Container */}
      <div className="bg-brand-50 w-full max-w-4xl rounded-2xl border border-brand-200 overflow-hidden shadow-2xl relative my-8 flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Close Button Pin and Like Button */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <button
            onClick={() => setLiked(!liked)}
            className="p-2 rounded-full bg-white/80 hover:bg-white text-rose-500 shadow-sm border border-brand-200 cursor-pointer"
            aria-label="Guardar en favoritos"
          >
            <Heart className={`w-4 h-4 ${liked ? "fill-rose-500" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/80 hover:bg-white text-brand-700 hover:text-brand-900 shadow-sm border border-brand-200 cursor-pointer"
            aria-label="Cerrar detalles"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Left Side: Media gallery & player */}
        <div className="w-full md:w-1/2 bg-white flex flex-col justify-between border-r border-brand-200 p-4 sm:p-6 overflow-y-auto max-h-[40vh] md:max-h-full">
          <div className="relative w-full aspect-square rounded-xl bg-brand-100 overflow-hidden border border-brand-200">
            {activeMediaList[activeMediaIndex]?.type === "video" ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <ResolvedVideo
                  src={activeMediaList[activeMediaIndex].url}
                  className="w-full h-full object-cover"
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
                  {isMuted ? <VolumeX className="w-5 h-5 text-red-100" /> : <Volume2 className="w-5 h-5 text-white animate-pulse" />}
                </button>
              </div>
            ) : (
              <ResolvedImage
                src={activeMediaList[activeMediaIndex]?.url || getCategoryPlaceholder(product?.category)}
                alt={product.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}

            {product.basePrice >= 50000 && (
              <span className="absolute top-3 left-3 bg-green-700 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full shadow-sm">
                Envío Totalmente Gratis
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
                    idx === activeMediaIndex ? "border-brand-900 scale-105" : "border-brand-200 hover:border-brand-400"
                  }`}
                >
                  {item.type === "video" ? (
                    <div className="w-full h-full bg-black flex items-center justify-center relative">
                      <span className="absolute inset-0 bg-brand-900/30 group-hover:bg-brand-900/10 transition-colors" />
                      <span className="text-white text-xs font-bold leading-none">VÍDEO</span>
                    </div>
                  ) : (
                    <ResolvedImage
                      src={item.url}
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
              <span className="text-[10px] tracking-widest text-brand-500 uppercase font-bold">
                {product.category}
              </span>
              <div className="h-1 w-1 bg-brand-300 rounded-full" />
              <div className="flex items-center gap-0.5">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span className="text-xs font-medium text-brand-800">{averageRating} ({reviewsList.length})</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-900 leading-tight">
              {product.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-brand-700 font-light leading-relaxed">
              {product.description}
            </p>

            {/* Key list features */}
            {product.features && product.features.length > 0 && (
              <div className="space-y-2 mt-2">
                <h4 className="font-bold text-brand-900 text-xs uppercase tracking-wider">Características Premium:</h4>
                <ul className="space-y-1.5">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-brand-700">
                      <Check className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Micro-billing options automatic calculation */}
            <div className="border-t border-b border-brand-200 py-4 my-2.5 space-y-2.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-brand-600 font-light">Monto de Lista:</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-brand-900 font-serif">
                  {formatCurrency(listPrice)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <div className="bg-brand-100 p-2.5 rounded-lg border border-brand-200 text-xs">
                  <span className="text-brand-500 block text-[10px] uppercase font-semibold">En 3 Pagos sin interés</span>
                  <strong className="text-brand-900 font-serif text-sm">3 cuotas de {formatCurrency(installmentPrice)}</strong>
                </div>
                <div className="bg-green-50 border border-green-200 p-2.5 rounded-lg text-xs">
                  <span className="text-green-700 block text-[10px] uppercase font-semibold">15% Bonificado por Transferencia</span>
                  <strong className="text-green-800 font-serif text-sm">{formatCurrency(transferPrice)}</strong>
                </div>
              </div>
            </div>

            {/* Delivery guarantee & support banner */}
            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-brand-200 space-y-3.5 text-xs text-brand-600 leading-relaxed shadow-3xs">
              <div className="flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-brand-800 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-brand-900 flex items-center gap-1">
                    <span>Envíos Gratis a Todo el País</span>
                    <span className="text-[9px] uppercase font-bold text-green-700 bg-green-50 border border-green-200 py-0.5 px-2.5 rounded-full font-sans">Bonificado desde $50.000</span>
                  </p>
                  <p className="font-light text-[11px] text-brand-700">Embalaje reforzado de alta seguridad. Despachamos gratis superando los $50.000 (Entrega en 2 a 5 días hábiles).</p>
                </div>
              </div>
              <div className="h-px bg-brand-200/80 my-0.5" />
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#00a6f3] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#00a6f3] flex items-center gap-1 font-mono text-[11px] tracking-wide uppercase">
                    🤝 Compra Protegida por Mercado Pago
                  </p>
                  <p className="font-light text-brand-600 text-[11px]">Tu dinero está 100% seguro. Si el producto no llega tal como lo soñabas, te devolvemos el total de tu importe de inmediato.</p>
                </div>
              </div>
            </div>

            {/* Volvemos Renovados Message instead of Reviews */}
            <div className="pt-5 border-t border-brand-200 text-center space-y-2">
              <span className="inline-block bg-brand-800 text-brand-50 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">
                ✨ Volvemos Renovados
              </span>
              <p className="text-xs text-brand-700 font-light leading-relaxed px-2">
                Estamos regresando renovados con colecciones exclusivas para tu hogar. Pronto habilitaremos nuevamente nuestro canal de opiniones de la comunidad. ¡Gracias por confiar en nosotros!
              </p>
            </div>

          </div>

          {/* Quick CTA bottom button */}
          <div className="pt-6 mt-4 border-t border-brand-200">
            <button
              onClick={() => onAddToCart(product)}
              className="w-full bg-brand-900 hover:bg-black text-brand-50 font-semibold text-xs sm:text-sm tracking-wider uppercase py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-transform transform active:scale-95 cursor-pointer shadow-md"
            >
              <ShoppingCart className="w-4.5 h-4.5" />
              <span>Agregar al Carrito • {formatCurrency(listPrice)}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
