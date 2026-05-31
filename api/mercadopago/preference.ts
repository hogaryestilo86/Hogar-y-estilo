export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido. Utilizar POST." });
  }

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

    const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
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
      console.warn("Mercado Pago serverless helper: MP_ACCESS_TOKEN token was empty. Running demo/sandbox preview simulator mode.");
      return res.status(200).json({
        id: "pref-simulator-mode-99923485",
        init_point: "https://www.mercadopago.com.ar/",
        sandbox_init_point: "https://sandbox.mercadopago.com.ar/",
        isSimulator: true,
        message: "Por favor carga tus secretos de Vercel de manera correcta."
      });
    }

    // Call Mercado Pago REST API
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
      console.error("Vercel Serverless MercadoPago API Error:", errorData);
      return res.status(response.status).json({
        error: "Error del servidor de Mercado Pago al generar la preferencia de cobro.",
        details: errorData
      });
    }

    const data = await response.json();
    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      isSimulator: false
    });
  } catch (err: any) {
    console.error("Vercel Exception in MP preferences serverless call:", err);
    return res.status(500).json({
      error: "Error interno del servidor al procesar la pasarela de cobro.",
      message: err.message
    });
  }
}
