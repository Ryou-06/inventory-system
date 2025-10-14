// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage'; // ✅ Added for image uploads

const firebaseConfig = {
  apiKey: "AIzaSyBQJBC_dx6mSDIca7EPzQwSmpQvjj9X83w",
  authDomain: "inventory-system-7430c.firebaseapp.com",
  projectId: "inventory-system-7430c",
  storageBucket: "inventory-system-7430c.appspot.com", // ✅ Fixed extension to `.appspot.com`
  messagingSenderId: "1038771710911",
  appId: "1:1038771710911:web:f15efa917a70243dc64f0a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// ✅ Initialize and export Firebase Storage
export const storage = getStorage(app);

// Set auth persistence to LOCAL
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Auth persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('❌ Error setting auth persistence:', error);
  });
