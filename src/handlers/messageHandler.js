import { getMessages, CONFIG } from "../config/index.js";
import { log } from "../utils/logger.js";
import { db } from "../services/firebaseLogger.js"; // Add this import
import { doc, getDoc } from 'firebase/firestore';
import { 
  logMessage, 
  logConsultation, 
  trackUser, 
  trackKeyword,
  trackButtonClick,
  trackConversion,
  isLoggingEnabled
} from "../services/firebaseLogger.js";

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

  async handleConsultation(from, textBody, messageId, reply, reaction) {
    try {
      await this.wa.sendTypingIndicator(from);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.wa.sendMessage(from, reply);

      const adminNotification = `🔔 *PERMINTAAN KONSULTASI*\n\n` +
        `👤 Nomor: ${from}\n` +
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
            message: textBody,
            status: 'pending',
            notified: true
          });
          log("INFO", `📞 Consultation logged to Firebase for ${from}`);
        } catch (logErr) {
          log("WARN", `⚠️ Failed to log consultation: ${logErr.message}`);
        }
      }
      
      log("INFO", `✅ Permintaan konsultasi diproses untuk ${from}`);
    } catch (err) {
      log("ERROR", "❌ Error saat memproses konsultasi:", err.message);
      const messages = getMessages();
      await this.wa.sendMessage(from, messages.errors.general_error);
      throw err;
    }
  }

  async handleRegularMessage(from, messageId, reply, reaction, keyword) {
    try {
      await this.wa.sendReaction(from, messageId, reaction);
      await this.wa.sendTypingIndicator(from);
      
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      log("INFO", `💬 Mengirim balasan untuk kata kunci: ${keyword}`);
      
      // Strategy: Kirim button sesuai funnel stage untuk max conversion
      
      if (keyword === "welcome") {
        // Welcome: Quick action buttons
        await this.wa.sendInteractiveButtons(
          from,
          reply,
          [
            { id: "mulai", title: "🚀 Download Ebook" },
            { id: "tips", title: "💡 Strategi BEP" },
            { id: "konsultasi", title: "📞 Chat Konsultan" }
          ],
          "Pilih untuk mulai perjalanan Anda 👇"
        );
      } 
      else if (keyword === "help") {
        // Help: Show all menu with list
        await this.wa.sendInteractiveList(
          from,
          reply,
          "Menu",
          [
            {
              title: "🎯 Aksi Cepat",
              rows: [
                { 
                  id: "mulai", 
                  title: "🚀 Download Ebook", 
                  description: "Panduan lengkap + voucher diskon" 
                },
                { 
                  id: "konsultasi", 
                  title: "📞 Chat Konsultan", 
                  description: "Simulasi ROI & rekomendasi paket" 
                }
              ]
            },
            {
              title: "📚 Pembelajaran",
              rows: [
                { 
                  id: "tips", 
                  title: "💡 Strategi BEP <30 Hari", 
                  description: "5 strategi terbukti & real result" 
                },
                { 
                  id: "bonus", 
                  title: "🎁 Bonus Template", 
                  description: "Tools senilai 1.2 juta gratis" 
                }
              ]
            },
            {
              title: "🚀 Upgrade Level",
              rows: [
                { 
                  id: "autopilot", 
                  title: "⚡ Sistem Autopilot", 
                  description: "Passive income 24/7 hands-free" 
                }
              ]
            }
          ],
          "Jalan Pintas Juragan Photobox"
        );
      }
      else if (keyword === "mulai") {
        // Setelah download: Guide ke next step
        await this.wa.sendMessage(from, reply);
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
        // Setelah tips: Push ke bonus atau autopilot
        await this.wa.sendMessage(from, reply);
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
        // Setelah bonus: Strong push ke autopilot/konsultasi
        await this.wa.sendMessage(from, reply);
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
        // Setelah autopilot: Direct CTA konsultasi
        await this.wa.sendMessage(from, reply);
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
        // Default: Kirim text aja untuk keyword lain
        await this.wa.sendMessage(from, reply);
      }
      
      await this.wa.markAsRead(messageId);

      log("INFO", `✅ Alur pesan selesai untuk ${from}`);
    } catch (err) {
      log("ERROR", "❌ Error dalam alur pesan:", err.message);
      try {
        const messages = getMessages();
        await this.wa.sendMessage(from, messages.errors.general_error);
      } catch (recoveryErr) {
        log("ERROR", "❌ Gagal mengirim pesan error ke pengguna:", recoveryErr.message);
      }
    }
  }

  async processMessage(message, webhookData = null) {
    const messageId = message.id;
    const from = message.from;
    const type = message.type;
    
    // ✅ CORRECT: Extract name with proper priority
    let userName = "Unknown";
    
    try {
      // Priority 1: From webhook value.contacts (most reliable)
      if (webhookData?.contacts?.[0]?.profile?.name) {
        userName = webhookData.contacts[0].profile.name;
        log("INFO", `👤 Name from webhook contacts: ${userName}`);
      }
      // Priority 2: From message.contacts (alternative)
      else if (message.contacts?.[0]?.profile?.name) {
        userName = message.contacts[0].profile.name;
        log("INFO", `👤 Name from message contacts: ${userName}`);
      }
      // Priority 3: Get from Firestore cache
      else if (this.loggingEnabled) {
        const userRef = doc(db, 'users', from);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().name) {
          userName = userSnap.data().name;
          log("INFO", `👤 Name from cache: ${userName}`);
        }
      }
    } catch (err) {
      log("WARN", `⚠️ Failed to extract name: ${err.message}`);
    }

    // Check working hours
    const now = new Date();
    const hour = now.getHours();
    const isWorkingHour = hour >= 8 && hour < 17; // 08:00 - 17:00
    
    if (!isWorkingHour) {
      const offlineMsg = `Halo ${userName !== "Unknown" ? userName : ""}! ⚠️\n\nSaat ini di luar jam kerja (08:00–17:00 WIB).\nPesan Anda akan dibalas pada hari kerja berikutnya.\n\nTerima kasih! 🙏`;
      await this.wa.sendMessage(from, offlineMsg);
      log("INFO", `🕒 Auto-reply sent to ${from} (${userName}) - outside working hours`);
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
      log("WARN", `⏭️ Pesan duplikat diabaikan: ${messageId}`);
      return;
    }
    
    this.cache.add(messageId);

    log("INFO", "📨 Pesan masuk", {
      from,
      name: userName,
      type,
      body: textBody.substring(0, 50) + (textBody.length > 50 ? "..." : ""),
      id: messageId
    });

    // 🔥 TRACK USER ACTIVITY WITH NAME
    if (this.loggingEnabled) {
      try {
        await trackUser(from, userName);
        log("INFO", `👤 User tracked: ${from} (${userName})`);
      } catch (logErr) {
        log("WARN", `⚠️ Failed to track user: ${logErr.message}`);
      }
    }

    // Check rate limit
    if (this.rateLimiter.isLimited(from)) {
      log("WARN", `⏱️ Rate limit kena untuk pengguna: ${from}`);
      return;
    }

    // Check message type
    if (type !== "text" && type !== "interactive") {
      log("WARN", `❌ Tipe pesan tidak didukung: ${type}`);
      const messages = getMessages();
      await this.wa.sendMessage(from, messages.errors.unsupported_type);
      return;
    }

    // Get reply
    const { message: reply, reaction, keyword } = this.wa.getReply(textBody);
    log("INFO", `🎯 Kata kunci cocok: ${keyword}`);

    // 🔥 LOG MESSAGE TO FIREBASE
    if (this.loggingEnabled) {
      try {
        await logMessage({
          messageId,
          from,
          name: userName, // ✅ Include name in log
          type,
          textBody,
          keyword,
          status: 'success'
        });
        log("INFO", `📝 Message logged to Firebase: ${messageId.substring(0, 20)}...`);

        // Track keyword usage
        await trackKeyword(keyword);
        log("INFO", `🎯 Keyword tracked: ${keyword}`);

        // Track button click if button was clicked
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
      await this.handleConsultation(from, textBody, messageId, reply, reaction);
      return;
    }

    // Handle regular message
    await this.handleRegularMessage(from, messageId, reply, reaction, keyword);
  }
}