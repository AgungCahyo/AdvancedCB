import { messagesData, CONFIG } from "../config/index.js";
import { log } from "../utils/logger.js";

export class MessageHandler {
  constructor(whatsappService, cache, rateLimiter) {
    this.wa = whatsappService;
    this.cache = cache;
    this.rateLimiter = rateLimiter;
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
      
      log("INFO", `✅ Permintaan konsultasi diproses untuk ${from}`);
    } catch (err) {
      log("ERROR", "❌ Error saat memproses konsultasi:", err.message);
      await this.wa.sendMessage(from, messagesData.errors.general_error);
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
      await this.wa.sendMessage(from, reply);
      await this.wa.markAsRead(messageId);

      log("INFO", `✅ Alur pesan selesai untuk ${from}`);
    } catch (err) {
      log("ERROR", "❌ Error dalam alur pesan:", err.message);
      try {
        await this.wa.sendMessage(from, messagesData.errors.general_error);
      } catch (recoveryErr) {
        log("ERROR", "❌ Gagal mengirim pesan error ke pengguna:", recoveryErr.message);
      }
    }
  }

  async processMessage(message) {
    const messageId = message.id;
    const from = message.from;
    const type = message.type;
    const textBody = message.text?.body || "";

    // Check cache
    if (this.cache.has(messageId)) {
      log("WARN", `⏭️ Pesan duplikat diabaikan: ${messageId}`);
      return;
    }
    
    this.cache.add(messageId);

    log("INFO", "📨 Pesan masuk", {
      from,
      type,
      body: textBody.substring(0, 50) + (textBody.length > 50 ? "..." : ""),
      id: messageId
    });

    // Check rate limit
    if (this.rateLimiter.isLimited(from)) {
      log("WARN", `⏱️ Rate limit kena untuk pengguna: ${from}`);
      return;
    }

    // Check message type
    if (type !== "text") {
      log("WARN", `❌ Tipe pesan tidak didukung: ${type}`);
      await this.wa.sendMessage(from, messagesData.errors.unsupported_type);
      return;
    }

    // Get reply
    const { message: reply, reaction, keyword } = this.wa.getReply(textBody);
    log("INFO", `🎯 Kata kunci cocok: ${keyword}`);

    // Handle consultation
    if (keyword === "konsultasi") {
      await this.handleConsultation(from, textBody, messageId, reply, reaction);
      return;
    }

    // Handle regular message
    await this.handleRegularMessage(from, messageId, reply, reaction, keyword);
  }
}