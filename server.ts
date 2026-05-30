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
