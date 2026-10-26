import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { subjectApi, attendanceApi, settingApi } from "../../services/index.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import toast from "react-hot-toast";
import {
  UserCheck,
  Calendar,
  BookOpen,
  CheckCircle2,
  XCircle,
  Save,
  BarChart2,
  Users,
  ShieldAlert,
  Search,
} from "lucide-react";

export default function Attendance() {
  const { user } = useAuth();
  const isAdminOrFaculty = user?.role === "ADMIN" || user?.role === "FACULTY";

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("mark"); // "mark" | "summary"
  const [settings, setSettings] = useState({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // { [studentId]: { isPresent: boolean, remarks: string } }
  const [summaryList, setSummaryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Load institutional settings & subjects
  useEffect(() => {
    async function init() {
      try {
        const [subRes, setRes] = await Promise.all([
          subjectApi.getAll({ limit: 100 }),
          settingApi.getAll().catch(() => ({ data: {} })),
        ]);
        const subList = subRes.data?.subjects || subRes.data || [];
        setSubjects(subList);
        setSettings(setRes.data || {});

        if (subList.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(subList[0].id);
        }
      } catch (err) {
        toast.error("Failed to load initial attendance data.");
      }
    }
    init();
  }, []);

  // When subject or date changes, load attendance data
  useEffect(() => {
    if (!selectedSubjectId) return;

    if (activeTab === "mark") {
      loadMarkingSheet();
    } else {
      loadSummary();
    }
  }, [selectedSubjectId, selectedDate, activeTab]);

  async function loadMarkingSheet() {
    setLoading(true);
    try {
      const [stuRes, attRes] = await Promise.all([
        attendanceApi.getStudents(selectedSubjectId),
        attendanceApi.get({ subjectId: selectedSubjectId, date: selectedDate }),
      ]);

      const stuList = stuRes.data || [];
      const records = attRes.data || [];

      setStudents(stuList);

      // Build map from existing records or default to present: true
      const existingMap = {};
      for (const rec of records) {
        existingMap[rec.studentId] = {
          isPresent: rec.isPresent,
          remarks: rec.remarks || "",
        };
      }

      const initialMap = {};
      for (const s of stuList) {
        if (existingMap[s.id]) {
          initialMap[s.id] = existingMap[s.id];
        } else {
          initialMap[s.id] = { isPresent: true, remarks: "" };
        }
      }
      setAttendanceMap(initialMap);
    } catch (err) {
      toast.error("Could not load subject students.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    setLoading(true);
    try {
      const res = await attendanceApi.summary(selectedSubjectId);
      setSummaryList(res.data || []);
    } catch (err) {
      toast.error("Could not load attendance summary.");
    } finally {
      setLoading(false);
    }
  }

  function toggleAttendance(studentId) {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        isPresent: !prev[studentId]?.isPresent,
      },
    }));
  }

  function handleRemarksChange(studentId, remarks) {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks,
      },
    }));
  }

  function markAll(status) {
    setAttendanceMap((prev) => {
      const updated = { ...prev };
      for (const id of Object.keys(updated)) {
        updated[id] = { ...updated[id], isPresent: status };
      }
      return updated;
    });
  }

  async function handleSaveAttendance() {
    if (!selectedSubjectId) {
      toast.error("Please select a subject.");
      return;
    }
    setSaving(true);
    try {
      const records = Object.entries(attendanceMap).map(([studentId, data]) => ({
        studentId,
        isPresent: data.isPresent,
        remarks: data.remarks || null,
      }));

      await attendanceApi.record({
        subjectId: selectedSubjectId,
        date: selectedDate,
        records,
      });

      toast.success(`Attendance saved for ${records.length} students.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  const attendanceEnabled = settings.ATTENDANCE_ENABLED === "true";
  const minPercentage = parseInt(settings.ATTENDANCE_MIN_PERCENTAGE || "75", 10);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.enrollmentNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStudents = students.length;
  const presentCount = Object.values(attendanceMap).filter((a) => a.isPresent).length;
  const absentCount = totalStudents - presentCount;
  const dailyRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60 }}>
      <PageHeader
        title="Attendance Management"
        subtitle="Record daily session attendance and monitor student eligibility."
      />

      {/* Institutional Status Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderRadius: "10px",
          background: attendanceEnabled ? "rgba(59, 130, 246, 0.1)" : "rgba(100, 116, 139, 0.1)",
          border: `1px solid ${attendanceEnabled ? "rgba(59, 130, 246, 0.25)" : "rgba(100, 116, 139, 0.2)"}`,
          marginBottom: 20,
        }}
      >
        <ShieldAlert size={20} color={attendanceEnabled ? "var(--primary)" : "var(--slate-400)"} />
        <div style={{ fontSize: "0.875rem" }}>
          <span style={{ fontWeight: 600, color: "#fff" }}>
            Institutional Policy Status: {attendanceEnabled ? "ENABLED" : "OPTIONAL / DISABLED (Default)"}
          </span>
          <span style={{ color: "var(--slate-400)", marginLeft: 8 }}>
            {attendanceEnabled
              ? `Idea submission requirement is enforced at ${minPercentage}% minimum attendance.`
              : "Attendance is not currently required for idea submissions. Configure anytime in Settings and this is optional."}
          </span>
        </div>
      </div>

      {/* Controls Bar: Subject Selector, Date, & Tabs */}
      <div
        style={{
          background: "var(--navy-900)",
          border: "1px solid var(--navy-700)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          {/* Subject Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={18} color="var(--slate-400)" />
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="form-input"
              style={{ minWidth: 240, background: "var(--navy-800)", color: "#fff" }}
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker (Marking Tab Only) */}
          {activeTab === "mark" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={18} color="var(--slate-400)" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-input"
                style={{ background: "var(--navy-800)", color: "#fff" }}
              />
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab("mark")}
            className={`btn ${activeTab === "mark" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}
          >
            <UserCheck size={16} /> Mark Roll-Call
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`btn ${activeTab === "summary" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}
          >
            <BarChart2 size={16} /> Attendance Summary
          </button>
        </div>
      </div>

      {activeTab === "mark" ? (
        <div>
          {/* Day Stats Ribbon & Action Controls */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div className="card" style={{ padding: "14px 18px", background: "var(--navy-900)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--slate-400)", textTransform: "uppercase" }}>
                Total Students
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginTop: 4 }}>
                {totalStudents}
              </div>
            </div>
            <div className="card" style={{ padding: "14px 18px", background: "var(--navy-900)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--slate-400)", textTransform: "uppercase" }}>
                Present
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#22c55e", marginTop: 4 }}>
                {presentCount}
              </div>
            </div>
            <div className="card" style={{ padding: "14px 18px", background: "var(--navy-900)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--slate-400)", textTransform: "uppercase" }}>
                Absent
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef4444", marginTop: 4 }}>
                {absentCount}
              </div>
            </div>
            <div className="card" style={{ padding: "14px 18px", background: "var(--navy-900)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--slate-400)", textTransform: "uppercase" }}>
                Day Attendance Rate
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--primary)", marginTop: 4 }}>
                {dailyRate}%
              </div>
            </div>
          </div>

          {/* Quick Actions & Search */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => markAll(true)}
                className="btn btn-secondary"
                style={{ fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: 6 }}
              >
                <CheckCircle2 size={15} color="#22c55e" /> Mark All Present
              </button>
              <button
                type="button"
                onClick={() => markAll(false)}
                className="btn btn-secondary"
                style={{ fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: 6 }}
              >
                <XCircle size={15} color="#ef4444" /> Mark All Absent
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={16}
                  color="var(--slate-400)"
                  style={{ position: "absolute", left: 10, top: 10 }}
                />
                <input
                  type="text"
                  placeholder="Filter student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 32, width: 220, fontSize: "0.875rem" }}
                />
              </div>

              {isAdminOrFaculty && (
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={saving || loading || students.length === 0}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Attendance"}
                </button>
              )}
            </div>
          </div>

          {/* Roll Call Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--navy-900)" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--slate-400)" }}>
                Loading students for this subject...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--slate-400)" }}>
                No active students found for this subject semester.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Roll / Enroll No</th>
                      <th>Student Name</th>
                      <th style={{ width: 160, textAlign: "center" }}>Status</th>
                      <th>Remarks (Optional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => {
                      const att = attendanceMap[s.id] || { isPresent: true, remarks: "" };
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600, color: "var(--slate-300)" }}>
                            {s.enrollmentNumber}
                          </td>
                          <td style={{ fontWeight: 500, color: "#fff" }}>
                            {s.name}
                            <div style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>{s.email}</div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => toggleAttendance(s.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 14px",
                                borderRadius: 20,
                                fontWeight: 600,
                                fontSize: "0.8125rem",
                                cursor: "pointer",
                                border: "none",
                                background: att.isPresent
                                  ? "rgba(34, 197, 94, 0.15)"
                                  : "rgba(239, 68, 68, 0.15)",
                                color: att.isPresent ? "#22c55e" : "#ef4444",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {att.isPresent ? (
                                <>
                                  <CheckCircle2 size={15} /> Present
                                </>
                              ) : (
                                <>
                                  <XCircle size={15} /> Absent
                                </>
                              )}
                            </button>
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="e.g. Leave, Medical, Excused..."
                              value={att.remarks || ""}
                              onChange={(e) => handleRemarksChange(s.id, e.target.value)}
                              className="form-input"
                              style={{ fontSize: "0.8125rem", height: 32 }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Attendance Summary Tab */
        <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--navy-900)" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--slate-400)" }}>
              Loading cumulative attendance summary...
            </div>
          ) : summaryList.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--slate-400)" }}>
              No attendance records recorded yet for this subject.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>Enrollment No</th>
                    <th>Student Name</th>
                    <th style={{ textAlign: "center" }}>Total Sessions</th>
                    <th style={{ textAlign: "center" }}>Attended</th>
                    <th>Attendance %</th>
                    <th style={{ textAlign: "center" }}>Idea Submission Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryList.map((item) => {
                    const pct = item.percentage;
                    const isEligible = !attendanceEnabled || pct >= minPercentage;
                    const barColor = pct >= 75 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";

                    return (
                      <tr key={item.student.id}>
                        <td style={{ fontWeight: 600, color: "var(--slate-300)" }}>
                          {item.student.enrollmentNumber}
                        </td>
                        <td style={{ fontWeight: 500, color: "#fff" }}>{item.student.name}</td>
                        <td style={{ textAlign: "center" }}>{item.totalSessions}</td>
                        <td style={{ textAlign: "center", color: "#22c55e", fontWeight: 600 }}>
                          {item.presentSessions}
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 8,
                                background: "var(--navy-700)",
                                borderRadius: 4,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  height: "100%",
                                  background: barColor,
                                  borderRadius: 4,
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: barColor }}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: isEligible
                                ? "rgba(34, 197, 94, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                              color: isEligible ? "#22c55e" : "#ef4444",
                            }}
                          >
                            {isEligible ? "Eligible" : `Below ${minPercentage}% (Blocked)`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
