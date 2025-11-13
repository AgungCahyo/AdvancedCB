// src/services/firebaseLogger.js - UPDATED TO USE ADMIN SDK
import { db, FIREBASE_ENABLED, serverTimestamp, increment } from '../utils/firebaseAdmin.js';

// ============================================================================
// LOGGING FUNCTIONS (Using Admin SDK - bypasses security rules)
// ============================================================================

/**
 * Log message to Firestore
 */
export async function logMessage(messageData) {
  if (!FIREBASE_ENABLED || !db) return null;

  try {
    const messageRef = await db.collection('messages').add({
      messageId: messageData.messageId,
      from: messageData.from,
      name: messageData.name || 'Unknown',
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
 * Log consultation request
 */
export async function logConsultation(consultationData) {
  if (!FIREBASE_ENABLED || !db) return null;

  try {
    const consultRef = await db.collection('consultations').add({
      from: consultationData.from,
      name: consultationData.name || 'Unknown',
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
 * Track user activity
 */
export async function trackUser(userId, profileName = null, keyword = null) {
  if (!FIREBASE_ENABLED || !db) return null;

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create new user
      await userRef.set({
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
      // Update existing user
      const updateData = {
        lastSeen: serverTimestamp(),
        messageCount: increment(1),
      };

      // Only update name if different (prevent unnecessary writes)
      if (profileName && userDoc.data().name !== profileName) {
        updateData.name = profileName;
      }

      if (keyword) {
        updateData.lastKeyword = keyword;
      }

      await userRef.update(updateData);
    }

    return userId;
  } catch (error) {
    console.error('❌ Failed to track user:', error.message);
    return null;
  }
}

/**
 * Track keyword usage
 */
export async function trackKeyword(keyword) {
  if (!FIREBASE_ENABLED || !db) return null;

  try {
    const today = new Date().toISOString().split('T')[0];
    const statRef = db.collection('keyword_stats').doc(`${keyword}_${today}`);
    const statDoc = await statRef.get();

    if (!statDoc.exists) {
      await statRef.set({
        keyword,
        date: today,
        count: 1,
        conversions: 0
      });
    } else {
      await statRef.update({
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
 * Track button clicks
 */
export async function trackButtonClick(buttonData) {
  if (!FIREBASE_ENABLED || !db) return null;

  try {
    await db.collection('button_clicks').add({
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
 * Update global stats
 */
async function updateStats(metric) {
  if (!FIREBASE_ENABLED || !db) return;

  try {
    const statsRef = db.collection('stats').doc('global');
    const statsDoc = await statsRef.get();

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

    if (!statsDoc.exists) {
      await statsRef.set({
        totalMessages: metric === 'messages' ? 1 : 0,
        totalUsers: metric === 'users' ? 1 : 0,
        consultationRequests: metric === 'consultations' ? 1 : 0,
        lastUpdated: serverTimestamp()
      });
    } else {
      await statsRef.update(updateData);
    }
  } catch (error) {
    console.error('❌ Failed to update stats:', error.message);
  }
}

/**
 * Track conversion funnel
 */
export async function trackConversion(from, fromKeyword, toKeyword) {
  if (!FIREBASE_ENABLED || !db) return null;

  try {
    await db.collection('conversions').add({
      from,
      fromKeyword,
      toKeyword,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    });

    if (toKeyword === 'konsultasi') {
      const today = new Date().toISOString().split('T')[0];
      const statRef = db.collection('keyword_stats').doc(`${fromKeyword}_${today}`);
      const statDoc = await statRef.get();
      
      if (statDoc.exists) {
        await statRef.update({
          conversions: increment(1)
        });
      } else {
        await statRef.set({
          keyword: fromKeyword,
          date: today,
          count: 0,
          conversions: 1
        });
      }
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
  if (!FIREBASE_ENABLED || !db) return [];

  try {
    const snapshot = await db.collection('messages')
      .where('from', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limitCount)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Failed to get user journey:', error.message);
    return [];
  }
}

/**
 * Log system errors
 */
export async function logError(errorData) {
  if (!FIREBASE_ENABLED || !db) return null;

  try {
    await db.collection('errors').add({
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

/**
 * Check if logging is enabled
 */
export function isLoggingEnabled() {
  return FIREBASE_ENABLED;
}

/**
 * Get logging status
 */
export function getLoggingStatus() {
  return {
    enabled: FIREBASE_ENABLED,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// BATCH LOGGING (Optional optimization)
// ============================================================================

let batchQueue = [];
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 5000;

export function queueLog(collectionName, data) {
  if (!FIREBASE_ENABLED || !db) return;

  batchQueue.push({ collectionName, data });

  if (batchQueue.length >= BATCH_SIZE) {
    flushBatchQueue();
  }
}

async function flushBatchQueue() {
  if (batchQueue.length === 0 || !db) return;

  const batch = [...batchQueue];
  batchQueue = [];

  try {
    const promises = batch.map(item => 
      db.collection(item.collectionName).add({
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

// Start batch processing if enabled
if (FIREBASE_ENABLED) {
  setInterval(flushBatchQueue, BATCH_INTERVAL);
}