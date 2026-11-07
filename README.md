# Team Management Software (TMS)

Collaborative task management: projects, members, tasks with priorities and due dates, discussions and file attachments.

- **Frontend:** React 18 + TypeScript (CRA), Tailwind, MUI icons, Redux Toolkit
- **Backend:** Node + Express 4, MongoDB (Mongoose), zod validation, `jose` JWT
- **Auth:** httpOnly cookie session (`tms_token`), server-side revocation on logout, rate-limited login

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
