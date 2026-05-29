/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CartItem } from "../types";
import { X, ArrowRight, Trash2, ShieldCheck, HelpCircle, Truck, RefreshCw } from "lucide-react";
import { ResolvedImage, ResolvedVideo, getCategoryPlaceholder } from "../indexedDbMedia";

interface SlideOutCartProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
}

export default function SlideOutCart({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}: SlideOutCartProps) {
  const FREE_SHIPPING_LIMIT = 50000;
  const SHIPPING_COST = 5800;

  // Calculations
  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.product.basePrice * item.quantity,
    0
  );

  const isFreeShipping = subtotal >= FREE_SHIPPING_LIMIT;
  const remainingForFreeShipping = FREE_SHIPPING_LIMIT - subtotal;
  const shipping = cartItems.length === 0 ? 0 : isFreeShipping ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;

  const progressPercent = Math.min((subtotal / FREE_SHIPPING_LIMIT) * 100, 100);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-modal="true" role="dialog">
      {/* Dark overlay backdrop */}
      <div 
        className="absolute inset-0 bg-brand-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex">
        {/* Sliding Panel */}
        <div className="w-screen max-w-md bg-brand-50 shadow-2xl flex flex-col h-full transform transition-all duration-300 border-l border-brand-200">
          
          {/* Cart Header */}
          <div className="p-4 sm:p-5 border-b border-brand-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-brand-900">Tu Bolsa de Compra</h2>
              <span className="text-xs bg-brand-200 text-brand-800 font-bold px-2 py-0.5 rounded-full">
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            </div>
            <button
              id="btn-cart-close"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-brand-100 text-brand-700 hover:text-brand-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Shipping Threshold Progress Metagame */}
          <div className="p-4 sm:p-5 bg-white border-b border-brand-100">
            {cartItems.length === 0 ? (
              <p className="text-xs sm:text-sm text-brand-500 font-light text-center">
                Carga productos para calcular el envío gratis.
              </p>
            ) : isFreeShipping ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs sm:text-sm text-green-700 flex items-center gap-1.5 font-medium">
                  <Truck className="w-4 h-4" />
                  ¡Felicitaciones! Tenés <strong>Envío Gratis</strong> para todo este pedido.
                </p>
                <div className="w-full bg-green-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-green-700 h-full rounded-full transition-all duration-500 w-full" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs sm:text-sm text-brand-800 font-light">
                  Estás a solo <strong className="font-bold text-brand-900">{formatCurrency(remainingForFreeShipping)}</strong> de obtener <strong className="font-semibold text-green-700">Envío Gratis</strong>.
                </p>
                <div className="w-full bg-brand-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand-800 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-brand-500 italic">
                  Umbral de envío gratis: {formatCurrency(FREE_SHIPPING_LIMIT)} ARS.
                </p>
              </div>
            )}
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {cartItems.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-4">
                <div className="text-brand-300 text-6xl">🛍️</div>
                <div>
                  <p className="text-lg font-serif font-bold text-brand-900">Tu bolsa está vacía</p>
                  <p className="text-xs sm:text-sm text-brand-500 font-light mt-1">
                    Animate a decorar tu hogar con nuestra exclusiva curaduría.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="bg-brand-800 hover:bg-brand-900 text-brand-50 px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium tracking-wider uppercase transition-all cursor-pointer"
                >
                  Seguir Comprando
                </button>
              </div>
            ) : (
              cartItems.map((item) => {
                const product = item.product;
                const activeMedia = product.media && product.media.length > 0 ? product.media[0] : null;
                const isVideoMedia = activeMedia?.type === "video";
                const mediaUrl = activeMedia?.url || getCategoryPlaceholder(product.category);
                
                return (
                  <div 
                    key={product.id}
                    className="flex bg-white rounded-lg p-3 border border-brand-200 hover:border-brand-300 shadow-xs transition-shadow relative"
                  >
                    {/* Image or Video Preview */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md border border-brand-200 overflow-hidden bg-brand-100 shrink-0 relative flex items-center justify-center">
                      {isVideoMedia ? (
                        <ResolvedVideo
                          src={mediaUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          autoPlay
                          loop
                        />
                      ) : (
                        <ResolvedImage
                          src={mediaUrl}
                          alt={product.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="ml-3 sm:ml-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-serif text-sm sm:text-base font-semibold text-brand-900 line-clamp-1 pr-4">
                            {product.title}
                          </h4>
                          <button
                            onClick={() => onRemoveItem(product.id)}
                            className="p-1 text-brand-400 hover:text-red-600 transition-colors cursor-pointer shrink-0 absolute top-2 right-2"
                            aria-label={`Eliminar ${product.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-brand-500 font-light mt-0.5 uppercase tracking-wider">
                          {product.category}
                        </p>
                        <p className="text-sm font-serif font-semibold text-brand-900 mt-1">
                          {formatCurrency(product.basePrice)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-brand-300 rounded-md bg-brand-100 overflow-hidden">
                          <button
                            onClick={() => onUpdateQuantity(product.id, -1)}
                            className="px-2.5 py-1 text-brand-700 hover:bg-brand-200 text-xs sm:text-sm transition-colors font-medium cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-xs text-brand-900 font-semibold bg-white border-x border-brand-200 min-w-[28px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(product.id, 1)}
                            className="px-2.5 py-1 text-brand-700 hover:bg-brand-200 text-xs sm:text-sm transition-colors font-medium cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        
                        <p className="text-xs sm:text-sm font-bold text-brand-900 font-serif">
                          Subtotal: {formatCurrency(product.basePrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Pricing summary and triggers */}
          {cartItems.length > 0 && (
            <div className="p-4 sm:p-5 bg-white border-t border-brand-200 space-y-4 shadow-top">
              <div className="space-y-1.5 text-xs sm:text-sm text-brand-700">
                <div className="flex justify-between">
                  <span className="font-light">Subtotal:</span>
                  <span className="font-semibold text-brand-950 font-serif">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-light">Envío:</span>
                  {isFreeShipping ? (
                    <span className="text-green-700 font-bold tracking-wider uppercase text-[10px] bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      Gratuito
                    </span>
                  ) : (
                    <span className="font-semibold text-brand-950 font-serif">{formatCurrency(shipping)}</span>
                  )}
                </div>
                {!isFreeShipping && (
                  <p className="text-[10px] text-brand-500 text-right font-light">
                    Agrega {formatCurrency(remainingForFreeShipping)} más para envío bonificado.
                  </p>
                )}
                <div className="border-t border-brand-200 pt-3 flex justify-between text-base sm:text-lg font-bold text-brand-900">
                  <span className="font-serif">Total:</span>
                  <span className="font-serif font-extrabold">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Secure order elements */}
              <div className="bg-brand-100 p-2.5 rounded-lg border border-brand-200 flex items-center gap-2 text-[10.5px] text-brand-600 font-light leading-snug">
                <ShieldCheck className="w-5 h-5 text-green-700 shrink-0" />
                <span>
                  Compra segura y protegida. Reembolso total de 14 días si no estás 100% satisfecho con los materiales.
                </span>
              </div>

              {/* Cart CTAs */}
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  id="btn-cart-checkout"
                  onClick={onCheckout}
                  className="w-full bg-brand-900 hover:bg-black text-brand-100 font-semibold text-xs sm:text-sm tracking-widest uppercase py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  <span>Iniciar Pago Seguro</span>
                  <ArrowRight className="w-4.5 h-4.5" />
                </button>
                <button
                  id="btn-cart-continue"
                  onClick={onClose}
                  className="w-full bg-transparent hover:bg-brand-100 text-brand-800 font-medium text-xs tracking-widest uppercase py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-brand-300"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Seguir Comprando</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
