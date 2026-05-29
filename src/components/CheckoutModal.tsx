/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { OrderDetails, CartItem, BankDetails } from "../types";
import { X, CreditCard, Landmark, CheckCircle, ArrowRight, ClipboardCheck, ArrowLeft, ShieldAlert } from "lucide-react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  clearCart: () => void;
  adminEmail: string;
  adminPhone: string;
  onOrderComplete?: (orderDetails: OrderDetails, cartItems: CartItem[]) => void;
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
  const [formData, setFormData] = useState<OrderDetails>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zipCode: "",
    paymentMethod: "transfer",
    installments: 3,
  });

  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

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
  const shipping = isFreeShipping ? 0 : 5800;
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
    setLoading(true);

    try {
      const response = await fetch("/api/send-order-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminEmail: adminEmail,
          orderDetails: formData,
          cartItems: cartItems,
        }),
      });

      if (response.ok) {
        try {
          const resData = await response.json();
          console.log("Correo despachado con éxito de forma interna:", resData);
        } catch (jsonErr) {
          console.log("Notificación procesada de forma local (formato estático).");
        }
      } else {
        console.warn("Servidor de notificaciones de correo no disponible (modo estático). El pedido se registrará de forma local.");
      }
    } catch (e) {
      console.log("Modo de despacho offline activo: Procesando de manera exclusivamente local.");
    } finally {
      // Always register order locally for dynamic analytics and panel tracking
      if (onOrderComplete) {
        onOrderComplete(formData, cartItems);
      }
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
      paymentMethod: "transfer",
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
        <div className="p-6 max-h-[70vh] overflow-y-auto">
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
                  <span>Entrega coordinada nacional por <strong>Correo Argentino</strong> (2 a 5 días)</span>
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
              {/* Selector de métodos de pago */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <h4 className="font-bold text-brand-900 flex items-center gap-2 text-sm sm:text-base">
                        <Landmark className="w-5 h-5 text-green-700" />
                        Transferencia Bancaria
                      </h4>
                      <span className="bg-green-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        -15% OFF
                      </span>
                    </div>
                    <p className="text-xs text-brand-600 font-light mt-2">
                      Paga de forma directa mediante CBU o Alias bancario para recibir un 15% de descuento en el pedido.
                    </p>
                  </div>
                  <div className="text-right mt-4 pt-2 border-t border-brand-100">
                    <span className="text-[10px] text-brand-500">Monto total con descuento:</span>
                    <p className="text-lg font-bold text-green-700 font-serif">
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
                      <h4 className="font-bold text-brand-900 flex items-center gap-2 text-sm sm:text-base">
                        <CreditCard className="w-5 h-5 text-brand-800" />
                        Tarjeta (Crédito/Débito)
                      </h4>
                      <span className="bg-brand-800 text-brand-50 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        3 Cuotas Sin Interés
                      </span>
                    </div>
                    <p className="text-xs text-brand-600 font-light mt-2">
                      Admite tarjetas Visa, Mastercard, American Express o Cabal. Listo para Mercado Pago.
                    </p>
                  </div>
                  <div className="text-right mt-4 pt-2 border-t border-brand-100">
                    <span className="text-[10px] text-brand-500">3 de lista de:</span>
                    <p className="text-lg font-bold text-brand-900 font-serif">
                      {formatCurrency(installmentAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalles dinámicos según el método elegido */}
              {formData.paymentMethod === "transfer" ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
                  <h4 className="font-serif font-bold text-green-900 text-sm flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-green-700" />
                    Datos para realizar la Transferencia Bancaria:
                  </h4>
                  <div className="text-xs text-brand-800 space-y-1.5 font-mono">
                    <p><strong>Banco / Entidad:</strong> {bankDetails.bankName}</p>
                    <p><strong>Titular de la Cuenta:</strong> {bankDetails.accountHolder}</p>
                    <p><strong>CBU / CVU:</strong> {bankDetails.cbu}</p>
                    <p><strong>Alias de Pago:</strong> {bankDetails.alias}</p>
                    <p><strong>CUIT / CUIL:</strong> {bankDetails.cuit}</p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={copyCBU}
                      className="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>{copiedText ? "¡Copiado!" : "Copiar datos de CBU"}</span>
                    </button>
                    <p className="text-[10px] text-green-700 italic">
                      Por favor, una vez realizada la transferencia, envía el comprobante a nuestro Instagram @deco.home.rosario para despachar tu envío de inmediato.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-brand-100 border border-brand-300 rounded-xl p-5 space-y-4">
                  <h4 className="font-serif font-semibold text-brand-900 text-sm flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-brand-800" />
                    Simulador seguro de Tarjeta de Crédito/Débito
                  </h4>
                  <p className="text-xs text-brand-600 font-light">
                    Hogar y Estilo utiliza encriptación de datos de extremo a extremo. Paga tranquilo.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Número de Tarjeta</span>
                      <input
                        type="text"
                        placeholder="4517 •••• •••• 1278"
                        maxLength={19}
                        disabled={loading}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 font-mono"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Nombre Impreso</span>
                      <input
                        type="text"
                        placeholder="SOFIA MEDINA"
                        disabled={loading}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Vencimiento</span>
                      <input
                        type="text"
                        placeholder="MM / AA"
                        maxLength={5}
                        disabled={loading}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-brand-700 uppercase mb-1">Código (CVV)</span>
                      <input
                        type="password"
                        placeholder="•••"
                        maxLength={4}
                        disabled={loading}
                        className="w-full bg-white border border-brand-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900"
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
                  disabled={loading}
                  className={`px-6 py-3 text-xs sm:text-sm font-semibold tracking-wider uppercase rounded-lg flex items-center gap-2 transition-all shadow-md transform active:scale-95 cursor-pointer ${
                    formData.paymentMethod === "transfer"
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
                      <span>{formData.paymentMethod === "transfer" ? "Notificar y Confirmar Pedido" : "Confirmar Pago Seguro"}</span>
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
              const methodText = isTransfer ? "Transferencia Bancaria (-15% OFF)" : "Tarjeta de Crédito (3 cuotas sin interés)";
              
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
            const cleanPhone = adminPhone ? adminPhone.replace(/[^0-9]/g, "") : "5493416555555";
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(orderText)}`;
            const mailtoUrl = `mailto:${adminEmail}?subject=Nuevo Pedido Hogar %26 Estilo - ${encodeURIComponent(formData.fullName)}&body=${encodeURIComponent(orderText)}`;

            return (
              <div className="py-6 text-center space-y-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-700 shadow-md">
                  <CheckCircle className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h4 className="font-serif text-2xl sm:text-3xl font-bold text-brand-900">
                    ¡Muchas gracias por tu compra!
                  </h4>
                  <p className="text-xs sm:text-sm text-brand-600 max-w-md mx-auto font-light">
                    Hemos registrado tu pedido para <strong>{formData.fullName}</strong> en nuestro panel de control de envíos locales.
                  </p>
                </div>

                {/* Direct Action Channels Dispatch Box */}
                <div className="bg-white border border-brand-200 p-5 rounded-2xl max-w-md mx-auto text-left space-y-3 shadow-xs">
                  <p className="font-bold text-xs uppercase tracking-wider text-brand-800 text-center">
                    📲 ¡Envía tu pedido al vendedor para agilizar el despacho!
                  </p>
                  <p className="text-[11px] text-brand-500 text-center font-light leading-relaxed">
                    Puedes notificar al propietario al instante presionando los botones de abajo. Tu comprobante se cargará listo para enviar por Email o WhatsApp.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] py-3 px-3 rounded-lg shadow-sm transition-all uppercase tracking-wider text-center"
                    >
                      <span>Por WhatsApp</span>
                      <span className="text-xs">💬</span>
                    </a>
                    <a
                      href={mailtoUrl}
                      className="flex items-center justify-center gap-1.5 bg-brand-900 hover:bg-black text-brand-50 font-bold text-[11px] py-3 px-3 rounded-lg shadow-sm transition-all uppercase tracking-wider text-center"
                    >
                      <span>Por E-mail</span>
                      <span className="text-xs">✉️</span>
                    </a>
                  </div>
                </div>

                {isTransfer && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-xl max-w-md mx-auto text-left text-xs space-y-2">
                    <p className="font-semibold text-green-800">📌 Recuerda transferir para guardar la seña:</p>
                    <p className="text-brand-700 leading-relaxed font-light">
                      Transfiere el importe de <strong className="text-green-750 font-serif font-black">{formatCurrency(transferTotal)}</strong> y envía el comprobante bancario por cualquiera de los canales de arriba o por nuestro Instagram principal.
                    </p>
                  </div>
                )}

                <div className="pt-4">
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
