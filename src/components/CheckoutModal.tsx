import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  ShoppingCart, 
  ShoppingBag, 
  CreditCard, 
  Trash2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  Check, 
  ExternalLink, 
  HelpCircle,
  Copy,
  Instagram
} from "lucide-react";

interface Product {
  id: string;
  title: string;
  basePrice: number;
  media: { url: string; type: string }[];
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  shipping: number;
  onOrderComplete?: (orderDetails: any, items: CartItem[], orderId?: string) => void;
  showToast?: boolean;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems,
  shipping,
  onOrderComplete,
  showToast = true
}: CheckoutModalProps) {
  const [step, setStep] = useState<"details" | "payment" | "success">("details");
  const [loading, setLoading] = useState(false);
  
  // Buyer profile form state
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "Santa Fe",
    postalCode: "",
    paymentMethod: "" as any,
    receiptImage: ""
  });

  const [cardData, setCardData] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: ""
  });

  // Simulator flag
  const [mpIsSimulator, setMpIsSimulator] = useState(true);
  const [generatedOrderId, setGeneratedOrderId] = useState("");
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Automatic Mercado Pago Brick states
  const [mpPreferenceUrl, setMpPreferenceUrl] = useState<string>("");
  const [mpPreferenceLoading, setMpPreferenceLoading] = useState<boolean>(false);
  const [mpError, setMpError] = useState<string>("");
  const [mpTransferDetails, setMpTransferDetails] = useState<any>(null);
  const [hasPrivateToken, setHasPrivateToken] = useState<boolean>(false);
  const brickInstanceRef = useRef<any>(null);

  const notify = (msg: string, type: "success" | "error" | "info" = "success") => {
    if (showToast) {
      const event = new CustomEvent("show-toast", { detail: { message: msg, type } });
      window.dispatchEvent(event);
    } else {
      alert(msg);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0
    }).format(amount);
  };

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.product.basePrice * item.quantity,
    0
  );
  const isFreeShipping = subtotal >= 50000;
  const computedShipping = isFreeShipping ? 0 : 10000;
  const finalListTotal = subtotal + computedShipping;

  // Payments logic
  const transferTotal = Math.round(subtotal * 0.85) + computedShipping;

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
                  theme: "default",
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
                      shipping: computedShipping,
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

                  // Retrieve barcode or deep links for transfers (DEBIN instructions) if available:
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
                if (active) setMpError("Error de validación o inicialización en el widget. Corregí los datos de la tarjeta o rellená bien los campos.");
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
            setMpError("No se pudo cargar el módulo seguro de Mercado Pago: " + err.message);
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
  }, [isOpen, step, formData.paymentMethod, cartItems, computedShipping, formData.fullName, formData.email]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.phone || !formData.address || !formData.city || !formData.postalCode) {
      notify("Por favor, completá todos los campos de envío obligatorios.", "error");
      return;
    }
    setStep("payment");
  };

  const handleConfirmPayment = async () => {
    if (!formData.paymentMethod) {
      notify("Por favor selectá un método de pago válido de la lista.", "error");
      return;
    }

    setLoading(true);

    try {
      const isTransfer = formData.paymentMethod === "transfer";
      const finalPriceToCollect = isTransfer ? transferTotal : finalListTotal;
      const staticId = `ORDER-${Math.floor(1000 + Math.random() * 9000)}`;

      // Record offline transfer order locally
      if (onOrderComplete) {
        onOrderComplete(formData, cartItems, staticId);
      }

      setGeneratedOrderId(staticId);
      setStep("success");
      notify("¡Pedido registrado con éxito! Esperamos tu comprobante bancario.", "success");
    } catch (err) {
      notify("Ocurrió un error al intentar registrar el despacho de tu orden.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("details");
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      province: "Santa Fe",
      postalCode: "",
      paymentMethod: "" as any,
      receiptImage: ""
    });
    setCardData({
      number: "",
      name: "",
      expiry: "",
      cvv: ""
    });
    setMpTransferDetails(null);
    setMpPreferenceUrl("");
    onClose();
  };

  const handleCopyOrderText = () => {
    const isTransfer = formData.paymentMethod === "transfer";
    const totalToPay = isTransfer ? transferTotal : finalListTotal;
    const itemListText = cartItems.map(item => `• ${item.quantity}x ${item.product.title} (Color: ${item.selectedColor || "Estándar"}, Talle: ${item.selectedSize || "Estándar"})`).join("\n");

    const orderText = `*Hogar y Estilo - Nuevo Pedido Registrado* 🏡🛍️
-----------------------------------------
ID de Orden: ${generatedOrderId}
Cliente: ${formData.fullName}
Email: ${formData.email}
Teléfono: ${formData.phone}
Dirección: ${formData.address}, ${formData.city} (${formData.province})
Código Postal: ${formData.postalCode}

*Detalle de Productos:*
${itemListText}

Envío: ${computedShipping === 0 ? "Gratis bonificado" : formatCurrency(computedShipping)}
Método de Pago: ${formData.paymentMethod === "transfer" ? "Transferencia Bancaria Directa (15% OFF)" : "Tarjeta de Crédito / Débito (Vía Mercado Pago)"}
*TOTAL NETO ABONADO / A ABONAR: ${formatCurrency(totalToPay)}*

=========================================
Muchas gracias por tu compra en Hogar y Estilo Deco. ¡Ya preparamos tu despacho!`;

    navigator.clipboard.writeText(orderText);
    setCopiedOrder(true);
    setTimeout(() => setCopiedOrder(false), 3000);
    notify("¡Ficha técnica copiada! Enviala por Instagram o WhatsApp.", "success");
  };

  const handleCopyCbu = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
    notify("¡Datos bancarios copiados al portapapeles con éxito!", "success");
  };

  return (
    <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-brand-100 flex flex-col md:flex-row overflow-hidden max-h-[90vh] md:max-h-[680px] animate-in fade-in zoom-in duration-300">
        
        {/* LEFT COLUMN: SHOPPING BAG SUMMARY */}
        <div className="w-full md:w-2/5 bg-brand-50/50 p-6 md:p-8 border-b md:border-b-0 md:border-r border-brand-100/80 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-brand-900 text-white p-2.5 rounded-2xl shadow-sm">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-serif font-black text-brand-900 tracking-tight text-lg">Resumen de Compra</h3>
                <p className="text-[10px] text-brand-500 uppercase tracking-wider font-bold">Hogar y Estilo</p>
              </div>
            </div>

            <div className="space-y-4 max-h-[160px] md:max-h-[280px] overflow-y-auto pr-1">
              {cartItems.map((item, idx) => (
                <div key={`${item.product.id}-${idx}`} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-brand-100/50 shadow-xs">
                  <div className="h-12 w-12 rounded-lg bg-brand-100 overflow-hidden shrink-0">
                    <img 
                      src={item.product.media[0]?.url || "/placeholder.jpg"} 
                      alt={item.product.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-brand-900 truncate font-sans">{item.product.title}</h4>
                    <p className="text-[10px] text-brand-500 font-mono mt-0.5">
                      Cant: {item.quantity} • {item.selectedColor || "Único"} {item.selectedSize ? `• ${item.selectedSize}` : ""}
                    </p>
                    <p className="text-xs font-black text-brand-900 mt-1 font-serif">{formatCurrency(item.product.basePrice * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-brand-100 space-y-2.5">
            <div className="flex justify-between text-xs text-brand-600 font-sans">
              <span>Subtotal del Carrito</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-brand-600 font-sans items-center">
              <span className="flex items-center gap-1">
                Envío Certificado a Domicilio
                {isFreeShipping && <span className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-md font-bold uppercase">Gratis</span>}
              </span>
              <span>{computedShipping === 0 ? "Bonificado" : formatCurrency(computedShipping)}</span>
            </div>
            
            <div className="bg-brand-900/5 p-3 rounded-2xl flex justify-between items-center mt-3">
              <div>
                <p className="text-[10px] text-brand-500 uppercase font-bold tracking-wider leading-none">Total Neto Estimado</p>
                <p className="text-lg font-serif font-black text-brand-900 mt-1">
                  {formData.paymentMethod === "transfer" ? formatCurrency(transferTotal) : formatCurrency(finalListTotal)}
                </p>
              </div>
              {formData.paymentMethod === "transfer" && (
                <div className="text-right">
                  <span className="text-[9.5px] bg-green-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">15% Off Aplicado</span>
                </div>
              )}
            </div>
            <p className="text-[9px] text-center text-brand-500 italic mt-2 leading-tight">Las compras superiores a $50.000 aplican envío express bonificado a cualquier provincia.</p>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE FORM STEPS */}
        <div className="w-full md:w-3/5 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[500px] md:max-h-full">
          
          {/* HEADER WITH STEPS INDEX indicator */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "details" ? "bg-brand-900 text-white" : "bg-green-100 text-green-800"}`}>
                {step === "details" ? "1" : <Check className="w-3.5 h-3.5" />}
              </div>
              <span className="text-xs font-semibold text-brand-900 font-sans">Datos de Envío</span>
              <div className="h-[1px] w-8 bg-brand-200" />
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "payment" ? "bg-brand-900 text-white" : step === "success" ? "bg-green-100 text-green-850" : "bg-brand-100 text-brand-400"}`}>
                {step === "success" ? <Check className="w-3.5 h-3.5" /> : "2"}
              </div>
              <span className={`text-xs font-sans ${step === "payment" ? "font-semibold text-brand-900" : "text-brand-400"}`}>Método de Pago</span>
            </div>
            
            <button 
              type="button" 
              onClick={onClose}
              className="p-1.5 hover:bg-brand-50 text-brand-400 hover:text-brand-900 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* STEP 1: BILLING & SHIPPING DETAILS */}
          {step === "details" && (
            <form onSubmit={handleNextStep} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="text-left">
                  <h4 className="font-serif font-black text-brand-900 text-base">Datos de Entrega Certificada</h4>
                  <p className="text-xs text-brand-500 font-light mt-0.5">Ingresá tu información real para el envío express por correo postal.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-brand-800 mb-1 font-sans uppercase">Nombre Completo del Destinatario *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: Sofia Beltran"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full bg-brand-50 border border-brand-200/80 rounded-xl p-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-900 text-brand-900 font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-brand-800 mb-1 font-sans uppercase">Correo Electrónico *</label>
                      <input 
                        type="email" 
                        required
                        placeholder="ejemplo@correo.com"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full bg-brand-50 border border-brand-200/80 rounded-xl p-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-900 text-brand-900 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-brand-800 mb-1 font-sans uppercase">Celular / WhatsApp *</label>
                      <input 
                        type="tel" 
                        required
                        placeholder="Ej: 341655453"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full bg-brand-50 border border-brand-200/80 rounded-xl p-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-900 text-brand-900 font-sans"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-brand-800 mb-1 font-sans uppercase">Calle y Altura (Domicilio de Entrega) *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: Corrientes 1420 Piso 3-B"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full bg-brand-50 border border-brand-200/80 rounded-xl p-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-900 text-brand-900 font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-1">
                      <label className="block text-[11px] font-bold text-brand-800 mb-1 font-sans uppercase">Cód. Postal *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej: 2000"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        className="w-full bg-brand-50 border border-brand-200/80 rounded-xl p-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-900 text-brand-900 font-sans font-semibold"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[11px] font-bold text-brand-800 mb-1 font-sans uppercase">Localidad *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej: Rosario"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full bg-brand-50 border border-brand-200/80 rounded-xl p-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-900 text-brand-900 font-sans"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[11px] font-bold text-brand-800 mb-1 font-sans uppercase">Provincia *</label>
                      <select
                        name="province"
                        value={formData.province}
                        onChange={handleInputChange}
                        className="w-full bg-brand-50 border border-brand-200/80 rounded-xl p-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-brand-900 text-brand-900 font-sans font-medium"
                      >
                        <option value="Santa Fe">Santa Fe</option>
                        <option value="Buenos Aires">Buenos Aires</option>
                        <option value="CABA">CABA</option>
                        <option value="Córdoba">Córdoba</option>
                        <option value="Entre Ríos">Entre Ríos</option>
                        <option value="Mendoza">Mendoza</option>
                        <option value="Tucumán">Tucumán</option>
                        <option value="Salta">Salta</option>
                        <option value="Neuquén">Neuquén</option>
                        <option value="Chaco">Chaco</option>
                        <option value="San Luis">San Luis</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-brand-100 flex items-center justify-between mt-5">
                <span className="text-[10px] text-brand-400 font-medium font-sans">
                  🔒 Conexión segura Cifrada SSL
                </span>
                <button
                  type="submit"
                  className="bg-brand-900 hover:bg-black text-white px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold tracking-wider uppercase flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <span>Continuar a Pago</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: PAYMENT STRATEGY CHOICER */}
          {step === "payment" && (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4 text-left">
                <div>
                  <h4 className="font-serif font-black text-brand-900 text-base">Elegir Pasarela de Pago</h4>
                  <p className="text-xs text-brand-500 font-light mt-0.5">Seleccioná cómo preferís abonar tus productos para que podamos proceder con el empaque.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A: Bank manual transfer */}
                  <div 
                    onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "transfer" }))}
                    className={`border-2 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between relative ${
                      formData.paymentMethod === "transfer"
                        ? "border-green-600 bg-green-50/20 shadow-xs"
                        : "border-brand-100/80 hover:border-brand-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-green-100 text-green-800 rounded-xl">
                        <帮助Circle className="w-4 h-4 text-green-800" />
                      </div>
                      <span className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">15 % Beneficio</span>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-black text-brand-950 font-serif">Transferencia Bancaria</p>
                      <p className="text-[10.5px] text-brand-550 leading-relaxed font-sans mt-0.5">
                        Aboná con un 15% de descuento directo en el total transfiriendo a nuestro alias / CBU manualmente.
                      </p>
                    </div>
                    {formData.paymentMethod === "transfer" && (
                      <div className="absolute top-3 right-3 text-green-700 bg-green-200/50 p-0.5 rounded-full">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Option B: Credit card / MP Integration */}
                  <div 
                    onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "credit" }))}
                    className={`border-2 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between relative ${
                      formData.paymentMethod === "credit"
                        ? "border-[#009ee3] bg-sky-50/10 shadow-xs"
                        : "border-brand-100/80 hover:border-brand-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-sky-100 text-[#009ee3] rounded-xl">
                        <CreditCard className="w-4 h-4 text-[#009ee3]" />
                      </div>
                      <span className="text-[9px] bg-[#009ee3] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Automático</span>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-black text-brand-950 font-serif">Tarjeta de Crédito / Débito / DEBIN</p>
                      <p className="text-[10.5px] text-brand-550 leading-relaxed font-sans mt-0.5">
                        Pagá de manera segura con tu tarjeta o transferencia instantánea sin salir de nuestra tienda utilizando Mercado Pago.
                      </p>
                    </div>
                    {formData.paymentMethod === "credit" && (
                      <div className="absolute top-3 right-3 text-[#009ee3] bg-sky-200/50 p-0.5 rounded-full">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>

                {!formData.paymentMethod && (
                  <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 text-center">
                    <p className="text-xs text-brand-600 font-medium">👈 Seleccioná un método de pago arriba para avanzar con el proceso.</p>
                  </div>
                )}

                {formData.paymentMethod === "transfer" && (
                  <div className="bg-green-50/50 border-2 border-green-600/30 rounded-xl p-5 sm:p-6 space-y-4 shadow-xs font-sans animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 border-b border-green-650/20 pb-3">
                      <span className="p-1 px-2.5 text-[9px] bg-green-600 text-white rounded-full font-bold uppercase tracking-wider shrink-0">15% Descuento</span>
                      <h4 className="font-serif font-black text-green-900 text-sm">
                        Instrucciones de Transferencia Bancaria Directa
                      </h4>
                    </div>

                    <p className="text-xs text-brand-800 leading-relaxed font-sans">
                      Deducimos un <strong>15% de descuento</strong> del subtotal de tu carrito por utilizar este canal directo. Por favor transferí el importe neto calculado:
                    </p>

                    <div className="bg-white border border-green-200 rounded-xl p-4 space-y-1.5 text-center shadow-xs">
                      <p className="text-[10px] uppercase font-bold text-brand-500 tracking-wider">Total Final Con Descuento a Abonar</p>
                      <p className="text-2xl font-black text-green-700 font-serif">{formatCurrency(transferTotal)}</p>
                      <p className="text-[9.5px] text-brand-550 leading-none">
                        (Subtotal con 15% OFF + Costo de Envío)
                      </p>
                    </div>

                    <div className="p-3.5 bg-green-100/40 rounded-xl border border-green-250/30 text-xs text-brand-900 space-y-2.5 font-sans">
                      <div className="flex justify-between items-center bg-white/70 p-2.5 rounded-lg border border-green-100">
                        <div>
                          <span className="text-[10px] text-brand-500 block leading-none font-bold uppercase">Alias Único CBU</span>
                          <span className="font-mono text-xs text-brand-900 select-all font-semibold break-all">deco.home.rosario</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleCopyCbu("deco.home.rosario")}
                          className="p-1.5 hover:bg-green-100 text-green-750 hover:text-green-900 rounded-lg transition-all cursor-pointer border border-green-200"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex justify-between items-center bg-white/70 p-2.5 rounded-lg border border-green-100 animate-pulse">
                        <div>
                          <span className="text-[10px] text-brand-500 block leading-none font-bold uppercase">Banco Receptivo</span>
                          <span className="font-sans text-xs text-brand-900 font-semibold uppercase">Banco Municipal de Rosario</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10.5px] text-brand-650 leading-normal font-sans italic">
                      💡 Luego de confirmar el pedido, te facilitamos la ficha técnica técnica del despacho para que nos envíes tu comprobante por chat y coordinemos más rápido.
                    </p>
                  </div>
                )}

                {formData.paymentMethod === "credit" && (
                  <div className="bg-white border-2 border-[#009ee3] rounded-xl p-5 sm:p-6 space-y-4 shadow-sm text-left font-sans animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 border-b border-[#009ee3]/30 pb-3">
                      <span className="p-1 px-2.5 text-[9px] bg-[#009ee3] text-white rounded-full font-bold uppercase tracking-wider shrink-0">Seguro</span>
                      <h4 className="font-serif font-black text-[#009ee3] text-sm">
                        Mercado Pago Directo Sin Salir de la Tienda
                      </h4>
                    </div>

                    <p className="text-xs text-brand-700 leading-relaxed font-sans">
                      Pagá de forma segura con tu tarjeta de crédito/débito o por transferencia bancaria automática (DEBIN/Red Link) utilizando la pasarela oficial integrada.
                    </p>

                    {mpPreferenceLoading && (
                      <div className="py-12 flex flex-col items-center justify-center space-y-3">
                        <span className="w-8 h-8 border-3 border-brand-200 border-t-[#009ee3] rounded-full animate-spin" />
                        <p className="text-xs text-brand-600 font-semibold animate-pulse">
                          Cargando módulo seguro de Mercado Pago...
                        </p>
                      </div>
                    )}

                    {mpError && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xs text-red-800 font-medium">{mpError}</p>
                      </div>
                    )}

                    {/* Mercado Pago Brick will render inside this container */}
                    <div 
                      id="paymentCardBrickContainer" 
                      className={`w-full min-h-[250px] ${mpPreferenceLoading ? "hidden" : "block"}`}
                    ></div>

                    {mpIsSimulator && (
                      <div className="bg-amber-50/85 border border-amber-200 rounded-xl p-3.5 text-[10.5px] text-amber-900 leading-relaxed flex gap-2 font-sans">
                        <span className="text-sm select-none">💡</span>
                        <div>
                          <strong>Modo Demostración Activo:</strong> Como todavía no has configurado tus claves privadas reales (<code>MP_ACCESS_TOKEN</code>) en las variables de entorno de tu servidor, Mercado Pago opera en modo simulador para que pruebes tarjetas y transferencias de prueba.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ACTION FOOTER BAR */}
              <div className="pt-5 border-t border-brand-100 flex items-center justify-between mt-5">
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="px-4 py-2 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
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

          {/* STEP 3: TRANSACTION SUCCESSFUL REPORT BANNER */}
          {step === "success" && (
            <div className="py-6 flex flex-col justify-between h-full text-center space-y-5 animate-in fade-in duration-500">
              <div className="space-y-4 max-w-md mx-auto">
                <div className="mx-auto h-16 w-16 bg-green-100 text-green-850 rounded-full flex items-center justify-center shadow-xs">
                  <CheckCircle className="w-9 h-9 text-green-750" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-brand-900 text-xl tracking-tight">¡Pedido Recibido con Éxito!</h3>
                  <p className="text-xs text-brand-500 font-light mt-1">Registramos tu despacho de forma segura en nuestro sistema.</p>
                </div>

                <div className="p-4 bg-brand-50 border border-brand-100 rounded-2xl text-left space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between border-b pb-1.5 text-[11px] border-brand-100">
                    <span className="text-brand-550 font-bold">Código de Despacho:</span>
                    <span className="text-brand-900 font-black">{generatedOrderId}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5 text-[11px] border-brand-100">
                    <span className="text-brand-550">Cliente Destinatario:</span>
                    <span className="text-brand-900 font-semibold">{formData.fullName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5 text-[11px] border-brand-100">
                    <span className="text-brand-550">Forma de Envío:</span>
                    <span className="text-brand-900">Correo Express Certificado</span>
                  </div>
                  <div className="flex justify-between pt-0.5 text-[11px]">
                    <span className="text-brand-550 font-bold">Total Abonado:</span>
                    <span className="text-brand-900 font-black">
                      {formData.paymentMethod === "transfer" ? formatCurrency(transferTotal) : formatCurrency(finalListTotal)}
                    </span>
                  </div>
                </div>

                {formData.paymentMethod === "transfer" ? (
                  <div className="bg-green-50 border border-green-200 text-green-955 rounded-2xl p-4.5 max-w-md mx-auto text-center space-y-3 shadow-xs">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-955 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full font-serif font-bold">
                      ⚠️ Acción Requerida: Confirmar Transferencia
                    </div>
                    <p className="text-[11px] text-brand-700 leading-relaxed font-light">
                      Transferí el importe total de <strong>{formatCurrency(transferTotal)}</strong> usando el Alias de abajo, y envianos la captura del comprobante enviada directamente a nuestro Instagram oficial:
                    </p>

                    <div className="bg-white p-3.5 rounded-xl border border-green-150 max-w-[285px] mx-auto text-center space-y-1">
                      <p className="text-[9px] text-brand-500 font-bold uppercase tracking-wider">Copiá nuestro Alias Único</p>
                      <p className="font-mono text-sm text-brand-900 font-black p-2 bg-green-50/50 rounded-lg select-all">deco.home.rosario</p>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("deco.home.rosario");
                          notify("¡Alias de CBU copiado!", "success");
                        }}
                        className="text-[10px] text-green-700 font-bold underline cursor-pointer hover:text-green-900"
                      >Copiar Datos Bancarios</button>
                    </div>

                    <div className="pt-2">
                      <a 
                        href="https://instagram.com/deco.home.rosario" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-block bg-brand-950 hover:bg-black text-white rounded-lg px-4.5 py-2.5 text-xs font-bold transition-all shadow-md active:scale-95 text-center font-sans"
                      >
                        📲 Ir a Instagram @deco.home.rosario
                      </a>
                    </div>
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
                      🔒 Pago Acreditado en Producción
                    </div>
                    <p className="text-[11px] text-brand-700 leading-relaxed font-light">
                      El pago automático de <strong>{formatCurrency(finalListTotal)}</strong> por Mercado Pago fue procesado con éxito. Empacamos tus productos de inmediato.
                    </p>
                  </div>
                )}
              </div>

              {/* SUCCESS ACTIONS FOOTER GROUP */}
              <div className="space-y-2 max-w-sm mx-auto w-full pt-4 border-t border-brand-100 mt-4">
                <button
                  type="button"
                  onClick={handleCopyOrderText}
                  className={`w-full bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-900 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${copiedOrder ? "bg-green-150 border-green-300" : ""}`}
                >
                  <Copy className="w-4 h-4 text-brand-900" />
                  <span>{copiedOrder ? "¡Copiado al Portapapeles!" : "Copiar Ficha de Despacho"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full bg-brand-900 hover:bg-black text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  Cerrar y Volver a la Tienda
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
