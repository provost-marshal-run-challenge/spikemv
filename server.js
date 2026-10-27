const express = require('express');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// Firebase Admin Setup
if (!admin.apps.length) {
  try {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawAccount) {
      const serviceAccount = JSON.parse(rawAccount);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase Admin SDK Initialized Successfully!");
    } else {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT environment variable is missing!");
    }
  } catch (error) {
    console.error("❌ Firebase Admin Initialization Error:", error);
  }
}

// MT5 WebRequest & Health Check Route
app.get('/', (req, res) => {
  res.send("SpikeMV Backend Active!");
});

// ⚠️ މުހިންމު ބައި: ސާވަރު ނިވިގެން ނުދާ ގޮތަށް Port Listen ކުރުވުން
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 SpikeMV Server running on port ${PORT}`);
});
