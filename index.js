const ws3 = require("ws3-fca");
const login = typeof ws3 === "function" ? ws3 : (ws3.default || ws3.login || ws3);
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Facebook Bot is active and running...");
});
app.listen(PORT, () => {
  console.log(`🌐 HTTP server live on port ${PORT}`);
});

const BOSS_UID = "61578840237242"; // 👑 Your UID
const appState = JSON.parse(fs.readFileSync("appstate.json", "utf-8"));

let GROUP_THREAD_ID = null;
let LOCKED_GROUP_NAME = null;
let nickLockEnabled = false;
let originalNicknames = {};

// ✅ Spoof trusted browser/device
const loginOptions = {
  appState,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FBAV/350.0.0.8.103",
};

login(loginOptions, (err, api) => {
  if (err) return console.error("❌ Login failed:", err);

  api.setOptions({ listenEvents: true });
  console.log("🤖 Bot is online...");

  api.listenMqtt(async (err, event) => {
    if (err) return console.error("❌ Listen error:", err);

    const senderID = event.senderID;
    const threadID = event.threadID;
    const body = (event.body || "").toLowerCase();

    // 🔒 Group name lock
    if (event.type === "message" && body === "/gclock") {
      if (senderID !== BOSS_UID)
        return api.sendMessage("⛔ Only boss can use this command.", threadID);
      try {
        const info = await api.getThreadInfo(threadID);
        GROUP_THREAD_ID = threadID;
        LOCKED_GROUP_NAME = info.name;
        api.sendMessage(`🔒 Group name locked as: "${LOCKED_GROUP_NAME}"`, threadID);
      } catch (e) {
        api.sendMessage("❌ Failed to lock group name.", threadID);
        console.error("Lock error:", e);
      }
    }

    // 🔁 Revert group name if changed
    if (event.logMessageType === "log:thread-name" && event.threadID === GROUP_THREAD_ID) {
      const changedName = event.logMessageData.name;
      if (LOCKED_GROUP_NAME && changedName !== LOCKED_GROUP_NAME) {
        try {
          await api.setTitle(LOCKED_GROUP_NAME, GROUP_THREAD_ID);
          api.sendMessage(
            `⚠️ Group name changed to "${changedName}". Reverting to "${LOCKED_GROUP_NAME}" ✅`,
            GROUP_THREAD_ID
          );
        } catch (e) {
          api.sendMessage(
            `❌ Couldn't revert group name to "${LOCKED_GROUP_NAME}". Bot may not be admin.`,
            GROUP_THREAD_ID
          );
        }
      }
    }

    // 🧑‍🔒 Nickname lock ON
    if (event.type === "message" && body === "/nicklock on") {
      if (senderID !== BOSS_UID)
        return api.sendMessage("⛔ Only boss can use this command.", threadID);
      try {
        const threadInfo = await api.getThreadInfo(threadID);
        originalNicknames = {};
        threadInfo.userInfo.forEach(user => {
          originalNicknames[user.id] = user.nickname || "";
        });
        nickLockEnabled = true;
        api.sendMessage("🔐 Nickname lock is now ON.", threadID);
      } catch (err) {
        api.sendMessage("❌ Failed to enable nickname lock.", threadID);
      }
    }

    // 🔓 Nickname lock OFF
    if (event.type === "message" && body === "/nicklock off") {
      if (senderID !== BOSS_UID)
        return api.sendMessage("⛔ Only boss can use this command.", threadID);
      nickLockEnabled = false;
      originalNicknames = {};
      api.sendMessage("🔓 Nickname lock is now OFF.", threadID);
    }

    // 🔁 Revert nickname if changed
    if (nickLockEnabled && event.logMessageType === "log:user-nickname") {
      const changedUID = event.logMessageData.participant_id;
      const newNick = event.logMessageData.nickname;
      const originalNick = originalNicknames[changedUID];

      if (originalNick !== undefined && newNick !== originalNick) {
        try {
          await api.changeNickname(originalNick, threadID, changedUID);
          console.log(`🔁 Nickname reverted for UID ${changedUID}`);
        } catch (err) {
          console.error("❌ Failed to revert nickname:", err);
        }
      }
    }
  });
});
