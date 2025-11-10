// src/config/index.js - Configuration and Messages Data Management (Refactored)
import "dotenv/config";
import { db, FIREBASE_ENABLED } from '../utils/firebase.js'; // Import from centralized module
import { doc, onSnapshot } from 'firebase/firestore';
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// MESSAGES DATA MANAGEMENT
// ============================================================================

let messagesData = null;
let messagesLoaded = false;
let useFirebase = false;

if (FIREBASE_ENABLED && db) {
  console.log("🔥 Firebase config detected, initializing messages listener...");
  
  try {
    // Set up real-time listener
    const messagesRef = doc(db, 'bot_config', 'messages');
    
    onSnapshot(
      messagesRef,
      (docSnap) => {
        if (docSnap.exists()) {
          messagesData = docSnap.data();
          messagesLoaded = true;
          useFirebase = true;
          
          const timestamp = new Date().toISOString();
          console.log(`✅ [${timestamp}] Messages synced from Firebase`);
          
          // Log update details
          if (messagesData.last_updated) {
            const lastUpdate = messagesData.last_updated.toDate?.() || new Date(messagesData.last_updated);
            console.log(`📝 Last updated: ${lastUpdate.toLocaleString('id-ID')}`);
            console.log(`👤 Updated by: ${messagesData.updated_by || 'unknown'}`);
          }
        } else {
          console.warn('⚠️  Messages document not found in Firebase');
          loadFromLocalFile();
        }
      },
      (error) => {
        console.error('❌ Firebase sync error:', error.message);
        console.log('⚠️  Falling back to local messages.json');
        loadFromLocalFile();
      }
    );

    console.log('✅ Firebase listener initialized');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️  Falling back to local messages.json');
    loadFromLocalFile();
  }
} else {
  console.log('📁 Firebase not configured, using local messages.json');
  loadFromLocalFile();
}

// Load from local messages.json
function loadFromLocalFile() {
  try {
    const messagesPath = join(__dirname, "../../messages.json");
    messagesData = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
    messagesLoaded = true;
    useFirebase = false;
    console.log('✅ Messages loaded from local file');
  } catch (error) {
    console.error("❌ Failed to load messages.json:", error.message);
    console.error("❌ Bot cannot start without messages configuration");
    process.exit(1);
  }
}

// Export getter function with safety checks
export const getMessages = () => {
  if (!messagesLoaded) {
    throw new Error('Messages not loaded yet. Wait for initialization.');
  }
  return messagesData;
};

// Wait for messages to load (for async initialization)
export const waitForMessages = (maxWaitMs = 10000) => {
  return new Promise((resolve, reject) => {
    if (messagesLoaded) {
      resolve(messagesData);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (messagesLoaded) {
        clearInterval(checkInterval);
        resolve(messagesData);
      } else if (Date.now() - startTime > maxWaitMs) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for messages to load'));
      }
    }, 100);
  });
};

// Export status info
export const getMessagesStatus = () => ({
  loaded: messagesLoaded,
  source: useFirebase ? 'firebase' : 'local',
  timestamp: new Date().toISOString()
});

// Backward compatibility: export messagesData directly (deprecated, use getMessages() instead)
export { messagesData };

// ============================================================================
// ENVIRONMENT VARIABLES CONFIGURATION
// ============================================================================

export const CONFIG = {
  token: process.env.WA_TOKEN,
  phoneID: process.env.PHONE_ID,
  verifyToken: process.env.VERIFY_TOKEN,
  adminNumber: process.env.ADMIN_NUMBER,
  port: process.env.PORT || 3000,
  apiVersion: "v24.0",
  get apiUrl() {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneID}/messages`;
  },
};

// Validate required environment variables
const requiredEnvVars = ["WA_TOKEN", "PHONE_ID", "VERIFY_TOKEN", "ADMIN_NUMBER"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Environment variable wajib tidak ditemukan: ${missingVars.join(", ")}`);
  process.exit(1);
}

console.log('✅ Environment variables validated');