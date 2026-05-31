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
          error: "API key incorpórea. La API de Gemini no está configurada aún en este servidor."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const systemPrompt = `Eres un experto amigable en redactar publicaciones de e-commerce en Argentina para "Hogar y Estilo". Sos cercano, amigable y háblame con el voseo rioplatense (Vos).`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${systemPrompt}\n\nTítulo: ${title}. Desc: ${description}`,
      });

      res.json({ title: title, description: response.text || "", seoFeatures: "" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Endpoints para Mercado Pago Locales
  app.get("/api/mercadopago/config", (req, res) => {
    const publicKey = process.env.MP_PUBLIC_KEY || process.env.VITE_MP_PUBLIC_KEY || "APP_USR-7e14f52c-80fd-4fbc-ad89-d9cb79b6f849";
    return res.json({
      publicKey,
      hasPrivateToken: !!process.env.MP_ACCESS_TOKEN
    });
  });

  app.post("/api/mercadopago/payment", async (req, res) => {
    try {
      const { paymentData, cartItems, shipping, payerDetails } = req.body;
      const mpAccessToken = process.env.MP_ACCESS_TOKEN;

      if (!mpAccessToken) {
        return res.json({
          id: Math.floor(10000 + Math.random() * 90000),
          status: "approved",
          status_detail: "accredited",
          isSimulator: true
        });
      }

      // Conexión externa a Mercado Pago API
      const response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transaction_amount: Number(paymentData.transaction_amount),
          token: paymentData.token,
          description: "Compra local - Hogar y Estilo",
          payment_method_id: paymentData.payment_method_id,
          payer: { email: paymentData.payer?.email || "test_payer@test.com" }
        })
      });

      const paymentResult = await response.json();
      return res.json(paymentResult);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Serve static assets or use Vite dev server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0");
}

startServer().catch(console.error);
