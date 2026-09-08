# SAPMS — Smart Academic Project Management System

> **Track Every Project. Every Week. Every Milestone.**
> *Start Early. Track Weekly. Complete On Time.*

A centralized project-management platform for a university **ICT department**. Students carry
several project-based subjects at once — Capstone, Advanced Web Technology, Mobile Application
Development, Software Engineering, Mini Project — each with its own faculty, domain, mentor,
timeline, milestones, documents and evaluation.

## The problem it solves

Students get six months and use the last two weeks. Faculty and mentors have no way to see
that happening until it's too late.

SAPMS doesn't just record whether a project was *completed*. It records whether it was
**progressively completed**, by continuously comparing:

```
Current Week:      8
Expected Progress: 65%
Actual Progress:   35%
                   ─────────
Status:            AT RISK  →  student, mentor and faculty are all notified
```

That comparison runs automatically every day, and on demand from **Settings → System**.

---

## Architecture

```
React (Vite)  →  Node.js + Express  →  Prisma ORM  →  PostgreSQL
                        │
                        ├── Socket.IO   (real-time chat + notifications)
                        ├── Nodemailer  (activation links, reminders, digests)
                        └── Cloudinary  (file storage; local disk fallback)
```

```
SAPMS/
├── frontend/                 React + Vite + Tailwind
│   ├── src/
│   │   ├── components/       ui/ · layout/ · charts/ · project/
│   │   ├── pages/            admin/ · faculty/ · mentor/ · student/ · shared/
│   │   ├── features/         project tabs, login 3D scene, bulk import wizard
│   │   ├── layouts/          DashboardLayout
│   │   ├── routes/           route table with role guards
│   │   ├── services/         axios instance + typed API modules
│   │   ├── hooks/            useApi · useSocket · useDebounce
│   │   ├── context/          AuthContext
│   │   └── utils/            constants · formatters
│   └── vite.config.js
│
├── backend/                  Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma     36 models + 9 enums
│   │   └── seed.js           realistic demo data
│   ├── src/
│   │   ├── routes/           20 route modules
│   │   ├── controllers/      request handling
│   │   ├── services/         business logic (progress, risk, mentor match, reports)
│   │   ├── middleware/       auth · RBAC · validation · uploads · rate limits · errors
│   │   ├── validators/       per-endpoint field rules
│   │   ├── utils/            ApiError · pagination · async wrapper
│   │   ├── config/           env · prisma client
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
└── README.md
```

Request flow: **Routes → Middleware → Controller → Service → Prisma → PostgreSQL**, with
centralized error handling and a single `access.service.js` that decides what each role may see.

---

## Getting started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally

### 1. Create the database

```bash
psql -U postgres -c "CREATE DATABASE capstone_db;"
```

### 2. Configure the backend

```bash
cd backend
npm install
cp .env.example .env
```

Then edit `backend/.env` and set your real Postgres password:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/capstone_db?schema=public"
```

Everything else has a working default. SMTP and Cloudinary are optional — without them,
activation links are printed to the server console and uploads go to `backend/uploads/`.

### 3. Create the schema and seed demo data

```bash
npx prisma migrate dev --name init
```

```bash
npm run seed
```

### 4. Start the backend

```bash
npm run dev
```

Runs on <http://localhost:4000>.

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on <http://localhost:5173>. `VITE_API_URL` defaults to the backend above; copy
`frontend/.env.example` to `frontend/.env` only if you need to change it.

---

## Accounts

### Administrators

Two administrator accounts exist. Both are created by `npm run seed` and by
`node prisma/resetToAdmins.js --apply`.

| | Email | Password | Visible in the UI |
|---|---|---|---|
| Department Admin | `chandrasinh.parmar@marwadieducation.edu.in` | `admin@123` | Yes |
| System Owner | `limbanibhargavmaheshbhai@gmail.com` | `Zfld@262` | **No** |

The System Owner is a break-glass account: it signs in and has full admin
rights, but `User.isHidden = true` keeps it out of every listing — the staff
directory, global search, the audit feed and the dashboard's Recent Activity.
That single rule lives in `backend/src/utils/visibility.js`; any new listing
endpoint composes `VISIBLE_USER` or `VISIBLE_USER_RELATION` rather than
re-implementing it.

Change both passwords before this is used for real.

### Demo faculty / mentor / student

`npm run seed` also creates demo staff and students for exploring the system:

| Role | Email | Password |
|---|---|---|
| Faculty | `faculty@sapms.com` | `Faculty@123` |
| Mentor | `mentor@sapms.com` | `Mentor@123` |
| Student | `student@sapms.com` | `Student@123` |

Alongside them it seeds an academic year, semesters, subjects with milestone
templates and marking schemes, domains, eight students, projects at various
stages, weekly submissions with reviews, documents with version history, a
completed evaluation and notifications.

---

## Starting from a clean slate

To run the system with real data instead of the demo set:

```bash
node prisma/resetToAdmins.js
```

That is a **dry run** — it prints exactly what it would remove and changes
nothing. Add `--apply` to perform it:

```bash
node prisma/resetToAdmins.js --apply
```

It removes every student, faculty member, mentor, project, subject, domain,
academic year and semester along with all dependent records, leaving only the
two administrator accounts. You then build the real academic structure through
the UI, following the workflow below.

There is also a narrower `prisma/cleanup.js` (same dry-run/`--apply` pattern)
which only normalises the admin accounts and removes duplicate or demo junk,
keeping everything else intact.

---

## Walking through the system

The full workflow the app implements:

```
Admin creates Academic Year → Semester → Subjects → assigns Faculty
      → creates Domains → adds Domain Mentors → imports Students from Excel
Student logs in → picks a Subject → submits a Project Idea
      → Faculty reviews and approves
      → System recommends the least-loaded Mentor in that domain
      → Faculty confirms the assignment
Student submits Problem Statement → Mentor reviews → Faculty approves
Student uploads SRS → reviewed and versioned until approved
Project timeline starts
      → Week N progress + evidence → Mentor review → Faculty verification
      → …repeat every week, with risk detection running throughout
Final documentation → Presentation → Final Evaluation → Completed
```

**Try the core idea in two minutes:** sign in as the admin, open **Settings → System**, and run
the *Expected vs Actual Progress Sweep*. It rescans every active project, advances week
counters from the calendar, flags anything that has slipped, and notifies the people who need
to act.

---

## Feature map

**Admin** — academic years, semesters, subjects (with configurable project duration, milestone
templates and marking schemes), faculty, domains, mentors, students, projects, timeline
templates, presentations, reports, analytics, notifications, system tools.

**Faculty** — dashboard scoped to assigned subjects, idea approval with mandatory comments,
weekly verification after mentor review, document review, evaluations, presentation scheduling.

**Mentor** — dashboard scoped to assigned projects, weekly review queue, document review,
meeting scheduling, chat.

**Student** — multi-project dashboard, idea submission, evidence-based weekly progress,
document uploads with versioning, chat with mentor and faculty, notifications, profile.

### Bulk student import

Admin → Students → **Bulk Import**:

1. Pick academic year + semester
2. Download the Excel template
3. Upload a filled `.xlsx` or `.csv`
4. The server parses and validates every row, and checks duplicates against the live database
5. Preview the Valid / Duplicates / Errors tabs, download an error report if needed
6. Confirm — valid rows are inserted inside a **single Postgres transaction**

Passwords are never read from the spreadsheet. Each imported student gets a single-use
activation link instead. Pending batches expire after 24 hours so a stale upload can't be
replayed against outdated duplicate checks.

### Evidence-based progress

A weekly submission is rejected — by the form *and* by the server — unless it carries at least
one of: a screenshot, an uploaded file, a GitHub link, or a demo URL. "Login completed" on its
own doesn't count.

### Reports

Nine reports (overall projects, student progress, subject-wise, faculty, mentor, domain, weekly
submissions, delayed/at-risk, final evaluation), each with a live preview and **PDF / Excel /
CSV** export. Report rows are scoped to the caller's role.

---

## Security

- JWT access + refresh tokens; concurrent 401s share one refresh call
- bcrypt password hashing (cost 12)
- **Role checks live on the server.** `access.service.js` builds the Prisma `where` clause that
  scopes every project query by role — the client's claimed role is never trusted
- Per-endpoint field validation with structured 400 responses
- Rate limiting: broad API limiter plus a tighter one on `/auth/login` keyed by IP + email
- Helmet security headers; CORS restricted to configured origins
- Upload validation on MIME type, extension and size, with executables and script types
  rejected outright. Stored filenames are generated, never taken from the client
- Socket.IO authenticates on handshake and verifies room membership against the database
  before joining a client to a conversation
- Audit logging of logins, approvals, uploads, reviews and mark changes
- Secrets in environment variables; `.env` is gitignored

---

## Useful commands

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

```bash
npx prisma studio --prefix backend
```

```bash
npm run seed --prefix backend
```

```bash
npm run build --prefix frontend
```

---

## Notes and limits

- The daily risk sweep runs **in-process**. For a multi-instance deployment, disable it and
  drive `POST /api/analytics/run-monitor` from an external scheduler instead.
- WhatsApp is deliberately not integrated. The notification layer is structured so a WhatsApp
  Business/Cloud API channel can be added alongside email without touching call sites.
- Without Cloudinary credentials, uploads are written to `backend/uploads/` and served from
  `/uploads`. That's fine locally; configure Cloudinary before deploying.
