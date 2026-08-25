import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, FolderKanban, GraduationCap, BookOpen, User, UserCheck, Layers, Loader2,
} from "lucide-react";
import { searchApi } from "../../services/index.js";
import { useDebounce } from "../../hooks/useDebounce.js";

const GROUP_ICONS = {
  project: FolderKanban,
  student: GraduationCap,
  subject: BookOpen,
  faculty: User,
  mentor: UserCheck,
  domain: Layers,
};

/**
 * Navbar search across students, projects, subjects, faculty, mentors and
 * domains (spec §58). Results are scoped server-side to the caller's role.
 */
export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounced = useDebounce(query, 300);

  // Flat list for keyboard navigation across groups.
  const flat = groups.flatMap((g) => g.items.map((item) => ({ ...item, type: g.type })));

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchApi
      .global(debounced.trim())
      .then(({ data }) => {
        if (!cancelled) {
          setGroups(data.groups || []);
          setHighlight(0);
        }
      })
      .catch(() => !cancelled && setGroups([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Ctrl/Cmd+K to focus, Escape to dismiss, outside click to close.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const go = (item) => {
    setOpen(false);
    setQuery("");
    setGroups([]);
    if (item?.link) navigate(item.link);
  };

  const onInputKeyDown = (e) => {
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[highlight]);
    }
  };

  let runningIndex = -1;

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, maxWidth: 440 }}>
      <div style={{ position: "relative" }}>
        <Search
          size={16}
          style={{
            position: "absolute",
            left: 13,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--slate-500)",
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          className="form-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search students, projects, subjects…"
          aria-label="Global search"
          style={{ paddingLeft: 38, paddingRight: 52 }}
        />
        <kbd
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.62rem",
            fontWeight: 700,
            color: "var(--slate-500)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 5,
            padding: "2px 6px",
            pointerEvents: "none",
          }}
        >
          ⌘K
        </kbd>
      </div>

      <AnimatePresence>
        {open && query.trim().length >= 2 && (
          <motion.div
            className="dropdown"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            style={{ left: 0, right: 0, minWidth: 0, maxHeight: 460, overflowY: "auto" }}
          >
            {loading ? (
              <div
                style={{
                  padding: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "var(--slate-400)",
                  fontSize: "0.8125rem",
                }}
              >
                <Loader2 size={15} className="spin" />
                Searching…
              </div>
            ) : !groups.length ? (
              <div
                style={{
                  padding: 22,
                  textAlign: "center",
                  color: "var(--slate-500)",
                  fontSize: "0.8125rem",
                }}
              >
                No matches for “{query}”.
              </div>
            ) : (
              groups.map((group) => {
                const Icon = GROUP_ICONS[group.type] || Search;
                return (
                  <div key={group.type}>
                    <div
                      style={{
                        padding: "9px 14px 5px",
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--slate-500)",
                      }}
                    >
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      runningIndex += 1;
                      const isActive = runningIndex === highlight;
                      return (
                        <button
                          key={`${group.type}-${item.id}`}
                          type="button"
                          onClick={() => go(item)}
                          onMouseEnter={() => setHighlight(runningIndex)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            display: "flex",
                            alignItems: "center",
                            gap: 11,
                            padding: "10px 14px",
                            background: isActive ? "rgba(124,58,237,0.12)" : "transparent",
                          }}
                        >
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: "rgba(255,255,255,0.05)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={14} color="var(--purple-400)" />
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span
                              className="truncate"
                              style={{
                                display: "block",
                                fontSize: "0.8125rem",
                                fontWeight: 600,
                                color: "var(--white)",
                              }}
                            >
                              {item.title}
                            </span>
                            <span
                              className="truncate"
                              style={{
                                display: "block",
                                fontSize: "0.7rem",
                                color: "var(--slate-500)",
                              }}
                            >
                              {[item.subtitle, item.meta].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
