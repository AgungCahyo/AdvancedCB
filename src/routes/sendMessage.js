// src/routes/sendMessage.js
import express from "express";
import rateLimit from "express-rate-limit";
import { log } from "../utils/logger.js";
import { WhatsAppService } from "../services/whatsapp.js";

export function createSendMessageRouter() {
  const router = express.Router();
  const whatsappService = new WhatsAppService();

  // Rate-limit middleware: max 10 request per minute per IP
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: "Too many requests, try again later." },
  });

  // Auth middleware
  const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.BOT_API_SECRET;

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Helper: validate phone number
  const isValidPhone = (number) => /^\d{10,15}$/.test(number);

  // POST /api/send-message - send single or multiple messages
  router.post("/", authMiddleware, limiter, async (req, res) => {
    try {
      let { to, message } = req.body;

      // Support single string or array of numbers
      const recipients = Array.isArray(to) ? to : [to];

      if (!recipients.length || !message) {
        return res.status(400).json({ error: "Missing required fields: to, message" });
      }

      if (message.length > 4096) {
        return res.status(400).json({ error: "Message exceeds 4096 characters" });
      }

      // Filter invalid numbers
      const validRecipients = recipients.filter(isValidPhone);
      if (!validRecipients.length) {
        return res.status(400).json({ error: "No valid phone numbers provided" });
      }

      log("INFO", `📤 Broadcasting message to ${validRecipients.length} recipient(s)`);

      // Batched sending with small delay
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (const number of validRecipients) {
        await whatsappService.sendMessage(number, message);
        log("INFO", `✅ Message sent to ${number}`); // only log number, not message
        await delay(500); // 0.5 second delay per message
      }

      return res.json({ success: true, sentTo: validRecipients.length });

    } catch (error) {
      log("ERROR", `❌ Failed to send broadcast:`, error.message);
      return res.status(500).json({ error: "Failed to send message", details: error.message });
    }
  });

  return router;
}
