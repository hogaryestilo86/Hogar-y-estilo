/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Search, Clipboard, ExternalLink, Package, Clock, CheckCircle2, ShieldCheck, HelpCircle, ArrowRight, CornerDownRight } from "lucide-react";

interface OrderTrackerProps {
  pendingOrders: any[];
}

const STATUS_STEPS = [
  { key: "pending", altKey: "pago en verificación", title: "Verificando Pago", desc: "Estamos confirmando la acreditación de tu transferencia o pago." },
  { key: "paid", altKey: "pago aprobado", title: "Pago Aprobado", desc: "Tu pago fue verificado y aprobado. Registramos tu compra con éxito." },
  { key: "preparing", altKey: "preparando paquete", title: "Preparando Paquete", desc: "Estamos embalando tu pedido con la máxima protección y seguridad." },
  { key: "shipped", altKey: "despachado", title: "Despachado", desc: "Tu paquete ya fue entregado a Correo Argentino para su transporte." }
];

export default function OrderTracker({ pendingOrders }: OrderTrackerProps) {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [foundOrder, setFoundOrder] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);

    if (!orderId.trim() || !phone.trim()) {
      setFoundOrder(null);
      return;
    }

    const cleanInputId = orderId.trim().toLowerCase();
    const targetOrderId = cleanInputId.startsWith("#") ? cleanInputId : `#${cleanInputId}`;
    const cleanInputPhone = phone.replace(/[^0-9]/g, "");

    const matched = pendingOrders.find((ord) => {
      const cleanOrdId = (ord.id || "").trim().toLowerCase();
      const cleanOrdPhone = (ord.details?.phone || "").replace(/[^0-9]/g, "");
      return cleanOrdId === targetOrderId && cleanOrdPhone === cleanInputPhone;
    });

    setFoundOrder(matched || null);
  };

  const getStepIndex = (status: string) => {
    const cleanStatus = (status || "").toLowerCase();
    const idx = STATUS_STEPS.findIndex((step) => 
      step.key.toLowerCase() === cleanStatus || 
      step.altKey.toLowerCase() === cleanStatus
    );
    return idx === -1 ? 0 : idx;
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
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="space-y-6 text-center mb-8">
        <span className="inline-block bg-brand-100 text-brand-900 border border-brand-200 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-3xs uppercase">
          📍 Portal de Envíos Exclusivo
        </span>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-brand-900">
          Seguí tu Pedido
        </h2>
        <p className="text-xs sm:text-sm text-brand-700 font-light max-w-md mx-auto leading-relaxed">
          Ingresá tus credenciales de compra para visualizar en tiempo real el progreso de tu despacho y obtener tu código de seguimiento oficial.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-brand-200 shadow-sm p-5 sm:p-8">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-6">
          <div className="text-left space-y-1.5">
            <label className="block text-[11px] font-bold text-brand-850 uppercase tracking-wider">Número de Orden *</label>
            <input
              type="text"
              placeholder="Ej: #1024 o 1024"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full bg-brand-50 border border-brand-200 text-brand-900 text-xs sm:text-sm px-4.5 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-400 font-light"
              required
            />
          </div>

          <div className="text-left space-y-1.5">
            <label className="block text-[11px] font-bold text-brand-850 uppercase tracking-wider">Tu Teléfono *</label>
            <input
              type="tel"
              placeholder="Ej: 3416555555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-brand-50 border border-brand-200 text-brand-900 text-xs sm:text-sm px-4.5 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-400 font-light"
              required
            />
          </div>

          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              className="w-full bg-brand-900 hover:bg-black text-brand-50 hover:text-white font-semibold text-xs sm:text-sm py-3.5 px-4 rounded-xl transition-all uppercase tracking-wider active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Search className="w-4 h-4 text-brand-300" />
              <span>Consultar Estado de Pedido</span>
            </button>
          </div>
        </form>

        {searched && foundOrder && (
          <div className="border-t border-brand-100 pt-6 space-y-8 animate-in fade-in duration-300 text-left">
            {/* Header info summary */}
            <div className="bg-brand-50 p-4.5 rounded-2xl border border-brand-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-brand-500 block tracking-wider">Titular de Compra</span>
                <span className="text-brand-950 font-bold block text-sm sm:text-base">{foundOrder.details.fullName}</span>
                <span className="text-[11px] text-brand-600 block mt-0.5">{foundOrder.details.address}, {foundOrder.details.city}</span>
              </div>
              <div className="bg-white py-2 px-4 rounded-xl border border-brand-200 inline-block md:text-right">
                <span className="text-[10px] uppercase font-bold text-brand-500 block tracking-wider">Orden Sincronizada</span>
                <span className="font-mono text-brand-900 font-black text-sm block">{foundOrder.id}</span>
                <span className="text-[10px] text-brand-600 block mt-0.5 font-light">Total de compra: {formatCurrency(foundOrder.items.reduce((acc: number, item: any) => acc + (item.product.basePrice * item.quantity), 0) * (foundOrder.details.paymentMethod === "transfer" ? 0.85 : 1))}</span>
              </div>
            </div>

            {/* Tracker Step Progress (Mercado Libre visual style) */}
            <div>
              <h4 className="font-serif text-lg font-bold text-brand-900 mb-6 flex items-center gap-2">
                <span>📦 Estado de tu Envío</span>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
              </h4>

              {/* Progress Steps Container */}
              <div className="relative pl-6 border-l border-brand-200 space-y-8">
                {STATUS_STEPS.map((step, idx) => {
                  const currentActiveIdx = getStepIndex(foundOrder.status);
                  const isCompleted = idx <= currentActiveIdx;
                  const isCurrent = idx === currentActiveIdx;

                  return (
                    <div key={idx} className="relative">
                      {/* Left Side Icon Bullet */}
                      <span className={`absolute -left-[35px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isCompleted 
                          ? "bg-green-600 border-green-600 text-white shadow-xs" 
                          : "bg-white border-brand-300 text-brand-400"
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <span className="text-[9px] font-sans font-bold">{idx + 1}</span>
                        )}
                      </span>

                      {/* Content text info */}
                      <div className="space-y-1">
                        <h5 className={`text-xs sm:text-sm font-bold ${
                          isCurrent 
                            ? "text-brand-950 font-black animate-pulse" 
                            : isCompleted 
                              ? "text-brand-900 font-semibold" 
                              : "text-brand-400 font-normal"
                        }`}>
                          {step.title} {isCurrent && "🌟"}
                        </h5>
                        <p className={`text-[11.5px] leading-relaxed font-light ${
                          isCompleted ? "text-brand-700" : "text-brand-400/80"
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Official Tracking code wrapper space */}
            {foundOrder.trackingCode ? (
              <div className="bg-green-50 border-2 border-green-200 p-5 rounded-2xl space-y-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🚚</span>
                  <span className="font-bold text-xs uppercase tracking-wider text-green-950">¡Tu Pedido ya está en camino!</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-green-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                  <div>
                    <span className="block text-[9.5px] text-brand-500 font-bold uppercase tracking-wider font-sans mb-1">Código de Seguimiento Correo Argentino</span>
                    <span className="font-black text-brand-900 text-base sm:text-lg tracking-wider">{foundOrder.trackingCode}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(foundOrder.trackingCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="w-full sm:w-auto bg-green-100 hover:bg-green-200 text-green-950 border border-green-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>{copiedCode ? "¡Copiado!" : "Copiar Código"}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-1.5">
                  <a
                    href="https://www.correoargentino.com.ar/formularios/ondepaquete"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-green-700 hover:bg-green-800 text-white font-bold text-xs sm:text-sm uppercase tracking-wide py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-transform active:scale-95 text-center shadow-xs"
                  >
                    <span>Hacer Seguimiento en Correo Argentino</span>
                    <ExternalLink className="w-4 h-4 text-green-200" />
                  </a>
                  <p className="text-[10px] text-green-700 text-center italic mt-2">
                    Copiá tu código e ingresalo en la caja de búsquedas de Correo Argentino al hacer clic en el botón.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-250 p-4.5 rounded-2xl flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 animate-spin" />
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider text-amber-950">A la espera de Código de Envíos</h5>
                  <p className="text-[11.5px] text-brand-700 font-light leading-relaxed mt-1">
                    Tu código de seguimiento oficial se otorgará una vez que Correo Argentino reciba y procese el paquete. Estará visible aquí mismo. ¡Te avisamos por Instagram en cuanto lo despachemos!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {searched && !foundOrder && (
          <div className="border-t border-brand-100 pt-8 text-center space-y-4 animate-in fade-in duration-300">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
              <HelpCircle className="w-7 h-7" />
            </div>
            <h4 className="font-serif text-lg font-bold text-brand-900">
              No encontramos tu Pedido
            </h4>
            <p className="text-xs text-brand-600 max-w-sm mx-auto leading-relaxed font-light">
              Verificá que el Número de la Orden (Ej: <strong className="font-bold font-mono">1024</strong>) y tu Teléfono de contacto coincidan con el comprobante emitido. Si persistís con dudas, envianos tus datos por Instagram.
            </p>
            <div className="pt-2">
              <a
                href="https://instagram.com/deco.home.rosario"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-brand-100 hover:bg-brand-200 border border-brand-250 text-brand-900 font-semibold px-4.5 py-2 rounded-xl text-xs sm:text-sm tracking-wide transition-colors active:scale-95 cursor-pointer"
              >
                <span>Consultar por Instagram</span>
                <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
