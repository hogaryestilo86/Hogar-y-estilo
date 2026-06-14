import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  console.log("Checking Firestore catalog_master...");
  try {
    const docSnap = await getDoc(doc(db, "settings", "catalog_master"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("Found catalog_master keys:", Object.keys(data));
      if (data.products) {
        console.log(`Contains 'products' array with ${data.products.length} items`);
        // Let's write the product data to a temporary file or check it
        fs.writeFileSync("db_products_backup.json", JSON.stringify(data.products, null, 2));
        console.log("Wrote products to db_products_backup.json");
      } else {
        console.log("No products array in catalog_master");
      }
    } else {
      console.log("catalog_master does not exist in settings collection");
    }
  } catch (e: any) {
    console.error("Error reading catalog_master:", e.message);
  }
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
