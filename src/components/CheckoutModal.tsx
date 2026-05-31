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

          // Mount to container
          const paymentContainer = document.getElementById("paymentCardBrickContainer");
          if (paymentContainer && active) {
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
        if (brickInstanceRef.current) {
          brickInstanceRef.current.unmount().catch(console.error);
          brickInstanceRef.current = null;
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
                  <label className="block text-xs font-semib
