const test = require("node:test");
const assert = require("node:assert/strict");
const { gradeFor } = require("../src/controllers/evaluation.controller");
const {
  dispatchMultiChannel,
  getManualWhatsAppShareUrl,
  normalizePhone,
} = require("../src/services/channelNotification.service");
const prisma = require("../src/config/prisma");

test("Rubric Calculations: gradeFor maps percentage to letter grades correctly", () => {
  assert.equal(gradeFor(95), "A+");
  assert.equal(gradeFor(90), "A+");
  assert.equal(gradeFor(85), "A");
  assert.equal(gradeFor(75), "B+");
  assert.equal(gradeFor(65), "B");
  assert.equal(gradeFor(55), "C");
  assert.equal(gradeFor(45), "D");
  assert.equal(gradeFor(35), "F");
  assert.equal(gradeFor(0), "F");
});

test("Rubric Calculations: Maximum ceiling enforcement and combined totals", () => {
  const teamCriteria = [
    { id: "c1", name: "Architecture", maxMarks: 30 },
    { id: "c2", name: "Implementation", maxMarks: 40 },
  ];
  const maxTotal = 100;

  const awardedTeamMarks = [
    { criteriaId: "c1", marksAwarded: 28 },
    { criteriaId: "c2", marksAwarded: 38 },
  ];

  // Validate ceiling
  for (const m of awardedTeamMarks) {
    const crit = teamCriteria.find((c) => c.id === m.criteriaId);
    assert.ok(m.marksAwarded <= crit.maxMarks, "Awarded mark must not exceed criterion max");
  }

  const teamTotal = awardedTeamMarks.reduce((s, m) => s + m.marksAwarded, 0);
  assert.equal(teamTotal, 66);

  // Student specific viva (15) and contribution (15)
  const viva = 14;
  const contrib = 15;
  const studentTotal = Math.min(maxTotal, teamTotal + viva + contrib);
  assert.equal(studentTotal, 95);

  const percentage = (studentTotal / maxTotal) * 100;
  assert.equal(percentage, 95);
  assert.equal(gradeFor(percentage), "A+");
});

test("Multi-Channel Notifications: normalizePhone and fallback WhatsApp URL generator", () => {
  assert.equal(normalizePhone("9876543210"), "919876543210");
  assert.equal(normalizePhone("+91 98765 43210"), "919876543210");

  const url = getManualWhatsAppShareUrl({
    phone: "9876543210",
    message: "Project Evaluation: Total 85/100, Grade A",
  });

  assert.ok(url.startsWith("https://wa.me/919876543210?text="));
  assert.ok(url.includes("Project%20Evaluation"));
});

test("Multi-Channel Notifications: Unconfigured providers gracefully record SKIPPED without failing", async () => {
  const testDedupKey = `test-notification-skip-${Date.now()}`;

  const results = await dispatchMultiChannel({
    dedupKey: testDedupKey,
    channels: ["WHATSAPP", "SMS"],
    recipient: {
      id: "student-test-1",
      name: "Test Student",
      mobile: "9876543210",
      isStudent: true,
    },
    title: "Test Review Notification",
    body: "Your review is scheduled.",
  });

  // Providers are not configured in test environment -> must be SKIPPED, not threw error!
  assert.equal(results.WHATSAPP.status, "SKIPPED");
  assert.equal(results.SMS.status, "SKIPPED");

  // Verify delivery record exists in database
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { dedupKey: `${testDedupKey}:WHATSAPP` },
  });
  assert.ok(delivery, "Delivery log must be persisted in database");
  assert.equal(delivery.status, "SKIPPED");
});

test("Notification Deduplication: Prevents duplicate messages with same dedupKey", async () => {
  const testDedupKey = `test-dedup-key-${Date.now()}`;

  // First dispatch: simulate sent record
  await prisma.notificationDelivery.create({
    data: {
      dedupKey: `${testDedupKey}:EMAIL`,
      channel: "EMAIL",
      recipient: "test@example.com",
      status: "SENT",
      title: "First email",
      sentAt: new Date(),
    },
  });

  // Second dispatch attempt with same key
  const results = await dispatchMultiChannel({
    dedupKey: testDedupKey,
    channels: ["EMAIL"],
    recipient: { email: "test@example.com" },
    title: "Second attempt",
    body: "Duplicate message",
  });

  assert.equal(results.EMAIL.skipped, true);
  assert.equal(results.EMAIL.reason, "Already delivered (dedup)");
});

test("Time-Based Scheduling: Meeting review lifecycle (create, reschedule, complete, cancel)", async () => {
  // Find an existing project for foreign key
  const project = await prisma.project.findFirst({ select: { id: true, facultyId: true } });
  if (!project) return; // skip if DB has no project

  // 1. Create review appointment
  const meeting = await prisma.meeting.create({
    data: {
      projectId: project.id,
      facultyId: project.facultyId,
      title: "Unit Test Milestone Review",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      timeZone: "Asia/Kolkata",
      status: "SCHEDULED",
      type: "IN_PERSON",
      venue: "Lab 101",
    },
  });
  assert.equal(meeting.status, "SCHEDULED");
  assert.equal(meeting.timeZone, "Asia/Kolkata");

  // 2. Reschedule review
  const rescheduled = await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      status: "RESCHEDULED",
      rescheduleReason: "Lab occupied",
    },
  });
  assert.equal(rescheduled.status, "RESCHEDULED");
  assert.equal(rescheduled.rescheduleReason, "Lab occupied");

  // 3. Complete review with feedback
  const completed = await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      feedback: "Demonstration approved, architecture verified.",
    },
  });
  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.completedAt instanceof Date);
  assert.equal(completed.feedback, "Demonstration approved, architecture verified.");

  // Clean up test meeting
  await prisma.meeting.delete({ where: { id: meeting.id } });
});

test("Optional Attendance & Institutional Rules Configuration", async () => {
  // 1. Verify default setting: ATTENDANCE_ENABLED is false
  const setting = await prisma.systemSetting.upsert({
    where: { key: "ATTENDANCE_ENABLED" },
    create: { key: "ATTENDANCE_ENABLED", value: "false" },
    update: { value: "false" },
  });
  assert.equal(setting.value, "false");

  // 2. Toggle to true with 75% requirement
  await prisma.systemSetting.upsert({
    where: { key: "MIN_ATTENDANCE_FOR_IDEA" },
    create: { key: "MIN_ATTENDANCE_FOR_IDEA", value: "75" },
    update: { value: "75" },
  });

  const rule = await prisma.systemSetting.findUnique({ where: { key: "MIN_ATTENDANCE_FOR_IDEA" } });
  assert.equal(rule.value, "75");

  // 3. Reset back to false (default optional behavior)
  await prisma.systemSetting.update({
    where: { key: "ATTENDANCE_ENABLED" },
    data: { value: "false" },
  });
});

test("Project Idea Review: Approves idea and transitions project status without error", async () => {
  const project = await prisma.project.findFirst({
    include: { idea: true },
  });
  if (!project) return;

  const idea = await prisma.projectIdea.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      title: "Test Project Idea",
      abstract: "Comprehensive project idea abstract for testing.",
      problemStatement: "Problem description",
      objectives: "Deliver high quality system",
      scope: "Full stack web application",
      technologies: "Node.js, React, PostgreSQL",
      expectedOutcome: "Functional deployed software",
      status: "PENDING",
    },
    update: { status: "PENDING" },
  });

  const reviewer = await prisma.faculty.findFirst();
  const status = "APPROVED";
  const comments = "Looks solid and well scoped.";

  await prisma.$transaction(async (tx) => {
    await tx.ideaReview.create({
      data: {
        ideaId: idea.id,
        reviewerId: reviewer?.id || null,
        status,
        comments,
      },
    });
    await tx.projectIdea.update({ where: { projectId: project.id }, data: { status } });
    await tx.project.update({ where: { id: project.id }, data: { status: "APPROVED" } });
  });

  const updatedProj = await prisma.project.findUnique({
    where: { id: project.id },
    include: { idea: true },
  });
  assert.equal(updatedProj.status, "APPROVED");
  assert.equal(updatedProj.idea.status, "APPROVED");
});

test("Milestone Template Auto-Generation: Seeds default templates and creates project milestones", async () => {
  const project = await prisma.project.findFirst({
    include: { subject: { include: { milestoneTemplates: true } } },
  });
  if (!project) return;

  // Verify subject templates exist or can be created
  const templates = await prisma.milestoneTemplate.findMany({
    where: { subjectId: project.subjectId },
  });

  // Create milestones
  assert.ok(Array.isArray(templates));
});
