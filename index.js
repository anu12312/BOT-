const ws3 = require("ws3-fca");
const login = typeof ws3 === "function" ? ws3 : (ws3.default || ws3.login || ws3);
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ HTTP server for uptime
app.get("/", (req, res) => {
  res.send("✅ Facebook Bot is active and running...");
});
app.listen(PORT, () => {
  console.log(`🌐 HTTP server live on port ${PORT}`);
});

// ✅ Appstate Login
const appState = JSON.parse(fs.readFileSync("appstate.json", "utf-8"));

const BOSS_UID = "100052951819398"; // 👑 Your UID
let GROUP_THREAD_ID = null;
let LOCKED_GROUP_NAME = null;
let GROUP_LOCK_ENABLED = false;

let NICKNAME_LOCK_ENABLED = false;
let USER_NICKNAMES = {};

const PREFIX = "/";

login({ appState }, (err, api) => {
  if (err) return console.error("❌ Login failed:", err);

  api.setOptions({ listenEvents: true });
  console.log("🤖 Bot is online...");

  api.listenMqtt(async (err, event) => {
    if (err) return console.error("❌ Listen error:", err);

    // ✅ Handle Group Lock ON/OFF
    if (event.type === "message" && event.body?.toLowerCase().startsWith(`${PREFIX}gclock`)) {
      if (event.senderID !== BOSS_UID)
        return api.sendMessage("❌ Permission denied. Only boss can use this command.", event.threadID);

      const threadID = event.threadID;
      const args = event.body.toLowerCase().split(" ");
      const subcmd = args[1];

      if (subcmd === "on") {
        const info = await api.getThreadInfo(threadID);
        GROUP_THREAD_ID = threadID;
        LOCKED_GROUP_NAME = info.name;
        GROUP_LOCK_ENABLED = true;

        api.sendMessage(`🔒 Group name locked as: "${LOCKED_GROUP_NAME}" ✅`, threadID);
      } else if (subcmd === "off") {
        GROUP_LOCK_ENABLED = false;
        api.sendMessage(`🔓 Group name lock disabled.`, threadID);
      } else {
        api.sendMessage(`📌 Usage:\n${PREFIX}gclock on - Lock group name\n${PREFIX}gclock off - Unlock`, threadID);
      }
    }

    // 🔁 Group name revert
    if (event.logMessageType === "log:thread-name" && GROUP_LOCK_ENABLED && event.threadID === GROUP_THREAD_ID) {
      const changedName = event.logMessageData?.name || "(unknown)";
      if (LOCKED_GROUP_NAME && changedName !== LOCKED_GROUP_NAME) {
        try {
          await api.setTitle(LOCKED_GROUP_NAME, GROUP_THREAD_ID);
          api.sendMessage(`⚠️ Group name changed to "${changedName}". Reverting to "${LOCKED_GROUP_NAME}" ✅`, GROUP_THREAD_ID);
          console.log("🔁 Group name reverted.");
        } catch (e) {
          api.sendMessage(`❌ Failed to revert group name.\n📌 Reason: Not admin or Facebook blocked the action.`, GROUP_THREAD_ID);
          console.error("Revert failed:", e);
        }
      }
    }

    // ✅ Nickname Lock ON/OFF
    if (event.type === "message" && event.body?.toLowerCase().startsWith(`${PREFIX}nicklock`)) {
      if (event.senderID !== BOSS_UID)
        return api.sendMessage("❌ Permission denied. Only boss can use this command.", event.threadID);

      const threadID = event.threadID;
      const args = event.body.toLowerCase().split(" ");
      const subcmd = args[1];

      if (subcmd === "on") {
        const info = await api.getThreadInfo(threadID);
        USER_NICKNAMES = {};
        for (let user of info.userInfo) {
          if (user.nickname) USER_NICKNAMES[user.id] = user.nickname;
        }
        NICKNAME_LOCK_ENABLED = true;
        api.sendMessage(`🔒 Nickname lock enabled.`, threadID);
      } else if (subcmd === "off") {
        NICKNAME_LOCK_ENABLED = false;
        api.sendMessage(`🔓 Nickname lock disabled.`, threadID);
      } else {
        api.sendMessage(`📌 Usage:\n${PREFIX}nicklock on - Lock nicknames\n${PREFIX}nicklock off - Unlock`, threadID);
      }
    }

    // 🔁 Nickname revert
    if (event.logMessageType === "log:user-nickname" && NICKNAME_LOCK_ENABLED) {
      const userID = event.logMessageData.participant_id;
      const newNick = event.logMessageData.nickname;
      const originalNick = USER_NICKNAMES[userID];

      if (originalNick && newNick !== originalNick) {
        try {
          await api.setNickname(originalNick, event.threadID, userID);
          api.sendMessage(`⚠️ Nickname changed to "${newNick}". Reverting to "${originalNick}" ✅`, event.threadID);
          console.log("🔁 Nickname reverted.");
        } catch (e) {
          api.sendMessage(`❌ Failed to revert nickname.\n📌 Reason: Not admin or permission denied.`, event.threadID);
          console.error("Nickname revert failed:", e);
        }
      }
    }

  });
});
