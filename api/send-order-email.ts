export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
        // Discord Rich Embed
        payload = {
          username: "Hogar y Estilo - Alertas",
          avatar_url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=400&q=80",
          content: `🎉 **¡NUEVA VENTA REGISTRADA!** #${orderId}`,
          embeds: [
            {
              title: `Pedido ${orderId}`,
              color: order.details?.paymentMethod === "credit" ? 3066993 : 15105570, // green for card, gold for bank transfer
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
        // Generic Webhook payload for Zapier, Make, custom endpoints
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

    return res.status(200).json({
      success: true,
      webhookDispatched: !!targetWebhook,
      webhookResult,
      details: "Notificación de venta procesada correctamente en segundo plano de manera invisible."
    });
  } catch (error: any) {
    console.error("Error processing sales notification background trigger:", error);
    return res.status(500).json({
      success: false,
      error: "Error interno al enviar la notificación.",
      details: error.message || error
    });
  }
}
