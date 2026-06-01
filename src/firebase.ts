import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase client-side using the credentials of the user's project
const app = initializeApp(firebaseConfig);

// Expose the Firestore database instance
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log("🔥 [Hogar y Estilo Client Model] Firebase initialized directly in the client!");
