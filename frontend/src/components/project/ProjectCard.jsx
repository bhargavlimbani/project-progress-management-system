import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Layers, User, UserCheck, Calendar, ArrowRight, Flag,
} from "lucide-react";
import StatusBadge from "../ui/StatusBadge.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";
import { expectedProgress, riskLevel, formatPercent } from "../../utils/format.js";

/**
 * Project summary card (spec §28). Shows subject, title, domain, faculty,
 * mentor, progress, current week, status and the next milestone — plus the
 * expected-vs-actual comparison that makes a slipping project obvious.
 */
export default function ProjectCard({ project, basePath = "/projects", index = 0 }) {
  const durationWeeks = project.subject?.durationWeeks || 12;
  const expected = expectedProgress(project.currentWeek, durationWeeks);
  const risk = riskLevel(project.progress, expected);

  const nextMilestone = project.milestones
    ?.filter((m) => m.status !== "APPROVED")
    .sort((a, b) => a.weekNumber - b.weekNumber)[0];

  const facultyName = project.faculty?.user?.name;
  const mentorName = project.mentor?.user?.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      className="glass-card glass-card-hover"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Subject + status */}
      <div className="flex items-start justify-between gap-3">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "var(--purple-400)",
            background: "rgba(124,58,237,0.12)",
            border: "1px solid rgba(124,58,237,0.2)",
            padding: "4px 10px",
            borderRadius: 99,
            maxWidth: "70%",
          }}
        >
          <BookOpen size={11} style={{ flexShrink: 0 }} />
          <span className="truncate">{project.subject?.name || "Unassigned subject"}</span>
        </span>

        <StatusBadge status={project.status} size="sm" />
      </div>

      {/* Title + domain */}
      <div>
        <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>
          {project.title}
        </h3>
        {project.domain?.name && (
          <span
            className="flex items-center gap-1"
            style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}
          >
            <Layers size={12} />
            {project.domain.name}
          </span>
        )}
      </div>

      {/* People */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="flex items-center gap-2" style={{ fontSize: "0.75rem" }}>
          <User size={12} color="var(--slate-500)" style={{ flexShrink: 0 }} />
          <span style={{ color: "var(--slate-500)" }}>Faculty</span>
          <span className="truncate" style={{ color: "var(--slate-200)", fontWeight: 500 }}>
            {facultyName || "—"}
          </span>
        </div>
        <div className="flex items-center gap-2" style={{ fontSize: "0.75rem" }}>
          <UserCheck size={12} color="var(--slate-500)" style={{ flexShrink: 0 }} />
          <span style={{ color: "var(--slate-500)" }}>Mentor</span>
          <span
            className="truncate"
            style={{
              color: mentorName ? "var(--slate-200)" : "var(--yellow-400)",
              fontWeight: 500,
            }}
          >
            {mentorName || "Not yet assigned"}
          </span>
        </div>
      </div>

      {/* Progress vs expected */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 7,
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--slate-400)", fontWeight: 500 }}>
            Progress
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--white)" }}>
              {formatPercent(project.progress)}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
              of {formatPercent(expected)} expected
            </span>
          </span>
        </div>

        <ProgressBar value={project.progress} expected={expected} height={7} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <span
            className="flex items-center gap-1"
            style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}
          >
            <Calendar size={11} />
            Week {project.currentWeek} of {durationWeeks}
          </span>
          <span className={`badge badge-${risk.tone}`} style={{ fontSize: "0.6rem", padding: "2px 8px" }}>
            {risk.label}
          </span>
        </div>
      </div>

      {/* Next milestone */}
      {nextMilestone && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 12px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Flag size={13} color="var(--purple-400)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.65rem", color: "var(--slate-500)", fontWeight: 600 }}>
              Next milestone
            </div>
            <div
              className="truncate"
              style={{ fontSize: "0.75rem", color: "var(--slate-200)", fontWeight: 600 }}
            >
              Week {nextMilestone.weekNumber} · {nextMilestone.title}
            </div>
          </div>
        </div>
      )}

      <Link
        to={`${basePath}/${project.id}`}
        className="btn btn-primary btn-sm"
        style={{ justifyContent: "center", marginTop: "auto" }}
      >
        View Project
        <ArrowRight size={14} />
      </Link>
    </motion.div>
  );
}
