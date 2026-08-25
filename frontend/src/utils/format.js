import { format, formatDistanceToNow, isValid, parseISO, differenceInCalendarDays } from "date-fns";

const toDate = (value) => {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
};

export function formatDate(value, pattern = "dd MMM yyyy") {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

export function formatDateTime(value) {
  const d = toDate(value);
  return d ? format(d, "dd MMM yyyy, h:mm a") : "—";
}

export function formatTime(value) {
  const d = toDate(value);
  return d ? format(d, "h:mm a") : "—";
}

/** "3 days ago" / "in 2 hours" — used in feeds and notification lists. */
export function timeAgo(value) {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "—";
}

/** Days until a deadline; negative means overdue. */
export function daysUntil(value) {
  const d = toDate(value);
  return d ? differenceInCalendarDays(d, new Date()) : null;
}

/** Human phrasing for a deadline, e.g. "Due tomorrow", "3 days overdue". */
export function deadlineLabel(value) {
  const days = daysUntil(value);
  if (days === null) return "No deadline";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

export function formatPercent(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "0%";
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatBytes(bytes) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Two-letter avatar initials from a person's name. */
export function initials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** ENUM_VALUE → "Enum Value" */
export function humanize(value = "") {
  return String(value)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function truncate(text = "", max = 80) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Time-of-day greeting for the student dashboard header (spec §65). */
export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/**
 * Expected progress at a given week — the baseline the USP compares against.
 * Linear across the configured duration (spec §41).
 */
export function expectedProgress(currentWeek, durationWeeks = 12) {
  if (!durationWeeks) return 0;
  return Math.min(100, Math.max(0, (currentWeek / durationWeeks) * 100));
}

/** Classify a project against its expected pace. */
export function riskLevel(actual, expected) {
  const gap = expected - actual;
  if (gap >= 30) return { level: "delayed", label: "Delayed", tone: "red" };
  if (gap >= 15) return { level: "at-risk", label: "At Risk", tone: "orange" };
  if (actual >= 100) return { level: "complete", label: "Complete", tone: "green" };
  return { level: "on-track", label: "On Track", tone: "green" };
}

/** Extract a readable message from an axios error. */
export function apiErrorMessage(error, fallback = "Something went wrong.") {
  const data = error?.response?.data;
  if (!data) return error?.message || fallback;
  if (data.details && typeof data.details === "object") {
    const first = Object.values(data.details)[0];
    if (first) return first;
  }
  return data.message || fallback;
}
