const admin = require('firebase-admin');

// Render Environment Variable އިން Firebase Admin Initialize ކުރުން
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin SDK Initialized Successfully!");
  } catch (error) {
    console.error("❌ Firebase Admin Initialization Error:", error);
  }
}

// Signal Active ވުމުން ފޯނުތަކަށް Push Notification ފޮނުވާ Function
async function triggerPushNotification(signalData, fcmTokens) {
  if (!fcmTokens || fcmTokens.length === 0) return;

  const message = {
    notification: {
      title: `🚨 SpikeMV Signal: ${signalData.symbol}`,
      body: signalData.suggestion || 'High Probability Pre-Spike Active!'
    },
    tokens: fcmTokens
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`🚀 FCM Push Alerts sent: ${response.successCount} successful`);
  } catch (error) {
    console.error("❌ FCM Send Error:", error);
  }
}
