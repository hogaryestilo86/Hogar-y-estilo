/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { OrderDetails, CartItem, BankDetails } from "../types";
import { X, CreditCard, Landmark, CheckCircle, ArrowRight, ClipboardCheck, ArrowLeft, ShieldAlert, DollarSign, HelpCircle, Copy, Instagram, Upload, Image } from "lucide-react";
import { storeMedia, ResolvedImage, ResolvedVideo, getCategoryPlaceholder } from "../indexedDbMedia";

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

  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("El comprobante debe ser una imagen o captura de pantalla.", "error");
      return;
    }

    setUploadingReceipt(true);
    try {
      const idbUrl = await storeMedia(file);
      setReceiptImage(idbUrl);
      setFormData(prev => ({ ...prev, receiptImage: idbUrl }));
      notify("¡Comprobante adjuntado con éxito! Se guardará con tu pedido.", "success");
    } catch (err) {
      console.error(err);
      notify("Hubo un error al procesar la imagen del comprobante.", "error");
    } finally {
      setUploadingReceipt(false);
    }
  };

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

  // Automatic Mercado Pago Brick states
  const [mpPreferenceUrl, setMpPreferenceUrl] = useState<string>("");
  const [mpPreferenceLoading, setMpPreferenceLoading] = useState<boolean>(false);
  const [mpError, setMpError] = useState<string>("");
  const [mpIsSimulator, setMpIsSimulator] = useState<boolean>(false);
  const [mpTransferDetails, setMpTransferDetails] = useState<any>(null);
  const [hasPrivateToken, setHasPrivateToken] = useState<boolean>(false);
  const brickInstanceRef = useRef<any>(null);

  const notify = (msg: string, type: "success" | "error" | "info" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      console.log(`[Toast Fallback] ${type.toUpperCase()}: ${msg}`);
    }
  };

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

  // React hook to generate Mercado Pago Brick at checkout automatically
  useEffect(() => {
    let active = true;
    
    if (isOpen && step === "payment" && formData.paymentMethod === "credit") {
      setMpPreferenceLoading(true);
      setMpError("");

      const initializeBrick = async () => {
        try {
          // 1. Dynamic script load
          await new Promise<void>((resolve, reject) => {
            if (window.hasOwnProperty("MercadoPago")) {
              resolve();
              return;
            }
            const script = document.createElement("script");
            script.src = "https://sdk.mercadopago.com/js/v2";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("No se pudo cargar el SDK de Mercado Pago."));
            document.body.appendChild(script);
          });

          if (!active) return;

          // 2. Fetch config
          const configRes = await fetch("/api/mercadopago/config");
          if (!configRes.ok) {
            throw new Error("No se pudo obtener la clave pública de configuración.");
          }
          const { publicKey, hasPrivateToken: isReal } = await configRes.json();
          setHasPrivateToken(isReal);
          setMpIsSimulator(!isReal);

          if (!active) return;

          // 3. Initialize MP
          const mp = new (window as any).MercadoPago(publicKey, { locale: "es-AR" });
          const bricksBuilder = mp.bricks();

          // 4. Cleanup old brick
          if (brickInstanceRef.current) {
            try {
              await brickInstanceRef.current.unmount();
            } catch (e) {
              console.warn("Error unmounting previous Brick instance:", e);
            }
            brickInstanceRef.current = null;
          }

          if (!active) return;

          // 5. Build settings and mount
          const settings = {
            initialization: {
              amount: finalListTotal,
              payer: {
                email: formData.email || "correo@ejemplo.com",
                firstName: formData.fullName.split(" ")[0] || "Cliente",
                lastName: formData.fullName.split(" ").slice(1).join(" ") || "DecoHome",
              },
            },
            customization: {
              paymentMethods: {
                creditCard: "all",
                debitCard: "all",
                bankTransfer: "all", // DEBIN / Red Link automatic transfer natively!
              },
              visual: {
                style: {
                  theme: "dark",
                  customVariables: {
                    colorPrimary: "#009ee3",
                    colorBackground: "#001b33",
                    colorText: "#ffffff",
                    colorInputBackground: "#00284d",
                    colorInputText: "#ffffff",
                    borderRadius: "12px",
                  }
                },
              },
            },
            callbacks: {
              onReady: () => {
                if (active) setMpPreferenceLoading(false);
              },
              onSubmit: async ({ selectedPaymentMethod, formData: paymentFormData }: any) => {
                if (!active) return;
                setLoading(true);
                try {
                  const res = await fetch("/api/mercadopago/payment", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      paymentData: paymentFormData,
                      cartItems,
                      shipping,
                      payerDetails: formData,
                    }),
                  });

                  const paymentResult = await res.json();
                  if (!res.ok) {
                    throw new Error(paymentResult.error || "Error al procesar el pago.");
                  }

                  if (paymentResult.isSimulator) {
                    setMpIsSimulator(true);
                  }

                  // Retrieve barcode, point_of_interaction or deep links for transfers (DEBIN instructions) if available:
                  if (paymentResult.point_of_interaction) {
                    setMpTransferDetails(paymentResult.point_of_interaction);
                  }

                  setGeneratedOrderId(paymentResult.id ? `MP-${paymentResult.id}` : `#${Math.floor(1000 + Math.random() * 9000)}`);
                  setStep("success");

                  if (onOrderComplete) {
                    onOrderComplete(
                      { 
                        ...formData, 
                        paymentMethod: "credit", 
                        receiptImage: paymentResult.point_of_interaction?.transaction_data?.ticket_url || "" 
                      }, 
                      cartItems, 
                      paymentResult.id ? `MP-${paymentResult.id}` : undefined
                    );
                  }
                } catch (err: any) {
                  console.error("Submitting payment Brick error:", err);
                  notify(err.message || "Error procesando el pago. Por favor verificá tus datos e intentá de nuevo.", "error");
                } finally {
                  if (active) setLoading(false);
                }
              },
              onError: (error: any) => {
                console.error("Mercado Pago Brick error callback:", error);
                if (active) setMpError("Error de validación o inicialización en el widget. Corregí los datos de la tarjeta.");
              },
            },
          };

          // Mount to container (safety check and clear leftover DOM nodes)
          const paymentContainer = document.getElementById("paymentCardBrickContainer");
          if (paymentContainer && active) {
            try {
              paymentContainer.innerHTML = "";
            } catch (e) {
              console.warn("No se pudo limpiar el contenedor de Mercado Pago antes de montar:", e);
            }
            brickInstanceRef.current = await bricksBuilder.create("payment", "paymentCardBrickContainer", settings);
          }
        } catch (err: any) {
          console.error("Error al inicializar Mercado Pago Brick:", err);
          if (active) {
            setMpError("No se pudo cargar el módulo seguro de Mercado Pago en vivo: " + err.message);
            setMpPreferenceLoading(false);
          }
        }
      };

      // Add a slight latency to allow the React container element to mount safely first!
      const delayTimer = setTimeout(() => {
        initializeBrick();
      }, 100);

      return () => {
        active = false;
        clearTimeout(delayTimer);
        
        const instance = brickInstanceRef.current;
        if (instance) {
          brickInstanceRef.current = null;
          try {
            const p = instance.unmount();
            if (p && typeof p.catch === "function") {
              p.catch((err: any) => console.warn("Error asincrónico al desmontar el Brick de Mercado Pago:", err));
            }
          } catch (err) {
            console.warn("Error sincrónico al desmontar el Brick de Mercado Pago:", err);
          }
        }

        // Empty the container DOM element as a backup to avoid duplicate iframes
        const container = document.getElementById("paymentCardBrickContainer");
        if (container) {
          try {
            container.innerHTML = "";
          } catch (e) {
            console.warn("No se pudo vaciar el contenedor de Mercado Pago:", e);
          }
        }
      };
    }
  }, [isOpen, step, formData.paymentMethod, cartItems, shipping, formData.fullName, formData.email]);

  if (!isOpen) return null;

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
    const cbuText = `CBU: ${bankDetails?.cbu || ""} - Alias: ${bankDetails?.alias || ""} - Titular: ${bankDetails?.accountHolder || ""} - CUIT: ${bankDetails?.cuit || ""} (${bankDetails?.bankName || ""})`;
    navigator.clipboard.writeText(cbuText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleConfirmPayment = async () => {
    if (formData.paymentMethod === "credit" && !mpPreferenceUrl) {
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
      // If it's a card payment and we have a calculated preference URL from Mercado Pago
      if (formData.paymentMethod === "credit" && mpPreferenceUrl) {
        window.open(mpPreferenceUrl, "_blank", "noopener,noreferrer");
        notify("¡Redirigiendo a la pasarela segura de Mercado Pago!", "success");
      }

      // Generate automatic unique Order Num #1000-#9999 as requested
      const orderNum = `#${Math.floor(1000 + Math.random() * 9000)}`;
      setGeneratedOrderId(orderNum);

      if (onOrderComplete) {
        onOrderComplete({ ...formData, receiptImage }, cartItems, orderNum);
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
    setReceiptImage("");
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
            <p className="text-xs text-brand-505">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="col-span-1">
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>

                <div className="col-span-1">
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>

                <div className="col-span-1">
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>

                <div className="col-span-1">
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>
              </div>

              {/* Order total preview */}
              <div className="bg-brand-100 p-4 rounded-xl border border-brand-200 mt-6 space-y-3">
                <h4 className="font-serif font-bold text-brand-900 text-sm border-b border-brand-200/60 pb-1.5">
                  Resumen de Compra
                </h4>
                
                {/* Visual Cart Items List with Photos */}
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {cartItems.map((item) => {
                    const product = item.product;
                    const activeMedia = product.media && product.media.length > 0 ? product.media[0] : null;
                    const isVideoMedia = activeMedia?.type === "video";
                    const mediaUrl = activeMedia?.url || getCategoryPlaceholder(product.category);

                    return (
                      <div key={product.id} className="flex items-center justify-between bg-white/70 p-2 rounded-lg border border-brand-200/50 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded border border-brand-200 overflow-hidden shrink-0 bg-brand-50 flex items-center justify-center">
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
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-brand-900 line-clamp-1 pr-1 font-serif">
                              {product.title}
                            </p>
                            <p className="text-[10px] text-brand-500 font-light">
                              Cant: {item.quantity} • {product.category || "General"}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-brand-900 font-mono">
                          {formatCurrency(product.basePrice * item.quantity)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5 text-xs text-brand-700 border-t border-brand-200/60 pt-2 bg-brand-100/50">
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
                <div key="payment-none" className="bg-[#FFFDF9] border-2 border-dashed border-amber-300 rounded-xl p-6 text-center space-y-3 shadow-xs">
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
                <div key="payment-transfer" className="block animate-in fade-in duration-300">
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
                          <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">Banco</span>
                          <span className="font-semibold text-brand-900">{bankDetails?.bankName || "Banco de la Nación Argentina"}</span>
                        </div>
                        
                        <div className="bg-brand-50 p-3 rounded-lg">
                          <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">Titular de Cuenta</span>
                          <span className="font-semibold text-brand-900">{bankDetails?.accountHolder || "Hogar y Estilo S.H."}</span>
                        </div>
                        
                        <div className="bg-brand-50 p-3 rounded-lg">
                          <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">Tipo de Cuenta</span>
                          <span className="font-semibold text-brand-900">Caja de Ahorros Pesos</span>
                        </div>

                        <div className="bg-brand-50 p-3 rounded-lg">
                          <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">CUIT / Identificación</span>
                          <span className="font-semibold text-brand-900">{bankDetails?.cuit || "20-35890432-1"}</span>
                        </div>

                        <div className="bg-brand-50 p-3 rounded-lg col-span-1 sm:col-span-2">
                          <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-bold">CBU / CVU Bancario (Copiar manualmente de ser necesario)</span>
                          <span className="font-mono font-bold text-brand-900 text-xs sm:text-sm break-all select-all">{bankDetails?.cbu || ""}</span>
                        </div>
                      </div>

                      {/* Copy interactive Alias line (ONLY ALIAS COPIABLE WITH A TAP) */}
                      <div className="flex flex-col sm:flex-row justify-between items-center bg-green-50/70 border border-green-200 p-4 rounded-xl gap-4 text-left">
                        <div>
                          <span className="block text-[10px] text-green-700 uppercase tracking-widest font-bold mb-0.5">Alias de Cobro (Toca para copiar)</span>
                          <span className="font-sans font-black text-brand-950 text-base tracking-wider select-all">{bankDetails?.alias || "deco.home.rosario"}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (bankDetails?.alias) {
                              navigator.clipboard.writeText(bankDetails.alias);
                              notify("¡Alias copiado! Úsalo para transferir", "success");
                            } else {
                              notify("No hay un alias configurado.", "error");
                            }
                          }}
                          className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs shadow-xs w-full sm:w-auto"
                        >
                          <Copy className="w-3.5 h-3.5 text-white" />
                          <span>Copiar Alias</span>
                        </button>
                      </div>

                      {/* Drag and Drop Zone or Button for uploading Transfer Receipt */}
                      <div className="border-2 border-dashed border-brand-300 bg-brand-50/50 p-5 rounded-xl text-center space-y-3 font-sans transition-all hover:bg-brand-50 hover:border-brand-400">
                        <div className="w-10 h-10 bg-brand-200 text-brand-700 rounded-full flex items-center justify-center mx-auto">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-brand-900">
                            {receiptImage ? "✓ ¡Comprobante de Pago Adjuntado!" : "Adjuntar Captura o Comprobante de Pago"}
                          </p>
                          <p className="text-[10px] text-brand-500 font-light max-w-xs mx-auto leading-relaxed">
                            {receiptImage ? "Subiste con éxito una imagen. Si querés cambiarla, podés volver a subir otra." : "Subí una captura de pantalla de la transferencia desde tu celular para que validemos tu pago al instante."}
                          </p>
                        </div>

                        {receiptImage && (
                          <div className="relative inline-block border border-brand-250 rounded-lg overflow-hidden max-w-[125px] shadow-xs">
                            <ResolvedImage 
                              src={receiptImage}
                              alt="Vista previa comprobante"
                              className="h-16 w-auto object-cover mx-auto"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-brand-900/85 text-white text-[8px] py-0.5 font-bold">VISTA PREVIA</span>
                          </div>
                        )}

                        <div className="pt-1">
                          <button
                            type="button"
                            disabled={uploadingReceipt}
                            onClick={() => fileInputRef.current?.click()}
                            className={`px-4.5 py-2 rounded-lg font-bold text-xs uppercase tracking-wide cursor-pointer transition-colors ${
                              receiptImage 
                                ? "bg-brand-800 text-white hover:bg-black" 
                                : "bg-white border border-brand-300 text-brand-800 hover:bg-brand-50"
                            }`}
                          >
                            {uploadingReceipt ? "Procesando comprobante..." : receiptImage ? "Cambiar Imagen" : "Seleccionar Imagen / Captura"}
                          </button>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleReceiptUpload}
                            accept="image/*"
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-brand-600 font-light mt-2 leading-relaxed bg-[#FFFDF9] border border-brand-200 p-2.5 rounded-lg">
                      💡 <strong>Recordá:</strong> Copiá el Alias para transferir desde la aplicación de tu banco o billetera virtual. No hace falta que envíes capturas, asociamos automáticamente con tus datos.
                    </p>
                  </div>
                </div>
              )}

              {formData.paymentMethod === "credit" && (
                <div key="payment-credit" className="block animate-in fade-in duration-300">
                  <div className="bg-[#001b33] border-2 border-[#009ee3] rounded-xl p-5 sm:p-6 space-y-4 shadow-sm text-left font-sans">
                    <div className="flex items-center justify-between border-b border-[#009ee3]/40 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1 px-2.5 text-[9px] bg-[#009ee3] text-white rounded-full font-bold uppercase tracking-wider shrink-0">Seguro</span>
                        <h4 className="font-serif font-black text-[#009ee3] text-sm">
                          Plataforma Oficial Mercado Pago
                        </h4>
                      </div>
                      <span className="text-xs text-blue-300 bg-[#002f54] px-2 py-0.5 rounded-md font-mono font-semibold">🔒 Conexión Segura</span>
                    </div>

                    <p className="text-xs text-blue-100 leading-relaxed font-sans">
                      Pagá de forma segura con tu tarjeta de crédito/débito o por transferencia bancaria automática (DEBIN/Red Link) utilizando la pasarela oficial integrada.
                    </p>

                    {mpError && (
                      <div className="p-4 bg-red-950/70 border border-red-500 rounded-xl mb-4">
                        <p className="text-xs text-red-200 font-medium">{mpError}</p>
                      </div>
                    )}

                    {/* Mercado Pago Brick will render inside this container */}
                    <div key="mp-brick-container" className="w-full relative min-h-[250px]">
                      {mpPreferenceLoading && (
                        <div className="absolute inset-0 bg-[#001b33]/90 flex flex-col items-center justify-center space-y-3 z-10 rounded-xl">
                          <span className="w-8 h-8 border-3 border-blue-900 border-t-[#009ee3] rounded-full animate-spin" />
                          <p className="text-xs text-blue-200 font-semibold animate-pulse">
                            Cargando módulo de Mercado Pago seguro...
                          </p>
                        </div>
                      )}

                      <div 
                        id="paymentCardBrickContainer" 
                        className="w-full min-h-[250px]"
                      ></div>
                    </div>

                    {mpIsSimulator && (
                      <div className="bg-[#002f54]/70 border border-[#009ee3]/30 rounded-xl p-3.5 text-[10.5px] text-blue-100 leading-relaxed flex gap-2 font-sans">
                        <span className="text-sm select-none">💡</span>
                        <div>
                          <strong>Modo Democación Activo:</strong> Como todavía no has configurado tus claves privadas reales (<code>MP_ACCESS_TOKEN</code>) en las variables de entorno de tu servidor, Mercado Pago opera en modo simulador para que pruebes tarjetas y transferencias de prueba.
                        </div>
                      </div>
                    )}
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
                {formData.paymentMethod !== "credit" && (
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={loading || !formData.paymentMethod}
                    className={`px-6 py-3 text-xs sm:text-sm font-semibold tracking-wider uppercase rounded-lg flex items-center gap-2 transition-all shadow-md transform active:scale-95 cursor-pointer ${
                      !formData.paymentMethod
                        ? "bg-brand-200 text-brand-400 border border-brand-300 cursor-not-allowed shadow-none"
                        : "bg-green-700 hover:bg-green-800 text-white"
                    }`}
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-brand-100 border-t-brand-900 rounded-full animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <span>Registrar Pedido y Ver Alias</span>
                        <CheckCircle className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
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
                
                {/* 1. SECCIÓN PRINCIPAL: AGRADECIMIENTO E INSTAGRAM DIRECTO */}
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

                {/* 2. BADGE DE ESTADO DEL PAGO CLARO SEGÚN TRANSFER/TARJETA */}
                {isTransfer ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4.5 max-w-md mx-auto text-center space-y-3.5 shadow-xs">
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-955 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full font-serif">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                        Estado: Reserva Confirmada - Pago Pendiente
                      </div>
                      <p className="text-[11px] text-brand-700 leading-relaxed font-light">
                        Tu pedido está reservado por 24 horas. Realizá la transferencia de <strong>{formatCurrency(transferTotal)}</strong> usando el <strong>Alias de abajo</strong>, y envianos el comprobante por Instagram para que preparemos tu paquete de inmediato.
                      </p>
                    </div>

                    {receiptImage && (
                      <div className="bg-white border border-amber-200 p-3 rounded-xl space-y-1.5 text-center mt-1 animate-in fade-in duration-300">
                        <span className="block text-[10px] text-green-700 font-bold uppercase tracking-wider font-sans">📄 Comprobante Adjuntado con éxito:</span>
                        <div className="relative inline-block border border-brand-200 rounded-lg overflow-hidden max-w-[140px] shadow-xs mx-auto">
                          <ResolvedImage 
                            src={receiptImage} 
                            alt="Comprobante en base" 
                            className="h-20 w-auto object-cover max-w-full"
                          />
                        </div>
                        <p className="text-[9.5px] text-brand-500 font-sans italic">
                          ¡El comprobante ya fue adjuntado a la orden! Tadeo lo verá directo en su Panel de Administración.
                        </p>
                      </div>
                    )}
                  </div>
                ) : mpTransferDetails ? (
                  <div className="bg-blue-50 border border-blue-200 text-blue-955 rounded-2xl p-4.5 max-w-md mx-auto text-center space-y-3 shadow-xs">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-955 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full font-serif font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      Estado: Transferencia Automática Mercado Pago
                    </div>
                    <p className="text-[11px] text-brand-700 leading-relaxed font-light">
                      Se generó una solicitud de transferencia bancaria inmediata (DEBIN/Red Link) de <strong>{formatCurrency(finalListTotal)}</strong> mediante Mercado Pago.
                    </p>
                    {mpTransferDetails.transaction_data?.qr_code && (
                      <div className="bg-white p-3.5 rounded-xl border border-blue-100 max-w-[280px] mx-auto text-center space-y-1">
                        <p className="text-[9px] text-brand-500 font-bold uppercase tracking-wider">Código de Transferencia Automática</p>
                        <p className="font-mono text-xs text-brand-900 break-all select-all font-bold p-2 bg-blue-50/50 rounded-lg">{mpTransferDetails.transaction_data.qr_code}</p>
                        <button 
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mpTransferDetails.transaction_data.qr_code);
                            notify("¡Código copiado! Pegalo en tu home banking.", "success");
                          }}
                          className="text-[10px] text-blue-600 font-bold underline cursor-pointer hover:text-blue-800"
                        >Copiar código de transferencia</button>
                      </div>
                    )}
                    {mpTransferDetails.transaction_data?.ticket_url && (
                      <div className="pt-1">
                        <a 
                          href={mpTransferDetails.transaction_data.ticket_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4.5 py-2.5 text-xs font-bold transition-all shadow-md active:scale-95 text-center font-sans"
                        >
                          Ver Detalle de Transferencia / Pagar con MP
                        </a>
                      </div>
                    )}
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

                {/* 3. NÚMERO DE ORDEN DESTACADO */}
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
                <div className="bg-[#FFFDF9] border border-amber-250 rounded-xl p-4 max-w-md mx-auto text-center space-y-1 shadow-xs">
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
                      <p><strong>Banco:</strong> {bankDetails?.bankName || "Banco de la Nación Argentina"}</p>
                      <p><strong>Titular:</strong> {bankDetails?.accountHolder || "Hogar y Estilo S.H."}</p>
                      <p><strong>CBU CVU:</strong> <span className="font-bold text-brand-950 break-all">{bankDetails?.cbu || ""}</span></p>
                      
                      <div className="p-3 border border-dashed border-green-200 bg-green-50/50 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 my-2 text-left">
                        <div>
                          <p className="text-[10px] text-brand-500 font-bold uppercase tracking-wider font-sans">Alias para Copiar:</p>
                          <p className="text-sm font-sans font-extrabold text-brand-950 tracking-wider select-all">{bankDetails?.alias || "deco.home.rosario"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(bankDetails?.alias || "deco.home.rosario");
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
