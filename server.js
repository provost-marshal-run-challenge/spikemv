// 🔑 VAPID Public Key Endpoint for Web Push
app.get('/api/vapid-public-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const publicKey = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa9SkvMvKeyPublicSpikeMvDemoKeyHere1234567890ABCDEF";
  return res.json({ publicKey });
});

// 📊 State / Feed Status Endpoint (Lovable fallback check)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json({ status: "online", activeSignals: Object.keys(lastNotifiedState).length });
});
