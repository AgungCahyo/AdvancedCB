// src/utils/firebase.js - Centralized Firebase Initialization
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration (extracted to avoid duplication)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Check if Firebase is configured
const FIREBASE_ENABLED = !!(
  process.env.FIREBASE_API_KEY && 
  process.env.FIREBASE_PROJECT_ID
);

let app = null;
let db = null;

if (FIREBASE_ENABLED) {
  try {
    // Reuse existing app if available, or initialize new one
    const existingApps = getApps();
    app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("🔥 Firebase initialized successfully");
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
  }
} else {
  console.log('📁 Firebase not configured');
}

// Export for use in other modules
export { app, db, FIREBASE_ENABLED };