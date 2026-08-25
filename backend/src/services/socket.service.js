const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./../config/prisma");
const { env } = require("../config/env");

/**
 * Socket.IO with the same auth model as the REST API.
 *
 * The previous implementation trusted whatever userId a client emitted on
 * `join`, which let anyone subscribe to another user's notification channel.
 * Here the identity comes from a verified JWT during the handshake, and room
 * membership is checked against the database before a client is joined.
 */
function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: env.clientOrigins,
      credentials: true,
    },
  });

  // ── Handshake auth ───────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer /, "");

    if (!token) return next(new Error("Authentication required."));

    try {
      socket.user = jwt.verify(token, env.jwt.accessSecret);
      next();
    } catch {
      next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    const { id: userId, role } = socket.user;

    // Personal channel for notifications — derived from the token, not the client.
    socket.join(`user:${userId}`);

    /**
     * Join a conversation room only after confirming the caller is a
     * participant (or an admin auditing the thread).
     */
    socket.on("chat:join", async (conversationId, ack) => {
      try {
        if (typeof conversationId !== "string") return ack?.({ ok: false });

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { participants: true },
        });
        if (!conversation) return ack?.({ ok: false, error: "Conversation not found." });

        const allowed =
          role === "ADMIN" ||
          conversation.participants.some((p) =>
            role === "STUDENT" ? p.studentId === userId : p.userId === userId
          );

        if (!allowed) return ack?.({ ok: false, error: "Not a participant." });

        socket.join(`conv:${conversationId}`);
        ack?.({ ok: true });
      } catch (err) {
        console.error("chat:join failed:", err.message);
        ack?.({ ok: false, error: "Could not join conversation." });
      }
    });

    socket.on("chat:leave", (conversationId) => {
      if (typeof conversationId === "string") socket.leave(`conv:${conversationId}`);
    });

    /**
     * Typing indicators are ephemeral and carry no stored state, so they are
     * relayed directly — but only into rooms this socket already joined.
     */
    socket.on("chat:typing", ({ conversationId, isTyping } = {}) => {
      if (!socket.rooms.has(`conv:${conversationId}`)) return;
      socket.to(`conv:${conversationId}`).emit("chat:typing", {
        conversationId,
        userId,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("disconnect", () => {
      // Rooms are cleaned up by Socket.IO automatically.
    });
  });

  return io;
}

/** Push a notification to one user's personal channel. */
function emitToUser(io, userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initSocket, emitToUser };
