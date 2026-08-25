import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  MessageSquare, Send, Paperclip, Loader2, Download, X, ArrowLeft,
} from "lucide-react";
import { chatApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { useSocket } from "../../hooks/useSocket.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  apiErrorMessage, formatTime, formatDate, timeAgo, initials, truncate,
} from "../../utils/format.js";
import { PageHeader, EmptyState, SkeletonCard } from "../../components/ui/index.js";

/**
 * Conversation list plus thread (spec §48). Each project has one conversation
 * containing its students, faculty and mentor.
 */
export default function Chat() {
  const { user } = useAuth();
  const socket = useSocket();
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  const { data: conversations, loading, refetch } = useApi(() => chatApi.conversations(), [], {
    initialData: [],
  });

  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);

  // Auto-open the most recent conversation on desktop.
  useEffect(() => {
    if (!activeId && conversations?.length) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  useEffect(() => {
    if (!activeId) return undefined;
    let active = true;
    setLoadingThread(true);

    chatApi
      .messages(activeId)
      .then(({ data }) => active && setMessages(data))
      .catch((err) => active && toast.error(apiErrorMessage(err)))
      .finally(() => active && setLoadingThread(false));

    chatApi.markRead(activeId).catch(() => {});

    return () => {
      active = false;
    };
  }, [activeId]);

  useEffect(() => {
    if (!socket || !activeId) return undefined;

    socket.emit("chat:join", activeId, (ack) => {
      if (ack && !ack.ok) toast.error(ack.error || "Could not join the conversation.");
    });

    const onMessage = (message) => {
      if (message.conversationId !== activeId) {
        refetch(); // bump the sidebar's last-message preview
        return;
      }
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };

    socket.on("chat:message", onMessage);
    return () => {
      socket.emit("chat:leave", activeId);
      socket.off("chat:message", onMessage);
    };
  }, [socket, activeId, refetch]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !file) || !activeId) return;

    setSending(true);
    try {
      const data = new FormData();
      if (text.trim()) data.append("body", text.trim());
      if (file) data.append("file", file);

      const { data: message } = await chatApi.send(activeId, data);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setText("");
      setFile(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const isOwn = (message) =>
    message.senderKind === (user.role === "STUDENT" ? "STUDENT" : "USER") &&
    message.sender?.id === user.id;

  const active = conversations?.find((c) => c.id === activeId);

  if (loading) {
    return (
      <>
        <PageHeader icon={MessageSquare} title="Chat" />
        <SkeletonCard height={400} />
      </>
    );
  }

  if (!conversations?.length) {
    return (
      <>
        <PageHeader
          icon={MessageSquare}
          title="Chat"
          subtitle="Message your mentor and faculty about the work in progress."
          crumbs={[{ label: "Chat" }]}
        />
        <div className="glass-card">
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            message="A conversation opens automatically for each project — visit a project's Chat tab to start one."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={MessageSquare}
        title="Chat"
        subtitle="One conversation per project, with your mentor and faculty."
        crumbs={[{ label: "Chat" }]}
      />

      <div className="glass-card chat-layout">
        {/* Conversation list */}
        <div
          className={showThreadOnMobile ? "chat-hide-mobile" : undefined}
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto" }}
        >
          {conversations.map((conversation) => {
            const isActive = conversation.id === activeId;
            const others = conversation.participants
              ?.map((p) => p.user?.name || p.student?.name)
              .filter((n) => n && n !== user.name);

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setActiveId(conversation.id);
                  setShowThreadOnMobile(true);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: isActive ? "rgba(124,58,237,0.1)" : "transparent",
                  borderLeft: `3px solid ${isActive ? "var(--purple-500)" : "transparent"}`,
                }}
              >
                <div
                  className="truncate"
                  style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--white)" }}
                >
                  {conversation.project?.title || "Project"}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: "0.7rem", color: "var(--purple-400)", marginTop: 1 }}
                >
                  {conversation.project?.subject?.name}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: "0.72rem", color: "var(--slate-500)", marginTop: 5 }}
                >
                  {conversation.lastMessage
                    ? `${conversation.lastMessage.sender?.name || "Someone"}: ${truncate(
                        conversation.lastMessage.body || "Sent an attachment",
                        38
                      )}`
                    : others?.length
                    ? `With ${others.slice(0, 2).join(", ")}`
                    : "No messages yet"}
                </div>
                {conversation.lastMessage && (
                  <div style={{ fontSize: "0.65rem", color: "var(--slate-600)", marginTop: 3 }}>
                    {timeAgo(conversation.lastMessage.sentAt)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Thread */}
        <div
          className={!showThreadOnMobile ? "chat-hide-mobile" : undefined}
          style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
        >
          <div
            style={{
              padding: "13px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="btn-icon-sm show-mobile-only"
              onClick={() => setShowThreadOnMobile(false)}
              aria-label="Back to conversations"
              style={{ color: "var(--slate-400)" }}
            >
              <ArrowLeft size={17} />
            </button>

            <div style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                {active?.project?.title || "Conversation"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
                {active?.participants?.length || 0} participants
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {loadingThread ? (
              <div style={{ margin: "auto" }}>
                <div className="spinner" />
              </div>
            ) : !messages.length ? (
              <EmptyState
                compact
                icon={MessageSquare}
                title="No messages yet"
                message="Say hello, or ask about the feedback on your last submission."
              />
            ) : (
              messages.map((message, i) => {
                const own = isOwn(message);
                const prev = messages[i - 1];
                const showDay = !prev || formatDate(prev.sentAt) !== formatDate(message.sentAt);

                return (
                  <div key={message.id}>
                    {showDay && (
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: "0.68rem",
                          color: "var(--slate-500)",
                          margin: "6px 0 12px",
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

                        <div
                          className={`chat-bubble ${own ? "chat-bubble-own" : "chat-bubble-other"}`}
                        >
                          {message.body && (
                            <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>
                          )}
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
                                background: own
                                  ? "rgba(255,255,255,0.15)"
                                  : "rgba(255,255,255,0.06)",
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
          </div>

          <form
            onSubmit={send}
            style={{ padding: "13px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
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
      </div>
    </>
  );
}
