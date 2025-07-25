const ws3 = require("ws3-fca");
const login = typeof ws3 === "function" ? ws3 : (ws3.default || ws3.login || ws3);
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ HTTP server to keep app live (Render/uptimebot)
app.get("/", (req, res) => {
  res.send("✅ Facebook Bot is active and running...");
});
app.listen(PORT, () => {
  console.log(`🌐 HTTP server live on port ${PORT}`);
});

// ✅ Login with appstate
const appState = JSON.parse(fs.readFileSync("appstate.json", "utf-8"));

let GROUP_THREAD_ID = null;
let LOCKED_GROUP_NAME = null;

login({ appState }, (err, api) => {
  if (err) return console.error("❌ Login failed:", err);

  api.setOptions({ listenEvents: true });
  console.log("🤖 Bot is online...");

  api.listenMqtt(async (err, event) => {
    if (err) return console.error("❌ Listen error:", err);

    // 🔒 Lock group name
    if (event.type === "message" && event.body?.toLowerCase() === "/gclock") {
      try {
        const threadID = event.threadID;
        const info = await api.getThreadInfo(threadID);
        GROUP_THREAD_ID = threadID;
        LOCKED_GROUP_NAME = info.name;

        api.sendMessage(`🔒 Group name locked as: "${LOCKED_GROUP_NAME}"`, threadID);
      } catch (e) {
        console.error("Failed to lock group name:", e);
        api.sendMessage("❌ Failed to lock group name. Try again later.", event.threadID);
      }
    }

    // 🔁 Revert name change if group name changes
    if (event.logMessageType === "log:thread-name" && event.threadID === GROUP_THREAD_ID) {
      const changedName = event.logMessageData.name;

      if (LOCKED_GROUP_NAME && changedName !== LOCKED_GROUP_NAME) {
        try {
          await api.setTitle(LOCKED_GROUP_NAME, GROUP_THREAD_ID);
          api.sendMessage(`⚠️ Group name changed to "${changedName}". Reverting to "${LOCKED_GROUP_NAME}" ✅`, GROUP_THREAD_ID);
          console.log("🔁 Group name reverted.");
        } catch (e) {
          api.sendMessage(
            `❌ Group name changed to "${changedName}" but revert failed.\n\n📌 Reason: Bot is likely not admin or Facebook blocked the action.\n👑 Make sure I'm an admin.`,
            GROUP_THREAD_ID
          );
          console.error("Revert failed:", e);
        }
      }
    }
  });
});
