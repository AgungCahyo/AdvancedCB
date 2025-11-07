import axios from "axios";
import { CONFIG, messagesData } from "../config/index.js";
import { log } from "../utils/logger.js";

export class WhatsAppService {
  constructor() {
    this.apiUrl = CONFIG.apiUrl;
    this.token = CONFIG.token;
  }

  replacePlaceholders(message) {
    return message
      .replace(/{{ebook_link}}/g, messagesData.ebook_link)
      .replace(/{{bonus_link}}/g, messagesData.bonus_link)
      .replace(/{{konsultan_wa}}/g, messagesData.konsultan_wa);
  }

  getReply(text) {
    const normalizedText = text.toLowerCase().trim();
    
    const keywordMap = [
      { keywords: ["konsultasi", "konsultan", "hubungi"], key: "konsultasi" },
      { keywords: ["autopilot", "franchise", "sistem"], key: "autopilot" },
      { keywords: ["bonus", "template", "download"], key: "bonus" },
      { keywords: ["tips", "strategi", "bep"], key: "tips" },
      { keywords: ["mulai", "start", "download ebook"], key: "mulai" },
      { keywords: ["help", "menu", "bantuan"], key: "help" },
    ];
    
    for (const { keywords, key } of keywordMap) {
      if (keywords.some(keyword => normalizedText.includes(keyword))) {
        const response = messagesData.funnel[key];
        if (response) {
          return {
            message: this.replacePlaceholders(response.message),
            reaction: response.reaction,
            keyword: key
          };
        }
      }
    }
    
    const welcome = messagesData.funnel.welcome;
    return {
      message: this.replacePlaceholders(welcome.message),
      reaction: welcome.reaction,
      keyword: "welcome"
    };
  }

  async sendMessage(to, body) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "text",
          text: { body: body },
        },
        {
          headers: { 
            "Authorization": `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          timeout: 10000,
        }
      );
      
      log("INFO", `✅ Pesan terkirim ke ${to}`);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      log("ERROR", `❌ Gagal mengirim pesan ke ${to}:`, errorMsg);
      
      if (err.response?.data) {
        log("ERROR", "Detail error API:", JSON.stringify(err.response.data, null, 2));
      }
      
      throw err;
    }
  }

  async markAsRead(messageId) {
    try {
      await axios.post(
        this.apiUrl,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        {
          headers: { 
            "Authorization": `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          timeout: 5000,
        }
      );
      
      log("INFO", `📖 Pesan ${messageId} ditandai sudah dibaca`);
    } catch (err) {
      log("WARN", `⚠️ Gagal menandai pesan sudah dibaca:`, err.response?.data?.error?.message || err.message);
    }
  }

  async sendReaction(to, messageId, emoji) {
    try {
      await axios.post(
        this.apiUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "reaction",
          reaction: { 
            message_id: messageId, 
            emoji: emoji 
          }
        },
        {
          headers: { 
            "Authorization": `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          timeout: 5000,
        }
      );
      
      log("INFO", `👍 Reaksi ${emoji} terkirim ke ${to}`);
    } catch (err) {
      log("WARN", `⚠️ Gagal mengirim reaksi:`, err.response?.data?.error?.message || err.message);
    }
  }

  async sendTypingIndicator(to) {
    try {
      await axios.post(
        this.apiUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "typing",
        },
        {
          headers: { 
            "Authorization": `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          timeout: 5000,
        }
      );
    } catch (err) {
      log("WARN", `⚠️ Gagal mengirim indikator mengetik`, err.message);
    }
  }
}