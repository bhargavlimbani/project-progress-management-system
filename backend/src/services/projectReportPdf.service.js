const PDFDocument = require("pdfkit");

/**
 * Generates an official, beautifully styled Academic Project Evaluation & Completion Report PDF.
 */
function generateProjectReportPdf(project, evaluation) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Academic Project Report - ${project.title}`,
          Author: "SAPMS - Academic Management System",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#0f172a"; // slate-900
      const accentColor = "#6366f1"; // indigo-500
      const mutedColor = "#64748b"; // slate-500
      const borderColor = "#e2e8f0"; // slate-200

      // ── Header ─────────────────────────────────────────────────────────────
      doc
        .rect(40, 40, 515, 75)
        .fillAndStroke("#f8fafc", borderColor);

      doc
        .fillColor(primaryColor)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("MARWADI UNIVERSITY", 55, 52, { align: "center", width: 485 });

      doc
        .fillColor(mutedColor)
        .fontSize(10)
        .font("Helvetica")
        .text("FACULTY OF TECHNOLOGY • DEPARTMENT OF INFORMATION & COMMUNICATION TECHNOLOGY", 55, 74, {
          align: "center",
          width: 485,
        });

      doc
        .fillColor(accentColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("ACADEMIC PROJECT EVALUATION & COMPLETION REPORT", 55, 92, {
          align: "center",
          width: 485,
        });

      doc.moveDown(3);

      let y = 135;

      // ── Project Identity Block ─────────────────────────────────────────────
      doc.rect(40, y, 515, 80).fillAndStroke("#ffffff", borderColor);

      doc
        .fillColor(mutedColor)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("PROJECT TITLE", 55, y + 12);

      doc
        .fillColor(primaryColor)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text(project.title || "Untitled Project", 55, y + 24, { width: 485 });

      const subName = project.subject?.name ? `${project.subject.name} (${project.subject.code || ""})` : "General Capstone";
      const domainName = project.domain?.name || "Not Specified";
      const yearLabel = project.academicYear?.label || "Current Academic Year";

      doc
        .fillColor(mutedColor)
        .fontSize(8)
        .font("Helvetica")
        .text(`Subject: ${subName}`, 55, y + 54);

      doc.text(`Domain: ${domainName}`, 260, y + 54);
      doc.text(`Academic Year: ${yearLabel}`, 400, y + 54);

      y += 95;

      // ── Team Members Table ─────────────────────────────────────────────────
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("1. Team Members & Leadership", 40, y);

      y += 18;

      // Table Header
      doc.rect(40, y, 515, 22).fillAndStroke("#f1f5f9", borderColor);
      doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("SR.", 50, y + 6);
      doc.text("ENROLLMENT NO.", 80, y + 6);
      doc.text("STUDENT FULL NAME", 200, y + 6);
      doc.text("ROLE", 390, y + 6);
      doc.text("CONTACT / EMAIL", 450, y + 6);

      y += 22;

      const members = project.members || [];
      if (!members.length) {
        doc.rect(40, y, 515, 22).stroke(borderColor);
        doc.fillColor(mutedColor).font("Helvetica").text("No team members recorded", 50, y + 6);
        y += 22;
      } else {
        members.forEach((m, idx) => {
          doc.rect(40, y, 515, 22).stroke(borderColor);
          doc.fillColor(primaryColor).fontSize(8).font("Helvetica");
          doc.text(String(idx + 1), 50, y + 6);
          doc.text(m.student?.enrollmentNumber || "—", 80, y + 6);
          doc.font("Helvetica-Bold").text(m.student?.name || "—", 200, y + 6, { width: 180, lineBreak: false });
          doc.font("Helvetica").text(m.isLead ? "Team Lead" : "Member", 390, y + 6);
          doc.fontSize(7).text(m.student?.email || "—", 450, y + 6, { width: 100, lineBreak: false });
          y += 22;
        });
      }

      y += 15;

      // ── Faculty & Mentorship ───────────────────────────────────────────────
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("2. Supervision & Mentorship", 40, y);

      y += 18;

      doc.rect(40, y, 250, 48).fillAndStroke("#ffffff", borderColor);
      doc.rect(305, y, 250, 48).fillAndStroke("#ffffff", borderColor);

      doc.fillColor(mutedColor).fontSize(8).font("Helvetica-Bold").text("INTERNAL FACULTY GUIDE", 50, y + 8);
      doc.fillColor(primaryColor).fontSize(10).text(project.faculty?.user?.name || "Not Assigned", 50, y + 20);
      doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text(project.faculty?.designation || "Faculty Member", 50, y + 33);

      doc.fillColor(mutedColor).fontSize(8).font("Helvetica-Bold").text("DESIGNATED MENTOR", 315, y + 8);
      doc.fillColor(primaryColor).fontSize(10).text(project.mentor?.user?.name || "Self-Directed / Unassigned", 315, y + 20);
      doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text(project.mentor?.expertise ? `Expertise: ${project.mentor.expertise}` : "Industry / Academic Mentor", 315, y + 33);

      y += 62;

      // ── Progress & Verification Summary ────────────────────────────────────
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("3. Progress & Deliverables Summary", 40, y);

      y += 18;

      doc.rect(40, y, 515, 42).fillAndStroke("#f8fafc", borderColor);

      const progressVal = Math.round(project.progress || 0);
      const weekCount = project.weeklyProgress?.length || 0;
      const docCount = project.documents?.length || 0;

      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(`Overall Progress: ${progressVal}%`, 55, y + 10);
      doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text(`Current Phase: ${project.status?.replace(/_/g, " ")}`, 55, y + 24);

      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(`Weekly Submissions: ${weekCount}`, 230, y + 10);
      doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text(`Milestones Cleared: ${project.milestones?.filter(m => m.status === "APPROVED").length || 0}`, 230, y + 24);

      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(`Documents Uploaded: ${docCount}`, 400, y + 10);
      doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text(`SRS & Tech Docs Verified`, 400, y + 24);

      y += 56;

      // ── Evaluation & Grading (if evaluated) ─────────────────────────────────
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("4. Evaluation & Rubric Scores", 40, y);

      y += 18;

      const evalGrade = evaluation?.grade || "Pending Final Evaluation";
      const totalMarks = evaluation?.totalMarks != null ? evaluation.totalMarks : "—";
      const remarks = evaluation?.facultyRemarks || "All deliverables reviewed according to ICT rubrics.";

      doc.rect(40, y, 515, 60).fillAndStroke("#ffffff", borderColor);
      doc.fillColor(mutedColor).fontSize(8).font("Helvetica-Bold").text("FINAL GRADE", 55, y + 10);
      doc.fillColor(accentColor).fontSize(18).font("Helvetica-Bold").text(evalGrade, 55, y + 22);

      doc.fillColor(mutedColor).fontSize(8).font("Helvetica-Bold").text("TOTAL MARKS AWARDED", 180, y + 10);
      doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text(String(totalMarks), 180, y + 24);

      doc.fillColor(mutedColor).fontSize(8).font("Helvetica-Bold").text("FACULTY REMARKS & RECOMMENDATIONS", 310, y + 10);
      doc.fillColor(primaryColor).fontSize(8).font("Helvetica").text(remarks, 310, y + 24, { width: 235 });

      y += 85;

      // ── Formal Signatures ──────────────────────────────────────────────────
      doc.rect(40, y, 515, 75).fillAndStroke("#f8fafc", borderColor);

      doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold");

      doc.text("___________________________________", 55, y + 42);
      doc.text("Faculty Guide Signature", 55, y + 54);

      doc.text("___________________________________", 230, y + 42);
      doc.text("Project Coordinator / Mentor", 230, y + 54);

      doc.text("___________________________________", 400, y + 42);
      doc.text("Head of Department (HOD)", 400, y + 54);

      // Footer
      doc
        .fillColor(mutedColor)
        .fontSize(7)
        .font("Helvetica")
        .text(
          `Generated automatically by SAPMS on ${new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })} • Reference ID: ${project.id.slice(0, 8).toUpperCase()}`,
          40,
          780,
          { align: "center", width: 515 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateProjectReportPdf,
};
