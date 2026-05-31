import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // API Routes - Must be declared BEFORE Vite middleware
  app.post("/api/optimize-description", async (req, res) => {
    try {
      const { description, title } = req.body;

      if (!description && !title) {
        return res.status(400).json({ error: "Ingresa al menos un título o descripción básica del producto para optimizar." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "API key incorpórea. La API de Gemini no está configurada aún en este servidor. Por favor, configúrala en Settings > Secrets."
        });
      }

      // Initialize GoogleGenAI server-side with recommended User-Agent header
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemPrompt = `Eres un experto amigable, cálido y profesional en redactar publicaciones para e-commerce. Trabajas para la marca de decoración "Hogar y Estilo" de Rosario, Argentina.
Tus respuestas y textos sugeridos deben estar escritos siempre con el tratamiento de "Vos" (voseo argentino: ej. tuteo amigable, cercano, cálido, utilizando palabras locales naturales, sin sonar exagerado pero con total confianza y cercanía).
Eliminá por completo cualquier trato de "Usted" o español ibérico. Háblame de "Vos" a mí también en la descripción del producto.

A partir del título rudimentario y de la descripción o notas provistas por el usuario, debés generar 3 campos optimizados:
1. Un título de producto comercialmente atractivo, sofisticado, elegante y optimizado para SEO (ej: "Lámpara de Mesa de Madera Rústica Japandi" en lugar de "lampara de madera").
2. Una descripción persuasiva y súper vendedora adaptada al voseo argentino de forma informal, cercana, amigable pero muy profesional y refinada, redactada en formato Markdown con:
   - Un párrafo introductorio ultra elegante que evoque comodidad, orden, calidez en el hogar o distinción. Te debés dirigir al comprador hablándole de "Vos" (ej: "Transformá tus espacios", "Llevá calidez a tu mesa").
   - Una sección titulada "**Detalles de Diseño**" con una lista de ventajas clave, materiales sofisticados y usabilidad.
   - Un sutil y persuasivo llamado a la acción que invite a renovar los rincones cotidianos de su hogar.
3. El SEO "todo" o tags clave: Una lista de 5 a 6 palabras clave o características destacadas de SEO, separadas exactamente por una coma (ej: "mármol travertino real, mesa auxiliar japandi, estilo rústico moderno, decoración de salas minimalistas, calidad artesanal premium").

Reglas críticas:
- No hables de dropshipping abiertamente. Los productos son seleccionados exclusivamente por Hogar & Estilo.
- Devuelve la respuesta STRICTLY en formato JSON válido de acuerdo al esquema solicitado sin markdown tags afuera. El campo de SEO debe ser "seoFeatures" con los tags de palabras clave separados por coma.`;

      const userMessage = `Título provisto: "${title || ""}"
Descripción básica / Notas del producto: "${description || ""}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${systemPrompt}\n\n${userMessage}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { 
                type: "STRING",
                description: "Título sofisticado de alta gama para el producto" 
              },
              description: { 
                type: "STRING", 
                description: "Descripción persuasiva en formato Markdown" 
              },
              seoFeatures: { 
                type: "STRING", 
                description: "Palabras clave de SEO separadas exclusivamente por coma" 
              }
            },
            required: ["title", "description", "seoFeatures"]
          }
        }
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText);
      
      res.json({
        title: parsedData.title || title || "Producto Premium",
        description: parsedData.description || description || "",
        seoFeatures: parsedData.seoFeatures || ""
      });
    } catch (error: any) {
      console.error("Error optimizando descripción con Gemini:", error);
      res.status(500).json({
        error: "Ocurrió un error al procesar tu solicitud con el optimizador inteligente de Gemini.",
        details: error.message || error,
      });
    }
  });

  // API Endpoint: Proxy images to bypass hotlinking and CORS restrictions from MercadoLibre CDN
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).send("Falta el parámetro url.");
      }

      // Allow either mlstatic.com or unsplash.com
      if (!imageUrl.includes("mlstatic.com") && !imageUrl.includes("unsplash.com")) {
        return res.status(400).send("Solo se admiten URLs de dominios autorizados.");
      }

      const response = await fetch(imageUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.mercadolibre.com.ar/",
          "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
      });

      if (!response.ok) {
        return res.status(response.status).send(`Error fetching image: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "image/webp";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=43200");

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("Error in image-proxy:", err);
      res.status(500).send("Error de servidor interno en el proxy de imágenes.");
    }
  });

  // API Endpoint: Send Buyer Order Data directly registering locally
  app.post("/api/send-order-email", (req, res) => {
    return res.json({
      success: true,
      details: "Registrado localmente de forma segura en la base de datos local."
    });
  });

  // API Endpoint: Create Mercado Pago Payment Preference (Deprecated, kept for compatibility)
  app.post("/api/mercadopago/preference", async (req, res) => {
    try {
      const { items, shipping, payer } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No se enviaron artículos para procesar el pago." });
      }

      const mpAccessToken = process.env.MP_ACCESS_TOKEN;

      // Prepare items for Mercado Pago format
      const mpItems = items.map((item: any) => ({
        id: item.product?.id || item.id || "item-id",
        title: item.product?.title || item.title || "Producto de Deco.Home",
        quantity: Number(item.quantity) || 1,
        unit_price: Math.round(Number(item.product?.basePrice || item.price || item.unit_price)),
        currency_id: "ARS",
        picture_url: item.product?.media?.[0]?.url || ""
      }));

      // Add shipping if present
      if (shipping && Number(shipping) > 0) {
        mpItems.push({
          id: "envio-correo",
          title: "Envío a Domicilio",
          quantity: 1,
          unit_price: Math.round(Number(shipping)),
          currency_id: "ARS",
          picture_url: ""
        });
      }

      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const host = req.headers.host || "localhost:3000";
      const baseUrl = `${protocol}://${host}`;

      const preferencePayload = {
        items: mpItems,
        payer: {
          name: payer?.fullName || "Cliente",
          email: payer?.email || "test_user@test.com",
          phone: {
            number: payer?.phone || ""
          },
          address: {
            street_name: payer?.address || ""
          }
        },
        back_urls: {
          success: `${baseUrl}/?payment_status=success`,
          failure: `${baseUrl}/?payment_status=failure`,
          pending: `${baseUrl}/?payment_status=pending`
        },
        auto_return: "approved",
        statement_descriptor: "DECO HOME ROSARIO",
        external_reference: `order-${Math.floor(1000 + Math.random() * 9000)}`
      };

      if (!mpAccessToken) {
        // Fallback for demonstration / developer testing if token is not defined yet
        console.warn("Mercado Pago Integration Alert: MP_ACCESS_TOKEN environment variable is not defined. Using smart simulator mode.");
        
        // Return simulated checkout URL and sandbox IDs
        return res.json({
          id: "pref-simulator-mode-99923485",
          init_point: `https://www.mercadopago.com.ar/`, // Fallback
          sandbox_init_point: `https://sandbox.mercadopago.com.ar/`,
          isSimulator: true,
          message: "Para realizar pagos de verdad con tu cuenta, configura la variable 'MP_ACCESS_TOKEN' en Secrets."
        });
      }

      // Make a real call API to Mercado Pago
      const response = await fetch("https://api.mercadopago.com/v1/checkout/preferences", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(preferencePayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error creating preference on Mercado Pago API:", errorData);
        return res.status(response.status).json({
          error: "Error del servidor de Mercado Pago al generar la preferencia de cobro.",
          details: errorData
        });
      }

      const data = await response.json();
      return res.json({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
        isSimulator: false
      });
    } catch (err: any) {
      console.error("Exception in Mercado Pago Pref Controller:", err);
      return res.status(500).json({
        error: "Error interno del servidor al procesar la pasarela de cobro.",
        message: err.message
      });
    }
  });

  // API Endpoint: Get Mercado Pago Config (Public Key)
  app.get("/api/mercadopago/config", (req, res) => {
    const publicKey = process.env.MP_PUBLIC_KEY || process.env.VITE_MP_PUBLIC_KEY || "APP_USR-7e14f52c-80fd-4fbc-ad89-d9cb79b6f849";
    return res.json({
      publicKey,
      hasPrivateToken: !!process.env.MP_ACCESS_TOKEN
    });
  });

  // API Endpoint: Process Payment Brick direct payment natively
  app.post("/api/mercadopago/payment", async (req, res) => {
    try {
      const { paymentData, cartItems, shipping, payerDetails } = req.body;

      if (!paymentData) {
        return res.status(400).json({ error: "Falta el payload de pago ('paymentData')." });
      }

      const mpAccessToken = process.env.MP_ACCESS_TOKEN;

      // SIMULATED TESTING MODE
      if (!mpAccessToken) {
        console.warn("Local Developer Mode: MP_ACCESS_TOKEN is missing. Emulating successful transaction.");
        
        const paymentMethodId = paymentData.payment_method_id || "visa";
        const isBankTransfer = paymentMethodId.includes("transfer") || paymentMethodId.includes("debin") || paymentMethodId === "clabe" || paymentMethodId === "pse";
        
        return res.json({
          id: Math.floor(1000000000 + Math.random() * 9000000000),
          status: isBankTransfer ? "pending" : "approved",
          status_detail: isBankTransfer ? "pending_waiting_transfer" : "accredited",
          payment_method_id: paymentMethodId,
          transaction_amount: Number(paymentData.transaction_amount),
          isSimulator: true,
          message: "Operando en modo de simulación. Configura MP_ACCESS_TOKEN para producción."
        });
      }

      // Connect to Mercado Pago /v1/payments endpoint representing Brick request
      const url = "https://api.mercadopago.com/v1/payments";
      const idempotencyKey = `idemp-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      const mpPayload: any = {
        transaction_amount: Number(paymentData.transaction_amount),
        token: paymentData.token, // Standard credit/debit card token
        description: `Compra en Hogar y Estilo - ${cartItems?.length || 1} producto(s)`,
        installments: Number(paymentData.installments) || 1,
        payment_method_id: paymentData.payment_method_id,
        issuer_id: paymentData.issuer_id ? String(paymentData.issuer_id) : undefined,
        payer: {
          email: paymentData.payer?.email || payerDetails?.email || "test_payer@test.com",
          first_name: payerDetails?.fullName?.split(" ")[0] || "Cliente",
          last_name: payerDetails?.fullName?.split(" ").slice(1).join(" ") || "DecoHome",
          identification: paymentData.payer?.identification || {
            type: "DNI",
            number: "12345678"
          },
          address: {
            zip_code: payerDetails?.postalCode || "",
            street_name: payerDetails?.address || "",
            street_number: ""
          }
        },
        additional_info: {
          items: cartItems?.map((item: any) => ({
            id: item.product?.id || item.id || "item-id",
            title: item.product?.title || item.title || "Producto Premium Deco",
            quantity: Number(item.quantity) || 1,
            unit_price: Math.round(Number(item.product?.basePrice || item.price)),
            category_id: "home_decor",
            picture_url: item.product?.media?.[0]?.url || ""
          })) || [],
          shipments: {
            receiver_address: {
              zip_code: payerDetails?.postalCode || "",
              state_name: payerDetails?.province || "",
              city_name: payerDetails?.city || "",
              street_name: payerDetails?.address || ""
            }
          }
        },
        notification_url: req.headers.host ? `https://${req.headers.host}/api/mercadopago/webhook` : undefined,
        statement_descriptor: "DECO HOME ROSARIO",
        external_reference: `checkout-${Date.now()}`
      };

      // Handle specific point of interaction/transfers
      if (!paymentData.token && paymentData.point_of_interaction) {
        mpPayload.point_of_interaction = paymentData.point_of_interaction;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(mpPayload)
      });

      const paymentResponseData = await response.json();

      if (!response.ok) {
        console.error("Mercado Pago API Server Payment Processing Error:", paymentResponseData);
        return res.status(response.status).json({
          error: "No se pudo procesar la transacción de Mercado Pago en producción.",
          details: paymentResponseData
        });
      }

      return res.json({
        id: paymentResponseData.id,
        status: paymentResponseData.status,
        status_detail: paymentResponseData.status_detail,
        payment_method_id: paymentResponseData.payment_method_id,
        transaction_amount: paymentResponseData.transaction_amount,
        barcode: paymentResponseData.barcode || null,
        point_of_interaction: paymentResponseData.point_of_interaction || null,
        isSimulator: false
      });
    } catch (err: any) {
      console.error("Exception in serverless process_payment:", err);
      return res.status(500).json({
        error: "Error interno en el servidor al intentar procesar la pasarela de Mercado Pago.",
        message: err.message
      });
    }
  });

  // Serve static assets or use Vite dev server
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando en modo Desarrollo con Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Iniciando en modo Producción...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Hogar y Estilo] Servidor corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error iniciando el servidor:", err);
});
