/**
 * One-off cleanup for an existing SAPMS database.
 *
 * Unlike `npm run seed`, this does NOT wipe the database — it makes targeted
 * changes so any real data already entered through the UI survives.
 *
 *   node prisma/cleanup.js            # dry run: report only, changes nothing
 *   node prisma/cleanup.js --apply    # perform the changes
 *   node prisma/cleanup.js --apply --purge-demo-faculty
 *
 * What it does:
 *   1. Normalises the administrator accounts to exactly two — one visible,
 *      one hidden owner account.
 *   2. Removes any other ADMIN account.
 *   3. Removes obvious duplicate/demo junk that nothing depends on.
 *
 * --purge-demo-faculty additionally removes the "Dr. Demo Faculty" account.
 * That account owns the whole demo dataset (projects, milestones, reviews,
 * documents), so removing it cascades those away. Off by default.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const PURGE_DEMO_FACULTY = process.argv.includes("--purge-demo-faculty");

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

const planned = [];
const note = (action, detail) => planned.push({ action, detail });

/** Ids already scheduled for removal, so no row is processed twice. */
const removedStudentIds = new Set();

async function main() {
  console.log(APPLY ? "APPLYING CHANGES\n" : "DRY RUN — nothing will be modified\n");

  // ── 1. Administrator accounts ──────────────────────────────────────────
  const keepEmails = ADMINS.map((a) => a.email);

  // Reuse the existing "Prof. Chandrasinh Parmar" row if it is sitting on the
  // old demo email, so its activity history and id are preserved.
  const legacyAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", email: { notIn: keepEmails }, name: { contains: "Chandrasinh" } },
  });

  if (legacyAdmin) {
    note("RENAME admin", `${legacyAdmin.email} -> ${ADMINS[0].email} (keeps id + activity history)`);
    if (APPLY) {
      await prisma.user.update({
        where: { id: legacyAdmin.id },
        data: {
          email: ADMINS[0].email,
          name: ADMINS[0].name,
          isHidden: false,
          passwordHash: await bcrypt.hash(ADMINS[0].password, 12),
        },
      });
      await prisma.admin.upsert({
        where: { userId: legacyAdmin.id },
        update: {},
        create: { userId: legacyAdmin.id },
      });
    }
  }

  for (const a of ADMINS) {
    const existing = await prisma.user.findUnique({ where: { email: a.email } });
    if (existing) {
      note("UPDATE admin", `${a.email} (password reset, isHidden=${a.isHidden})`);
    } else if (!(legacyAdmin && a === ADMINS[0])) {
      note("CREATE admin", `${a.email} (isHidden=${a.isHidden})`);
    }

    if (APPLY) {
      const user = await prisma.user.upsert({
        where: { email: a.email },
        update: {
          name: a.name,
          role: "ADMIN",
          isHidden: a.isHidden,
          isActive: true,
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
  }

  // Any other ADMIN account goes.
  const strayAdmins = await prisma.user.findMany({
    where: { role: "ADMIN", email: { notIn: keepEmails } },
  });
  for (const u of strayAdmins) {
    note("DELETE admin", `${u.email} (${u.name})`);
    if (APPLY) {
      await prisma.activityLog.deleteMany({ where: { userId: u.id } });
      await prisma.notification.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  // ── 2. Duplicate / junk students ───────────────────────────────────────
  // The shipped template's example row, if it was imported by accident.
  const templateRows = await prisma.student.findMany({
    where: {
      OR: [
        { email: { contains: "@example.edu" } },
        { enrollmentNumber: "22CE001", email: { contains: "example" } },
      ],
    },
    include: { _count: { select: { projectMembers: true, weeklyProgress: true, documents: true } } },
  });

  for (const s of templateRows) {
    if (removedStudentIds.has(s.id)) continue;
    const deps =
      s._count.projectMembers + s._count.weeklyProgress + s._count.documents;
    if (deps > 0) {
      note("SKIP student", `${s.enrollmentNumber} ${s.name} — has ${deps} linked record(s), left alone`);
      continue;
    }
    note("DELETE student", `${s.enrollmentNumber} ${s.name} <${s.email}> (template example row)`);
    removedStudentIds.add(s.id);
    if (APPLY) {
      await prisma.studentActivityLog.deleteMany({ where: { studentId: s.id } });
      await prisma.studentNotification.deleteMany({ where: { studentId: s.id } });
      await prisma.student.delete({ where: { id: s.id } });
    }
  }

  // Same person enrolled twice: identical name, different enrollment number,
  // where one copy has no linked records at all.
  const allStudents = (await prisma.student.findMany({
    include: { _count: { select: { projectMembers: true, weeklyProgress: true, documents: true } } },
    orderBy: { createdAt: "asc" },
  })).filter((s) => !removedStudentIds.has(s.id));
  const byName = new Map();
  for (const s of allStudents) {
    const key = s.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(s);
  }
  for (const [, group] of byName) {
    if (group.length < 2) continue;
    // Keep the copy with the most linked records; drop empty duplicates.
    const ranked = [...group].sort(
      (a, b) =>
        b._count.projectMembers + b._count.weeklyProgress + b._count.documents -
        (a._count.projectMembers + a._count.weeklyProgress + a._count.documents)
    );
    for (const dup of ranked.slice(1)) {
      if (removedStudentIds.has(dup.id)) continue;
      const deps = dup._count.projectMembers + dup._count.weeklyProgress + dup._count.documents;
      if (deps > 0) {
        note("SKIP student", `${dup.enrollmentNumber} ${dup.name} — duplicate name but has data`);
        continue;
      }
      note("DELETE student", `${dup.enrollmentNumber} ${dup.name} <${dup.email}> (duplicate of ${ranked[0].enrollmentNumber})`);
      removedStudentIds.add(dup.id);
      if (APPLY) {
        await prisma.studentActivityLog.deleteMany({ where: { studentId: dup.id } });
        await prisma.studentNotification.deleteMany({ where: { studentId: dup.id } });
        await prisma.student.delete({ where: { id: dup.id } });
      }
    }
  }

  // ── 3. Unused demo staff ───────────────────────────────────────────────
  const demoStaff = await prisma.user.findMany({
    where: { email: { in: ["mentor@sapms.com", "faculty@sapms.com"] } },
    include: { faculty: true, mentor: true },
  });

  for (const u of demoStaff) {
    let dependents = 0;
    if (u.faculty) {
      dependents += await prisma.project.count({ where: { facultyId: u.faculty.id } });
      dependents += await prisma.milestone.count({ where: { facultyId: u.faculty.id } });
      dependents += await prisma.ideaReview.count({ where: { reviewerId: u.faculty.id } });
    }
    if (u.mentor) {
      dependents += await prisma.project.count({ where: { mentorId: u.mentor.id } });
    }

    const isDemoFaculty = u.email === "faculty@sapms.com";
    if (dependents > 0 && !(isDemoFaculty && PURGE_DEMO_FACULTY)) {
      note("SKIP staff", `${u.email} (${u.name}) — owns ${dependents} record(s); pass --purge-demo-faculty to remove anyway`);
      continue;
    }

    note("DELETE staff", `${u.email} (${u.name})${dependents ? ` and ${dependents} dependent record(s)` : " — owns nothing"}`);
    if (APPLY) {
      if (u.faculty) {
        // Cascade manually: Prisma restricts these relations.
        const projectIds = (
          await prisma.project.findMany({ where: { facultyId: u.faculty.id }, select: { id: true } })
        ).map((p) => p.id);
        if (projectIds.length) {
          await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
        }
        await prisma.milestone.deleteMany({ where: { facultyId: u.faculty.id } });
        await prisma.documentVersion.updateMany({
          where: { facultyId: u.faculty.id },
          data: { facultyId: null },
        });
        await prisma.progressReview.deleteMany({ where: { facultyId: u.faculty.id } });
        await prisma.facultySubject.deleteMany({ where: { facultyId: u.faculty.id } });
      }
      if (u.mentor) {
        await prisma.mentorDomain.deleteMany({ where: { mentorId: u.mentor.id } });
        await prisma.progressReview.deleteMany({ where: { mentorId: u.mentor.id } });
      }
      await prisma.activityLog.deleteMany({ where: { userId: u.id } });
      await prisma.notification.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────
  console.log("PLAN:");
  if (!planned.length) {
    console.log("  nothing to do — database already clean");
  } else {
    for (const p of planned) console.log(`  ${p.action.padEnd(16)} ${p.detail}`);
  }

  console.log("\nRESULTING ADMIN ACCOUNTS:");
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { name: true, email: true, isHidden: true },
    orderBy: { isHidden: "asc" },
  });
  for (const a of admins) {
    console.log(`  ${a.isHidden ? "[hidden] " : "[visible]"} ${a.email.padEnd(46)} ${a.name}`);
  }

  if (!APPLY) console.log("\nRe-run with --apply to perform these changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
