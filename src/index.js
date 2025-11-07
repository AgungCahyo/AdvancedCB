import express from "express";
import { CONFIG } from "./config/index.js";
import { log } from "./utils/logger.js";
import { MessageCache } from "./utils/cache.js";
import { RateLimiter } from "./utils/rateLimit.js";
import { WhatsAppService } from "./services/whatsapp.js";
import { MessageHandler } from "./handlers/messageHandler.js";
import { createWebhookRouter } from "./routes/webhook.js";

const app = express();
app.use(express.json());

// Initialize services
const cache = new MessageCache(1000, 500);
const rateLimiter = new RateLimiter(5000);
const whatsappService = new WhatsAppService();
const messageHandler = new MessageHandler(whatsappService, cache, rateLimiter);

// Setup routes
const webhookRouter = createWebhookRouter(messageHandler, cache, rateLimiter);
app.use("/webhook", webhookRouter);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Bot WhatsApp Cloud API - Jalan Pintas Juragan Photobox",
    status: "running",
    version: "2.0.0",
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

// Start server
const server = app.listen(CONFIG.port, () => {
  console.log("\n" + "=".repeat(60));
  log("INFO", "🚀 Server WhatsApp Bot dimulai");
  console.log("=".repeat(60));
  log("INFO", `📱 Bot: Jalan Pintas Juragan Photobox`);
  log("INFO", `🌐 Port: ${CONFIG.port}`);
  log("INFO", `📞 Phone ID: ${CONFIG.phoneID}`);
  log("INFO", `🔗 Webhook URL: http://localhost:${CONFIG.port}/webhook`);
  log("INFO", `💚 Health Check: http://localhost:${CONFIG.port}/webhook/health`);
  console.log("=".repeat(60) + "\n");
  log("INFO", "✅ Bot siap menerima pesan!");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log("INFO", "🛑 SIGTERM diterima: menutup server HTTP");
  server.close(() => {
    log("INFO", "✅ Server HTTP ditutup");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  log("INFO", "🛑 SIGINT diterima: menutup server HTTP");
  server.close(() => {
    log("INFO", "✅ Server HTTP ditutup");
    process.exit(0);
  });
});

process.on("uncaughtException", (err) => {
  log("ERROR", "❌ Uncaught Exception:", err.message);
  log("ERROR", "Stack:", err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  log("ERROR", "❌ Unhandled Rejection di:", promise);
  log("ERROR", "Alasan:", reason);
});