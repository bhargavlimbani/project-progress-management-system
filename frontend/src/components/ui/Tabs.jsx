/**
 * Horizontal tab strip. Scrolls rather than wrapping on narrow screens so the
 * nine project-detail tabs stay reachable on a phone.
 *
 * tabs: [{ key, label, icon?, badge? }]
 */
export default function Tabs({ tabs = [], active, onChange }) {
  return (
    <div className="tabs" role="tablist" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-btn ${isActive ? "active" : ""}`}
            onClick={() => onChange?.(tab.key)}
            style={{ flexShrink: 0 }}
          >
            {Icon && <Icon size={15} />}
            {tab.label}
            {tab.badge > 0 && (
              <span
                style={{
                  background: isActive ? "var(--purple-500)" : "rgba(255,255,255,0.1)",
                  color: isActive ? "#fff" : "var(--slate-400)",
                  borderRadius: 99,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  padding: "1px 6px",
                  marginLeft: 2,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
