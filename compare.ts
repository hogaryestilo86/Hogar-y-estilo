import fs from "fs";

try {
  const p1 = JSON.parse(fs.readFileSync("./products.json", "utf-8"));
  console.log("products.json count:", p1.length);
  console.log("products.json sample titles:", p1.slice(0, 3).map((item: any) => `${item.id}: ${item.title || item.name} (${item.category})`));
} catch (e) {
  console.error(e);
}

try {
  const p2 = JSON.parse(fs.readFileSync("./db_products_backup.json", "utf-8"));
  console.log("db_products_backup.json count:", p2.length);
  console.log("db_products_backup.json sample titles:", p2.slice(0, 3).map((item: any) => `${item.id}: ${item.title || item.name || item.features?.[0]} (${item.category})`));
} catch (e) {
  console.error(e);
}
