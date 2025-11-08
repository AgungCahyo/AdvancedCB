import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyAzJ1IAgNMMjHGu584o4rTPMffCLzj9YRQ",
  authDomain: "dashboard-cb-fd982.firebaseapp.com",
  projectId: "dashboard-cb-fd982",
  storageBucket: "dashboard-cb-fd982.firebasestorage.app",
  messagingSenderId: "244904697875",
  appId: "1:244904697875:web:ab8fb39baf1ce51cbe1fe6",
  measurementId: "G-JCKGB9Q7W0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  try {
    const messagesJson = JSON.parse(
      fs.readFileSync('./messages.json', 'utf-8')
    );

    const messagesRef = doc(db, 'bot_config', 'messages');
    await setDoc(messagesRef, {
      ...messagesJson,
      last_updated: serverTimestamp(),
      updated_by: 'migration_script'
    });

    console.log('✅ Migration successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();