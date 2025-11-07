import "dotenv/config";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load messages.json
let messagesData;
try {
  const messagesPath = join(__dirname, "../../messages.json");
  messagesData = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
} catch (error) {
  console.error("❌ Gagal membaca messages.json:", error.message);
  process.exit(1);
}

// Environment variables configuration
export const CONFIG = {
  token: process.env.WA_TOKEN,
  phoneID: process.env.PHONE_ID,
  verifyToken: process.env.VERIFY_TOKEN,
  adminNumber: process.env.ADMIN_NUMBER,
  port: process.env.PORT || 3000,
  apiVersion: "v24.0",
  get apiUrl() {
    return `https://graph.facebook.com/${this.apiVersion}/${this.phoneID}/messages`;
  },
};

// Validate required environment variables
const requiredEnvVars = ["WA_TOKEN", "PHONE_ID", "VERIFY_TOKEN", "ADMIN_NUMBER"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Environment variable wajib tidak ditemukan: ${missingVars.join(", ")}`);
  process.exit(1);
}

export { messagesData };