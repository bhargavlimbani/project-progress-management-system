const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SAPMS database...");

  // ── Academic Year ──────────────────────────────────────────────────────
  const ay = await prisma.academicYear.upsert({
    where: { label: "2025-2026" },
    update: {},
    create: { label: "2025-2026", isActive: true, startDate: new Date("2025-06-01"), endDate: new Date("2026-05-31") },
  });
  console.log("✅ Academic year created");

  // ── Semesters ──────────────────────────────────────────────────────────
  const sems = {};
  for (const num of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const sem = await prisma.semester.upsert({
      where: { number_academicYearId: { number: num, academicYearId: ay.id } },
      update: {},
      create: { number: num, academicYearId: ay.id },
    });
    sems[num] = sem;
  }
  console.log("✅ Semesters created");

  // ── Admin ──────────────────────────────────────────────────────────────
  const adminPwd = await bcrypt.hash("Admin@123", 12);
  const adminEmail = "admin@sapms.com";
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "Prof. Chandrasinh Parmar", email: adminEmail, passwordHash: adminPwd, role: "ADMIN" },
  });
  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id },
  });
  console.log(`✅ Admin created: ${adminEmail} / Admin@123`);

  // ── Domains ────────────────────────────────────────────────────────────
  const domainData = [
    { name: "Artificial Intelligence", description: "AI, ML, Deep Learning projects" },
    { name: "Web Development", description: "React, Node.js, Full-stack web applications" },
    { name: "Flutter", description: "Cross-platform mobile development" },
    { name: "Cloud Computing", description: "AWS, GCP, Azure cloud projects" },
    { name: "Cyber Security", description: "Security, penetration testing, encryption" },
    { name: "Data Science", description: "Data analysis, visualization, big data" },
  ];

  const domains = {};
  for (const d of domainData) {
    const domain = await prisma.domain.upsert({
      where: { name: d.name },
      update: {},
      create: d,
    });
    domains[d.name] = domain;
  }
  console.log("✅ Domains created");

  // ── Faculty ────────────────────────────────────────────────────────────
  const facultyPwd = await bcrypt.hash("Faculty@123", 12);

  const facUsers = [
    { name: "Dr. Priya Mehta", email: "priya.mehta@marwadieducation.edu.in", facultyId: "FAC001", designation: "Associate Professor" },
    { name: "Prof. Rahul Sharma", email: "rahul.sharma@marwadieducation.edu.in", facultyId: "FAC002", designation: "Assistant Professor" },
    { name: "Dr. Anjali Patel", email: "anjali.patel@marwadieducation.edu.in", facultyId: "FAC003", designation: "Professor" },
  ];

  // Primary demo faculty
  const demoFacEmail = "faculty@sapms.com";
  await prisma.user.upsert({
    where: { email: demoFacEmail },
    update: {},
    create: { name: "Dr. Demo Faculty", email: demoFacEmail, passwordHash: facultyPwd, role: "FACULTY" },
  });

  const faculty = {};
  for (const f of facUsers) {
    let user = await prisma.user.findUnique({ where: { email: f.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { name: f.name, email: f.email, passwordHash: facultyPwd, role: "FACULTY" },
      });
    }
    let fac = await prisma.faculty.findUnique({ where: { userId: user.id } });
    if (!fac) {
      fac = await prisma.faculty.create({
        data: { userId: user.id, facultyId: f.facultyId, designation: f.designation, mobile: "9000000001" },
      });
    }
    faculty[f.facultyId] = fac;
  }

  const demoFacUser = await prisma.user.findUnique({ where: { email: demoFacEmail } });
  let demoFac = await prisma.faculty.findUnique({ where: { userId: demoFacUser.id } });
  if (!demoFac) {
    demoFac = await prisma.faculty.create({
      data: { userId: demoFacUser.id, facultyId: "FAC000", designation: "Associate Professor" },
    });
  }
  faculty["FAC000"] = demoFac;
  console.log(`✅ Faculty created: ${demoFacEmail} / Faculty@123`);

  // ── Mentors ────────────────────────────────────────────────────────────
  const mentorPwd = await bcrypt.hash("Mentor@123", 12);

  const mentorData = [
    { name: "Mr. Arjun Nair", email: "arjun.nair@marwadieducation.edu.in", mentorId: "MEN001", expertise: "Artificial Intelligence, Machine Learning", domainKeys: ["Artificial Intelligence", "Data Science"] },
    { name: "Ms. Sneha Gupta", email: "sneha.gupta@marwadieducation.edu.in", mentorId: "MEN002", expertise: "React, Node.js, Full-Stack", domainKeys: ["Web Development"] },
    { name: "Mr. Vishal Joshi", email: "vishal.joshi@marwadieducation.edu.in", mentorId: "MEN003", expertise: "Flutter, Android", domainKeys: ["Flutter"] },
    { name: "Ms. Riya Desai", email: "riya.desai@marwadieducation.edu.in", mentorId: "MEN004", expertise: "AWS, Azure, Cloud Architecture", domainKeys: ["Cloud Computing", "Cyber Security"] },
  ];

  const demoMentorEmail = "mentor@sapms.com";
  await prisma.user.upsert({
    where: { email: demoMentorEmail },
    update: {},
    create: { name: "Demo Mentor", email: demoMentorEmail, passwordHash: mentorPwd, role: "MENTOR" },
  });

  const mentors = {};
  for (const m of mentorData) {
    let user = await prisma.user.findUnique({ where: { email: m.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { name: m.name, email: m.email, passwordHash: mentorPwd, role: "MENTOR" },
      });
    }
    let mentor = await prisma.mentor.findUnique({ where: { userId: user.id } });
    if (!mentor) {
      mentor = await prisma.mentor.create({
        data: { userId: user.id, mentorId: m.mentorId, expertise: m.expertise, mobile: "9000000010" },
      });
    }
    for (const dk of m.domainKeys) {
      if (domains[dk]) {
        await prisma.mentorDomain.upsert({
          where: { mentorId_domainId: { mentorId: mentor.id, domainId: domains[dk].id } },
          update: {},
          create: { mentorId: mentor.id, domainId: domains[dk].id },
        });
      }
    }
    mentors[m.mentorId] = mentor;
  }

  const demoMentorUser = await prisma.user.findUnique({ where: { email: demoMentorEmail } });
  let demoMentor = await prisma.mentor.findUnique({ where: { userId: demoMentorUser.id } });
  if (!demoMentor) {
    demoMentor = await prisma.mentor.create({
      data: { userId: demoMentorUser.id, mentorId: "MEN000", expertise: "General", mobile: "9000000000" },
    });
  }
  mentors["MEN000"] = demoMentor;
  console.log(`✅ Mentors created: ${demoMentorEmail} / Mentor@123`);

  // ── Subjects ───────────────────────────────────────────────────────────
  const subjectData = [
    { name: "Capstone Project", code: "ICT701", semNum: 7, durationWeeks: 16 },
    { name: "Advanced Web Technology", code: "ICT702", semNum: 7, durationWeeks: 14 },
    { name: "Mobile Application Development", code: "ICT703", semNum: 7, durationWeeks: 14 },
    { name: "Software Engineering", code: "ICT601", semNum: 6, durationWeeks: 12 },
    { name: "Mini Project", code: "ICT501", semNum: 5, durationWeeks: 10 },
  ];

  const subjects = {};
  for (const s of subjectData) {
    const sem = sems[s.semNum];
    if (!sem) continue;
    let subject = await prisma.subject.findUnique({ where: { code: s.code } });
    if (!subject) {
      subject = await prisma.subject.create({
        data: { name: s.name, code: s.code, semesterId: sem.id, academicYearId: ay.id, durationWeeks: s.durationWeeks },
      });
    }
    subjects[s.code] = subject;

    await prisma.facultySubject.upsert({
      where: { facultyId_subjectId: { facultyId: demoFac.id, subjectId: subject.id } },
      update: {},
      create: { facultyId: demoFac.id, subjectId: subject.id },
    });
  }
  console.log("✅ Subjects created");

  // ── Milestone templates + marking scheme for EVERY subject ───────────
  // Each subject has its own duration, so the 12-step plan is scaled to fit
  // rather than assuming everything runs for 12 weeks.
  const PLAN = [
    { title: "Project Idea", description: "Submit project idea with abstract and objectives", weight: 5 },
    { title: "Problem Statement", description: "Define clear problem statement and scope", weight: 5 },
    { title: "SRS Document", description: "Submit Software Requirements Specification", weight: 10 },
    { title: "System Design", description: "Architecture, DFD, ER Diagram", weight: 10 },
    { title: "Database Design", description: "Create database schema and migrations", weight: 5 },
    { title: "Frontend Development", description: "Build UI components and pages", weight: 10 },
    { title: "Backend APIs", description: "Implement REST APIs and business logic", weight: 15 },
    { title: "Integration", description: "Integrate frontend and backend", weight: 10 },
    { title: "Testing", description: "Unit testing, integration testing", weight: 10 },
    { title: "Bug Fixing", description: "Fix bugs and improve performance", weight: 5 },
    { title: "Documentation", description: "Final documentation and code comments", weight: 10 },
    { title: "Final Presentation", description: "Project demonstration and viva", weight: 15 },
  ];

  const EVAL_CRITERIA = [
    { name: "Innovation", description: "Originality and creativity of the solution", maxMarks: 10 },
    { name: "Implementation", description: "Quality of code and technical implementation", maxMarks: 25 },
    { name: "Documentation", description: "SRS, reports, and code documentation quality", maxMarks: 15 },
    { name: "Testing", description: "Test coverage and bug handling", maxMarks: 10 },
    { name: "Presentation", description: "Demo quality and communication", maxMarks: 15 },
    { name: "Viva", description: "Technical knowledge demonstrated during viva", maxMarks: 15 },
    { name: "Mentor Evaluation", description: "Mentor's assessment of weekly progress", maxMarks: 10 },
  ];

  for (const subject of Object.values(subjects)) {
    const weeks = subject.durationWeeks || 12;

    // Stretch or compress the plan onto this subject's week count, keeping the
    // weights normalised to 100% so weighted progress stays meaningful.
    const steps = Array.from({ length: weeks }, (_, i) => {
      const source = PLAN[Math.min(Math.floor((i / weeks) * PLAN.length), PLAN.length - 1)];
      return { ...source, weekNumber: i + 1 };
    });
    const rawTotal = steps.reduce((sum, t) => sum + t.weight, 0);

    for (const t of steps) {
      await prisma.milestoneTemplate.upsert({
        where: { subjectId_weekNumber: { subjectId: subject.id, weekNumber: t.weekNumber } },
        update: {},
        create: {
          subjectId: subject.id,
          weekNumber: t.weekNumber,
          title: t.title,
          description: t.description,
          weight: Math.round((t.weight / rawTotal) * 1000) / 10,
        },
      });
    }

    for (const c of EVAL_CRITERIA) {
      await prisma.evaluationCriteria.upsert({
        where: { subjectId_name: { subjectId: subject.id, name: c.name } },
        update: {},
        create: { subjectId: subject.id, ...c },
      });
    }
  }
  console.log(`✅ Milestone templates + marking schemes created for ${Object.keys(subjects).length} subjects`);

  // ── Students ───────────────────────────────────────────────────────────
  const studentPwd = await bcrypt.hash("Student@123", 12);

  const studentData = [
    { enrollment: "22ICT001", name: "Bhargav Limbani", email: "student@sapms.com", mobile: "9876543210", semNum: 7 },
    { enrollment: "22ICT002", name: "Riya Patel", email: "riya.patel@marwadiuniversity.ac.in", mobile: "9876543211", semNum: 7 },
    { enrollment: "22ICT003", name: "Aryan Shah", email: "aryan.shah@marwadiuniversity.ac.in", mobile: "9876543212", semNum: 7 },
    { enrollment: "22ICT004", name: "Nisha Solanki", email: "nisha.solanki@marwadiuniversity.ac.in", mobile: "9876543213", semNum: 7 },
    { enrollment: "21ICT001", name: "Dhruv Mehta", email: "dhruv.mehta@marwadiuniversity.ac.in", mobile: "9876543214", semNum: 6 },
    { enrollment: "21ICT002", name: "Priya Rajput", email: "priya.rajput@marwadiuniversity.ac.in", mobile: "9876543215", semNum: 6 },
    { enrollment: "20ICT001", name: "Sagar Trivedi", email: "sagar.trivedi@marwadiuniversity.ac.in", mobile: "9876543216", semNum: 5 },
    { enrollment: "20ICT002", name: "Meera Joshi", email: "meera.joshi@marwadiuniversity.ac.in", mobile: "9876543217", semNum: 5 },
  ];

  const students = {};
  for (const s of studentData) {
    let student = await prisma.student.findUnique({ where: { enrollmentNumber: s.enrollment } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          enrollmentNumber: s.enrollment,
          name: s.name,
          email: s.email,
          mobile: s.mobile,
          passwordHash: studentPwd,
          isActivated: true,
          academicYearId: ay.id,
          semesterId: sems[s.semNum].id,
        },
      });
    }
    students[s.enrollment] = student;
  }
  console.log("✅ Students created: student@sapms.com / Student@123");

  // ── Projects ───────────────────────────────────────────────────────────
  const projectsData = [
    {
      title: "AI Resume Analyzer",
      subjectCode: "ICT701",
      studentEnrollments: ["22ICT001"],
      domainName: "Artificial Intelligence",
      mentorId: "MEN001",
      status: "IN_PROGRESS",
      progress: 72,
      currentWeek: 9,
    },
    {
      title: "Packaging Management System",
      subjectCode: "ICT702",
      studentEnrollments: ["22ICT001"],
      domainName: "Web Development",
      mentorId: "MEN002",
      status: "IN_PROGRESS",
      progress: 85,
      currentWeek: 10,
    },
    {
      title: "Expense Tracker",
      subjectCode: "ICT703",
      studentEnrollments: ["22ICT001"],
      domainName: "Flutter",
      mentorId: "MEN003",
      status: "AT_RISK",
      progress: 45,
      currentWeek: 8,
    },
    {
      title: "Student Project Management System",
      subjectCode: "ICT601",
      studentEnrollments: ["22ICT001"],
      domainName: "Web Development",
      mentorId: "MEN002",
      status: "IN_PROGRESS",
      progress: 60,
      currentWeek: 7,
    },
    {
      title: "Smart Crop Disease Detection",
      subjectCode: "ICT701",
      studentEnrollments: ["22ICT002"],
      domainName: "Artificial Intelligence",
      mentorId: "MEN001",
      status: "IN_PROGRESS",
      progress: 65,
      currentWeek: 8,
    },
    {
      title: "E-Commerce Platform",
      subjectCode: "ICT702",
      studentEnrollments: ["22ICT003", "22ICT004"],
      domainName: "Web Development",
      mentorId: "MEN002",
      status: "DELAYED",
      progress: 30,
      currentWeek: 9,
    },
    {
      title: "Blood Bank App",
      subjectCode: "ICT703",
      studentEnrollments: ["22ICT003"],
      domainName: "Flutter",
      mentorId: "MEN003",
      status: "COMPLETED",
      progress: 100,
      currentWeek: 14,
    },
    {
      title: "Cloud Infrastructure Monitor",
      subjectCode: "ICT501",
      studentEnrollments: ["20ICT001"],
      domainName: "Cloud Computing",
      mentorId: "MEN004",
      status: "IDEA_SUBMITTED",
      progress: 5,
      currentWeek: 1,
    },
  ];

  const createdProjects = {};
  for (const pd of projectsData) {
    const subject = subjects[pd.subjectCode];
    if (!subject) continue;
    const domain = domains[pd.domainName];
    const mentor = mentors[pd.mentorId];

    let project = await prisma.project.findFirst({
      where: { title: pd.title, subjectId: subject.id },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          title: pd.title,
          subjectId: subject.id,
          academicYearId: ay.id,
          facultyId: demoFac.id,
          mentorId: mentor?.id,
          domainId: domain?.id,
          status: pd.status,
          progress: pd.progress,
          currentWeek: pd.currentWeek,
          startDate: new Date("2025-07-01"),
          endDate: new Date("2025-12-31"),
        },
      });

      for (let i = 0; i < pd.studentEnrollments.length; i++) {
        const student = students[pd.studentEnrollments[i]];
        if (student) {
          await prisma.projectMember.upsert({
            where: { projectId_studentId: { projectId: project.id, studentId: student.id } },
            update: {},
            create: { projectId: project.id, studentId: student.id, isLead: i === 0 },
          });
        }
      }
    }

    createdProjects[pd.title] = project;
  }
  console.log("\u2705 Projects created");

  // ── Project ideas + their review history (spec §29–§30) ───────────────
  // Every project needs the idea that started it, otherwise the Overview tab
  // and the faculty review queue both render empty.
  const IDEA_CONTENT = {
    "AI Resume Analyzer": {
      abstract:
        "A web platform that parses student resumes against live placement-drive criteria and returns a section-by-section improvement report, so students can fix gaps before applying rather than after being rejected.",
      problemStatement:
        "Final-year students submit resumes to campus drives with no feedback loop. Recruiters reject most of them on formatting and keyword mismatch alone, students are never told why, and the same mistakes repeat across every drive.",
      objectives:
        "Parse PDF and DOCX resumes into structured sections\nScore each section against a configurable job description\nSurface missing skills and weak phrasing with concrete rewrites\nTrack score improvement across resume versions",
      scope:
        "In scope: resume parsing, JD matching, scoring, improvement suggestions, version history.\nOut of scope: applying to jobs on the student behalf, recruiter-side dashboards.",
      technologies: "React, Node.js, Express, PostgreSQL, Python (spaCy), Prisma",
      expectedOutcome:
        "A deployed web app where a student uploads a resume, picks a target role, and receives a scored breakdown with actionable rewrites within seconds.",
    },
    "Packaging Management System": {
      abstract:
        "An inventory and dispatch tracker for a packaging unit, replacing the spreadsheet workflow with role-based stock movement, batch traceability and reorder alerts.",
      problemStatement:
        "The packaging unit tracks raw material, work-in-progress and dispatch across three disconnected spreadsheets. Stock counts drift within days, reorder points are missed, and a defective batch cannot be traced back to its raw material lot.",
      objectives:
        "Model raw material, WIP and finished-goods stock in one ledger\nTrace every finished batch back to its source lots\nTrigger reorder alerts at configurable thresholds\nProduce dispatch documents from the same data",
      scope:
        "In scope: stock ledger, batch traceability, reorder alerts, dispatch notes, role-based access.\nOut of scope: accounting integration, payroll, machine-level IoT telemetry.",
      technologies: "React, Node.js, Express, PostgreSQL, Prisma, Chart.js",
      expectedOutcome:
        "A working system where a stock movement recorded on the floor is immediately reflected in reorder alerts and batch traceability.",
    },
    "Expense Tracker": {
      abstract:
        "A cross-platform mobile app for shared household expenses, with automatic split calculation, settlement suggestions and offline-first entry.",
      problemStatement:
        "Students sharing accommodation track shared costs over chat. Balances are disputed at month end because there is no shared record, and existing apps assume constant connectivity that hostel networks do not reliably provide.",
      objectives:
        "Record expenses offline and sync when connectivity returns\nSplit costs equally, by share or by exact amount\nCompute the minimum set of settlement transfers\nExport a monthly statement per participant",
      scope:
        "In scope: group expenses, split modes, settlement optimisation, offline sync, export.\nOut of scope: real payment processing, bank account linking.",
      technologies: "Flutter, Dart, SQLite, Firebase, REST",
      expectedOutcome:
        "An installable Android app where a group can record expenses offline and see who owes whom the moment they reconnect.",
    },
    "Student Project Management System": {
      abstract:
        "A department-level system for tracking academic project progress week by week, comparing expected against actual completion so slippage is caught early.",
      problemStatement:
        "Faculty cannot tell whether a six-month project is progressing until the final submission. Monitoring happens over chat and email, evidence is never retained, and students who stall are identified far too late for intervention to help.",
      objectives:
        "Capture weekly progress with mandatory evidence\nCompare expected versus actual progress continuously\nRoute submissions through mentor review then faculty verification\nSurface at-risk projects to everyone who can act",
      scope:
        "In scope: idea approval, mentor matching, milestones, weekly evidence, reviews, documents, evaluation.\nOut of scope: attendance, timetabling, fee management.",
      technologies: "React, Node.js, Express, PostgreSQL, Prisma, Socket.IO",
      expectedOutcome:
        "A platform where a faculty member can see, in one view, which projects are behind schedule and by how much.",
    },
    "Smart Crop Disease Detection": {
      abstract:
        "A mobile-first tool that identifies crop disease from a leaf photograph and returns locally-relevant treatment guidance in the regional language.",
      problemStatement:
        "Smallholder farmers identify crop disease by eye and apply broad-spectrum treatment, which is expensive and often wrong. Expert diagnosis requires travel to an agricultural centre, by which point the affected area has spread.",
      objectives:
        "Classify common regional crop diseases from a single leaf image\nWork on low-end devices with intermittent connectivity\nReturn treatment guidance in regional languages\nLog outbreaks geographically to reveal spread patterns",
      scope:
        "In scope: image classification for selected regional crops, treatment guidance, outbreak map.\nOut of scope: soil testing, yield prediction, marketplace features.",
      technologies: "Python, TensorFlow Lite, Flutter, FastAPI, PostgreSQL",
      expectedOutcome:
        "An Android app that returns a disease classification with confidence and treatment guidance from a single photograph, offline.",
    },
    "E-Commerce Platform": {
      abstract:
        "A multi-vendor marketplace for campus-based small sellers, with vendor onboarding, order routing and a unified checkout.",
      problemStatement:
        "Student-run micro-businesses sell through social media posts with manual order collection. Orders are lost in message threads, there is no inventory truth, and buyers have no order history or dispute path.",
      objectives:
        "Onboard vendors with independent catalogues and inventory\nRoute a single checkout into per-vendor orders\nProvide buyers with order history and status tracking\nGive vendors a fulfilment dashboard",
      scope:
        "In scope: vendor onboarding, catalogue, cart, split checkout, order tracking.\nOut of scope: live payment gateway integration, logistics partner APIs.",
      technologies: "React, Node.js, Express, PostgreSQL, Prisma, Redis",
      expectedOutcome:
        "A marketplace where a buyer checks out once across multiple vendors and each vendor receives their own fulfilable order.",
    },
    "Blood Bank App": {
      abstract:
        "A donor-matching and inventory system connecting hospitals with eligible nearby donors, tracking unit availability by blood group in real time.",
      problemStatement:
        "Blood requirement is broadcast through informal social media appeals with no verification of donor eligibility or current stock. Hospitals cannot see regional availability, so urgent requests are met by chance rather than by matching.",
      objectives:
        "Maintain verified donor records with eligibility windows\nTrack unit inventory by group across participating centres\nMatch urgent requests to eligible nearby donors\nNotify matched donors immediately",
      scope:
        "In scope: donor registry, eligibility tracking, inventory, request matching, notifications.\nOut of scope: medical screening, cold-chain logistics, regulatory reporting.",
      technologies: "Flutter, Node.js, Express, PostgreSQL, Firebase Cloud Messaging",
      expectedOutcome:
        "A deployed app where a hospital raises a request and eligible donors within range are notified within seconds.",
    },
    "Cloud Infrastructure Monitor": {
      abstract:
        "A unified monitoring dashboard aggregating metrics, cost and alerting across multiple cloud providers into one view.",
      problemStatement:
        "Teams running workloads across more than one cloud provider check each provider console separately. There is no single view of spend or health, so cost overruns and degraded services are noticed late.",
      objectives:
        "Pull metrics and billing from multiple provider APIs\nNormalise them into one comparable schema\nAlert on threshold breaches across providers\nForecast month-end spend from current burn",
      scope:
        "In scope: metric and cost ingestion, normalisation, dashboards, threshold alerting, forecasting.\nOut of scope: provisioning or modifying cloud resources.",
      technologies: "React, Node.js, Express, PostgreSQL, AWS SDK, Azure SDK, Prometheus",
      expectedOutcome:
        "A dashboard showing health and spend across providers side by side, with alerts before budget is exceeded.",
    },
  };

  for (const [title, project] of Object.entries(createdProjects)) {
    const content = IDEA_CONTENT[title];
    if (!content) continue;

    const existingIdea = await prisma.projectIdea.findUnique({
      where: { projectId: project.id },
    });
    if (existingIdea) continue;

    // A project past the idea stage must carry an approved idea; the one still
    // sitting at IDEA_SUBMITTED stays PENDING so the review queue is not empty.
    const stillPending = project.status === "IDEA_SUBMITTED";

    const idea = await prisma.projectIdea.create({
      data: {
        projectId: project.id,
        domainId: project.domainId,
        title,
        ...content,
        status: stillPending ? "PENDING" : "APPROVED",
      },
    });

    if (!stillPending) {
      await prisma.ideaReview.create({
        data: {
          ideaId: idea.id,
          reviewerId: demoFac.id,
          status: "APPROVED",
          comments:
            "Well-scoped problem with a clearly identified user. Objectives are measurable - proceed and begin the problem statement.",
        },
      });
    }
  }
  console.log(
    `\u2705 Project ideas created for ${Object.keys(createdProjects).length} projects`
  );

  // ── Weekly Progress for demo student ──────────────────────────────────
  const demoStudent = students["22ICT001"];
  const capstoneProject = createdProjects["AI Resume Analyzer"];

  if (demoStudent && capstoneProject) {
    const weeklyData = [
      { week: 1, task: "Project Idea Submission", desc: "Submitted AI Resume Analyzer project idea with abstract and objectives", completed: "Submitted project idea, identified domain (AI), created abstract" },
      { week: 2, task: "Problem Statement", desc: "Defined clear problem statement targeting HR departments", completed: "Problem statement finalized, target users identified, scope defined" },
      { week: 3, task: "SRS Document", desc: "Completed Software Requirements Specification document", completed: "SRS v1 submitted with functional and non-functional requirements" },
      { week: 4, task: "System Design", desc: "Created DFD, ER Diagram and system architecture", completed: "Architecture diagram created, database schema designed, DFD levels 0 and 1" },
      { week: 5, task: "Database Design", desc: "Implemented PostgreSQL database with Prisma ORM", completed: "Created all tables, relationships, indexes and seed data" },
      { week: 6, task: "Frontend UI", desc: "Built React dashboard with resume upload and results view", completed: "Login, dashboard, upload page, results visualization all complete" },
      { week: 7, task: "AI Integration", desc: "Integrated NLP model for resume parsing and scoring", completed: "Python ML model integrated via REST API, 85% accuracy achieved" },
      { week: 8, task: "Backend APIs", desc: "Completed all REST API endpoints with authentication", completed: "Auth, resume, user, analysis APIs complete with JWT" },
      { week: 9, task: "Testing", desc: "Unit and integration testing", completed: "80% test coverage, major bugs fixed" },
    ];

    for (const wd of weeklyData) {
      const existing = await prisma.weeklyProgress.findUnique({
        where: { projectId_weekNumber: { projectId: capstoneProject.id, weekNumber: wd.week } },
      });
      if (!existing) {
        const wp = await prisma.weeklyProgress.create({
          data: {
            projectId: capstoneProject.id,
            studentId: demoStudent.id,
            weekNumber: wd.week,
            taskTitle: wd.task,
            description: wd.desc,
            completedWork: wd.completed,
            nextWeekPlan: `Proceed to week ${wd.week + 1} tasks`,
            githubUrl: "https://github.com/demo/ai-resume-analyzer",
          },
        });

        if (wd.week <= 7 && mentors["MEN001"]) {
          await prisma.progressReview.create({
            data: {
              progressId: wp.id,
              mentorId: mentors["MEN001"].id,
              status: "APPROVED",
              feedback: `Week ${wd.week} work looks great. Good progress!`,
            },
          });

          if (wd.week <= 6) {
            await prisma.progressReview.create({
              data: {
                progressId: wp.id,
                facultyId: demoFac.id,
                status: "APPROVED",
                feedback: `Verified. Week ${wd.week} completed successfully.`,
              },
            });
          }
        }
      }
    }
  }
  console.log("✅ Weekly progress created");

  // ── Milestones for Capstone project ───────────────────────────────────
  if (capstoneProject) {
    const milestoneData = [
      { week: 1, title: "Project Idea", weight: 5, status: "APPROVED" },
      { week: 2, title: "Problem Statement", weight: 5, status: "APPROVED" },
      { week: 3, title: "SRS Document", weight: 10, status: "APPROVED" },
      { week: 4, title: "System Design", weight: 10, status: "APPROVED" },
      { week: 5, title: "Database Design", weight: 5, status: "APPROVED" },
      { week: 6, title: "Frontend Development", weight: 10, status: "APPROVED" },
      { week: 7, title: "Backend APIs", weight: 15, status: "APPROVED" },
      { week: 8, title: "Integration", weight: 10, status: "APPROVED" },
      { week: 9, title: "Testing", weight: 10, status: "PENDING" },
      { week: 10, title: "Bug Fixing", weight: 5, status: "PENDING" },
      { week: 11, title: "Documentation", weight: 10, status: "PENDING" },
      { week: 12, title: "Final Presentation", weight: 15, status: "PENDING" },
    ];

    for (const m of milestoneData) {
      await prisma.milestone.upsert({
        where: { projectId_weekNumber: { projectId: capstoneProject.id, weekNumber: m.week } },
        update: {},
        create: {
          projectId: capstoneProject.id,
          facultyId: demoFac.id,
          weekNumber: m.week,
          title: m.title,
          weight: m.weight,
          status: m.status,
          completedAt: m.status === "APPROVED" ? new Date() : null,
        },
      });
    }
  }
  console.log("✅ Milestones created");

  // ── Documents with version history (spec §34) ─────────────────────────
  if (capstoneProject && demoStudent) {
    const docData = [
      {
        type: "PROBLEM_STATEMENT",
        versions: [
          { version: 1, status: "CHANGES_REQUIRED", fileName: "problem-statement-v1.pdf",
            comments: "The target users are not defined clearly. Please narrow the scope." },
          { version: 2, status: "APPROVED", fileName: "problem-statement-v2.pdf",
            comments: "Much clearer now — approved." },
        ],
      },
      {
        type: "SRS",
        versions: [
          { version: 1, status: "REJECTED", fileName: "srs-v1.pdf",
            comments: "Missing non-functional requirements and the ER diagram." },
          { version: 2, status: "CHANGES_REQUIRED", fileName: "srs-v2.pdf",
            comments: "ER diagram added, but the DFD only goes to level 0." },
          { version: 3, status: "APPROVED", fileName: "srs-v3.pdf",
            comments: "All sections present. Approved." },
        ],
      },
    ];

    for (const d of docData) {
      let doc = await prisma.document.findFirst({
        where: { projectId: capstoneProject.id, type: d.type },
      });

      if (!doc) {
        doc = await prisma.document.create({
          data: { projectId: capstoneProject.id, studentId: demoStudent.id, type: d.type },
        });

        for (const v of d.versions) {
          await prisma.documentVersion.create({
            data: {
              documentId: doc.id,
              version: v.version,
              // Demo metadata only — no real file is written to disk by the seed.
              fileUrl: `/uploads/documents/seed-${d.type.toLowerCase()}-v${v.version}.pdf`,
              fileName: v.fileName,
              fileSize: 240_000 + v.version * 40_000,
              mimeType: "application/pdf",
              status: v.status,
              facultyId: demoFac.id,
              comments: v.comments,
              reviewedAt: new Date(),
            },
          });
        }
      }
    }
  }
  console.log("✅ Documents with version history created");

  // ── A completed evaluation on an older project ────────────────────────
  const completedProject = await prisma.project.findFirst({
    where: { status: "COMPLETED" },
    include: { subject: true },
  });

  if (completedProject) {
    const criteria = await prisma.evaluationCriteria.findMany({
      where: { subjectId: completedProject.subjectId, isActive: true },
    });

    if (criteria.length) {
      const existing = await prisma.evaluation.findUnique({
        where: { projectId: completedProject.id },
      });

      if (!existing) {
        // Award roughly 80% of each criterion so the demo shows a realistic grade.
        const marks = criteria.map((c) => ({
          criteriaId: c.id,
          marksAwarded: Math.round(c.maxMarks * 0.8 * 2) / 2,
        }));
        const totalMarks = marks.reduce((s, m) => s + m.marksAwarded, 0);
        const maxTotal = criteria.reduce((s, c) => s + c.maxMarks, 0);
        const percentage = maxTotal ? (totalMarks / maxTotal) * 100 : 0;

        const evaluation = await prisma.evaluation.create({
          data: {
            projectId: completedProject.id,
            facultyId: demoFac.id,
            totalMarks,
            grade: percentage >= 80 ? "A" : percentage >= 70 ? "B+" : "B",
            facultyRemarks:
              "Consistent weekly submissions with solid evidence throughout the semester.",
            mentorRemarks: "Responsive to feedback and never fell behind the expected pace.",
            completedAt: new Date(),
          },
        });

        await prisma.evaluationMark.createMany({
          data: marks.map((m) => ({ ...m, evaluationId: evaluation.id })),
        });
      }
    }
  }
  console.log("✅ Evaluation created");

  // ── Sample notifications ───────────────────────────────────────────────
  if (demoStudent) {
    const notifData = [
      { type: "IDEA_APPROVED", title: "Project Idea Approved", body: "Your AI Resume Analyzer idea has been approved by faculty." },
      { type: "MENTOR_ASSIGNED", title: "Mentor Assigned", body: "Mr. Arjun Nair has been assigned as your mentor." },
      { type: "WEEKLY_PROGRESS_APPROVED", title: "Week 8 Progress Approved", body: "Your Week 8 submission has been verified by faculty." },
      { type: "DEADLINE_APPROACHING", title: "Deadline Approaching", body: "Week 10 progress submission is due in 3 days." },
    ];

    for (const n of notifData) {
      await prisma.studentNotification.create({
        data: { studentId: demoStudent.id, type: n.type, title: n.title, body: n.body },
      });
    }
  }
  console.log("✅ Notifications created");

  // ── Staff notifications + audit trail (spec §53) ──────────────────────
  // Without these the admin's Recent Activity widget and every project's
  // Activity tab render empty, which reads as broken rather than as new.
  const atRiskProjects = await prisma.project.findMany({
    where: { status: { in: ["AT_RISK", "DELAYED"] } },
    select: { id: true, title: true },
  });

  const existingStaffNotifs = await prisma.notification.count();
  if (existingStaffNotifs === 0) {
    for (const p of atRiskProjects) {
      await prisma.notification.create({
        data: {
          userId: demoFacUser.id,
          type: "PROJECT_AT_RISK",
          title: "Project falling behind",
          body: `"${p.title}" is tracking below its expected pace for this week.`,
          link: `/faculty/projects/${p.id}`,
        },
      });
    }

    await prisma.notification.create({
      data: {
        userId: demoMentorUser.id,
        type: "GENERAL",
        title: "Weekly reviews pending",
        body: "Weekly submissions are waiting on your review.",
        link: "/mentor/weekly-reviews",
      },
    });
  }

  const existingLogs = await prisma.activityLog.count();
  if (existingLogs === 0) {
    const capstone = createdProjects["AI Resume Analyzer"];
    const trail = [
      { userId: adminUser.id, action: "LOGIN", entityType: "User", entityId: adminUser.id },
      { userId: adminUser.id, action: "CREATE_ACADEMIC_YEAR", entityType: "AcademicYear", entityId: ay.id },
      { userId: adminUser.id, action: "CREATE_STUDENT", entityType: "Student", entityId: demoStudent?.id },
      { userId: demoFacUser.id, action: "PROJECT_APPROVED", entityType: "Project", entityId: capstone?.id, projectId: capstone?.id },
      { userId: demoFacUser.id, action: "MENTOR_ASSIGNED", entityType: "Project", entityId: capstone?.id, projectId: capstone?.id },
      { userId: demoMentorUser.id, action: "PROGRESS_APPROVED", entityType: "WeeklyProgress", entityId: capstone?.id, projectId: capstone?.id },
      { userId: demoFacUser.id, action: "DOCUMENT_APPROVED", entityType: "Document", entityId: capstone?.id, projectId: capstone?.id },
    ];

    for (const entry of trail) {
      if (!entry.entityId) continue;
      await prisma.activityLog.create({ data: entry });
    }

    // Student-side actions live in their own table.
    if (demoStudent && capstone) {
      for (const action of ["LOGIN", "SUBMIT_PROJECT_IDEA", "SUBMIT_WEEKLY_PROGRESS", "UPLOAD_DOCUMENT"]) {
        await prisma.studentActivityLog.create({
          data: {
            studentId: demoStudent.id,
            action,
            entityType: "Project",
            entityId: capstone.id,
            metadata: { projectId: capstone.id },
          },
        });
      }
    }
  }
  console.log("✅ Staff notifications and activity log created");

  console.log("\n🎉 Seeding complete!");
  console.log("\n📧 Demo Credentials:");
  console.log(`  Admin:   ${adminEmail} / Admin@123`);
  console.log(`  Faculty: ${demoFacEmail} / Faculty@123`);
  console.log(`  Mentor:  ${demoMentorEmail} / Mentor@123`);
  console.log(`  Student: student@sapms.com / Student@123`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
