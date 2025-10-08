// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBQJBC_dx6mSDIca7EPzQwSmpQvjj9X83w",
  authDomain: "inventory-system-7430c.firebaseapp.com",
  projectId: "inventory-system-7430c",
  storageBucket: "inventory-system-7430c.firebasestorage.app",
  messagingSenderId: "1038771710911",
  appId: "1:1038771710911:web:f15efa917a70243dc64f0a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth with persistence
export const auth = getAuth(app);

// Set auth persistence to LOCAL (persists across browser tabs and sessions)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Auth persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('❌ Error setting auth persistence:', error);
  });


