import { useMemo } from "react";
import { MessageSquareQuote, Lightbulb, TrendingUp, FileText } from "lucide-react";
import { formatDateTime } from "../../utils/format.js";
import { DOCUMENT_TYPES } from "../../utils/constants.js";
import { EmptyState, StatusBadge } from "../../components/ui/index.js";

/**
 * Every piece of feedback the project has received, in one place — idea
 * reviews, weekly progress reviews and document reviews, newest first.
 */
export default function FeedbackTab({ project }) {
  const feedback = useMemo(() => {
    const items = [];

    (project.idea?.reviews || []).forEach((review) => {
      items.push({
        id: `idea-${review.id}`,
        kind: "Project Idea",
        icon: Lightbulb,
        context: project.idea.title,
        status: review.status,
        text: review.comments,
        author:
          review.reviewer?.user?.name ||
          review.mentorReviewer?.user?.name ||
          "Reviewer",
        role: review.mentorReviewerId ? "Mentor" : "Faculty",
        at: review.reviewedAt,
      });
    });

    (project.weeklyProgress || []).forEach((entry) => {
      (entry.reviews || []).forEach((review) => {
        items.push({
          id: `progress-${review.id}`,
          kind: `Week ${entry.weekNumber} Progress`,
          icon: TrendingUp,
          context: entry.taskTitle,
          status: review.status,
          text: review.feedback,
          author:
            review.mentor?.user?.name || review.faculty?.user?.name || "Reviewer",
          role: review.mentorId ? "Mentor" : "Faculty",
          at: review.reviewedAt,
        });
      });
    });

    (project.documents || []).forEach((doc) => {
      (doc.versions || []).forEach((version) => {
        if (!version.comments) return;
        items.push({
          id: `doc-${version.id}`,
          kind: `${DOCUMENT_TYPES[doc.type] || doc.type} v${version.version}`,
          icon: FileText,
          context: version.fileName,
          status: version.status,
          text: version.comments,
          author:
            version.faculty?.user?.name || version.mentor?.user?.name || "Reviewer",
          role: version.facultyId ? "Faculty" : "Mentor",
          at: version.reviewedAt || version.uploadedAt,
        });
      });
    });

    return items
      .filter((item) => item.text)
      .sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [project]);

  if (!feedback.length) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={MessageSquareQuote}
          title="No feedback yet"
          message="Comments from idea reviews, weekly progress reviews and document reviews all collect here."
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {feedback.map((item) => {
        const Icon = item.icon;
        const accent =
          item.status === "APPROVED"
            ? "var(--green-500)"
            : item.status === "REJECTED"
            ? "var(--red-500)"
            : "var(--orange-500)";

        return (
          <div
            key={item.id}
            className="glass-card"
            style={{ padding: 20, borderLeft: `3px solid ${accent}` }}
          >
            <div
              className="flex items-start justify-between gap-3 mb-3"
              style={{ flexWrap: "wrap" }}
            >
              <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} color="var(--purple-400)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>{item.kind}</div>
                  <div className="truncate" style={{ fontSize: "0.72rem", color: "var(--slate-500)" }}>
                    {item.context}
                  </div>
                </div>
              </div>

              <StatusBadge status={item.status} size="sm" />
            </div>

            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--slate-200)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {item.text}
            </p>

            <div
              style={{
                marginTop: 12,
                fontSize: "0.72rem",
                color: "var(--slate-500)",
              }}
            >
              — {item.author} · {item.role} · {formatDateTime(item.at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
