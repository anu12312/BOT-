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

const BOSS_UID = "61577927253024";
const appState = JSON.parse(fs.readFileSync("appstate.json", "utf-8"));

let GROUP_THREAD_ID = null;
let LOCKED_GROUP_NAME = null;
let nickLockEnabled = false;
let originalNicknames = {};
let lastMessageTime = 0;

login({ appState }, (err, api) => {
  if (err) return console.error("❌ Login failed:", err);

  api.setOptions({
    listenEvents: true,
    selfListen: false,
    forceLogin: true,
    logLevel: "silent",
    updatePresence: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  });

  console.log("✅ Bot login successful!");
  console.log("📡 Waiting 5 seconds before starting listener...");

  setTimeout(() => {
    api.listenMqtt(async (err, event) => {
      if (err) return console.error("❌ Listen error:", err);

      try {
        const senderID = event.senderID;
        const threadID = event.threadID;
        const body = (event.body || "").toLowerCase();

        if (Date.now() - lastMessageTime < 3000) return;
        lastMessageTime = Date.now();

        // 🔒 /gclock command
        if (event.type === "message" && body === "/gclock") {
          if (senderID !== BOSS_UID) return api.sendMessage("⛔ Only Boss can use this.", threadID);
          try {
            const info = await api.getThreadInfo(threadID);
            GROUP_THREAD_ID = threadID;
            LOCKED_GROUP_NAME = info.name;
            api.sendMessage(`🔒 Group name locked as: "${LOCKED_GROUP_NAME}"`, threadID);
            console.log(`🔒 Group name locked in [${info.name}] (${threadID})`);
          } catch (e) {
            console.error("❌ Group lock error:", e.message || e);
            api.sendMessage("⚠️ Failed to lock group name.", threadID);
          }
        }

        // 🔁 Group name revert
        if (event.logMessageType === "log:thread-name" && event.threadID === GROUP_THREAD_ID) {
          const changedName = event.logMessageData.name;
          if (LOCKED_GROUP_NAME && changedName !== LOCKED_GROUP_NAME) {
            try {
              const info = await api.getThreadInfo(GROUP_THREAD_ID);
              if (!info.adminIDs.some(a => a.id === api.getCurrentUserID())) {
                return api.sendMessage("⚠️ Bot is not admin to revert name.", GROUP_THREAD_ID);
              }
              await api.setTitle(LOCKED_GROUP_NAME, GROUP_THREAD_ID);
              api.sendMessage(`⚠️ Group name was changed to "${changedName}". Reverted to "${LOCKED_GROUP_NAME}" ✅`, GROUP_THREAD_ID);
            } catch (e) {
              console.error("❌ Revert error:", e.message || e);
            }
          }
        }

        // 🔐 Nickname lock ON
        if (event.type === "message" && body === "/nicklock on") {
          if (senderID !== BOSS_UID) return api.sendMessage("⛔ Only Boss can use this.", threadID);
          try {
            const threadInfo = await api.getThreadInfo(threadID);
            originalNicknames = {};
            threadInfo.userInfo.forEach(user => {
              originalNicknames[user.id] = user.nickname || "";
            });
            nickLockEnabled = true;
            api.sendMessage("🔐 Nickname lock is now ON.", threadID);
            console.log(`🔐 Nickname lock enabled in [${threadInfo.name}] (${threadID})`);
          } catch (err) {
            console.error("❌ NickLock ON error:", err.message || err);
            api.sendMessage("⚠️ Failed to enable nickname lock.", threadID);
          }
        }

        // 🔓 Nickname lock OFF
        if (event.type === "message" && body === "/nicklock off") {
          if (senderID !== BOSS_UID) return api.sendMessage("⛔ Only Boss can use this.", threadID);
          nickLockEnabled = false;
          originalNicknames = {};
          api.sendMessage("🔓 Nickname lock is now OFF.", threadID);
          console.log(`🔓 Nickname lock disabled in (${threadID})`);
        }

        // 🔁 Nickname revert
        if (nickLockEnabled && event.logMessageType === "log:user-nickname") {
          const changedUID = event.logMessageData.participant_id;
          const newNick = event.logMessageData.nickname;
          const originalNick = originalNicknames[changedUID];
          if (originalNick !== undefined && newNick !== originalNick) {
            try {
              const info = await api.getThreadInfo(threadID);
              if (!info.adminIDs.some(a => a.id === api.getCurrentUserID())) {
                return api.sendMessage("⚠️ Bot is not admin to revert nickname.", threadID);
              }
              await api.changeNickname(originalNick, threadID, changedUID);
              console.log(`🔁 Nickname reverted for UID ${changedUID}`);
            } catch (err) {
              console.error("❌ Nick revert error:", err.message || err);
            }
          }
        }

        // 🟢 Log active group
        if (event.type === "message" && senderID !== api.getCurrentUserID()) {
          const info = await api.getThreadInfo(threadID);
          console.log(`💬 Message received in [${info.name}] (${threadID}) from UID ${senderID}`);
        }

      } catch (e) {
        console.error("❗ Unhandled error:", e.message || e);
      }
    });
  }, 5000);
});
