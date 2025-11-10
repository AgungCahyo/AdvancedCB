import { getMessages, CONFIG } from "../config/index.js";
import { log } from "../utils/logger.js";
import { 
  logMessage, 
  logConsultation, 
  trackUser, 
  trackKeyword,
  trackButtonClick,
  trackConversion,
  isLoggingEnabled
} from "../services/firebaseLogger.js";
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// Initialize Firebase for name lookup (reuse existing config)
let db = null;
const FIREBASE_ENABLED = !!(process.env.FIREBASE_API_KEY && process.env.FIREBASE_PROJECT_ID);

if (FIREBASE_ENABLED) {
  try {
    const existingApps = getApps();
    let app;
    
    // Reuse existing app or create new one
    if (existingApps.length > 0) {
      app = existingApps.find(a => a.name === 'logger') || existingApps[0];
    } else {
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
      };
      app = initializeApp(firebaseConfig, 'messagehandler');
    }
    
    db = getFirestore(app);
  } catch (error) {
    console.warn('⚠️ Firebase init for name lookup failed:', error.message);
  }
}

export class MessageHandler {
  constructor(whatsappService, cache, rateLimiter) {
    this.wa = whatsappService;
    this.cache = cache;
    this.rateLimiter = rateLimiter;
    this.loggingEnabled = isLoggingEnabled();
    
    if (this.loggingEnabled) {
      log("INFO", "📊 Firebase analytics logging enabled");
    } else {
      log("INFO", "📁 Firebase analytics logging disabled (config not found)");
    }
  }

  /**
   * Extract user name from webhook with fallbacks
   */
  async getUserName(from, webhookData) {
    let userName = "Unknown";
    
    try {
      // Priority 1: From webhook value.contacts (most reliable)
      if (webhookData?.contacts?.[0]?.profile?.name) {
        userName = webhookData.contacts[0].profile.name;
        log("INFO", `👤 Name from webhook: ${userName}`);
        return userName;
      }
      
      // Priority 2: Get from Firestore cache
      if (db && this.loggingEnabled) {
        const userRef = doc(db, 'users', from);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().name) {
          userName = userSnap.data().name;
          log("INFO", `👤 Name from cache: ${userName}`);
          return userName;
        }
      }
    } catch (err) {
      log("WARN", `⚠️ Failed to extract name: ${err.message}`);
    }
    
    return userName;
  }

  async handleConsultation(from, textBody, messageId, reply, reaction, userName = "Unknown") {
    try {
      await this.wa.sendTypingIndicator(from);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.wa.sendMessage(from, reply);

      const adminNotification = `🔔 *PERMINTAAN KONSULTASI*\n\n` +
        `👤 Nama: ${userName}\n` +
        `📱 Nomor: ${from}\n` +
        `💬 Pesan: "${textBody}"\n` +
        `⏰ Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n\n` +
        `Segera follow up untuk closing! 💰`;
      
      await this.wa.sendMessage(CONFIG.adminNumber, adminNotification);
      await this.wa.sendReaction(from, messageId, reaction);
      
      // 🔥 LOG CONSULTATION TO FIREBASE
      if (this.loggingEnabled) {
        try {
          await logConsultation({
            from,
            name: userName,
            message: textBody,
            status: 'pending',
            notified: true
          });
          log("INFO", `📞 Consultation logged for ${userName} (${from})`);
        } catch (logErr) {
          log("WARN", `⚠️ Failed to log consultation: ${logErr.message}`);
        }
      }
      
      log("INFO", `✅ Consultation processed for ${userName} (${from})`);
    } catch (err) {
      log("ERROR", "❌ Error processing consultation:", err.message);
      const messages = getMessages();
      await this.wa.sendMessage(from, messages.errors.general_error);
      throw err;
    }
  }

  async handleRegularMessage(from, messageId, reply, reaction, keyword, userName = "Unknown") {
    try {
      await this.wa.sendReaction(from, messageId, reaction);
      await this.wa.sendTypingIndicator(from);
      
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      log("INFO", `💬 Sending reply for keyword: ${keyword} to ${userName}`);
      
      // Personalize welcome message
      let personalizedReply = reply;
      if (keyword === "welcome" && userName !== "Unknown") {
        personalizedReply = reply.replace("Halo Juragan!", `Halo ${userName}!`);
      }
      
      // Strategy: Send buttons based on funnel stage
      if (keyword === "welcome") {
        await this.wa.sendInteractiveButtons(
          from,
          personalizedReply,
          [
            { id: "mulai", title: "🚀 Download Ebook" },
            { id: "tips", title: "💡 Strategi BEP" },
            { id: "konsultasi", title: "📞 Chat Konsultan" }
          ],
          "Pilih untuk mulai perjalanan Anda 👇"
        );
      } 
      else if (keyword === "help") {
        await this.wa.sendInteractiveList(
          from,
          personalizedReply,
          "Menu",
          [
            {
              title: "🎯 Aksi Cepat",
              rows: [
                { id: "mulai", title: "🚀 Download Ebook", description: "Panduan lengkap + voucher diskon" },
                { id: "konsultasi", title: "📞 Chat Konsultan", description: "Simulasi ROI & rekomendasi paket" }
              ]
            },
            {
              title: "📚 Pembelajaran",
              rows: [
                { id: "tips", title: "💡 Strategi BEP <30 Hari", description: "5 strategi terbukti & real result" },
                { id: "bonus", title: "🎁 Bonus Template", description: "Tools senilai 1.2 juta gratis" }
              ]
            },
            {
              title: "🚀 Upgrade Level",
              rows: [
                { id: "autopilot", title: "⚡ Sistem Autopilot", description: "Passive income 24/7 hands-free" }
              ]
            }
          ],
          "Jalan Pintas Juragan Photobox"
        );
      }
      else if (keyword === "mulai") {
        await this.wa.sendMessage(from, personalizedReply);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.wa.sendInteractiveButtons(
          from,
          "Sudah download? Lanjut ke mana? 👇",
          [
            { id: "tips", title: "💡 Tips BEP" },
            { id: "bonus", title: "🎁 Bonus Tools" },
            { id: "autopilot", title: "🚀 Sistem Auto" }
          ],
          "Rekomendasi: TIPS → BONUS → AUTOPILOT"
        );
      }
      else if (keyword === "tips") {
        await this.wa.sendMessage(from, personalizedReply);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.wa.sendInteractiveButtons(
          from,
          "Mau action sekarang? 🔥",
          [
            { id: "bonus", title: "🎁 Ambil Bonus" },
            { id: "autopilot", title: "🚀 Sistem Auto" },
            { id: "konsultasi", title: "📞 Konsultasi" }
          ],
          "87% yang follow flow ini closing!"
        );
      }
      else if (keyword === "bonus") {
        await this.wa.sendMessage(from, personalizedReply);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.wa.sendInteractiveButtons(
          from,
          "Next level: Passive income autopilot! 💰",
          [
            { id: "autopilot", title: "⚡ Info Autopilot" },
            { id: "konsultasi", title: "📞 Chat Sekarang" }
          ],
          "Voucher terbatas 12 slot tersisa!"
        );
      }
      else if (keyword === "autopilot") {
        await this.wa.sendMessage(from, personalizedReply);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.wa.sendInteractiveButtons(
          from,
          "Siap untuk ROI 4-6 bulan? 🎯",
          [
            { id: "konsultasi", title: "📞 Ya, Chat Konsultan" }
          ],
          "Kode: EBOOKKLIK2025 | 12 slot tersisa"
        );
      }
      else {
        await this.wa.sendMessage(from, personalizedReply);
      }
      
      await this.wa.markAsRead(messageId);

      log("INFO", `✅ Message flow completed for ${userName} (${from})`);
    } catch (err) {
      log("ERROR", "❌ Error in message flow:", err.message);
      try {
        const messages = getMessages();
        await this.wa.sendMessage(from, messages.errors.general_error);
      } catch (recoveryErr) {
        log("ERROR", "❌ Failed to send error message:", recoveryErr.message);
      }
    }
  }

  async processMessage(message, webhookData = null) {
    const messageId = message.id;
    const from = message.from;
    const type = message.type;
    
    // ✅ Extract user name with priority fallback
    const userName = await this.getUserName(from, webhookData);

    // ✅ Check working hours
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/JAkarta'});
    const hour = new Date(now).getHours();
    const isWorkingHour = hour >= 8 && hour < 17; // 08:00 - 17:00
    
    if (!isWorkingHour) {
      const greeting = userName !== "Unknown" ? `Halo ${userName}! ⚠️` : "Halo! ⚠️";
      const offlineMsg = `${greeting}\n\nSaat ini di luar jam kerja (08:00–17:00 WIB).\nPesan Anda akan dibalas pada hari kerja berikutnya.\n\nTerima kasih! 🙏`;
      await this.wa.sendMessage(from, offlineMsg);
      log("INFO", `🕒 Auto-reply sent to ${userName} (${from}) - outside working hours`);
      return;
    }
    
    // Handle button/interactive response
    let textBody = "";
    let isButtonClick = false;
    
    if (type === "text") {
      textBody = message.text?.body || "";
    } else if (type === "interactive") {
      const interactive = message.interactive;
      isButtonClick = true;
      
      if (interactive.type === "button_reply") {
        textBody = interactive.button_reply.id;
        log("INFO", `🔘 Button clicked: ${textBody}`);
      } else if (interactive.type === "list_reply") {
        textBody = interactive.list_reply.id;
        log("INFO", `📋 List selected: ${textBody}`);
      }
    }

    // Check cache
    if (this.cache.has(messageId)) {
      log("WARN", `⏭️ Duplicate message ignored: ${messageId}`);
      return;
    }
    
    this.cache.add(messageId);

    log("INFO", "📨 Message received", {
      from,
      name: userName,
      type,
      body: textBody.substring(0, 50) + (textBody.length > 50 ? "..." : ""),
      id: messageId
    });

    // 🔥 TRACK USER WITH NAME
    if (this.loggingEnabled) {
      try {
        await trackUser(from, userName);
        log("INFO", `👤 User tracked: ${userName} (${from})`);
      } catch (logErr) {
        log("WARN", `⚠️ Failed to track user: ${logErr.message}`);
      }
    }

    // Check rate limit
    if (this.rateLimiter.isLimited(from)) {
      log("WARN", `⏱️ Rate limit hit for: ${from}`);
      return;
    }

    // Check message type
    if (type !== "text" && type !== "interactive") {
      log("WARN", `❌ Unsupported message type: ${type}`);
      const messages = getMessages();
      await this.wa.sendMessage(from, messages.errors.unsupported_type);
      return;
    }

    // Get reply
    const { message: reply, reaction, keyword } = this.wa.getReply(textBody);
    log("INFO", `🎯 Keyword matched: ${keyword}`);

    // 🔥 LOG MESSAGE TO FIREBASE
    if (this.loggingEnabled) {
      try {
        await logMessage({
          messageId,
          from,
          name: userName,
          type,
          textBody,
          keyword,
          status: 'success'
        });
        log("INFO", `📝 Message logged: ${messageId.substring(0, 20)}...`);

        await trackKeyword(keyword);
        log("INFO", `🎯 Keyword tracked: ${keyword}`);

        if (isButtonClick) {
          await trackButtonClick({
            from,
            buttonId: textBody,
            buttonTitle: textBody,
            context: null
          });
          log("INFO", `🔘 Button click tracked: ${textBody}`);
        }
      } catch (logErr) {
        log("WARN", `⚠️ Failed to log to Firebase: ${logErr.message}`);
      }
    }

    // Handle consultation
    if (keyword === "konsultasi") {
      await this.handleConsultation(from, textBody, messageId, reply, reaction, userName);
      return;
    }

    // Handle regular message
    await this.handleRegularMessage(from, messageId, reply, reaction, keyword, userName);
  }
}