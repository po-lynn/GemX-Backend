import "dotenv/config";
import http from "node:http";
import postgres from "postgres";
import { Server } from "socket.io";
import admin from "firebase-admin";

const PORT = Number(process.env.SOCKET_PORT || 4001);
const CORS_ORIGIN = process.env.SOCKET_CORS_ORIGIN || "*";
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const dbName = process.env.DB_NAME;
  const password = process.env.DB_PASSWORD;
  const port = process.env.DB_PORT || "5432";

  if (!host || !user || !dbName || !password) return null;
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
}

const DATABASE_URL = resolveDatabaseUrl();

if (!DATABASE_URL) {
  throw new Error(
    "SOCKET server requires DATABASE_URL (or DB_HOST, DB_USER, DB_NAME, DB_PASSWORD)."
  );
}

const sql = postgres(DATABASE_URL, { ssl: "require" });

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, credentials: true },
});

/** @type {Map<string, Set<string>>} */
const onlineUsers = new Map();

function setOnline(userId, socketId) {
  const existing = onlineUsers.get(userId) || new Set();
  existing.add(socketId);
  onlineUsers.set(userId, existing);
}

function setOffline(userId, socketId) {
  const existing = onlineUsers.get(userId);
  if (!existing) return;
  existing.delete(socketId);
  if (existing.size === 0) onlineUsers.delete(userId);
}

function isUserOnline(userId) {
  const sockets = onlineUsers.get(userId);
  return !!sockets && sockets.size > 0;
}

async function ensureFirebase() {
  if (admin.apps.length > 0) return admin;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
  return admin;
}

async function sendOfflinePush(recipientId, senderId, previewText) {
  const firebase = await ensureFirebase();
  if (!firebase) return;

  const tokenRows = await sql`
    SELECT token
    FROM push_device_token
    WHERE user_id = ${recipientId}
  `;
  const tokens = tokenRows.map((r) => r.token).filter(Boolean);
  if (tokens.length === 0) return;

  await firebase.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "New message",
      body: previewText || "You received a new chat message.",
    },
    data: {
      type: "chat_message",
      senderId: String(senderId),
      recipientId: String(recipientId),
    },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });
}

io.on("connection", (socket) => {
  socket.on("connection", ({ userId }) => {
    if (!userId || typeof userId !== "string") return;
    socket.data.userId = userId;
    setOnline(userId, socket.id);
    socket.join(`user:${userId}`);
    socket.emit("connection_ack", { userId, socketId: socket.id });
  });

  socket.on("send_message", async (payload = {}, ack) => {
    try {
      const senderId = socket.data.userId;
      if (!senderId) {
        ack?.({ success: false, error: "Unauthorized socket. Call connection event first." });
        return;
      }

      const recipientId = String(payload.recipientId || "").trim();
      const text = typeof payload.text === "string" ? payload.text : "";
      const tempId = payload.tempId ? String(payload.tempId) : null;
      const fileUrl = payload.fileUrl ? String(payload.fileUrl).trim() : null;
      const messageType = payload.messageType ? String(payload.messageType) : (fileUrl ? "file" : "text");

      if (!recipientId) {
        ack?.({ success: false, error: "recipientId is required" });
        return;
      }
      if (!text.trim() && !fileUrl) {
        ack?.({ success: false, error: "text or fileUrl is required" });
        return;
      }

      const [saved] = await sql`
        INSERT INTO messages (sender_id, recipient_id, content, file_url, message_type, is_read)
        VALUES (${senderId}, ${recipientId}, ${text}, ${fileUrl}, ${messageType}, false)
        RETURNING id, sender_id, recipient_id, content, file_url, message_type, is_read, created_at
      `;

      const outgoing = {
        id: saved.id,
        senderId: saved.sender_id,
        recipientId: saved.recipient_id,
        text: saved.content,
        fileUrl: saved.file_url,
        messageType: saved.message_type,
        isRead: saved.is_read,
        timestamp: saved.created_at,
        tempId,
      };

      io.to(`user:${recipientId}`).emit("receive_message", outgoing);
      io.to(`user:${senderId}`).emit("message_saved", outgoing);
      ack?.({ success: true, message: outgoing });

      if (!isUserOnline(recipientId)) {
        await sendOfflinePush(recipientId, senderId, text.slice(0, 120));
      }
    } catch (error) {
      console.error("socket send_message error:", error);
      ack?.({ success: false, error: "Failed to send message" });
    }
  });

  socket.on("typing_status", (payload = {}) => {
    const senderId = socket.data.userId;
    if (!senderId) return;
    const recipientId = String(payload.recipientId || "").trim();
    const isTyping = !!payload.isTyping;
    if (!recipientId) return;
    io.to(`user:${recipientId}`).emit("typing_status", { senderId, recipientId, isTyping });
  });

  socket.on("disconnect", () => {
    if (socket.data.userId) setOffline(socket.data.userId, socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`socket.io chat server running on :${PORT}`);
});

