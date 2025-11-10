// src/utils/logger.js - Enhanced version with Firebase logging
import { db, FIREBASE_ENABLED } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Log levels with colors
const LOG_LEVELS = {
  INFO: { color: '\x1b[36m', priority: 0 },
  WARN: { color: '\x1b[33m', priority: 1 },
  ERROR: { color: '\x1b[31m', priority: 2 },
  SUCCESS: { color: '\x1b[32m', priority: 0 },
  DEBUG: { color: '\x1b[35m', priority: 0 }
};

const RESET_COLOR = '\x1b[0m';

// Log to Firebase (async, non-blocking)
async function logToFirebase(level, message, data, metadata) {
  if (!FIREBASE_ENABLED || !db) return;

  try {
    await addDoc(collection(db, 'system_logs'), {
      level,
      message,
      data: data ? JSON.stringify(data) : null,
      metadata: metadata || {},
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0],
      hour: new Date().getHours(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    // Silent fail - don't break app if logging fails
    console.error('Failed to log to Firebase:', error.message);
  }
}

// Main log function
export function log(level = "INFO", message, data = null, options = {}) {
  const timestamp = new Date().toISOString();
  const levelConfig = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  const coloredLevel = `${levelConfig.color}[${level}]${RESET_COLOR}`;
  const logMessage = `[${timestamp}] ${coloredLevel} ${message}`;
  
  // Console output
  if (level === "ERROR") {
    console.error(logMessage, data || "");
  } else if (level === "WARN") {
    console.warn(logMessage, data || "");
  } else {
    console.log(logMessage, data || "");
  }

  // Firebase logging (non-blocking)
  if (options.saveToDb !== false) {
    logToFirebase(level, message, data, options.metadata).catch(() => {
      // Silent catch
    });
  }
}

// Convenience methods
export const logger = {
  info: (message, data, options) => log('INFO', message, data, options),
  warn: (message, data, options) => log('WARN', message, data, options),
  error: (message, data, options) => log('ERROR', message, data, options),
  success: (message, data, options) => log('SUCCESS', message, data, options),
  debug: (message, data, options) => log('DEBUG', message, data, options),
};

export default log;