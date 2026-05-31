export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Se extrae la clave pública de tus variables de entorno en Vercel
  const publicKey = process.env.MP_PUBLIC_KEY || process.env.VITE_MP_PUBLIC_KEY || "APP_USR-7e14f52c-80fd-4fbc-ad89-d9cb79b6f849"; // Test default

  return res.status(200).json({
    publicKey,
    hasPrivateToken: !!process.env.MP_ACCESS_TOKEN
  });
}
