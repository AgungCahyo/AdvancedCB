// src/handlers/messageHandler.js - FULLY FIREBASE-DRIVEN VERSION
import { getMessages, CONFIG } from "../config/index.js";
import { db, FIREBASE_ENABLED } from '../utils/firebase.js';
import { log } from "../utils/logger.js";
import { 
  logMessage, 
  logConsultation, 
  trackUser, 
  trackKeyword,
  trackButtonClick,
  isLoggingEnabled
} from "../services/firebaseLogger.js";
import { doc, getDoc } from 'firebase/firestore';

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
      if (db && this.loggingEnabled && FIREBASE_ENABLED) {
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

  /**
   * Replace placeholders in message
   */
  replacePlaceholders(message, context = {}) {
    const messages = getMessages();
    let result = message;
    
    // Replace global placeholders
    result = result
      .replace(/\{\{ebook_link\}\}/g, messages.ebook_link)
      .replace(/\{\{bonus_link\}\}/g, messages.bonus_link)
      .replace(/\{\{konsultan_wa\}\}/g, messages.konsultan_wa);
    
    // Replace context-specific placeholders
    if (context.name) {
      result = result.replace(/\{name\}/g, context.name);
    }
    if (context.phone) {
      result = result.replace(/\{phone\}/g, context.phone);
    }
    if (context.message) {
      result = result.replace(/\{message\}/g, context.message);
    }
    if (context.timestamp) {
      result = result.replace(/\{timestamp\}/g, context.timestamp);
    }
    
    return result;
  }

  /**
   * Get button configuration from Firebase
   */
  getButtonConfig(keyword) {
    const messages = getMessages();
    const buttonText = messages.system_messages?.button_text || {};
    const buttonFooter = messages.system_messages?.button_footer || {};
    
   
    
    return configs[keyword] || null;
  }

  /**
   * Get list menu configuration from Firebase
   */
  getListMenuConfig() {
    const messages = getMessages();
    const listConfig = messages.system_messages?.list_menu;
    
    return listConfig;
  }

  async handleConsultation(from, textBody, messageId, reply, reaction, userName = "Unknown") {
    try {
      const messages = getMessages();
      
      await this.wa.sendTypingIndicator(from);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.wa.sendMessage(from, reply);

      // Get notification template from Firebase
      const notificationTemplate = messages.system_messages?.consultation_notification?.template;
      
      const adminNotification = this.replacePlaceholders(notificationTemplate, {
        name: userName,
        phone: from,
        message: textBody,
        timestamp: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      });
      
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
        const greetingWithName = `Halo ${userName}!`;
        personalizedReply = reply.replace("Halo Juragan!", greetingWithName);
      }
      
      // Strategy: Send buttons based on funnel stage
      if (keyword === "welcome") {
        const config = this.getButtonConfig("welcome");
        await this.wa.sendInteractiveButtons(
          from,
          personalizedReply,
          config.buttons,
          config.footer
        );
      } 
      else if (keyword === "help") {
        const listConfig = this.getListMenuConfig();
        await this.wa.sendInteractiveList(
          from,
          personalizedReply,
          listConfig.buttonText,
          listConfig.sections,
          listConfig.footer
        );
      }
      else if (["mulai", "tips", "bonus", "autopilot"].includes(keyword)) {
        await this.wa.sendMessage(from, personalizedReply);
        
        const config = this.getButtonConfig(keyword);
        if (config && config.followUp) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.wa.sendInteractiveButtons(
            from,
            config.followUp,
            config.buttons,
            config.footer
          );
        }
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
    const messages = getMessages();
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta'});
    const hour = new Date(now).getHours();
    const isWorkingHour = hour >= 8 && hour < 17; 
    
    if (!isWorkingHour) {
      const offlineConfig = messages.system_messages?.offline_hours;
      const shouldGreetWithName = offlineConfig?.greeting_with_name !== false;
      
      let offlineMsg = offlineConfig?.message ;
      
      // Replace {name} placeholder
      if (shouldGreetWithName && userName !== "Unknown") {
        offlineMsg = offlineMsg.replace("{name}", userName);
      } else {
        offlineMsg = offlineMsg.replace("{name}!", "!").replace("Halo !", "Halo!");
      }
      
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

    // Check rate limit
    if (this.rateLimiter.isLimited(from)) {
      log("WARN", `⏱️ Rate limit hit for: ${from}`);
      return;
    }

    // Check message type
    if (type !== "text" && type !== "interactive") {
      log("WARN", `❌ Unsupported message type: ${type}`);
      await this.wa.sendMessage(from, messages.errors.unsupported_type);
      return;
    }

    // ✅ Get keyword
    const { message: reply, reaction, keyword } = this.wa.getReply(textBody);
    log("INFO", `🎯 Keyword matched: ${keyword}`);

    // 🔥 TRACK USER WITH NAME
    if (this.loggingEnabled) {
      try {
        await trackUser(from, userName, keyword);
        log("INFO", `👤 User tracked: ${userName} (${from})`);
      } catch (logErr) {
        log("WARN", `⚠️ Failed to track user: ${logErr.message}`);
      }
    }

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