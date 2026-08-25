/**
 * Shared vocabulary for the UI: how each backend enum is labelled, coloured
 * and grouped. Keeping this in one place means a status renders identically
 * on a dashboard card, a table row and a project header.
 */

export const ROLES = {
  ADMIN: "ADMIN",
  FACULTY: "FACULTY",
  MENTOR: "MENTOR",
  STUDENT: "STUDENT",
};

export const ROLE_HOME = {
  ADMIN: "/admin",
  FACULTY: "/faculty",
  MENTOR: "/mentor",
  STUDENT: "/student",
};

/** Project lifecycle (spec §55). `tone` maps to the .badge-* CSS classes. */
export const PROJECT_STATUS = {
  DRAFT: { label: "Draft", tone: "gray" },
  IDEA_SUBMITTED: { label: "Idea Submitted", tone: "blue" },
  FACULTY_REVIEW: { label: "Faculty Review", tone: "blue" },
  CHANGES_REQUIRED: { label: "Changes Required", tone: "orange" },
  APPROVED: { label: "Approved", tone: "green" },
  MENTOR_ASSIGNED: { label: "Mentor Assigned", tone: "purple" },
  PROBLEM_STATEMENT_PENDING: { label: "Problem Statement Pending", tone: "yellow" },
  SRS_PENDING: { label: "SRS Pending", tone: "yellow" },
  SRS_APPROVED: { label: "SRS Approved", tone: "green" },
  IN_PROGRESS: { label: "In Progress", tone: "blue" },
  AT_RISK: { label: "At Risk", tone: "orange" },
  DELAYED: { label: "Delayed", tone: "red" },
  FINAL_REVIEW: { label: "Final Review", tone: "purple" },
  PRESENTATION_SCHEDULED: { label: "Presentation Scheduled", tone: "purple" },
  COMPLETED: { label: "Completed", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  ARCHIVED: { label: "Archived", tone: "gray" },
};

export const REVIEW_STATUS = {
  PENDING: { label: "Pending", tone: "yellow" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  CHANGES_REQUIRED: { label: "Changes Required", tone: "orange" },
};

export const IDEA_STATUS = REVIEW_STATUS;

export const DOCUMENT_TYPES = {
  PROJECT_PROPOSAL: "Project Proposal",
  PROBLEM_STATEMENT: "Problem Statement",
  SRS: "SRS",
  UML: "UML Diagrams",
  DFD: "DFD",
  ER_DIAGRAM: "ER Diagram",
  ARCHITECTURE: "Architecture",
  PPT: "Presentation Deck",
  FINAL_REPORT: "Final Report",
  SOURCE_CODE: "Source Code",
  APK: "APK Build",
  DEMO_VIDEO: "Demo Video",
  OTHER: "Other",
};

/** Sections a complete SRS is expected to contain (spec §33). */
export const SRS_SECTIONS = [
  "Introduction",
  "Problem Statement",
  "Objectives",
  "Scope",
  "Functional Requirements",
  "Non-functional Requirements",
  "User Requirements",
  "System Requirements",
  "Use Cases",
  "DFD",
  "ER Diagram",
  "Architecture",
  "Technology Stack",
];

export const MEETING_TYPES = {
  IN_PERSON: "In Person",
  ONLINE: "Online",
  HYBRID: "Hybrid",
};

export const PRESENTATION_TYPES = {
  INTERNAL: "Internal Review",
  EXTERNAL: "External Review",
  VIVA: "Viva",
  DEMO: "Demo",
  FINAL: "Final Presentation",
};

export const NOTIFICATION_TONE = {
  IDEA_APPROVED: "green",
  IDEA_REJECTED: "red",
  IDEA_CHANGES_REQUIRED: "orange",
  MENTOR_ASSIGNED: "purple",
  DOCUMENT_APPROVED: "green",
  DOCUMENT_REJECTED: "red",
  DOCUMENT_CHANGES_REQUIRED: "orange",
  WEEKLY_PROGRESS_APPROVED: "green",
  WEEKLY_PROGRESS_REJECTED: "red",
  WEEKLY_PROGRESS_REMINDER: "yellow",
  DEADLINE_APPROACHING: "yellow",
  PROJECT_AT_RISK: "orange",
  PROJECT_DELAYED: "red",
  MEETING_SCHEDULED: "blue",
  PRESENTATION_SCHEDULED: "purple",
  MARKS_PUBLISHED: "green",
  GENERAL: "gray",
};

/**
 * Default 12-week plan offered when seeding a subject's milestone template
 * (spec §35). Durations are configurable — this is a starting point, not a
 * hard-coded schedule.
 */
export const DEFAULT_MILESTONE_TEMPLATE = [
  { weekNumber: 1, title: "Project Idea", weight: 5 },
  { weekNumber: 2, title: "Problem Statement", weight: 5 },
  { weekNumber: 3, title: "SRS", weight: 10 },
  { weekNumber: 4, title: "System Design", weight: 10 },
  { weekNumber: 5, title: "Database", weight: 8 },
  { weekNumber: 6, title: "Frontend", weight: 12 },
  { weekNumber: 7, title: "Backend", weight: 12 },
  { weekNumber: 8, title: "Integration", weight: 8 },
  { weekNumber: 9, title: "Testing", weight: 8 },
  { weekNumber: 10, title: "Bug Fixing", weight: 7 },
  { weekNumber: 11, title: "Documentation", weight: 8 },
  { weekNumber: 12, title: "Final Presentation", weight: 7 },
];

/** Default marking scheme offered when configuring a subject (spec §50). */
export const DEFAULT_EVALUATION_CRITERIA = [
  { name: "Innovation", maxMarks: 10 },
  { name: "Implementation", maxMarks: 25 },
  { name: "Documentation", maxMarks: 15 },
  { name: "Testing", maxMarks: 10 },
  { name: "Presentation", maxMarks: 15 },
  { name: "Viva", maxMarks: 15 },
  { name: "Mentor Evaluation", maxMarks: 10 },
];

/** Chart palette — matches the design tokens in index.css. */
export const CHART_COLORS = [
  "#7c3aed", "#3b82f6", "#22c55e", "#f97316",
  "#eab308", "#ec4899", "#06b6d4", "#a78bfa",
  "#14b8a6", "#f43f5e",
];

export const STATUS_TONE_HEX = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#7c3aed",
  gray: "#94a3b8",
};
