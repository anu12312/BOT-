const fs = require("fs");
const express = require("express");
const login = require("ws3-fca");

// ✅ Load appstate.json properly
let appState;
try {
  appState = JSON.parse(fs.readFileSync("appstate.json", "utf-8"));
} catch (err) {
  console.error("❌ Error reading appstate.json:", err);
  process.exit(1);
}

// ✅ Start web server for uptime (Render)
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("🤖 Bot is Live!"));
app.listen(PORT, () => console.log(`🌐 Listening on port ${PORT}`));

// ✅ Login with custom headers
login(
  {
    appState,
    userAgent:
      // 🟢 Change this to iPhone or Mozilla Win if needed
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.0.0",
    forceLogin: true
  },
  (err, api) => {
    if (err) {
      console.error("❌ Login failed:", err);
      return;
    }

    console.log("✅ Logged in successfully!");

    api.setOptions({
      listenEvents: true,
      selfListen: false,
      logLevel: "silent"
    });

    // ✅ Listen for messages
    api.listenMqtt((err, event) => {
      if (err) return console.error("❌ Listen error:", err);

      if (event.type === "message" && event.body) {
        const msg = event.body.toLowerCase();

        if (msg === "hello") {
          api.sendMessage("Hi! Bot is active 😎", event.threadID);
        }

        if (msg === "gm" || msg === "good morning") {
          api.sendMessage("🌞 Good Morning!", event.threadID);
        }
      }
    });
  }
);
