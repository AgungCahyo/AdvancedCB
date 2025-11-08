import express from "express";
import { CONFIG, waitForMessages, getMessagesStatus } from "./config/index.js";
import { log } from "./utils/logger.js";
import { MessageCache } from "./utils/cache.js";
import { RateLimiter } from "./utils/rateLimit.js";
import { WhatsAppService } from "./services/whatsapp.js";
import { MessageHandler } from "./handlers/messageHandler.js";
import { createWebhookRouter } from "./routes/webhook.js";

const app = express();
app.use(express.json());

// ============================================================================
// ASYNC INITIALIZATION
// ============================================================================

async function initializeBot() {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 Initializing WhatsApp Bot");
    console.log("=".repeat(60));

    // Step 1: Wait for messages to load
    console.log("\n⏳ Step 1: Loading messages configuration...");
    await waitForMessages();
    
    const messagesStatus = getMessagesStatus();
    console.log(`✅ Messages loaded from: ${messagesStatus.source}`);
    
    // Step 2: Initialize services
    console.log("\n⏳ Step 2: Initializing services...");
    const cache = new MessageCache(1000, 500);
    const rateLimiter = new RateLimiter(5000);
    const whatsappService = new WhatsAppService();
    const messageHandler = new MessageHandler(whatsappService, cache, rateLimiter);
    console.log("✅ Services initialized");

    // Step 3: Setup routes
    console.log("\n⏳ Step 3: Setting up routes...");
    const webhookRouter = createWebhookRouter(messageHandler, cache, rateLimiter);
    app.use("/webhook", webhookRouter);
    console.log("✅ Routes configured");

    // Root endpoint
    app.get("/", (req, res) => {
      const status = getMessagesStatus();
      res.json({
        message: "Bot WhatsApp Cloud API - Jalan Pintas Juragan Photobox",
        status: "running",
        version: "2.0.0",
        messages_source: status.source,
        endpoints: {
          webhook: "/webhook",
          health: "/webhook/health",
          stats: "/webhook/stats"
        }
      });
    });

    // Error handling
    app.use((err, req, res, next) => {
      log("ERROR", "❌ Error tidak tertangani:", err.message);
      res.status(500).json({ 
        error: "Internal server error",
        message: "Terjadi kesalahan yang tidak terduga"
      });
    });

    app.use((req, res) => {
      res.status(404).json({ 
        error: "Not found",
        message: "Endpoint yang diminta tidak ditemukan"
      });
    });

    // Step 4: Start server
    console.log("\n⏳ Step 4: Starting HTTP server...");
    const server = app.listen(CONFIG.port, () => {
      console.log("\n" + "=".repeat(60));
      log("INFO", "🎉 Server WhatsApp Bot berhasil dimulai!");
      console.log("=".repeat(60));
      log("INFO", `📱 Bot: Jalan Pintas Juragan Photobox`);
      log("INFO", `🌐 Port: ${CONFIG.port}`);
      log("INFO", `📞 Phone ID: ${CONFIG.phoneID}`);
      log("INFO", `📊 Messages: ${messagesStatus.source}`);
      log("INFO", `🔗 Webhook URL: http://localhost:${CONFIG.port}/webhook`);
      log("INFO", `💚 Health Check: http://localhost:${CONFIG.port}/webhook/health`);
      console.log("=".repeat(60) + "\n");
      log("INFO", "✅ Bot siap menerima pesan!");
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      log("INFO", `🛑 ${signal} diterima: menutup server HTTP`);
      server.close(() => {
        log("INFO", "✅ Server HTTP ditutup");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("uncaughtException", (err) => {
      log("ERROR", "❌ Uncaught Exception:", err.message);
      log("ERROR", "Stack:", err.stack);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      log("ERROR", "❌ Unhandled Rejection di:", promise);
      log("ERROR", "Alasan:", reason);
    });

  } catch (error) {
    console.error("\n❌ Failed to initialize bot:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ============================================================================
// START BOT
// ============================================================================

initializeBot();