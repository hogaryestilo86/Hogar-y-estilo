export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("Falta el parámetro url.");
    }

    // Allow authorizer domains
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
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (err: any) {
    console.error("Error in serverless image-proxy:", err);
    return res.status(500).send("Error de servidor interno en el proxy de imágenes.");
  }
}
