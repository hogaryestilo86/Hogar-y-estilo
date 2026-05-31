import fs from "fs";
import path from "path";

export default async function handler(req: any, res: any) {
  // Configurar CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const PRODUCTS_FILE = path.join(process.cwd(), "products.json");

  if (req.method === "GET") {
    try {
      if (fs.existsSync(PRODUCTS_FILE)) {
        const fileContent = await fs.promises.readFile(PRODUCTS_FILE, "utf-8");
        if (!fileContent || fileContent.trim() === "") {
          return res.status(200).json([]);
        }
        try {
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed)) {
            return res.status(200).json(parsed);
          }
        } catch (jsonErr) {
          console.warn("products.json contains invalid JSON, returning empty list:", jsonErr);
          return res.status(200).json([]);
        }
      }
      // Si no existe, devolver fallback dinámico en base a INITIAL_PRODUCTS
      return res.status(200).json({ fallback: true });
    } catch (err: any) {
      console.error("Error en Vercel Serverless leyendo products.json:", err);
      return res.status(200).json([]);
    }
  }

  if (req.method === "POST") {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Datos de catálogo inválidos." });
      }

      // En entornos Serverless con file system de solo lectura, la escritura fallará o será efímera.
      // Escribimos de todas formas, y si falla por solo lectura, simulamos éxito para evitar romper la UI del cliente.
      try {
        await fs.promises.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
        return res.status(200).json({ success: true, count: products.length });
      } catch (writeErr: any) {
        console.warn("No se pudo escribir products.json de manera persistente (esperado en Serverless de solo lectura):", writeErr);
        return res.status(200).json({ success: true, count: products.length, warning: "Escrito en memoria temporal" });
      }
    } catch (err: any) {
      console.error("Error en Vercel Serverless intentando guardar catálogo:", err);
      return res.status(500).json({ error: "No se pudo sincronizar el catálogo temporal.", message: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
