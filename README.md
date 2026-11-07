# Team Management Software (TMS)

Collaborative task management: projects, members, tasks with priorities and due dates, discussions and file attachments.

- **Frontend:** React 18 + TypeScript (CRA), Tailwind, MUI icons, Redux Toolkit
- **Backend:** Node + Express 4, MongoDB (Mongoose), zod validation, `jose` JWT
- **Auth:** httpOnly cookie session (`tms_token`), server-side revocation on logout, rate-limited login

## Features

- Projects, members and tasks with priorities and due dates; discussions and file attachments
- **Kanban board** (To Do / In Progress / In Review / Completed) with drag and drop and a keyboard-friendly status menu
- **Deadline risk radar**: explainable per-task risk scores. Each flagged task lists the exact reasons (overdue, too little time for the remaining work given how long this project's finished tasks usually take, no recent activity, overloaded assignee), and the board shows risk chips on cards. Logic lives in `backend/utils/risk.js`.
- **Activity feed**: an append-only log of what happened in each project (task created/moved/edited/deleted, comments, files, members, project edits) with field-level changes, category filters and cursor pagination. Entries snapshot names and titles so they stay readable after the thing they describe is deleted. Logging can never fail the action that triggered it. See `backend/utils/activity.js`.

## Run locally

```bash
# API  (needs a MongoDB URI; see backend/.env.example)
cd backend && cp .env.example .env   # fill it in
npm install && npm run dev           # http://localhost:8000

# Web
cd frontend && cp .env.example .env
npm install && npm start             # http://localhost:3000
```

## Tests

```bash
cd backend && npm test               # API integration tests (in-memory MongoDB, no real DB needed)
cd frontend && CI=true npm test -- --watchAll=false
```

## Security model (summary)

- Every route except `register`, `login`, `logout` and `healthz` requires a valid session. The user identity always comes from the session, never from the request body or URL.
- Project **manager**: edit/delete project, manage members, create tasks. Project **members**: read, comment, attach files. Task **assignee / creator / manager**: edit, change status.
- Uploads are signed server-side (`POST /uploads/sign`); the Cloudinary secret never reaches the browser.
- Passwords are bcrypt-hashed and never returned by any endpoint. Other users only expose public fields.

See [docs/IMPROVEMENT_PLAN.md](docs/IMPROVEMENT_PLAN.md) for the full audit and roadmap.
