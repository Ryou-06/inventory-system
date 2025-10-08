import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 👈 Add this line for Authentication

const firebaseConfig = {
  apiKey: "AIzaSyBQJBC_dx6mSDIca7EPzQwSmpQvjj9X83w",
  authDomain: "inventory-system-7430c.firebaseapp.com",
  projectId: "inventory-system-7430c",
  storageBucket: "inventory-system-7430c.firebasestorage.app",
  messagingSenderId: "1038771710911",
  appId: "1:1038771710911:web:f15efa917a70243dc64f0a",
};

// Initialize app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Export Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
