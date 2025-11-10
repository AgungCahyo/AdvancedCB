// scripts/migrate-system-messages.js
// Run: node scripts/migrate-system-messages.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const systemMessagesData = {
  system_messages: {
    offline_hours: {
      message: "Halo {name}! ⚠️\n\nSaat ini di luar jam kerja (08:00–17:00 WIB).\nPesan Anda akan dibalas pada hari kerja berikutnya.\n\nTerima kasih! 🙏",
      greeting_with_name: true
    },
    consultation_notification: {
      template: "🔔 *PERMINTAAN KONSULTASI*\n\n👤 Nama: {name}\n📱 Nomor: {phone}\n💬 Pesan: \"{message}\"\n⏰ Waktu: {timestamp}\n\nSegera follow up untuk closing! 💰"
    },
    button_text: {
      welcome_download: "🚀 Download Ebook",
      welcome_tips: "💡 Strategi BEP",
      welcome_consultation: "📞 Chat Konsultan",
      mulai_tips: "💡 Tips BEP",
      mulai_bonus: "🎁 Bonus Tools",
      mulai_autopilot: "🚀 Sistem Auto",
      tips_bonus: "🎁 Ambil Bonus",
      tips_autopilot: "🚀 Sistem Auto",
      tips_consultation: "📞 Konsultasi",
      bonus_autopilot: "⚡ Info Autopilot",
      bonus_consultation: "📞 Chat Sekarang",
      autopilot_consultation: "📞 Ya, Chat Konsultan"
    },
    button_footer: {
      welcome: "Pilih untuk mulai perjalanan Anda 👇",
      mulai: "Rekomendasi: TIPS → BONUS → AUTOPILOT",
      tips: "87% yang follow flow ini closing!",
      bonus: "Voucher terbatas 12 slot tersisa!",
      autopilot: "Kode: EBOOKKLIK2025 | 12 slot tersisa"
    },
    follow_up_messages: {
      after_mulai: "Sudah download? Lanjut ke mana? 👇",
      after_tips: "Mau action sekarang? 🔥",
      after_bonus: "Next level: Passive income autopilot! 💰",
      after_autopilot: "Siap untuk ROI 4-6 bulan? 🎯"
    },
    list_menu: {
      button_text: "Menu",
      footer_text: "Jalan Pintas Juragan Photobox",
      sections: [
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
      ]
    }
  },
  last_updated: serverTimestamp(),
  updated_by: "migration-script"
};

async function migrate() {
  try {
    console.log('🚀 Starting migration...');
    
    const messagesRef = doc(db, 'bot_config', 'messages');
    
    await updateDoc(messagesRef, systemMessagesData);
    
    console.log('✅ Migration completed successfully!');
    console.log('📝 Added system_messages to bot_config/messages');
    console.log('\n📊 Structure added:');
    console.log('  - offline_hours (message + greeting_with_name)');
    console.log('  - consultation_notification (template)');
    console.log('  - button_text (12 button configurations)');
    console.log('  - button_footer (5 footer texts)');
    console.log('  - follow_up_messages (4 follow-up messages)');
    console.log('  - list_menu (complete menu structure)');
    console.log('\n✨ You can now edit these via System Messages page in dashboard!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();