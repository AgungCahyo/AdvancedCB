// 📄 src/services/firebaseLogger.js - FIXED VERSION

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment, 
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  orderBy
} from 'firebase/firestore';

let db = null;
let isInitialized = false;

const FIREBASE_LOGGING_ENABLED = !!(
  process.env.FIREBASE_API_KEY && 
  process.env.FIREBASE_PROJECT_ID
);

if (FIREBASE_LOGGING_ENABLED) {
  try {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

    const app = initializeApp(firebaseConfig, 'logger');
    db = getFirestore(app);
    isInitialized = true;
    
    console.log('✅ Firebase Analytics Logger initialized');
  } catch (error) {
    console.error('❌ Firebase Logger init failed:', error.message);
    console.log('⚠️  Chat logging will be disabled');
  }
} else {
  console.log('📊 Firebase logging not configured (optional)');
}

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

/**
 * ✅ FIX 1: Seragamkan field name menjadi 'name' (bukan userName)
 */
export async function logMessage(messageData) {
  if (!isInitialized) return null;

  try {
    const messageRef = await addDoc(collection(db, 'messages'), {
      messageId: messageData.messageId,
      from: messageData.from,
      name: messageData.name || 'Unknown', // ✅ FIXED: Konsisten dengan handler
      type: messageData.type,
      textBody: messageData.textBody,
      keyword: messageData.keyword,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0],
      hour: new Date().getHours(),
      status: messageData.status || 'success'
    });

    console.log(`📝 Message logged: ${messageRef.id}`);
    return messageRef.id;
  } catch (error) {
    console.error('❌ Failed to log message:', error.message);
    return null;
  }
}

/**
 * ✅ FIX 2: Tambahkan field 'name' di consultation
 */
export async function logConsultation(consultationData) {
  if (!isInitialized) return null;

  try {
    const consultRef = await addDoc(collection(db, 'consultations'), {
      from: consultationData.from,
      name: consultationData.name || 'Unknown', // ✅ FIXED: Tambah field name
      message: consultationData.message,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0],
      status: consultationData.status || 'pending',
      notified: consultationData.notified || false
    });

    console.log(`📞 Consultation logged: ${consultRef.id}`);
    await updateStats('consultations');
    
    return consultRef.id;
  } catch (error) {
    console.error('❌ Failed to log consultation:', error.message);
    return null;
  }
}

/**
 * ✅ FIX 3: Tambahkan error handling di trackUser
 */
export async function trackUser(userId, profileName = null, keyword = null) {
  if (!isInitialized) return null;

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        userId,
        name: profileName || 'Unknown',
        firstSeen: serverTimestamp(),
        lastSeen: serverTimestamp(),
        messageCount: 1,
        conversationCount: 1,
        lastKeyword: keyword || null,
        tags: [],
        status: 'active'
      });
      console.log(`👤 New user tracked: ${profileName} (${userId})`);
    } else {
      const updateData = {
        lastSeen: serverTimestamp(),
        messageCount: increment(1),
      };

      // ✅ IMPROVED: Hanya update name jika berbeda (prevent unnecessary writes)
      if (profileName && userSnap.data().name !== profileName) {
        updateData.name = profileName;
      }

      if (keyword) {
        updateData.lastKeyword = keyword;
      }

      await updateDoc(userRef, updateData);
    }

    return userId;
  } catch (error) {
    console.error('❌ Failed to track user:', error.message);
    return null;
  }
}

/**
 * Update keyword statistics
 */
export async function trackKeyword(keyword) {
  if (!isInitialized) return null;

  try {
    const today = new Date().toISOString().split('T')[0];
    const statRef = doc(db, 'keyword_stats', `${keyword}_${today}`);
    const statSnap = await getDoc(statRef);

    if (!statSnap.exists()) {
      await setDoc(statRef, {
        keyword,
        date: today,
        count: 1,
        conversions: 0
      });
    } else {
      await updateDoc(statRef, {
        count: increment(1)
      });
    }

    return keyword;
  } catch (error) {
    console.error('❌ Failed to track keyword:', error.message);
    return null;
  }
}

/**
 * Track button click
 */
export async function trackButtonClick(buttonData) {
  if (!isInitialized) return null;

  try {
    await addDoc(collection(db, 'button_clicks'), {
      from: buttonData.from,
      buttonId: buttonData.buttonId,
      buttonTitle: buttonData.buttonTitle,
      context: buttonData.context || null,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    });

    console.log(`🔘 Button click tracked: ${buttonData.buttonId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to track button click:', error.message);
    return false;
  }
}

/**
 * ✅ FIX 4: Tambahkan error handling di updateStats
 */
async function updateStats(metric) {
  if (!isInitialized) return;

  try {
    const statsRef = doc(db, 'stats', 'global');
    const statsSnap = await getDoc(statsRef);

    const updateData = {
      lastUpdated: serverTimestamp()
    };

    if (metric === 'messages') {
      updateData.totalMessages = increment(1);
    } else if (metric === 'users') {
      updateData.totalUsers = increment(1);
    } else if (metric === 'consultations') {
      updateData.consultationRequests = increment(1);
    }

    if (!statsSnap.exists()) {
      await setDoc(statsRef, {
        totalMessages: metric === 'messages' ? 1 : 0,
        totalUsers: metric === 'users' ? 1 : 0,
        consultationRequests: metric === 'consultations' ? 1 : 0,
        lastUpdated: serverTimestamp()
      });
    } else {
      await updateDoc(statsRef, updateData);
    }
  } catch (error) {
    console.error('❌ Failed to update stats:', error.message);
  }
}

/**
 * Track conversion
 */
export async function trackConversion(from, fromKeyword, toKeyword) {
  if (!isInitialized) return null;

  try {
    await addDoc(collection(db, 'conversions'), {
      from,
      fromKeyword,
      toKeyword,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    });

    if (toKeyword === 'konsultasi') {
      const today = new Date().toISOString().split('T')[0];
      const statRef = doc(db, 'keyword_stats', `${fromKeyword}_${today}`);
      
      await updateDoc(statRef, {
        conversions: increment(1)
      }).catch(() => {
        setDoc(statRef, {
          keyword: fromKeyword,
          date: today,
          count: 0,
          conversions: 1
        });
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to track conversion:', error.message);
    return false;
  }
}

/**
 * Get user journey
 */
export async function getUserJourney(userId, limitCount = 20) {
  if (!isInitialized) return [];

  try {
    const q = query(
      collection(db, 'messages'),
      where('from', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Failed to get user journey:', error.message);
    return [];
  }
}

export function isLoggingEnabled() {
  return isInitialized;
}

export function getLoggingStatus() {
  return {
    enabled: isInitialized,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// BATCH LOGGING
// ============================================================================

let batchQueue = [];
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 5000;

export function queueLog(collectionName, data) {
  if (!isInitialized) return;

  batchQueue.push({ collectionName, data });

  if (batchQueue.length >= BATCH_SIZE) {
    flushBatchQueue();
  }
}

async function flushBatchQueue() {
  if (batchQueue.length === 0) return;

  const batch = [...batchQueue];
  batchQueue = [];

  try {
    const promises = batch.map(item => 
      addDoc(collection(db, item.collectionName), {
        ...item.data,
        timestamp: serverTimestamp()
      })
    );

    await Promise.all(promises);
    console.log(`📦 Batch logged: ${batch.length} items`);
  } catch (error) {
    console.error('❌ Batch logging failed:', error.message);
    batchQueue.push(...batch);
  }
}

if (isInitialized) {
  setInterval(flushBatchQueue, BATCH_INTERVAL);
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

export async function logError(errorData) {
  if (!isInitialized) return null;

  try {
    await addDoc(collection(db, 'errors'), {
      type: errorData.type || 'unknown',
      message: errorData.message,
      stack: errorData.stack || null,
      context: errorData.context || {},
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    });

    return true;
  } catch (error) {
    console.error('❌ Failed to log error:', error.message);
    return false;
  }
}