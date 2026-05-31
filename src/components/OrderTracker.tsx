/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Search, Clipboard, ExternalLink, Package, Clock, ShieldCheck, HelpCircle, ArrowRight, Truck, MapPin, Check, AlertCircle } from "lucide-react";

interface OrderTrackerProps {
  pendingOrders: any[];
  initialOrderId?: string;
}

// Status description mapping
const STATUS_MAPPING: Record<string, { title: string; desc: string; textClass: string; bgClass: string; borderClass: string; iconColor: string }> = {
  pending: {
    title: "Pedido Recibido",
    desc: "Validamos tu pago correctamente.",
    textClass: "text-[#00a650]",
    bgClass: "bg-[#eef7f0]",
    borderClass: "border-[#d2edd6]",
    iconColor: "text-[#00a650]"
  },
  received: {
    title: "Pedido Recibido",
    desc: "Validamos tu pago correctamente.",
    textClass: "text-[#00a650]",
    bgClass: "bg-[#eef7f0]",
    borderClass: "border-[#d2edd6]",
    iconColor: "text-[#00a650]"
  },
  preparing: {
    title: "En preparación en depósito",
    desc: "Estamos preparando tu compra en nuestro depósito central.",
    textClass: "text-amber-700",
    bgClass: "bg-[#fff9e6]",
    borderClass: "border-[#ffe08c]",
    iconColor: "text-amber-600"
  },
  shipped: {
    title: "Despachado / En viaje",
    desc: "El correo ya tiene tu paquete y está en viaje.",
    textClass: "text-blue-700",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    iconColor: "text-blue-600"
  },
  delivery: {
    title: "En camino a tu domicilio",
    desc: "El cartero está cerca de tu zona.",
    textClass: "text-purple-700",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-200",
    iconColor: "text-purple-600"
  },
  delivered: {
    title: "Entregado",
    desc: "¡Ya tenés tu producto! Disfrutá tu compra.",
    textClass: "text-emerald-800",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    iconColor: "text-emerald-650"
  }
};

export default function OrderTracker({ pendingOrders, initialOrderId }: OrderTrackerProps) {
  const [orderQuery, setOrderQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [foundOrder, setFoundOrder] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  React.useEffect(() => {
    if (initialOrderId) {
      setOrderQuery(initialOrderId);
      setSearched(true);
      const query = initialOrderId.trim().toLowerCase();
      const matched = pendingOrders.find((ord) => {
        const cleanOrdId = (ord.id || "").trim().toLowerCase();
        return (
          cleanOrdId === query ||
          cleanOrdId === `#${query}` ||
          query === cleanOrdId.replace("#", "") ||
          cleanOrdId.includes(query) ||
          query.includes(cleanOrdId)
        );
      });
      setFoundOrder(matched || null);
    }
  }, [initialOrderId, pendingOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);

    const query = orderQuery.trim().toLowerCase();
    if (!query) {
      setFoundOrder(null);
      return;
    }

    // Match orders flexibly with or without prefixes
    const matched = pendingOrders.find((ord) => {
      const cleanOrdId = (ord.id || "").trim().toLowerCase();
      return (
        cleanOrdId === query ||
        cleanOrdId === `#${query}` ||
        query === cleanOrdId.replace("#", "") ||
        cleanOrdId.includes(query) ||
        query.includes(cleanOrdId)
      );
    });

    setFoundOrder(matched || null);
  };

  const getStatusInfo = (status: string) => {
    const cleanStatus = (status || "pending").toLowerCase();
    return STATUS_MAPPING[cleanStatus] || STATUS_MAPPING.pending;
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
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 font-sans">
      {/* Visual Header */}
      <div className="text-center space-y-4 mb-8">
        <span className="inline-flex items-center gap-1.5 bg-[#eef7f0] text-[#00a650] border border-[#d2edd6] text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
          <Truck className="w-3.5 h-3.5" /> Seguimiento de Pedidos
        </span>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-brand-900">
          ¿Dónde está mi paquete?
        </h2>
        <p className="text-xs sm:text-sm text-brand-600 max-w-sm mx-auto leading-relaxed font-light">
          Ingresá tu número de pedido para conocer el estado de envío actual y acceder a tu código de seguimiento online.
        </p>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-brand-200 shadow-xs p-5 sm:p-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="text-left space-y-1.5">
            <label className="block text-[11px] font-bold text-brand-800 uppercase tracking-widest">
              Número de Pedido
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ej: #1024 o 1024"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                className="w-full bg-brand-50/50 border border-brand-200 text-brand-900 text-xs sm:text-sm pl-4 pr-12 py-3.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 font-light"
                required
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand-700 hover:text-black transition-colors"
                title="Buscar"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </form>

        {searched && foundOrder && (() => {
          const statusInfo = getStatusInfo(foundOrder.status);
          const isTransfer = foundOrder.details?.paymentMethod === "transfer";
          const subtotal = foundOrder.items?.reduce((acc: number, item: any) => acc + (item.product.basePrice * item.quantity), 0) || 0;
          const totalPaid = isTransfer ? subtotal * 0.85 : subtotal;

          return (
            <div className="mt-8 border-t border-brand-100 pt-7 space-y-6 animate-in fade-in duration-305 text-left">
              {/* Order Basic Description Area */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-brand-50/60 rounded-xl p-4 border border-brand-150">
                <div>
                  <span className="text-[10px] uppercase font-bold text-brand-500 block tracking-wider">Destinatario</span>
                  <span className="font-bold text-brand-900 block text-sm">{foundOrder.details?.fullName}</span>
                  <span className="text-brand-605 block mt-0.5">{foundOrder.details?.address}, {foundOrder.details?.city}</span>
                </div>
                <div className="sm:text-right font-mono">
                  <span className="text-[10px] uppercase font-bold text-brand-400 block tracking-wider font-sans">Orden ID</span>
                  <span className="font-bold text-brand-950 block">{foundOrder.id}</span>
                  <span className="text-brand-500 block mt-0.5 font-sans">Total: {formatCurrency(totalPaid)}</span>
                </div>
              </div>

              {/* Clean Highlighted Status Box */}
              <div className={`p-5 rounded-xl border ${statusInfo.bgClass} ${statusInfo.borderClass} space-y-2`}>
                <span className="text-[9px] uppercase tracking-widest font-black text-brand-400 block">
                  Estado Actual de tu Pedido
                </span>
                <div className="flex items-center gap-2.5">
                  <span className={`text-xl sm:text-2xl ${statusInfo.iconColor}`}>
                    {foundOrder.status === "delivered" ? "✅" : foundOrder.status === "delivery" ? "🏠" : foundOrder.status === "shipped" ? "✈️" : foundOrder.status === "preparing" ? "📦" : "🛒"}
                  </span>
                  <h4 className={`text-base sm:text-lg font-bold ${statusInfo.textClass}`}>
                    {statusInfo.title}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm font-light text-brand-800 leading-relaxed mt-1">
                  {statusInfo.desc}
                </p>
              </div>

              {/* Highlighted Tracking Code Receiver Box */}
              <div className="bg-brand-50/20 border border-brand-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-base text-brand-700">📋</span>
                  <span className="font-semibold text-xs uppercase tracking-wider text-brand-800">
                    Código de Seguimiento de Envío
                  </span>
                </div>

                {foundOrder.trackingCode ? (
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-brand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="font-mono">
                        <span className="block text-[8px] text-[#666666] font-bold uppercase tracking-wider font-sans mb-0.5">Identificador del bulto</span>
                        <span className="font-black text-[#111111] text-base sm:text-lg tracking-wider select-all">{foundOrder.trackingCode}</span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(foundOrder.trackingCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="w-full sm:w-auto bg-[#eef7f0] hover:bg-[#d6ebd7]/80 text-[#00a650] border border-[#d2edd6] px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-[#00a650]" /> : <Clipboard className="w-3.5 h-3.5" />}
                          <span>{copiedCode ? "¡Copiado con éxito!" : "Copiar Código"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 text-center">
                      <p className="text-[11.5px] text-brand-700 bg-white border border-brand-200 p-4 rounded-xl leading-relaxed font-light">
                        💬 Copiá el código de arriba y recordá que podés ingresarlo en la web del correo correspondiente para seguir el trayecto de tu paquete de forma online en cualquier momento.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#fff9e6]/50 border border-[#ffe08c]/60 p-4 rounded-xl flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-amber-950">
                        Código de seguimiento en preparación
                      </h5>
                      <p className="text-[11px] text-amber-900 leading-relaxed mt-1 font-light">
                        Estamos preparando la etiqueta de despacho. En cuanto despachemos tu paquete, el código de seguimiento de envío aparecerá aquí automáticamente para que sigas el viaje.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {searched && !foundOrder && (
          <div className="border-t border-brand-100 mt-8 pt-8 text-center space-y-4 animate-in fade-in duration-300">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-650">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h4 className="font-serif text-lg font-bold text-brand-900">
              No encontramos tu Pedido
            </h4>
            <p className="text-xs text-brand-600 max-w-sm mx-auto leading-relaxed font-light">
              Verificá que el número de compra coincida exactamente con el asignado. Recordá que si hiciste una compra reciente por transferencia, el administrador primero debe validarla en su panel para que aparezca aquí.
            </p>
            
            <div className="bg-brand-50 border border-brand-200 p-4 rounded-xl max-w-sm mx-auto space-y-3">
              <h5 className="text-[10px] uppercase tracking-widest font-bold text-brand-800">
                💡 Órdenes de Demostración para Prueba
              </h5>
              <p className="text-[11px] text-brand-600 leading-relaxed font-light">
                Hacé clic en cualquiera de las siguientes órdenes de demostración pre-cargadas para ver cómo funciona el seguimiento:
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOrderQuery("1024");
                    const matched = pendingOrders.find((ord) => ord.id === "1024");
                    setFoundOrder(matched || null);
                    setSearched(true);
                  }}
                  className="bg-white hover:bg-brand-100 border border-brand-200 text-brand-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  Orden #1024 (En Depósito)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderQuery("1580");
                    const matched = pendingOrders.find((ord) => ord.id === "1580");
                    setFoundOrder(matched || null);
                    setSearched(true);
                  }}
                  className="bg-white hover:bg-brand-100 border border-brand-200 text-brand-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  Orden #1580 (En Viaje)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
