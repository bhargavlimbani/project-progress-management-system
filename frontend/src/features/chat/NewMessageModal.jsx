import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PenSquare, Loader2, Search, Users } from "lucide-react";
import { chatApi } from "../../services/index.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { apiErrorMessage, initials } from "../../utils/format.js";
import { Modal, EmptyState, SearchBar } from "../../components/ui/index.js";

const ROLE_TONE = {
  ADMIN: "purple",
  FACULTY: "blue",
  MENTOR: "green",
  STUDENT: "gray",
};

/**
 * Pick one person and open a direct conversation with them.
 *
 * The list comes from the server, which decides who the caller is allowed to
 * message — an admin sees everyone, while faculty, mentors and students only
 * see people they share a project with.
 */
export default function NewMessageModal({ open, onClose, onOpened }) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null);

  const debounced = useDebounce(query, 250);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);

    chatApi
      .contacts(debounced.trim() || undefined)
      .then(({ data }) => active && setGroups(data.groups || []))
      .catch((err) => active && toast.error(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [open, debounced]);

  const start = async (contact) => {
    setStarting(contact.id);
    try {
      const { data } = await chatApi.openDirect(contact.kind, contact.id);
      onOpened?.(data.id, contact);
      onClose?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setStarting(null);
    }
  };

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Message"
      subtitle="Choose a person to start a private one-to-one conversation."
      width={540}
    >
      <div style={{ marginBottom: 16 }}>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search by name, email, ID…"
          width="100%"
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto" }} />
        </div>
      ) : total === 0 ? (
        <EmptyState
          compact
          icon={Users}
          title={query ? "No one matches that search" : "No one to message yet"}
          message={
            query
              ? "Try a different name or ID."
              : "You can message people you share a project with. Once projects exist, they'll appear here."
          }
        />
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto", margin: "0 -4px" }}>
          {groups.map((group) => (
            <div key={group.key} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--slate-500)",
                  padding: "4px 8px 6px",
                }}
              >
                {group.label}
              </div>

              {group.items.map((contact) => (
                <button
                  key={`${contact.kind}-${contact.id}`}
                  type="button"
                  onClick={() => start(contact)}
                  disabled={starting !== null}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 11,
                    textAlign: "left",
                    background: "transparent",
                    transition: "background 150ms",
                    opacity: starting && starting !== contact.id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(124,58,237,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {contact.profilePhoto ? (
                    <img src={contact.profilePhoto} alt="" className="avatar" width={36} height={36} />
                  ) : (
                    <span
                      className="avatar-placeholder"
                      style={{ width: 36, height: 36, fontSize: "0.75rem" }}
                    >
                      {initials(contact.name)}
                    </span>
                  )}

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      className="truncate"
                      style={{
                        display: "block",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--white)",
                      }}
                    >
                      {contact.name}
                    </span>
                    <span
                      className="truncate"
                      style={{ display: "block", fontSize: "0.72rem", color: "var(--slate-500)" }}
                    >
                      {[contact.code, contact.subtitle].filter(Boolean).join(" · ")}
                    </span>
                  </span>

                  <span
                    className={`badge badge-${ROLE_TONE[contact.role] || "gray"}`}
                    style={{ fontSize: "0.58rem", padding: "2px 7px", flexShrink: 0 }}
                  >
                    {contact.role}
                  </span>

                  {starting === contact.id && (
                    <Loader2 size={15} className="spin" color="var(--purple-400)" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export { PenSquare };
