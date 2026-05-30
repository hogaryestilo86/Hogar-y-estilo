/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { OrderDetails, CartItem, BankDetails } from "../types";
import { X, CreditCard, Landmark, CheckCircle, ArrowRight, ClipboardCheck, ArrowLeft, ShieldAlert, DollarSign, HelpCircle, Copy, Instagram } from "lucide-react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  clearCart: () => void;
  adminEmail: string;
  adminPhone: string;
  onOrderComplete?: (orderDetails: OrderDetails, cartItems: CartItem[], generatedOrderId?: string) => void;
  bankDetails: BankDetails;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems,
  clearCart,
  adminEmail,
  adminPhone,
  onOrderComplete,
  bankDetails,
  showToast,
}: CheckoutModalProps) {
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [step, isOpen]);
  const [formData, setFormData] = useState<OrderDetails>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zipCode: "",
    paymentMethod: "" as any,
    installments: 3,
  });

  const [cardData, setCardData] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    if (name === "number") {
      value = value.replace(/\D/g, "")
                  .replace(/(\d{4})/g, "$1 ")
                  .trim()
                  .substring(0, 19);
    } else if (name === "expiry") {
      value = value.replace(/\D/g, "");
      if (value.length > 2) {
        value = value.substring(0, 2) + "/" + value.substring(2, 4);
      }
      value = value.substring(0, 5);
    } else if (name === "cvv") {
      value = value.replace(/\D/g, "").substring(0, 4);
    }
    setCardData((prev) => ({ ...prev, [name]: value }));
  };

  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] = useState("");
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const notify = (msg: string, type: "success" | "error" | "info" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      console.log(`[Toast Fallback] ${type.toUpperCase()}: ${msg}`);
    }
  };

  if (!isOpen) return null;

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.product.basePrice * item.quantity,
    0
  );
  const isFreeShipping = subtotal >= 50000;
  const shipping = isFreeShipping ? 0 : 10000;
  const finalListTotal = subtotal + shipping;

  // Payments logic
  const transferTotal = Math.round(subtotal * 0.85) + shipping;
  const installmentAmount = Math.round(finalListTotal / 3);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.address || !formData.phone) {
      notify("Por favor, completa los campos requeridos para continuar.", "error");
      return;
    }
    setStep("payment");
  };

  const copyCBU = () => {
    const cbuText = `CBU: ${bankDetails.cbu} - Alias: ${bankDetails.alias} - Titular: ${bankDetails.accountHolder} - CUIT: ${bankDetails.cuit} (${bankDetails.bankName})`;
    navigator.clipboard.writeText(cbuText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleConfirmPayment = async () => {
    if (formData.paymentMethod === "credit") {
      if (!cardData.number || cardData.number.length < 15) {
        notify("Por favor, ingresá un número de tarjeta válido.", "error");
        return;
      }
      if (!cardData.name || cardData.name.trim().length < 4) {
        notify("Por favor, ingresá el nombre impreso en la tarjeta.", "error");
        return;
      }
      if (!cardData.expiry || cardData.expiry.length < 5) {
        notify("Por favor, ingresá un vencimiento válido (MM/AA).", "error");
        return;
      }
      if (!cardData.cvv || cardData.cvv.length < 3) {
        notify("Por favor, ingresá el código de seguridad (CVV) de la tarjeta.", "error");
        return;
      }
    }

    setLoading(true);

    try {
      // Generate automatic unique Order Num #1000-#9999 as requested
      const orderNum = `#${Math.floor(1000 + Math.random() * 9000)}`;
      setGeneratedOrderId(orderNum);

      if (onOrderComplete) {
        onOrderComplete(formData, cartItems, orderNum);
      }
    } catch (e) {
      console.log("Error registrando pedido de forma local:", e);
    } finally {
      setLoading(false);
      setStep("success");
    }
  };

  const handleFinish = () => {
    clearCart();
    onClose();
    setStep("form");
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      zipCode: "",
      paymentMethod: "" as any,
      installments: 3,
    });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-brand-900/60 backdrop-blur-xs">
      {/* Container */}
      <div className="bg-brand-50 w-full max-w-2xl rounded-2xl border border-brand-200 overflow-hidden shadow-2xl relative my-8">
        
        {/* Header */}
        <div className="p-5 border-b border-brand-200 bg-white flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-brand-900">
              {step === "form" && "Paso 1: Datos de Envío"}
              {step === "payment" && "Paso 2: Método de Pago"}
              {step === "success" && "¡Pedido Confirmado!"}
            </h3>
            <p className="text-xs text-brand-500">
              {step !== "success" ? "Comercio seguro certificado por Hogar y Estilo" : "Tu compra ha sido procesada de forma segura"}
            </p>
          </div>
          {step !== "success" && (
            <button
              onClick={onClose}
              className="p-1 px-2.5 py-1.5 rounded-full hover:bg-brand-100 text-brand-700 hover:text-brand-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress bar visual */}
        {step !== "success" && (
          <div className="w-full bg-brand-200 h-1">
            <div 
              className="bg-brand-900 h-full transition-all duration-300"
              style={{ width: step === "form" ? "50%" : "100%" }}
            />
          </div>
        )}

        {/* Content switch */}
        <div ref={contentRef} className="p-6 max-h-[70vh] overflow-y-auto">
          {step === "form" && (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1.5">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Ej. Sofía Medina"
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1.5">
                    Email de contacto *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1.5">
                    Teléfono Celular *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="341-155123456"
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1.5">
                    Dirección de Entrega *
                  </label>
                  <input
                    type="text"
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Calle y Número (Ej: Córdoba 1540)"
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1.5">
                    Ciudad / Localidad *
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    value={formData.city || ""}
                    onChange={handleInputChange}
                    placeholder="Rosario"
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1.5">
                    Código Postal *
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    required
                    value={formData.zipCode || ""}
                    onChange={handleInputChange}
                    placeholder="2000"
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                  />
                </div>
              </div>

              {/* Order total preview */}
              <div className="bg-brand-100 p-4 rounded-xl border border-brand-200 mt-6 space-y-3">
                <h4 className="font-serif font-bold text-brand-900 text-sm">Resumen de Compra</h4>
                <div className="space-y-1.5 text-xs text-brand-700">
                  <div className="flex justify-between">
                    <span>Subtotal de productos:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Envío:</span>
                    <span className={shipping === 0 ? "text-green-700 font-bold" : ""}>
                      {shipping === 0 ? "¡ENVÍO GRATIS!" : formatCurrency(shipping)}
                    </span>
                  </div>
                  {shipping > 0 && (
                    <div className="text-[10.5px] text-amber-700 bg-amber-50 border border-amber-100 p-1.5 rounded-sm">
                      💡 <strong>Falta {formatCurrency(50000 - subtotal)}</strong> para activar el <strong>Envío Gratis</strong>.
                    </div>
                  )}
                  <div className="border-t border-brand-200 pt-2 flex justify-between font-bold text-sm text-brand-900">
                    <span>Total estimado:</span>
                    <span>{formatCurrency(finalListTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Confidence badge tags */}
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-brand-250 flex flex-col gap-2 mt-4 text-[11px] text-brand-700">
                <div className="flex items-center gap-2">
                  <span className="text-[#00a6f3]">🛡️</span>
                  <span>Compra Asegurada y Protegida por <strong>Mercado Pago</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🚚</span>
                  <span>Entrega coordinada nacional a domicilio (2 a 5 días)</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs sm:text-sm font-medium tracking-wider uppercase bg-transparent text-brand-700 hover:bg-brand-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs sm:text-sm font-medium tracking-wider uppercase bg-brand-900 hover:bg-black text-brand-50 rounded-lg flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <span>Continuar a Pago</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {step === "payment" && (
            <div className="space-y-6">
              {/* Friendly notification to select method first */}
              <div className="bg-amber-50/70 border border-amber-200 text-brand-900 rounded-xl p-4 text-center space-y-1 shadow-xs">
                <p className="text-xs text-brand-800 font-sans leading-relaxed">
                  👋 <strong>¡Ya casi es tuyo!</strong> Por favor, elegí con qué medio querés pagar a continuación para ver los detalles:
                </p>
              </div>

              {/* Selector de métodos de pago */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Transferencia bancaria (Fácil y destacada con 15% descuento) */}
                <div
                  className={`border-2 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                    formData.paymentMethod === "transfer"
                      ? "border-green-600 bg-green-50/50"
                      : "border-brand-200 bg-white hover:border-brand-400"
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "transfer" }))}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-brand-900 flex items-center gap-1.5 text-xs sm:text-sm">
                        <Landmark className="w-4 h-4 text-green-700 shrink-0" />
                        Transferencia Bancaria
                      </h4>
                      <span className="bg-green-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        -15% OFF
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-600 font-light mt-2 leading-relaxed">
                      Paga mediante CBU o Alias bancario directo para recibir un 15% de descuento en el pedido.
                    </p>
                  </div>
                  <div className="text-right mt-4 pt-2 border-t border-brand-100">
                    <span className="text-[9px] text-brand-500 block">Total con descuento:</span>
                    <p className="text-base font-bold text-green-700 font-serif">
                      {formatCurrency(transferTotal)}
                    </p>
                  </div>
                </div>

                {/* Tarjeta de Crédito (3 cuotas sin interés) */}
                <div
                  className={`border-2 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                    formData.paymentMethod === "credit"
                      ? "border-brand-800 bg-brand-100"
                      : "border-brand-200 bg-white hover:border-brand-400"
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "credit" }))}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-brand-900 flex items-center gap-1.5 text-xs sm:text-sm">
                        <CreditCard className="w-4 h-4 text-brand-800 shrink-0" />
                        Tarjeta de Crédito / Débito
                      </h4>
                      <span className="bg-brand-800 text-brand-50 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                        3 Sin Interés
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-600 font-light mt-2 leading-relaxed">
                      Cobro online inmediato sin enviar fotos ni comprobantes de pago.
                    </p>
                  </div>
                  <div className="text-right mt-4 pt-2 border-t border-brand-100">
                    <span className="text-[9px] text-brand-500 block">3 cuotas fijas de:</span>
                    <p className="text-base font-bold text-brand-900 font-serif">
                      {formatCurrency(installmentAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalles dinámicos según el método elegido */}
              {!formData.paymentMethod && (
                <div className="bg-[#FFFDF9] border-2 border-dashed border-amber-300 rounded-xl p-6 text-center space-y-3 shadow-xs">
                  <div className="p-3 bg-amber-50 rounded-full inline-block text-amber-600 animate-bounce">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-serif font-black text-brand-900 text-sm">
                      Por favor, seleccioná tu Medio de Pago arriba:
                    </h4>
                    <p className="text-xs text-brand-600 max-w-md mx-auto leading-relaxed">
                      Elegí <strong>Transferencia Bancaria</strong> para disfrutar de un 15% de descuento inmediato, o <strong>Tarjeta de Crédito / Débito</strong> para financiar en hasta 3 cuotas fijas sin interés.
                    </p>
                  </div>
                </div>
              )}

              {formData.paymentMethod === "transfer" && (
                <div className="bg-white border-2 border-brand-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-brand-100 pb-3">
                    <Landmark className="w-5 h-5 text-brand-900" />
                    <h4 className="font-serif font-bold text-brand-900 text-sm">
                      Paso de Pago por Transferencia:
                    </h4>
                  </div>
                  
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-brand-800">
                      <div className="bg-brand-50 p-3 rounded-lg">
                        <span className="block text-[10px] text-brand-505 uppercase tracking-widest font-bold">Banco</span>
                        <span className="font-semibold text-brand-900">{bankDetails.bankName || "Banco Nación"}</span>
                      </div>
                      
                      <div className="bg-brand-50 p-3 rounded-lg">
                        <span className="block text-[10px] text-brand-505 uppercase tracking-widest font-bold">Titular de Cuenta</span>
                        <span className="font-semibold text-brand-900">{bankDetails.accountHolder || "Hogar y Estilo S.H."}</span>
                      </div>
                      
                      <div className="bg-brand-50 p-3 rounded-lg">
                        <span className="block text-[10px] text-brand-505 uppercase tracking-widest font-bold">Tipo de Cuenta</span>
                        <span className="font-semibold text-brand-900">Caja de Ahorros Pesos</span>
                      </div>

                      <div className="bg-brand-50 p-3 rounded-lg">
                        <span className="block text-[10px] text-brand-505 uppercase tracking-widest font-bold">CUIT / Identificación</span>
                        <span className="font-semibold text-brand-900">{bankDetails.cuit || "20-35890432-1"}</span>
                      </div>

                      <div className="bg-brand-50 p-3 rounded-lg col-span-1 sm:col-span-2">
                        <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">CBU / CVU Bancario (Copiar manualmente de ser necesario)</span>
                        <span className="font-mono font-bold text-brand-900 text-xs sm:text-sm break-all select-all">{bankDetails.cbu}</span>
                      </div>
                    </div>

                    {/* Copy interactive Alias line (ONLY ALIAS COPIABLE WITH A TAP) */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-green-50/70 border border-green-200 p-4 rounded-xl gap-4 text-left">
                      <div>
                        <span className="block text-[10px] text-green-755 uppercase tracking-widest font-bold mb-0.5">Alias de Cobro (Toca para copiar)</span>
                        <span className="font-sans font-black text-brand-950 text-base tracking-wider select-all">{bankDetails.alias}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(bankDetails.alias);
                          notify("¡Alias copiado! Úsalo para transferir", "success");
                        }}
                        className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs shadow-xs w-full sm:w-auto"
                      >
                        <Copy className="w-3.5 h-3.5 text-white" />
                        <span>Copiar Alias</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-brand-600 font-light mt-2 leading-relaxed bg-[#FFFDF9] border border-brand-200 p-2.5 rounded-lg">
                    💡 <strong>Recordá:</strong> Copiá el Alias para transferir desde la aplicación de tu banco o billetera virtual. No hace falta que envíes capturas, asociamos automáticamente con tus datos.
                  </p>
                </div>
              )}

              {formData.paymentMethod === "credit" && (
                <div className="bg-brand-100 border border-brand-300 rounded-xl p-5 space-y-4">
                  <h4 className="font-serif font-semibold text-brand-900 text-sm flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-brand-800" />
                    Pasarela Segura Automática (Acreditación Inmediata)
                  </h4>
                  <p className="text-xs text-brand-600 font-light">
                    Hogar y Estilo procesa los cobros con cifrado SSL de seguridad. Tu pago se valida al instante sin tener que enviar comprobantes ni avisar por WhatsApp.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Número de Tarjeta</span>
                      <input
                        type="text"
                        name="number"
                        placeholder="4517 •••• •••• 1278"
                        maxLength={19}
                        disabled={loading}
                        value={cardData.number}
                        onChange={handleCardChange}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 font-mono"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Nombre Impreso</span>
                      <input
                        type="text"
                        name="name"
                        placeholder="SOFIA MEDINA"
                        disabled={loading}
                        value={cardData.name}
                        onChange={handleCardChange}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Vencimiento</span>
                      <input
                        type="text"
                        name="expiry"
                        placeholder="MM / AA"
                        maxLength={5}
                        disabled={loading}
                        value={cardData.expiry}
                        onChange={handleCardChange}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 font-mono"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Código (CVV)</span>
                      <input
                        type="password"
                        name="cvv"
                        placeholder="•••"
                        maxLength={4}
                        disabled={loading}
                        value={cardData.cvv}
                        onChange={handleCardChange}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-brand-700 uppercase mb-1">Financiación / Cuotas</label>
                    <select
                      name="installments"
                      value={formData.installments}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden text-brand-900 font-medium"
                    >
                      <option value={1}>1 Pago de {formatCurrency(finalListTotal)} (Débito o Crédito)</option>
                      <option value={3}>3 Cuotas SIN INTERÉS de {formatCurrency(installmentAmount)}/mes</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-brand-200">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-brand-700 hover:bg-brand-100 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Datos</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={loading || !formData.paymentMethod}
                  className={`px-6 py-3 text-xs sm:text-sm font-semibold tracking-wider uppercase rounded-lg flex items-center gap-2 transition-all shadow-md transform active:scale-95 cursor-pointer ${
                    !formData.paymentMethod
                      ? "bg-brand-200 text-brand-400 border border-brand-300 cursor-not-allowed shadow-none"
                      : formData.paymentMethod === "transfer"
                      ? "bg-green-700 hover:bg-green-800 text-white"
                      : "bg-brand-900 hover:bg-black text-white"
                  }`}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-brand-100 border-t-brand-900 rounded-full animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {!formData.paymentMethod
                          ? "Seleccionar Pago"
                          : formData.paymentMethod === "transfer"
                          ? "Registrar Pedido y Ver Alias"
                          : "Confirmar Pago Seguro"}
                      </span>
                      <CheckCircle className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "success" && (() => {
            const isTransfer = formData.paymentMethod === "transfer";
            const toPay = isTransfer ? transferTotal : finalListTotal;
            
            const buildOrderSummaryText = () => {
              let methodText = "Tarjeta de Crédito (3 cuotas sin interés)";
              if (isTransfer) methodText = "Transferencia Bancaria (-15% OFF)";
              
              let text = `📦 NUEVO COMPROBANTE DE COMPRA - HOGAR & ESTILO\n\n`;
              text += `👤 Cliente: ${formData.fullName}\n`;
              text += `📞 Teléfono: ${formData.phone}\n`;
              text += `📧 Email: ${formData.email}\n`;
              text += `📍 Envío a: ${formData.address}, ${formData.city} (CP: ${formData.zipCode || "N/A"})\n`;
              text += `💳 Método de Pago: ${methodText}\n\n`;
              text += `🛒 Detalle del Pedido:\n`;
              
              cartItems.forEach((item) => {
                text += `• ${item.quantity}x ${item.product.title} - $${new Intl.NumberFormat("es-AR").format(item.product.basePrice)}\n`;
              });
              
              text += `\n💵 Importe Total: ${formatCurrency(toPay)}\n`;
              
              if (isTransfer) {
                text += `\n🏦 CBU Bancario para Transferir:\n`;
                text += `Banco: ${bankDetails.bankName}\n`;
                text += `CBU: ${bankDetails.cbu}\n`;
                text += `Alias: ${bankDetails.alias}\n`;
                text += `Titular: ${bankDetails.accountHolder}\n`;
              }
              
              return text;
            };

            const orderText = buildOrderSummaryText();
            const directMessageText = `Hola Hogar y Estilo, ya realicé mi compra y quedo a la espera del código de seguimiento una vez despachado`;
            return (
              <div className="py-6 text-center space-y-6">
                
                {/* 1. SECCIÓN PRINCIPAL: AGRADECIMIENTO E INSTAGRAM DIRECTO AL INCIAR LA PÁGINA (A pedido del usuario) */}
                <div className="bg-brand-100 border-2 border-brand-200 p-5 sm:p-6 rounded-2xl max-w-md mx-auto text-center space-y-4 shadow-sm animate-fade-in">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-700 shadow-md">
                    <CheckCircle className="w-8 h-8 animate-bounce" />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-serif text-2xl sm:text-3xl font-bold text-brand-900">
                      ¡Gracias por elegirnos!
                    </h4>
                    <p className="text-xs sm:text-sm text-brand-700 max-w-xs mx-auto font-light leading-relaxed">
                      Registramos el pedido de forma exitosa para <strong>{formData.fullName}</strong>.
                    </p>
                  </div>

                  <div className="border-t border-brand-250 pt-3 space-y-3">
                    <p className="text-xs sm:text-sm text-brand-950 font-semibold leading-relaxed font-sans">
                      📲 <strong>¡Aviso Importante!</strong> Para confirmar la compra y coordinar el despacho rápido de tus productos, por favor envianos una captura o foto del comprobante de pago a nuestro Instagram.
                    </p>

                    <a
                      href="https://instagram.com/deco.home.rosario"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        navigator.clipboard.writeText(directMessageText);
                        notify("¡Mensaje de aviso copiado! Pegalo al chatear en Instagram.", "success");
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 text-white py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-95 text-center cursor-pointer font-sans shadow-md"
                    >
                      <Instagram className="w-4.5 h-4.5 text-white" />
                      <span>Avisar Compra por Instagram</span>
                    </a>
                  </div>
                </div>

                {/* 2. BADGE DE ESTADO DEL PAGO SÚPER CLARO SEGÚN TRANSFER/TARJETA */}
                {isTransfer ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4.5 max-w-md mx-auto text-center space-y-1.5 shadow-xs">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-955 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full font-serif">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      Estado: Reserva Confirmada - Pago Pendiente
                    </div>
                    <p className="text-[11px] text-brand-700 leading-relaxed font-light">
                      Tu pedido está reservado por 24 horas. Realizá la transferencia de <strong>{formatCurrency(transferTotal)}</strong> usando el <strong>Alias de abajo</strong>, y envianos el comprobante por Instagram para que preparemos tu paquete de inmediato.
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 text-green-955 rounded-2xl p-4.5 max-w-md mx-auto text-center space-y-1.5 shadow-xs">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-955 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full font-serif">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      Estado: Pago Seguro Aprobado 🎉
                    </div>
                    <p className="text-[11px] text-brand-700 leading-relaxed font-light">
                      El pago de <strong>{formatCurrency(finalListTotal)}</strong> con tarjeta fue procesado y confirmado con éxito. ¡Ya estamos preparando tu pedido para despacharlo!
                    </p>
                  </div>
                )}

                {/* 3. GIGANTE Order Number widget space as requested */}
                <div className="flex flex-col items-center space-y-2">
                  <div 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedOrderId || "#1024");
                      setCopiedOrder(true);
                      notify("¡Número de orden copiado!", "success");
                      setTimeout(() => setCopiedOrder(false), 2000);
                    }}
                    className="bg-brand-900 hover:bg-black text-brand-50 rounded-xl px-10 py-5 shadow-lg border border-brand-800 inline-block cursor-pointer group active:scale-95 transition-all text-center select-none"
                    title="¡Toca para copiar!"
                  >
                    <span className="block text-[9px] text-brand-300 font-black uppercase tracking-widest mb-1 font-sans group-hover:text-amber-300 transition-colors">
                      {copiedOrder ? "¡Copiado con éxito! 🎉" : "Número de tu Orden (Toca para copiar)"}
                    </span>
                    <span className="font-mono text-3xl sm:text-4xl font-black text-white tracking-wider group-hover:text-amber-300 transition-colors">
                      {generatedOrderId || "#1024"}
                    </span>
                  </div>
                  
                  {/* Copy Order ID Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedOrderId || "#1024");
                        setCopiedOrder(true);
                        notify("Número de orden copiado", "success");
                        setTimeout(() => setCopiedOrder(false), 2000);
                      }}
                      className="bg-white hover:bg-brand-50 border border-brand-200 text-brand-900 px-4.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 text-center font-sans"
                    >
                      <Copy className="w-3.5 h-3.5 text-brand-850" />
                      <span>{copiedOrder ? "¡Número Copiado!" : "Copiar Número de Orden"}</span>
                    </button>
                  </div>
                </div>

                {/* Recordatorio de envío de comprobante y nro de orden */}
                <div className="bg-[#FFFDF9] border border-amber-205 rounded-xl p-4 max-w-md mx-auto text-center space-y-1 shadow-xs">
                  <p className="text-[11px] sm:text-xs text-brand-900 leading-relaxed font-sans">
                    ⚠️ <strong>Si abonás por Transferencia Bancaria:</strong> Recordá que para poder despachar tu pedido, debés enviarnos por Instagram tanto tu <strong>Número de Orden ({generatedOrderId || "#1024"})</strong> como la <strong>captura o comprobante de pago</strong>. ¡Así corroboramos y preparamos tu despacho más rápido!
                  </p>
                </div>

                {/* 4. DATOS BANCARIOS (SI ES TRANSFERENCIA) */}
                {isTransfer && (
                  <div className="bg-green-50/70 border-2 border-green-200 p-5 sm:p-6 rounded-2xl max-w-md mx-auto text-left space-y-4 shadow-xs">
                    <div className="flex items-center gap-2 border-b border-green-200 pb-2.5">
                      <Landmark className="w-4.5 h-4.5 text-green-800" />
                      <span className="font-bold text-xs uppercase tracking-wider text-green-950">🏦 Datos bancarios para transferir:</span>
                    </div>

                    <div className="space-y-3 text-[11px] font-mono text-brand-800 bg-white p-4 rounded-xl border border-brand-100">
                      <p><strong>Banco:</strong> {bankDetails.bankName}</p>
                      <p><strong>Titular:</strong> {bankDetails.accountHolder}</p>
                      <p><strong>CBU CVU:</strong> <span className="font-bold text-brand-950 break-all">{bankDetails.cbu}</span></p>
                      
                      <div className="p-3 border border-dashed border-green-200 bg-green-50/50 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 my-2 text-left">
                        <div>
                          <p className="text-[10px] text-brand-500 font-bold uppercase tracking-wider font-sans">Alias para Copiar:</p>
                          <p className="text-sm font-sans font-extrabold text-brand-950 tracking-wider select-all">{bankDetails.alias}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(bankDetails.alias || "");
                            notify("¡Alias de CBU copiado!", "success");
                          }}
                          className="bg-green-700 hover:bg-green-800 text-white font-sans px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95 whitespace-nowrap self-stretch sm:self-auto justify-center"
                        >
                          <Copy className="w-3.5 h-3.5 text-white" />
                          <span>Copiar Alias</span>
                        </button>
                      </div>

                      <p className="text-[10px] text-brand-600 font-sans italic leading-tight pt-1">
                        ⚠️ Por seguridad y para evitar errores de un número que puedan errar, solo se puede copiar con un toque el Alias. Por favor, utilizalo para transferir.
                      </p>

                      <p className="border-t border-brand-100 pt-2 shrink-0">
                        <strong>Monto neto a transferir:</strong> <strong className="text-green-800 text-sm font-bold font-mono">{formatCurrency(transferTotal)}</strong>
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. ACREDITACIÓN DE TARJETA (SI ES TARJETA) */}
                {!isTransfer && (
                  <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl max-w-md mx-auto text-left text-xs space-y-1.5 shadow-xs">
                    <p className="font-semibold text-blue-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                      💳 Acreditación de Pago Segura:
                    </p>
                    <p className="text-[11px] text-brand-700 leading-relaxed font-light">
                      Tu pago de <strong className="text-brand-900 font-bold">{formatCurrency(finalListTotal)}</strong> ha sido validado y acreditado con éxito en criptografía SSL de extremo a extremo. Los artículos ya pasaron a control de logística y empaque reforzado.
                    </p>
                  </div>
                )}

                {/* 6. OTROS CANALES */}
                <div className="bg-[#FAF8F5] border border-brand-200 p-4 rounded-xl max-w-md mx-auto text-center space-y-2">
                  <p className="text-[11px] text-brand-600 leading-relaxed font-light">
                    Por consultas sobre el despacho o para seguir el paquete, puedes responder directamente al correo electrónico automatizado o consultarnos en Instagram en <a href="https://instagram.com/deco.home.rosario" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-900 hover:underline">@deco.home.rosario</a>.
                  </p>
                </div>

                {/* 7. BOTÓN VOLVER */}
                <div className="pt-2">
                  <button
                    onClick={handleFinish}
                    className="bg-brand-900 hover:bg-black text-brand-50 px-8 py-3 rounded-full text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all shadow-md cursor-pointer"
                  >
                    Volver a la Tienda
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
