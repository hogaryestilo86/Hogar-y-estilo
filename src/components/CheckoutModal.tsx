import React, { useState, useEffect, useRef } from "react";
import { OrderDetails, CartItem, BankDetails } from "../types";
import { X, CreditCard, Landmark, CheckCircle, ArrowRight, ClipboardCheck, ArrowLeft, ShieldAlert, DollarSign, HelpCircle, Copy, Instagram, Upload, Image } from "lucide-react";
import { storeMedia, ResolvedImage } from "../indexedDbMedia";

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

  const [receiptImage, setReceiptImage] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedOrder, setCopiedOrder] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatic Mercado Pago Brick states
  const [mpPreferenceUrl, setMpPreferenceUrl] = useState<string>("");
  const [mpPreferenceLoading, setMpPreferenceLoading] = useState<boolean>(false);
  const [mpError, setMpError] = useState<string>("");
  const [mpIsSimulator, setMpIsSimulator] = useState<boolean>(false);
  const [mpTransferDetails, setMpTransferDetails] = useState<any>(null);
  const [hasPrivateToken, setHasPrivateToken] = useState<boolean>(false);
  const brickInstanceRef = useRef<any>(null);

  const [dragActive, setDragActive] = useState<boolean>(false);

  const notify = (msg: string, type: "success" | "error" | "info" = "info") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(msg);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardData((prev) => ({ ...prev, [name]: value }));
  };

  const [generatedOrderId, setGeneratedOrderId] = useState<string>("");

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
          // 1. Inject Mercado Pago SDK
          if (!(window as any).MercadoPago) {
            const script = document.createElement("script");
            script.src = "https://sdk.mercadopago.com/js/v2";
            script.async = true;
            document.body.appendChild(script);
            await new Promise((resolve) => {
              script.onload = resolve;
            });
          }

          if (!active) return;

          // 2. Clear old instances
          if (brickInstanceRef.current) {
            await brickInstanceRef.current.unmount().catch(console.error);
            brickInstanceRef.current = null;
          }

          // 3. Obtain Credentials via safe server API endpoint
          const configRes = await fetch("/api/mercadopago/config");
          if (!configRes.ok) {
            throw new Error("No se pudo obtener la clave pública de configuración.");
          }
          const { publicKey, hasPrivateToken: isReal } = await configRes.json();
          
          if (!active) return;
          setHasPrivateToken(isReal);

          // 3. Initialize MP
          const mp = new (window as any).MercadoPago(publicKey, { locale: "es-AR" });
          const bricksBuilder = mp.bricks();

          if (!active) return;

          // 4. Render native Brick controller targeting target element
          const renderCardBrick = async (builder: any) => {
            brickInstanceRef.current = await builder.create(
              "cardPayment",
              "paymentCardBrickContainer",
              {
                initialization: {
                  amount: finalListTotal,
                  payer: {
                    email: formData.email || "correo@ejemplo.com",
                    firstName: formData.fullName.split(" ")[0] || "Cliente",
                    lastName: formData.fullName.split(" ").slice(1).join(" ") || "DecoHome",
                  },
                },
                customization: {
                  visual: {
                    style: {
                      theme: "flat",
                      customVariables: {
                        formBackgroundColor: "#FFFFFF",
                        baseColor: "#4B2E1E",
                        borderRadius: "12px",
                      }
                    }
                  },
                  paymentMethods: {
                    maxInstallments: 3,
                    minInstallments: 1,
                    types: {
                      excluded: ["debit_card"]
                    }
                  }
                },
                callbacks: {
                  onReady: () => {
                    if (active) setMpPreferenceLoading(false);
                  },
                  onSubmit: async (cardFormData: any) => {
                    if (!active) return;
                    setMpPreferenceLoading(true);
                    try {
                      const res = await fetch("/api/mercadopago/payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          token: cardFormData.token,
                          issuer_id: cardFormData.issuer_id,
                          payment_method_id: cardFormData.payment_method_id,
                          transaction_amount: cardFormData.transaction_amount,
                          installments: cardFormData.installments,
                          payer: cardFormData.payer,
                          orderData: {
                            fullName: formData.fullName,
                            email: formData.email,
                            phone: formData.phone,
                            address: formData.address,
                            city: formData.city,
                            zipCode: formData.zipCode,
                            cartItems: cartItems.map(i => ({ title: i.product.title, quantity: i.quantity, price: i.product.basePrice })),
                          }
                        })
                      });

                      if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.details || "Error procesando el pago seguro offline.");
                      }

                      const paymentResult = await res.json();
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
                      console.error("Payment brick submission error:", err);
                      // Notify friendly error to make customer clear
                      notify("⚠️ Error al debitar la tarjeta: " + err.message, "error");
                    } finally {
                      if (active) setMpPreferenceLoading(false);
                    }
                  },
                  onError: (error: any) => {
                    console.error("Error crítico de Brick:", error);
                    notify("No pudimos conectar con los servidores de Mercado Pago.", "error");
                  },
                },
              }
            );
          };

          await renderCardBrick(bricksBuilder);
        } catch (err: any) {
          console.error("Error al inicializar Mercado Pago Brick:", err);
          if (active) {
            setMpError("No se pudo cargar el módulo seguro de Mercado Pago en vivo: " + err.message);
            setMpPreferenceLoading(false);
          }
        }
      };

      const delayTimer = setTimeout(() => {
        initializeBrick();
      }, 100);

      return () => {
        active = false;
        clearTimeout(delayTimer);
        if (brickInstanceRef.current) {
          brickInstanceRef.current.unmount().catch(console.error);
          brickInstanceRef.current = null;
        }
      };
    }
  }, [isOpen, step, formData.paymentMethod, cartItems, shipping, formData.fullName, formData.email]);

  const copyCBU = () => {
    const cbuText = `CBU: ${bankDetails?.cbu || ""} - Alias: ${bankDetails?.alias || ""} - Titular: ${bankDetails?.accountHolder || ""} - CUIT: ${bankDetails?.cuit || ""} (${bankDetails?.bankName || ""})`;
    navigator.clipboard.writeText(cbuText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.address || !formData.phone) {
      notify("Por favor, completa los campos requeridos para continuar.", "error");
      return;
    }
    setStep("payment");
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Max 10MB to verify safe storage limits
    if (file.size > 10 * 1024 * 1024) {
      notify("La imagen del comprobante no debe superar los 10 Megabytes.", "error");
      return;
    }

    setUploading(true);
    try {
      const savedUrl = await storeMedia(file);
      setReceiptImage(savedUrl);
      notify("¡Comprobante cargado correctamente!", "success");
    } catch (err) {
      console.error("Local file upload error:", err);
      notify("Ocurrió un error al cargar localmente el comprobante en la memoria segura del navegador.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) {
        notify("Por favor, arrastrá un archivo de formato de imagen válido (JPG, PNG, WEBP).", "error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        notify("La imagen del comprobante no debe superar los 10 MB.", "error");
        return;
      }
      
      setUploading(true);
      try {
        const savedUrl = await storeMedia(file);
        setReceiptImage(savedUrl);
        notify("¡Comprobante arrastrado y cargado correctamente!", "success");
      } catch (err) {
        console.error("Drag and drop register error:", err);
        notify("No pudimos guardar el archivo arrastrado.", "error");
      } finally {
        setUploading(false);
      }
    }
  };

  const removeReceipt = () => {
    setReceiptImage("");
    notify("Comprobante removido correctamente.", "info");
  };

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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>

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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
                  />
                </div>

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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
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
                    className="w-full bg-white border border-brand-200 rounded-lg p-2.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-500 text-brand-900 shadow-2xs"
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
                    <span>Costo de envío:</span>
                    <span className={shipping === 0 ? "text-green-700 font-bold" : ""}>
                      {shipping === 0 ? "¡ENVÍO GRATIS!" : formatCurrency(shipping)}
                    </span>
                  </div>
                  <div className="border-t border-brand-200 my-2 pt-2 flex justify-between font-bold text-brand-900 text-sm sm:text-base">
                    <span>Total estimado:</span>
                    <span>{formatCurrency(finalListTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="bg-brand-900 hover:bg-brand-950 text-white font-bold py-3 px-6 rounded-xl text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <span>Continuar a Pago</span>
                  <ArrowRight className="w-4 h-4 text-white" />
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
                    <span className="text-[9px] text-brand-505 block">Total con descuento:</span>
                    <p className="text-base font-bold text-green-700 font-serif">
                      {formatCurrency(transferTotal)}
                    </p>
                  </div>
                </div>

                {/* Tarjetas Bancarias (Mercado Pago Bricks Directas, 3 cuotas sin interés) */}
                <div
                  className={`border-2 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                    formData.paymentMethod === "credit"
                      ? "border-brand-850 bg-brand-100"
                      : "border-brand-200 bg-white hover:border-brand-400"
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "credit" }))}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-brand-900 flex items-center gap-1.5 text-xs sm:text-sm">
                        <CreditCard className="w-4 h-4 text-brand-900 shrink-0" />
                        Tarjeta Crédito / Débito
                      </h4>
                      <span className="bg-brand-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        3 CUOTAS SIN INTERÉS
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-600 font-light mt-2 leading-relaxed">
                      Paga de forma 100% nativa con tarjetas Visa, MasterCard o Cabal sin salir de nuestra tienda.
                    </p>
                  </div>
                  <div className="text-right mt-4 pt-2 border-t border-brand-100">
                    <span className="text-[9px] text-brand-505 block">3 cuotas fijas de:</span>
                    <p className="text-base font-bold text-brand-900 font-serif">
                      {formatCurrency(installmentAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* FRIENDLY SHIELD: Certifies merchant safety */}
              <div className="bg-[#FAF8F5] border border-brand-200 p-3.5 rounded-xl flex items-start gap-2.5 max-w-lg mx-auto">
                <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10.5px] sm:text-xs text-brand-800 leading-normal">
                  🔐 <strong>Protocolo Hogar y Estilo:</strong> Tus transacciones con tarjeta se encriptan bajo certificado bancario AES-256. Ninguno de tus números de tarjeta es visible para nuestros servidores ni se guardan localmente en ningún momento.
                </p>
              </div>

              {/* Sub-paso dinámico 1: TRANSFERENCIA BANCARIA */}
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
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-brand-800">
                        Compártenos la captura de tu comprobante de transferencia bancaria *
                      </label>
                      
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                          dragActive 
                            ? "border-green-600 bg-green-50/50" 
                            : receiptImage 
                              ? "border-brand-300 bg-brand-50/40" 
                              : "border-brand-200 bg-brand-50/20 hover:border-brand-400"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="receipt-file-input"
                        />
                        
                        {!receiptImage ? (
                          <div className="space-y-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="p-3 bg-brand-200 rounded-full inline-block text-brand-800">
                              <Upload className="w-5 h-5 text-brand-900" />
                            </div>
                            <p className="text-xs text-brand-800 font-sans font-medium">
                              <span className="text-brand-950 underline font-black">Haz clic para cargar</span> o arrastra tu captura de pantalla aquí
                            </p>
                            <p className="text-[10px] text-brand-500 font-sans font-light">Formatos admitidos: JPG, PNG, WEBP de hasta 10MB</p>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-left">
                              <div className="p-2 sm:p-2.5 bg-green-100 rounded-xl">
                                <ClipboardCheck className="w-5-h-5 text-green-700" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-green-800">¡Imagen de comprobante adjuntada!</p>
                                <p className="text-[10px] text-brand-500 font-light">Guardada localmente de forma temporal para corroborar.</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2.5 w-full sm:w-auto">
                              {/* Open interactive thumbnail visualizer */}
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
                              <button
                                type="button"
                                onClick={removeReceipt}
                                className="px-3.5 py-2 hover:bg-brand-100 text-red-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-brand-200 bg-white"
                              >
                                Quitar captura
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-paso dinámico 2: TARJETAS DE CRÉDITO DE MERCADO PAGO BRICKS (Directas nativas) */}
              {formData.paymentMethod === "credit" && (
                <div className="bg-white border-2 border-[#009ee3] rounded-xl p-5 sm:p-6 space-y-4 shadow-sm text-left font-sans animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 border-b border-brand-100 pb-3">
                    <img 
                      src="https://img.icons8.com/color/48/mercadopin.png" 
                      alt="Logo Mercado Pago" 
                      className="w-5 h-5 shrink-0" 
                    />
                    <h4 className="font-serif font-black text-[#009ee3] text-sm tracking-wide">
                      Módulo de Pago Seguro Directo:
                    </h4>
                  </div>

                  {mpError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs space-y-1">
                      <p className="font-bold">⚠️ Detalle de pasarela Mercado Pago:</p>
                      <p>{mpError}</p>
                    </div>
                  )}

                  {mpPreferenceLoading && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3.5 text-center">
                      <div className="relative flex items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-[#009ee3]"></div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-brand-900 tracking-wide">Conectando con la API de Mercado Pago...</p>
                        <p className="text-[10px] text-brand-500">Cifrando formulario AES-256 para recibir la respuesta.</p>
                      </div>
                    </div>
                  )}

                  {/* Mercado Pago Brick will render inside this container */}
                  <div 
                    id="paymentCardBrickContainer" 
                    className={`w-full min-h-[250px] ${mpPreferenceLoading ? "hidden" : "block"}`}
                  ></div>

                  {/* Inform customer that token is set explicitly */}
                  {hasPrivateToken ? (
                    <p className="text-[10px] text-green-700 italic text-center font-sans">
                      ✓ Credenciales activas: Mercado Pago configurado en producción mediante Vercel environment variables.
                    </p>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[10px] text-amber-800 leading-normal">
                      🔌 <strong>Modo Simulado Activo:</strong> MP_ACCESS_TOKEN o MP_PUBLIC_KEY no configurado en Vercel. Puedes usar la tarjeta de simulación genérica para completar el pedido de desarrollo.
                    </div>
                  )}
                </div>
              )}

              {/* Botonera de navegación del paso 2 */}
              <div className="flex justify-between items-center pt-4 border-t border-brand-200">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="px-5 py-3 rounded-xl border border-brand-300 text-brand-900 font-bold hover:bg-brand-100 transition-colors flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4 text-brand-900" />
                  <span>Volver a Envío</span>
                </button>

                {/* Confirm transfer manually from buttons only if paymentMethod is transfer (since MP Card Brick triggers submit automatically) */}
                {formData.paymentMethod === "transfer" && (
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={loading || uploading || !receiptImage}
                    className="bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-6 rounded-xl text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <ClipboardCheck className="w-4.5 h-4.5 text-white" />
                    )}
                    <span>{loading ? "Confirmando..." : "Confirmar Transferencia"}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "success" && (() => {
            const isTransfer = formData.paymentMethod === "transfer";
            const toPay = isTransfer ? transferTotal : finalListTotal;

            return (
              <div className="space-y-6 py-6 text-center max-w-xl mx-auto">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-700 animate-bounce">
                  <CheckCircle className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h4 className="font-serif text-2xl font-black text-brand-900">¡Muchísimas gracias por tu compra!</h4>
                  <p className="text-xs sm:text-sm text-brand-800 max-w-md mx-auto leading-relaxed">
                    Hemos registrado tu pedido correctamente. Tus detalles de envío y comprobante de pago han sido guardados temporalmente para su corroboración.
                  </p>
                </div>

                {/* 1. RESUMEN COMPACTO DEL PEDIDO */}
                <div className="bg-white border border-brand-200 rounded-2xl p-5 shadow-xs max-w-md mx-auto space-y-4 text-left font-sans">
                  <div className="border-b border-brand-100 pb-2.5 flex justify-between items-center">
                    <span className="text-[10px] text-brand-500 font-bold uppercase tracking-widest">Estado del Pedido</span>
                    <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Esperando Corroborar</span>
                  </div>

                  <div className="space-y-2 text-xs text-brand-800">
                    <p><strong>Comprador:</strong> {formData.fullName}</p>
                    <p><strong>Enviado a:</strong> {formData.address}, {formData.city}</p>
                    <p><strong>Contacto Mail:</strong> {formData.email}</p>
                    <p><strong>Método de pago seleccionado:</strong> <span className="font-extrabold text-brand-900">{isTransfer ? "Transferencia Bancaria (-15% OFF)" : "Tarjeta de Crédito / Débito (Nativo)"}</span></p>
                    <div className="border-t border-brand-100 pt-3 mt-3 flex justify-between items-center text-brand-950">
                      <span className="font-bold text-xs uppercase tracking-wider">Total final abonado:</span>
                      <span className="font-serif font-black text-base text-brand-950">{formatCurrency(toPay)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. COPÌAR NRO ORDEN */}
                <div className="p-4 bg-brand-100 border border-brand-200 rounded-2xl max-w-md mx-auto">
                  <span className="block text-[10px] text-brand-500 uppercase tracking-widest font-black mb-1">Número de orden generado:</span>
                  <div className="flex items-center justify-center gap-3.5">
                    <span className="font-mono font-bold text-brand-950 text-base sm:text-lg tracking-wider select-all">{generatedOrderId || "#1024"}</span>
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
                    </div>
                  </div>
                )}

                {/* 5. REDIRECT DIRECT BUTTON TO INSTAGRAM */}
                <div className="space-y-4 max-w-sm mx-auto pt-4 font-sans">
                  <button
                    onClick={() => {
                      clearCart();
                      onClose();
                      setStep("form");
                      setMpPreferenceUrl("");
                      setReceiptImage("");
                    }}
                    className="w-full text-brand-850 hover:text-brand-950 hover:underline text-xs tracking-wider transition-colors font-semibold uppercase cursor-pointer text-center bg-transparent py-2"
                  >
                    Cerrar y Volver a la Tienda
                  </button>
                  
                  <div>
                    <a
                      href="https://instagram.com/deco.home.rosario"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 text-white py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-95 text-center cursor-pointer font-sans shadow-md"
                    >
                      <Instagram className="w-4.5 h-4.5 text-white" />
                      <span>Avisar Compra por Instagram</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
