import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Send, Paperclip, MessageSquare, Loader2, Download, X } from "lucide-react";
import { chatApi } from "../../services/index.js";
import { useSocket } from "../../hooks/useSocket.js";
import { apiErrorMessage, formatTime, formatDate, initials } from "../../utils/format.js";
import { EmptyState } from "../../components/ui/index.js";

/**
 * Real-time project chat (spec §48). Joins the conversation room over the
 * authenticated socket; the server checks participation before letting a
 * client into a room, so a project id alone doesn't grant access.
 */
export default function ChatTab({ project, user }) {
  const socket = useSocket();
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState(null);

  // Open (or create) the conversation, then load its history.
  useEffect(() => {
    let active = true;
    setLoading(true);

    chatApi
      .openForProject(project.id)
      .then(({ data }) => {
        if (!active) return null;
        setConversation(data);
        return chatApi.messages(data.id);
      })
      .then((res) => {
        if (!active || !res) return;
        setMessages(res.data);
        chatApi.markRead(res.data[0]?.conversationId).catch(() => {});
      })
      .catch((err) => active && toast.error(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [project.id]);

  // Join the room and listen for incoming messages.
  useEffect(() => {
    if (!socket || !conversation) return undefined;

    socket.emit("chat:join", conversation.id, (ack) => {
      if (ack && !ack.ok) toast.error(ack.error || "Could not join the conversation.");
    });

    const onMessage = (message) => {
      if (message.conversationId !== conversation.id) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };

    const onTyping = ({ conversationId, userId, isTyping }) => {
      if (conversationId !== conversation.id || userId === user.id) return;
      setTypingUser(isTyping ? userId : null);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);

    return () => {
      socket.emit("chat:leave", conversation.id);
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
    };
  }, [socket, conversation, user.id]);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !file) || !conversation) return;

    setSending(true);
    try {
      const data = new FormData();
      if (text.trim()) data.append("body", text.trim());
      if (file) data.append("file", file);

      const { data: message } = await chatApi.send(conversation.id, data);
      // The socket echo may not reach the sender, so add it locally too.
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setText("");
      setFile(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const notifyTyping = (isTyping) => {
    if (socket && conversation) {
      socket.emit("chat:typing", { conversationId: conversation.id, isTyping });
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: 60, textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
      </div>
    );
  }

  const isOwn = (message) =>
    message.senderKind === (user.role === "STUDENT" ? "STUDENT" : "USER") &&
    message.sender?.id === user.id;

  return (
    <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: 560 }}>
      {/* Participants */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <MessageSquare size={16} color="var(--purple-400)" />
        <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>Project Chat</span>
        <span style={{ fontSize: "0.72rem", color: "var(--slate-500)" }}>
          {conversation?.participants?.length || 0} participants
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: 12 }}
      >
        {!messages.length ? (
          <EmptyState
            compact
            icon={MessageSquare}
            title="No messages yet"
            message="Ask your mentor a question, or share a quick update between weekly submissions."
          />
        ) : (
          messages.map((message, i) => {
            const own = isOwn(message);
            const prev = messages[i - 1];
            const showDay =
              !prev || formatDate(prev.sentAt) !== formatDate(message.sentAt);

            return (
              <div key={message.id}>
                {showDay && (
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "0.68rem",
                      color: "var(--slate-500)",
                      margin: "8px 0 14px",
                    }}
                  >
                    {formatDate(message.sentAt)}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 9,
                    flexDirection: own ? "row-reverse" : "row",
                    alignItems: "flex-end",
                  }}
                >
                  <span
                    className="avatar-placeholder"
                    style={{ width: 26, height: 26, fontSize: "0.6rem", flexShrink: 0 }}
                    title={message.sender?.name}
                  >
                    {initials(message.sender?.name)}
                  </span>

                  <div style={{ maxWidth: "76%" }}>
                    {!own && (
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--slate-500)",
                          marginBottom: 3,
                          paddingLeft: 4,
                        }}
                      >
                        {message.sender?.name}
                        {message.sender?.role && ` · ${message.sender.role}`}
                      </div>
                    )}

                    <div className={`chat-bubble ${own ? "chat-bubble-own" : "chat-bubble-other"}`}>
                      {message.body && <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>}

                      {message.fileUrl && (
                        <a
                          href={message.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            marginTop: message.body ? 8 : 0,
                            padding: "7px 10px",
                            borderRadius: 8,
                            background: own ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                            fontSize: "0.75rem",
                          }}
                        >
                          <Download size={12} />
                          {message.fileName || "Attachment"}
                        </a>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: "0.62rem",
                        color: "var(--slate-500)",
                        marginTop: 3,
                        textAlign: own ? "right" : "left",
                        paddingInline: 4,
                      }}
                    >
                      {formatTime(message.sentAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUser && (
          <div style={{ fontSize: "0.72rem", color: "var(--slate-500)", paddingLeft: 36 }}>
            Someone is typing…
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {file && (
          <div
            className="flex items-center gap-2"
            style={{
              marginBottom: 9,
              padding: "7px 11px",
              borderRadius: 9,
              background: "rgba(255,255,255,0.05)",
              fontSize: "0.75rem",
            }}
          >
            <Paperclip size={12} color="var(--purple-400)" />
            <span className="truncate" style={{ flex: 1 }}>
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              style={{ color: "var(--red-400)", display: "flex" }}
              aria-label="Remove attachment"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 9, alignItems: "flex-end" }}>
          <button
            type="button"
            className="btn-icon"
            onClick={() => fileRef.current?.click()}
            style={{ color: "var(--slate-400)", flexShrink: 0 }}
            aria-label="Attach a file"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            style={{ display: "none" }}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.zip"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />

          <textarea
            className="form-input"
            rows={1}
            placeholder="Write a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => notifyTyping(true)}
            onBlur={() => notifyTyping(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            style={{ resize: "none", minHeight: 42, maxHeight: 120 }}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || (!text.trim() && !file)}
            style={{ flexShrink: 0 }}
            aria-label="Send message"
          >
            {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
