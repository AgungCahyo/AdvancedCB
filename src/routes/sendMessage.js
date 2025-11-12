// src/routes/sendMessage.js - NEW ROUTE FOR BROADCAST
import express from "express";
import { CONFIG } from "../config/index.js";
import { log } from "../utils/logger.js";
import { WhatsAppService } from "../services/whatsapp.js";

export function createSendMessageRouter() {
  const router = express.Router();
  const whatsappService = new WhatsAppService();

  // Simple auth middleware
  const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.BOT_API_SECRET || "your-secret-token-here";
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // POST /api/send-message - Send single message
  router.post("/", authMiddleware, async (req, res) => {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({ 
          error: "Missing required fields: to, message" 
        });
      }

      // Validate phone number format
      if (!/^\d{10,15}$/.test(to)) {
        return res.status(400).json({ 
          error: "Invalid phone number format" 
        });
      }

      log("INFO", `📤 Broadcasting message to ${to}`);

      // Send message via WhatsApp API
      await whatsappService.sendMessage(to, message);

      log("INFO", `✅ Broadcast message sent to ${to}`);

      return res.json({ 
        success: true, 
        to, 
        message: "Message sent successfully" 
      });

    } catch (error) {
      log("ERROR", `❌ Failed to send broadcast to ${req.body.to}:`, error.message);
      return res.status(500).json({ 
        error: "Failed to send message",
        details: error.message 
      });
    }
  });

  return router;
}