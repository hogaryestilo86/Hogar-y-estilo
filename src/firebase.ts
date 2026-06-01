import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase client-side using the credentials of the user's project
const app = initializeApp(firebaseConfig);

// Expose the Firestore database instance
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Helper to recursively remove undefined properties from an object so Firestore doesn't reject it
export function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanObjectForFirestore);
  }
  if (typeof obj === "object") {
    const clean: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          clean[key] = cleanObjectForFirestore(val);
        }
      }
    }
    return clean;
  }
  return obj;
}

console.log("🔥 [Hogar y Estilo Client Model] Firebase initialized directly in the client!");
