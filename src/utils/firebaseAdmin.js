// src/utils/firebaseAdmin.js - NEW FILE (Backend Admin SDK)
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;
let isInitialized = false;

// Check if Firebase Admin is configured
const FIREBASE_ADMIN_ENABLED = !!(
  process.env.FIREBASE_PROJECT_ID
);

if (FIREBASE_ADMIN_ENABLED) {
  try {
    let serviceAccount;

    // Option 1: Use service account JSON file (RECOMMENDED for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = join(__dirname, '../../', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
    }
    // Option 2: Use environment variables (for deployment platforms)
    else if (process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    }
    // Option 3: Use Application Default Credentials (for GCP)
    else {
      console.log('📁 Using Application Default Credentials');
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      db = admin.firestore();
      isInitialized = true;
      console.log('✅ Firebase Admin initialized with default credentials');
      return;
    }

    // Initialize with service account
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    db = admin.firestore();
    isInitialized = true;

    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log(`📊 Project: ${process.env.FIREBASE_PROJECT_ID}`);
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.log('⚠️  Bot will continue without Firebase logging');
  }
} else {
  console.log('📁 Firebase Admin not configured');
}

// Export Firestore instance
export { db, isInitialized as FIREBASE_ENABLED, admin };

// Helper: Get server timestamp
export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

// Helper: Increment field
export const increment = (value) => admin.firestore.FieldValue.increment(value);