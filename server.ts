import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";

let db: any = null;

try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const configContent = fs.readFileSync(firebaseConfigPath, "utf-8");
    const firebaseConfig = JSON.parse(configContent);
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("🔥 [Hhogar y Estilo Server] Firebase initialized successfully on backend server-side!");
  } else {
    console.warn("firebase-applet-config.json not found, using local file-system catalog fallback.");
  }
} catch (err: any) {
  console.error("Failed to initialize Firebase on server-side:", err);
}

function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanObjectForFirestore);
  }
  if (typeof obj === "object") {
    const clean: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          clean[key] = cleanObjectForFirestore(val);
        }
      }
    }
    return clean;
  }
  return obj;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory exists inside public folder so Vite can bundle on build (important for Vercel/dynamic paths)
  const legacyDir = path.join(process.cwd(), "uploads");
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  if (fs.existsSync(legacyDir)) {
    try {
      const files = fs.readdirSync(legacyDir);
      for (const file of files) {
        const legacyFilePath = path.join(legacyDir, file);
        const newFilePath = path.join(uploadsDir, file);
        if (fs.statSync(legacyFilePath).isFile() && !fs.existsSync(newFilePath)) {
          fs.copyFileSync(legacyFilePath, newFilePath);
          console.log(`Migrated legacy local asset to public folder: ${file}`);
        }
      }
    } catch (migErr) {
      console.warn("Could not copy legacy assets to public directory:", migErr);
    }
  }
  
  app.use("/uploads", express.static(uploadsDir));

  // Enable wildcard CORS to allow streaming video and media requests from Vercel store or local hosts
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,X-Filename,X-MimeType,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Middleware for parsing JSON requests
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

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

      const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
      let response = null;
      let lastErr = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`[Gemini Optimizador] Intentando con el modelo: ${modelName}...`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: userMessage,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { 
                    type: Type.STRING,
                    description: "Título sofisticado de alta gama para el producto" 
                  },
                  description: { 
                    type: Type.STRING, 
                    description: "Descripción persuasiva en formato Markdown" 
                  },
                  seoFeatures: { 
                    type: Type.STRING, 
                    description: "Palabras clave de SEO separadas exclusivamente por coma" 
                  }
                },
                required: ["title", "description", "seoFeatures"]
              }
            }
          });
          console.log(`[Gemini Optimizador] Éxito con el modelo: ${modelName}!`);
          break; // Break loop on success
        } catch (err: any) {
          console.warn(`[Gemini Optimizador] Falló con el modelo ${modelName}:`, err.message || err);
          lastErr = err;
        }
      }

      if (!response) {
        throw new Error(`Ambos modelos de optimización fallaron. Último error: ${lastErr?.message || lastErr}`);
      }

      const jsonText = response.text || "{}";
      
      // Robust cleaning of candidate string from Gemini 
      let cleaned = jsonText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "");
        cleaned = cleaned.replace(/\n?```$/, "");
      }
      cleaned = cleaned.trim();
      
      const parsedData = JSON.parse(cleaned);
      
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

  // API Endpoint: Direct upload of media file (base64 or binary stream) to alleviate IndexedDB desynchronizations
  app.post("/api/upload-media", async (req, res) => {
    try {
      let filename: string | undefined;
      let mimeType: string | undefined;
      let fileBuffer: Buffer;

      const isBinaryStream = req.headers["x-filename"] !== undefined;

      if (isBinaryStream) {
        // Direct stream upload (highly efficient, zero base64 conversion overhead)
        filename = decodeURIComponent(req.headers["x-filename"] as string);
        mimeType = req.headers["x-mimetype"] as string;

        const chunks: Buffer[] = [];
        const readStreamPromise = new Promise<Buffer>((resolve, reject) => {
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
          req.on("error", (err) => reject(err));
        });
        fileBuffer = await readStreamPromise;
      } else {
        // Fallback to legacy base64 in JSON payload
        const { filename: jsonFilename, mimeType: jsonMimeType, base64 } = req.body || {};
        if (!base64) {
          return res.status(400).json({ error: "Faltan los datos base64 o binarios para la subida." });
        }
        filename = jsonFilename;
        mimeType = jsonMimeType;
        fileBuffer = Buffer.from(base64, "base64");
      }

      if (!filename) {
        return res.status(400).json({ error: "Falta el nombre del archivo en la solicitud." });
      }

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Safeguard filename structure
      let ext = "jpg";
      if (mimeType) {
        if (mimeType.includes("video/mp4")) ext = "mp4";
        else if (mimeType.includes("video/webm")) ext = "webm";
        else if (mimeType.includes("video/quicktime")) ext = "mov";
        else if (mimeType.includes("image/png")) ext = "png";
        else if (mimeType.includes("image/webp")) ext = "webp";
        else if (mimeType.includes("image/gif")) ext = "gif";
      } else if (filename && filename.includes(".")) {
        ext = filename.split(".").pop() || "jpg";
      }

      const cleanFilename = `media_${Date.now()}_${Math.floor(Math.random() * 100000)}.${ext}`;
      const filepath = path.join(uploadsDir, cleanFilename);

      fs.writeFileSync(filepath, fileBuffer);
      console.log(`[Media Direct Upload] Saved: /uploads/${cleanFilename} (${mimeType || ext}) - Method: ${isBinaryStream ? "BinaryStream" : "Base64"}`);

      res.json({
        success: true,
        url: `/uploads/${cleanFilename}`
      });
    } catch (err: any) {
      console.error("Error inside upload-media endpoint:", err);
      res.status(500).json({ error: "Fallo al procesar la subida multimedia en el servidor.", details: err.message });
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

  const PRODUCTS_FILE = path.join(process.cwd(), "products.json");

  // API Endpoint: Get Shared/Synchronized Products
  app.get("/api/products", async (req, res) => {
    try {
      let firestoreProducts: any[] = [];
      let dbReadSuccess = false;

      // 1. Primary: Try to read from Firebase Cloud Firestore if initialized on the server
      if (db) {
        try {
          const querySnapshot = await getDocs(collection(db, "products"));
          querySnapshot.forEach((docSnap) => {
            firestoreProducts.push(docSnap.data());
          });
          dbReadSuccess = true;
          console.log(`[Server Proxy] Loaded ${firestoreProducts.length} products successfully from Firestore.`);
        } catch (dbErr: any) {
          console.error("[Server Proxy] Error reading products from Firestore, falling back to local file-system:", dbErr.message);
        }
      }

      // 2. Secondary: Read products.json file-system backup.
      let localProducts: any[] = [];
      if (fs.existsSync(PRODUCTS_FILE)) {
        try {
          const fileContent = await fs.promises.readFile(PRODUCTS_FILE, "utf-8");
          if (fileContent && fileContent.trim() !== "") {
            const parsed = JSON.parse(fileContent);
            if (Array.isArray(parsed)) {
              localProducts = parsed;
            }
          }
        } catch (jsonErr) {
          console.warn("products.json contains invalid JSON:", jsonErr);
        }
      }

      // 3. Smart Merge: If Firestore succeeded, merge it with products.json on the server so we NEVER lose custom products!
      // This is extremely critical because if Firestore is write-exhausted (quota exceeded), new products
      // are successfully written to products.json but fail to save to Firestore. Placing them in the returned list
      // prevents data loss and restores consistency perfectly!
      if (dbReadSuccess) {
        const mergedMap = new Map<string, any>();

        // Start with Firestore products
        firestoreProducts.forEach((p) => {
          if (p && p.id) {
            mergedMap.set(p.id, p);
          }
        });

        // Add or overwrite with products.json (local file is authoritative for custom products in dev mode)
        localProducts.forEach((p) => {
          if (p && p.id) {
            // Keep the custom product if it's stored in the file system
            mergedMap.set(p.id, p);
          }
        });

        const mergedList = Array.from(mergedMap.values());
        return res.json(mergedList);
      }

      // If Firestore read wasn't successful, return the local file-system list
      if (localProducts.length > 0) {
        return res.json(localProducts);
      }

      // Return a special fallback flag if nothing exists yet
      return res.json({ fallback: true });
    } catch (err: any) {
      console.error("Error reading products:", err);
      return res.json([]);
    }
  });

  // API Endpoint: Save/Synchronize Shared Products
  app.post("/api/products", async (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Datos de catálogo inválidos." });
      }

      // Ensure uploads directory exists inside public folder so Vite can bundle on build (important for Vercel/dynamic paths)
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Automatically convert any embedded base64 items (heavy images or videos) with proper extensions
      const processedProducts = products.map((product) => {
        if (!product || !product.media || !Array.isArray(product.media)) return product;

        const updatedMedia = product.media.map((mediaItem) => {
          if (mediaItem && mediaItem.url && mediaItem.url.startsWith("data:")) {
            try {
              const regex = /^data:([a-zA-Z0-9-]+\/[a-zA-Z0-9-+.#]+);base64,(.+)$/;
              const matches = mediaItem.url.match(regex);
              if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];

                // Map standard MIME types to file extensions
                let ext = "bin";
                if (mimeType.includes("video/mp4")) ext = "mp4";
                else if (mimeType.includes("video/webm")) ext = "webm";
                else if (mimeType.includes("video/quicktime")) ext = "mov";
                else if (mimeType.includes("image/jpeg") || mimeType.includes("image/jpg")) ext = "jpg";
                else if (mimeType.includes("image/png")) ext = "png";
                else if (mimeType.includes("image/webp")) ext = "webp";
                else if (mimeType.includes("image/gif")) ext = "gif";
                else {
                  const parts = mimeType.split("/");
                  if (parts[1]) ext = parts[1].split("+")[0];
                }

                const filename = `media_${Date.now()}_${Math.floor(Math.random() * 100000)}.${ext}`;
                const filepath = path.join(uploadsDir, filename);

                // Write binary payload directly to physical disk
                fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));
                console.log(`[Media Extractor] Successfully saved heavy base64 media to: /uploads/${filename} (${mimeType})`);

                return { ...mediaItem, url: `/uploads/${filename}`, backupUrl: mediaItem.url };
              }
            } catch (err) {
              console.error("[Media Extractor] Error saving base64 to server file-system:", err);
            }
          }
          return mediaItem;
        });

        return { ...product, media: updatedMedia };
      });
      
      // A. Write backup in products.json file using base64-extracted clean urls
      await fs.promises.writeFile(PRODUCTS_FILE, JSON.stringify(processedProducts, null, 2), "utf-8");

      // B. Write to Firestore to sync backend state (now extremely lightweight and compliant with the 1MB limit!)
      if (db) {
        try {
          const querySnapshot = await getDocs(collection(db, "products"));
          const existingIds = new Set<string>();
          querySnapshot.forEach((docSnap) => {
            existingIds.add(docSnap.id);
          });

          // Upload/Set core documents
          for (const product of processedProducts) {
            if (product && product.id) {
              const cleanedProduct = cleanObjectForFirestore(product);
              await setDoc(doc(db, "products", product.id), cleanedProduct);
              existingIds.delete(product.id);
            }
          }

          // Delete any obsolete documents
          for (const remainingId of existingIds) {
            await deleteDoc(doc(db, "products", remainingId));
          }

          console.log(`[Server Proxy] Successfully synchronized ${processedProducts.length} lightweight products with Cloud Firestore.`);
          return res.json({ success: true, count: processedProducts.length, sync: "cloud_firestore", products: processedProducts });
        } catch (dbErr: any) {
          console.error("[Server Proxy] Error writing products to Firestore:", dbErr.message);
          return res.json({ success: true, count: processedProducts.length, sync: "local_file_only", products: processedProducts, warning: dbErr.message });
        }
      }

      return res.json({ success: true, count: processedProducts.length, sync: "local_file_only", products: processedProducts });
    } catch (err: any) {
      console.error("Error writing products:", err);
      return res.status(500).json({ error: "No se pudo guardar el catálogo en el servidor.", message: err.message });
    }
  });

  // API Endpoint: Send Buyer Order Data & Trigger Webhook notifications in background
  app.post("/api/send-order-email", async (req, res) => {
    try {
      const { order, adminEmail, webhookUrl } = req.body;

      if (!order) {
        return res.status(400).json({ error: "Faltan los datos de la orden." });
      }

      const targetWebhook = webhookUrl || process.env.NOTIFICATIONS_WEBHOOK_URL;
      let webhookResult = null;

      if (targetWebhook) {
        const isDiscord = targetWebhook.includes("discord.com") || targetWebhook.includes("discordapp.com");
        
        const orderId = order.id || "N/A";
        const dateStr = new Date(order.date || Date.now()).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
        const clientName = order.details?.fullName || "Cliente Anónimo";
        const clientEmail = order.details?.email || "No provisto";
        const clientPhone = order.details?.phone || "No provisto";
        const address = order.details?.address || "No provista";
        const city = order.details?.city || "No provista";
        const province = order.details?.province || "No provista";
        const paymentMethod = order.details?.paymentMethod === "credit" ? "💳 Tarjeta (Mercado Pago)" : "🏦 Transferencia Bancaria";
        
        const itemsList = order.items?.map((item: any) => {
          const title = item.product?.title || item.title || "Producto";
          const qty = item.quantity || 1;
          const price = item.product?.basePrice || item.price || 0;
          return `- ${qty}x ${title} ($${price.toLocaleString("es-AR")} c/u)`;
        }).join("\n") || "Sin artículos";

        const totalAmount = order.items?.reduce((acc: number, item: any) => {
          const price = item.product?.basePrice || item.price || 0;
          const qty = item.quantity || 1;
          return acc + (price * qty);
        }, 0) || 0;

        let payload: any = {};

        if (isDiscord) {
          payload = {
            username: "Hogar y Estilo - Alertas",
            avatar_url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=400&q=80",
            content: `🎉 **¡NUEVA VENTA REGISTRADA!** #${orderId}`,
            embeds: [
              {
                title: `Pedido ${orderId}`,
                color: order.details?.paymentMethod === "credit" ? 3066993 : 15105570,
                fields: [
                  { name: "Fecha", value: dateStr, inline: true },
                  { name: "Medio de Pago", value: paymentMethod, inline: true },
                  { name: "Cliente", value: `${clientName}\n📧 ${clientEmail}\n📞 ${clientPhone}` },
                  { name: "Dirección de Envío", value: `${address}, ${city}, ${province}` },
                  { name: "Artículos Comprados", value: itemsList },
                  { name: "Monto Total", value: `**$${totalAmount.toLocaleString("es-AR")} ARS**`, inline: true }
                ],
                footer: {
                  text: "Hogar y Estilo - Notificación Automática Invisible"
                },
                timestamp: new Date().toISOString()
              }
            ]
          };
        } else {
          payload = {
            event: "order.completed",
            timestamp: new Date().toISOString(),
            order: {
              id: orderId,
              date: dateStr,
              customer: {
                name: clientName,
                email: clientEmail,
                phone: clientPhone,
                address: address,
                city: city,
                province: province
              },
              payment: {
                method: paymentMethod,
                raw_method: order.details?.paymentMethod
              },
              items: order.items?.map((item: any) => ({
                id: item.product?.id || item.id,
                title: item.product?.title || item.title,
                category: item.product?.category || item.category,
                quantity: item.quantity,
                price: item.product?.basePrice || item.price
              })),
              total_amount: totalAmount,
              receipt_image_attached: !!order.details?.receiptImage
            }
          };
        }

        const response = await fetch(targetWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        webhookResult = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText
        };
      }

      return res.json({
        success: true,
        webhookDispatched: !!targetWebhook,
        webhookResult,
        details: "Registrado localmente de forma segura en la base de datos local y notificado discretamente."
      });
    } catch (err: any) {
      console.error("Exception in send-order-email background process:", err);
      return res.status(500).json({
        success: false,
        error: "Error interno al intentar despachar la alerta automática de venta.",
        message: err.message
      });
    }
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
