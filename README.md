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
- **Notifications and Inbox**: assignees, task creators and affected members are notified (never the person who acted). Bell with unread badge in both nav bars, an inbox modal with read/unread, mark-all-read, pagination and click-through to the task. One shared 30 s poller (paused when the tab is hidden). Inboxes are strictly per-user. See `backend/utils/activity.js` for the recipient rules.
- **Flow insights** (Board → Insights): median and 85th-percentile cycle time, tasks completed per week, a created-vs-completed burn-up, the work that has sat longest in a column (flagged when slower than 85% of finished tasks), and per-person figures that only the project manager sees. Inline SVG charts with text alternatives. Calculations are pure functions in `backend/utils/analytics.js`.

## Run locally

```bash
# API  (needs a MongoDB URI; see backend/.env.example)
cd backend && cp .env.example .env   # fill it in
npm install && npm run dev           # http://localhost:8000

# Web
cd frontend && cp .env.example .env
npm install && npm start             # http://localhost:3000
```

## Run with Docker

```bash
cp .env.example .env      # set JWT_SECRET (see the file for a one-liner to generate one)
docker compose up --build
# web: http://localhost:8080   api health: http://localhost:8000/healthz
```

The compose stack runs MongoDB, the API (non-root, health-checked) and the frontend (nginx, SPA fallback, long-cache for hashed assets). It is served over plain HTTP, so it sets `COOKIE_SECURE=false`; remove that when you put it behind HTTPS.

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

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: backend tests (in-memory MongoDB), frontend type check, tests and a production build (with `CI=true`, so any lint warning fails the build), then builds both Docker images and validates the compose file. Dependabot proposes weekly dependency updates.

See [docs/IMPROVEMENT_PLAN.md](docs/IMPROVEMENT_PLAN.md) for the full audit and roadmap.
