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

      const systemPrompt = `Eres un experto en redactar títulos de alta conversión, descripciones persuasivas y palabras clave de SEO para e-commerce de alta gama para la marca "Hogar y Estilo".
A partir del título rudimentario y de la descripción o palabras sueltas provistas por el usuario, debes generar 3 campos optimizados:
1. Un título de producto comercialmente atractivo, sofisticado y optimizado para SEO (ej: "Lámpara de Mesa de Madera Rústica Japandi" en lugar de "lampara de madera").
2. Una descripción persuasiva adaptada para Argentina/Latinoamérica (Español Neutro), utilizando formato Markdown con:
   - Un párrafo introductorio ultra elegante que evoque comodidad, orden o distinción.
   - Una sección titulada "**Detalles de Diseño**" con una lista de ventajas clave, materiales sofisticados y usabilidad.
   - Un llamado a la acción sutil y persuasivo sobre la renovación de sus ambientes cotidianos.
3. El SEO "todo" o tags clave: Una lista de 5 a 6 palabras clave o características destacadas de SEO, separadas exactamente por una coma (ej: "mármol travertino real, mesa auxiliar japandi, estilo rústico moderno, decoración de salas minimalistas, calidad artesanal premium").

Reglas críticas:
- No hables de dropshipping abiertamente, enfócate en productos exclusivos de Hogar & Estilo.
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

  // API Endpoint: Send Buyer Order Data via Email to Custom Registered Admin Email
  app.post("/api/send-order-email", async (req, res) => {
    try {
      const { adminEmail, orderDetails, cartItems } = req.body;

      if (!adminEmail) {
        return res.status(400).json({ error: "Falta el email del vendedor destinatario." });
      }

      if (!orderDetails || !cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Los datos de la orden o el carrito están vacíos." });
      }

      // Format clean HTML email content
      const itemsListHtml = cartItems
        .map(
          (item: any) => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: sans-serif; font-size: 14px; color: #333;">
              <strong>${item.product.title}</strong>
              <br/><span style="font-size: 11px; color: #666;">Colección: ${item.product.category}</span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-family: sans-serif; font-size: 14px; color: #333;">
              ${item.quantity}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-family: sans-serif; font-size: 14px; color: #333;">
              $${new Intl.NumberFormat("es-AR").format(item.product.basePrice)}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-family: sans-serif; font-size: 14px; color: #333; font-weight: bold;">
              $${new Intl.NumberFormat("es-AR").format(item.product.basePrice * item.quantity)}
            </td>
          </tr>
        `
        )
        .join("");

      const subtotal = cartItems.reduce(
        (acc: number, item: any) => acc + item.product.basePrice * item.quantity,
        0
      );
      const isFreeShipping = subtotal >= 50000;
      const shipping = isFreeShipping ? 0 : 5800;
      const total = subtotal + shipping;
      const transferDiscount = Math.round(subtotal * 0.15);
      const transferTotal = total - transferDiscount;

      const totalFormatted = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(total);
      const transferTotalFormatted = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(transferTotal);

      const htmlContent = `
        <div style="background-color: #f7f5f2; padding: 40px 20px; font-family: 'Georgia', serif; color: #2c2520; line-height: 1.6;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5dfd9; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="background-color: #1a1512; padding: 30px; text-align: center; color: #fdfdfd;">
              <h1 style="margin: 0; font-size: 24px; letter-spacing: 0.05em; font-weight: normal;">Hogar & Estilo</h1>
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #c2b5a2; font-family: sans-serif; margin-top: 5px;">Nueva Notificación de Venta</p>
            </div>
            
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="font-family: 'Georgia', serif; font-size: 18px; color: #1c1917; margin-top: 0; border-bottom: 2px solid #1a1512; padding-bottom: 10px;">
                ¡Excelente! Recibiste un nuevo pedido
              </h2>
              
              <div style="margin: 20px 0; font-family: sans-serif; font-size: 14px;">
                <p style="margin: 5px 0;"><strong>Comprador:</strong> ${orderDetails.fullName}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${orderDetails.email}</p>
                <p style="margin: 5px 0;"><strong>Teléfono:</strong> <a href="tel:${orderDetails.phone}">${orderDetails.phone}</a> | <a href="https://wa.me/${orderDetails.phone.replace(/[^0-9]/g, "")}">Enviar WhatsApp</a></p>
                <p style="margin: 5px 0;"><strong>Dirección de entrega:</strong> ${orderDetails.address}, ${orderDetails.city} (CP: ${orderDetails.zipCode || "N/A"})</p>
                <p style="margin: 5px 0;"><strong>Método de Pago:</strong> ${orderDetails.paymentMethod === "transfer" ? "Transferencia Bancaria (-15% OFF)" : `Tarjeta de Crédito (${orderDetails.installments} cuotas)`}</p>
              </div>

              <h3 style="font-family: sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #78716c; margin-top: 30px; margin-bottom: 10px;">Detalle del Carrito</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                <thead>
                  <tr style="background-color: #f7f5f2;">
                    <th style="padding: 10px; border-bottom: 2px solid #e5dfd9; text-align: left; font-family: sans-serif; font-size: 12px; color: #78716c;">Producto</th>
                    <th style="padding: 10px; border-bottom: 2px solid #e5dfd9; text-align: center; font-family: sans-serif; font-size: 12px; color: #78716c;">Cant</th>
                    <th style="padding: 10px; border-bottom: 2px solid #e5dfd9; text-align: right; font-family: sans-serif; font-size: 12px; color: #78716c;">Unitario</th>
                    <th style="padding: 10px; border-bottom: 2px solid #e5dfd9; text-align: right; font-family: sans-serif; font-size: 12px; color: #78716c;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsListHtml}
                </tbody>
              </table>

              <div style="font-family: sans-serif; font-size: 14px; float: right; width: 240px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #666;">Subtotal:</span>
                  <span>$${new Intl.NumberFormat("es-AR").format(subtotal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                  <span style="color: #666;">Costo de Envío:</span>
                  <span>${shipping === 0 ? "Gratuito" : `$${new Intl.NumberFormat("es-AR").format(shipping)}`}</span>
                </div>
                ${
                  orderDetails.paymentMethod === "transfer"
                    ? `
                  <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #166534; font-weight: bold;">
                    <span>Descuento Transferencia:</span>
                    <span>-$${new Intl.NumberFormat("es-AR").format(transferDiscount)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 10px 0; margin-top: 5px; border-top: 2px solid #1a1512; font-size: 16px; font-weight: bold; color: #166534;">
                    <span>Total a Transferir:</span>
                    <span>${transferTotalFormatted}</span>
                  </div>
                `
                    : `
                  <div style="display: flex; justify-content: space-between; padding: 10px 0; margin-top: 5px; border-top: 2px solid #1a1512; font-size: 16px; font-weight: bold; color: #1a1512;">
                    <span>Monto Total:</span>
                    <span>${totalFormatted}</span>
                  </div>
                `
                }
              </div>
              <div style="clear: both;"></div>

              <div style="background-color: #f7f5f2; border-radius: 8px; padding: 15px; text-align: center; margin-top: 25px; font-family: sans-serif; font-size: 12px; color: #78716c;">
                Venta registrada para coordinar envío al email: <strong>${orderDetails.email}</strong> o WhatsApp: <strong>${orderDetails.phone}</strong>.
              </div>
            </div>
            
            <div style="background-color: #f5f5f4; border-top: 1px solid #e5dfd9; font-family: sans-serif; font-size: 11px; text-align: center; color: #a8a29e; padding: 15px;">
              Notificaciones automáticas de Hogar & Estilo. Rosario, Santa Fe.
            </div>
          </div>
        </div>
      `;

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser || "no-reply@hogaryestilo.com";

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort || "465"),
          secure: parseInt(smtpPort || "465") === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"Hogar & Estilo Tienda" <${smtpFrom}>`,
          to: adminEmail,
          subject: `🔔 Nueva venta de: ${orderDetails.fullName} [Hogar & Estilo]`,
          html: htmlContent,
        });

        console.log("Real SMTP Notification sent!", info.messageId);
        return res.json({ success: true, method: "SMTP", messageId: info.messageId });
      } else {
        console.log("------------------------");
        console.log(`[SIMULATION] Email notification to seller (${adminEmail}):`);
        console.log(`Buyer: ${orderDetails.fullName} (${orderDetails.email})`);
        console.log(`Total order amount: $${total}`);
        console.log("------------------------");
        return res.json({
          success: true,
          method: "Simulation",
          details: "Se simuló correctamente el despacho de email corporativo al vendedor. Para despachos de e-mails reales, activa y parametriza el panel de Secrets del servidor.",
        });
      }
    } catch (err: any) {
      console.error("Error sending order email notification:", err);
      res.status(500).json({
        error: "Ocurrió un error al procesar la notificación de compra del comprador por email.",
        details: err.message || err,
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
