import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * Title block with breadcrumbs and an action slot (spec §64).
 *
 * crumbs: [{ label, to? }] — the last entry renders as the current page.
 */
export default function PageHeader({ title, subtitle, crumbs = [], actions, icon: Icon }) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        {crumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={`${crumb.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {crumb.to && !isLast ? (
                    <Link to={crumb.to}>{crumb.label}</Link>
                  ) : (
                    <span className={isLast ? "crumb-current" : undefined} aria-current={isLast ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
                </span>
              );
            })}
          </nav>
        )}

        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {Icon && (
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.25)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={18} color="var(--purple-400)" />
            </span>
          )}
          {title}
        </h1>

        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>

      {actions && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>{actions}</div>
      )}
    </div>
  );
}
