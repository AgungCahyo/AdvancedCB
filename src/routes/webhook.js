import express from "express";
import { CONFIG } from "../config/index.js";
import { log } from "../utils/logger.js";

export function createWebhookRouter(messageHandler, cache, rateLimiter) {
  const router = express.Router();

  // Webhook verification
  router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const tokenSent = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    log("INFO", "📥 Percobaan verifikasi webhook", { mode, tokenSent });

    if (mode === "subscribe" && tokenSent === CONFIG.verifyToken) {
      log("INFO", "✅ Webhook berhasil diverifikasi");
      return res.status(200).send(challenge);
    }
    
    log("WARN", "❌ Verifikasi webhook gagal - token salah");
    return res.sendStatus(403);
  });

  // Webhook message handling
  router.post("/", async (req, res) => {
    res.sendStatus(200); // Quick response

    try {
      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (!message) {
        log("INFO", "⏭️ Event bukan pesan, dilewati");
        return;
      }

      await messageHandler.processMessage(message);

    } catch (err) {
      log("ERROR", "❌ Error kritis di webhook POST:", err.message);
      if (err.stack) {
        log("ERROR", "Stack trace:", err.stack);
      }
    }
  });

  // Health check
  router.get("/health", (req, res) => {
    const uptime = process.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
    
    res.json({ 
      status: "healthy",
      bot: "Jalan Pintas Juragan Photobox",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      cache: {
        size: cache.size,
        maxSize: 1000
      },
      environment: {
        phoneID: CONFIG.phoneID,
        apiVersion: CONFIG.apiVersion
      }
    });
  });

  // Stats endpoint
  router.get("/stats", (req, res) => {
    res.json({
      processedMessages: cache.size,
      activeUsers: rateLimiter.activeUsers,
      uptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  });

  return router;
}