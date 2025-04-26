// server.js
import admin from 'firebase-admin';
import nodeCron from 'node-cron';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import express from 'express';
import { createRequire } from 'module';

dotenv.config();

const require = createRequire(import.meta.url);
const serviceAccount = require('./service.json');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Firebase Admin Init
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Appwrite Environment Configs
const PORT = process.env.PORT || 3000;
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const DATABASE_ID = process.env.DATABASE_ID;
const COLLECTION_ID = process.env.COLLECTION_ID;

// Fetch FCM Tokens from Appwrite
const getAllFCMTokens = async () => {
  const res = await fetch(`${APPWRITE_ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents`, {
    method: 'GET',
    headers: {
      'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      'X-Appwrite-Key': process.env.APPWRITE_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();

  console.log(data.documents);
  return data.documents.map(doc => doc.fcm_token).filter(token => token !== null);
};

// Default Morning Notification
const sendNotifications = async () => {
  try {
    const tokens = await getAllFCMTokens();
    const messages = tokens.map(token => ({
      token,
      notification: {
        title: 'Good Morning! ☀️',
        body: "Don't forget to add yesterday's expense",
      },
    }));
    const results = await Promise.all(messages.map(msg => admin.messaging().send(msg)));
    console.log(`✅ Notifications sent to ${results.length} devices`);
  } catch (err) {
    console.error('❌ Error sending notifications:', err.message);
  }
};

// Custom Notification
const customNotification = async (title, message) => {
  try {
    const tokens = await getAllFCMTokens();
    const messages = tokens.map(token => ({
      token,
      notification: {
        title,
        body: message,
      },
    }));
    const results = await Promise.all(messages.map(msg => admin.messaging().send(msg)));
    console.log(`✅ Notifications sent to ${results.length} devices`);
  } catch (err) {
    console.error('❌ Error sending custom notifications:', err.message);
  }
};

// POST: Custom Notification API
app.post('/sendNotification', async (req, res) => {
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  try {
    await customNotification(title, message);
    res.status(200).json({ message: '✅ Notifications sent successfully' });
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});


nodeCron.schedule('1 1 * * *', sendNotifications);
sendNotifications(); 

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});