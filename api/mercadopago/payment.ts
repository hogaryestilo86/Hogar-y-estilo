export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
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
    const { paymentData, cartItems, shipping, payerDetails } = req.body;

    if (!paymentData) {
      return res.status(400).json({ error: "Falta el payload de pago ('paymentData')." });
    }

    const mpAccessToken = process.env.MP_ACCESS_TOKEN;

    // SIMULATED TESTING MODE
    if (!mpAccessToken) {
      console.warn("Mercado Pago serverless helper: MP_ACCESS_TOKEN is missing. Emulating successful transaction.");
      
      const paymentMethodId = paymentData.payment_method_id || "visa";
      const isBankTransfer = paymentMethodId.includes("transfer") || paymentMethodId.includes("debin") || paymentMethodId === "clabe" || paymentMethodId === "pse";
      
      return res.status(200).json({
        id: Math.floor(1000000000 + Math.random() * 9000000000),
        status: isBankTransfer ? "pending" : "approved",
        status_detail: isBankTransfer ? "pending_waiting_transfer" : "accredited",
        payment_method_id: paymentMethodId,
        transaction_amount: Number(paymentData.transaction_amount),
        isSimulator: true,
        message: "Operando en modo de simulación. Registrate y configura MP_ACCESS_TOKEN en Vercel para conectividad de producción."
      });
    }

    // Connect to Mercado Pago /v1/payments endpoint
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

    // For point-of-sale or specific bank transfers that don't use tokens
    if (!paymentData.token) {
      // Transfer payments (Red Link, DEBIN) in Argentina
      if (paymentData.point_of_interaction) {
        mpPayload.point_of_interaction = paymentData.point_of_interaction;
      }
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

    return res.status(200).json({
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
}
