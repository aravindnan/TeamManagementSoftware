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
- **Task drawer**: click any task on the project page (list, board, radar, insights, activity) to open it in a slide-over, deep-linkable as `?task=<id>`. Inline editing of title, status, priority, assignee (manager/creator only), due date and estimate; labels; a sub-task checklist with progress; a Markdown description (write/preview, rendered by a small parser that builds React elements and never injects HTML, so descriptions cannot run script); comments; and the task's own history. Edits use a partial `PATCH` so only changed fields are sent and recorded.
- **Google sign-in and registration**: Google Identity Services on the login and register pages. The server verifies the ID token's signature against Google's keys, plus issuer, audience, expiry and `email_verified`. A Google account whose email matches an existing *unverified* password account links to it only after that account's password is cleared and its sessions revoked (pre-hijack defence). Set `GOOGLE_CLIENT_ID` (backend) and `REACT_APP_GOOGLE_CLIENT_ID` (frontend) to the same OAuth Web client ID; without them the button is hidden and the endpoint answers 503.
- **Workspaces and invites**: workspaces with owner / admin / member roles (non-members get 404), a Workspaces panel in both nav bars, a workspace filter on the dashboard, and a workspace picker when creating a project. Invites are email-bound links (256-bit token stored hashed, 7-day expiry, single use, regenerable and revocable) opened at `/invite/:token`; people who already have an account also see an in-app invitations banner. There is no email delivery yet: copy the link and send it yourself. Project members must belong to the project's workspace.
- **Existing projects**: projects created before workspaces keep working. To move them into workspaces run `cd backend && npm run migrate:workspaces` (one "<Name>'s workspace" per project manager, everyone on their projects added as members; safe to re-run).

## Frontend data layer

Server data is cached with TanStack Query (`frontend/src/queries/`):

- **Reads** are hooks (`useMe`, `useProject`, `useTask`, `useProjectRisk`, `useProjectActivity`, `useUnreadCount`, ...). Opening something you have just seen is instant, simultaneous requests for the same data are shared, and stale data is shown while a fresh copy loads.
- **Writes never coordinate refreshes by hand.** `queries/invalidation.ts` is a single declarative table saying which cached data each successful request makes stale; the HTTP layer applies it. New comments are patched straight into the cache; everything else refetches only what is on screen.
- Kanban moves are optimistic updates on the cache with per-task rollback; the inbox is optimistic too.
- The cache is cleared on login, logout and any 401, so one user's data can never reach the next.
- Failed requests are retried only when a retry could help (network errors and 5xx, at most twice).

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
