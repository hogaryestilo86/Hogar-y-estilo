import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  console.log("Checking Firestore records...");
  
  const snap1 = await getDoc(doc(db, "settings", "github_config"));
  if (snap1.exists()) {
    console.log("GITHUB_CONFIG:", JSON.stringify(snap1.data(), null, 2));
  } else {
    console.log("No github_config record in Firestore.");
  }

  const snap2 = await getDoc(doc(db, "settings", "mercadopago_config"));
  if (snap2.exists()) {
    console.log("MERCADOPAGO_CONFIG:", JSON.stringify(snap2.data(), null, 2));
  } else {
    console.log("No mercadopago_config record in Firestore.");
  }
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
