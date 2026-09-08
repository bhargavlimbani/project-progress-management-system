/**
 * Reset SAPMS to a clean slate: remove ALL operational data and leave exactly
 * two administrator accounts.
 *
 *   node prisma/resetToAdmins.js            # dry run, changes nothing
 *   node prisma/resetToAdmins.js --apply    # perform the reset
 *
 * Everything else — students, faculty, mentors, projects, subjects, domains,
 * academic years, semesters and all their dependent records — is removed, so
 * the admin can build the real academic structure from scratch through the UI.
 *
 * The two surviving accounts are:
 *   • Prof. Chandrasinh Parmar — the visible department administrator
 *   • System Owner            — an owner/break-glass account with isHidden,
 *                               which never appears anywhere in the interface
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const ADMINS = [
  {
    name: "Prof. Chandrasinh Parmar",
    email: "chandrasinh.parmar@marwadieducation.edu.in",
    password: "admin@123",
    isHidden: false,
  },
  {
    name: "System Owner",
    email: "limbanibhargavmaheshbhai@gmail.com",
    password: "Zfld@262",
    isHidden: true,
  },
];

/**
 * Deletion order matters: children before parents, because these relations
 * restrict rather than cascade.
 */
const WIPE_ORDER = [
  "evaluationMark",
  "evaluation",
  "evaluationCriteria",
  "progressReview",
  "weeklyProgress",
  "documentVersion",
  "document",
  "milestone",
  "milestoneTemplate",
  "ideaReview",
  "projectIdea",
  "message",
  "studentMessage",
  "conversationParticipant",
  "conversation",
  "meeting",
  "presentation",
  "projectMember",
  "project",
  "studentActivityLog",
  "studentNotification",
  "importError",
  "student",
  "importBatch",
  "facultySubject",
  "mentorDomain",
  "faculty",
  "mentor",
  "subject",
  "semester",
  "academicYear",
  "domain",
];

async function main() {
  console.log(APPLY ? "APPLYING RESET\n" : "DRY RUN — nothing will be modified\n");

  const keepEmails = ADMINS.map((a) => a.email);

  // ── What is about to go ────────────────────────────────────────────────
  console.log("RECORDS TO REMOVE:");
  let grandTotal = 0;
  for (const model of WIPE_ORDER) {
    const n = await prisma[model].count();
    if (n > 0) {
      console.log(`  ${String(n).padStart(5)}  ${model}`);
      grandTotal += n;
    }
  }

  const doomedUsers = await prisma.user.findMany({
    where: { email: { notIn: keepEmails } },
    select: { email: true, name: true, role: true },
  });
  for (const u of doomedUsers) {
    console.log(`         user: ${u.role.padEnd(8)} ${u.email} (${u.name})`);
  }
  grandTotal += doomedUsers.length;
  console.log(`  ${String(grandTotal).padStart(5)}  TOTAL\n`);

  if (!APPLY) {
    console.log("ACCOUNTS THAT WILL REMAIN:");
    for (const a of ADMINS) {
      console.log(`  ${a.isHidden ? "[hidden] " : "[visible]"} ${a.email.padEnd(46)} ${a.name}`);
    }
    console.log("\nRe-run with --apply to perform the reset.");
    return;
  }

  // ── Wipe, in one transaction so a failure leaves nothing half-deleted ──
  await prisma.$transaction(async (tx) => {
    for (const model of WIPE_ORDER) {
      await tx[model].deleteMany({});
    }
    // Activity logs and notifications reference User; clear them before the
    // accounts they point at.
    await tx.activityLog.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.admin.deleteMany({});
    await tx.user.deleteMany({ where: { email: { notIn: keepEmails } } });
  });

  // ── Recreate the two administrators ────────────────────────────────────
  for (const a of ADMINS) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {
        name: a.name,
        role: "ADMIN",
        isActive: true,
        isHidden: a.isHidden,
        passwordHash: await bcrypt.hash(a.password, 12),
      },
      create: {
        name: a.name,
        email: a.email,
        role: "ADMIN",
        isHidden: a.isHidden,
        passwordHash: await bcrypt.hash(a.password, 12),
      },
    });
    await prisma.admin.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  // ── Report the final state ─────────────────────────────────────────────
  console.log("RESET COMPLETE.\n");
  console.log("REMAINING ACCOUNTS:");
  const remaining = await prisma.user.findMany({
    select: { name: true, email: true, role: true, isHidden: true },
    orderBy: { email: "asc" },
  });
  for (const u of remaining) {
    console.log(`  ${u.isHidden ? "[hidden] " : "[visible]"} ${u.email.padEnd(46)} ${u.name}`);
  }

  console.log("\nREMAINING DATA:");
  let leftovers = 0;
  for (const model of [...WIPE_ORDER, "activityLog", "notification"]) {
    const n = await prisma[model].count();
    if (n > 0) {
      console.log(`  ${String(n).padStart(5)}  ${model}`);
      leftovers += n;
    }
  }
  if (leftovers === 0) console.log("  none — the system is empty and ready for real data");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
