# TMS: Product & Engineering Improvement Plan

> Scope: a full audit of the current codebase (backend, frontend, data model, security, UX), followed by a target architecture and a feature roadmap. The goal is to turn TMS into a portfolio-grade product.
> **No code has been changed.** Everything in this file is a recommendation.
> Audit date: 2026-11-07, at commit `9bf3871`.

---

## 0. Executive summary

TMS is a MERN-style team task manager. Users register, create projects, add members, assign tasks with a priority and due date, comment on projects and tasks, and attach files through Cloudinary. The UI concept is clean and has a clear visual identity. The core flows work on the happy path.

The implementation is still a student prototype. In priority order, the main problems are:

1. **The API has no authentication at all.** A `verifyToken` middleware exists but no route uses it, and the frontend never sends a token. Anyone who can reach the API can read every user, including password hashes, and can edit or delete any project. They can also call `DELETE /delete-all-users`, `/delete-all-projects` and `/delete-all-tasks`.
2. **Secrets are committed to a GitHub remote.** This includes the MongoDB credentials (`backend/.env`), the JWT signing key (hard-coded in 3 files), the Cloudinary API secret (`frontend/src/env/environment.ts`, which also ships in the browser bundle), and plaintext demo passwords (`documentation/dummy.txt`). **Rotate all of them now**, whether or not the repo is public.
3. **Several endpoints are broken or crash.** These include the members, tasks-by-project and performance endpoints, the completed/pending task endpoints, and `delete_all_data`. Some handlers send a response twice.
4. **The data model is relational, but it is stored as duplicated arrays in Mongo.** `User.allTasks`, `myProjects`, `involvedProjects` and `Project.allTasks` must be kept in sync by hand, and they already drift.
5. **The frontend has no data layer.** Pages re-fetch on a `rerender` boolean toggle. There are 289 `any` types, 154 `console.log` calls, no route guards, no accessibility attributes, and two copy-pasted comment and media implementations.

**Recommendation:** Spend about a week on a **stabilise & secure** pass. Then **re-platform** onto a typed, tested foundation: TypeScript on both ends, Postgres + Prisma, cookie-based auth with RBAC, TanStack Query and real-time updates. After that, build a small number of **signature features**: activity-log-driven AI standups, deadline-risk prediction, capacity-aware assignment, and GitHub PR linking. These give the project a story that stands out on a resume.

---

## Phase 1: How the project works today

### 1.1 Repository layout

```
backend/        Express 4 + Mongoose 8 (CommonJS JS)       ~1.3k LOC
  server.js     route table (all routes registered inside app.listen callback)
  controller/   auth, user, project, task controllers
  model/        User, Project, Task, Comment, File (File unused)
  middleware/   auth.js (verifyToken – never mounted)
  uploads/      8 committed binary blobs from an abandoned multer approach
  node_modules/ ~2,000 files committed to git
frontend/       CRA (react-scripts 5) + React 18 + TS 4.9   ~7.7k LOC
  pages/        Home, Login, Register, ForgotPassword (UI only), Dashboard, ProjectPage, TaskPage, FileDemo, AdminPanel (empty)
  components/   page sections (Dashboard*, ProjectPage*, TaskPage*, Sidebar, TopBar)
  modals/       22 modal components
  services/     axios wrappers (one per domain)
  redux/        one reducer (auth) – projectReducer exists but is not wired in
  env/          hard-coded API URL + secrets
design/, documentation/, research papers/   academic artefacts (drawio, PDFs, Figma)
```

### 1.2 Stack

| Layer | Tech | Notes |
|---|---|---|
| UI | React 18, CRA, Tailwind 3, MUI 5 (icons, Tooltip, date pickers), AOS | Tailwind for layout and MUI for pieces leads to two styling systems |
| State | Redux Toolkit store with a hand-written legacy reducer | Holds only `myUserProfile` |
| HTTP | axios, with no instance, interceptors or auth header | |
| Dates | `moment` **and** `dayjs` | Duplicate libraries; moment is in maintenance mode |
| Backend | Express 4, Mongoose 8, bcryptjs, jsonwebtoken, multer (unused) | `backend/package.json` also lists `react-redux`, `@reduxjs/toolkit` and `axios`, which are unused |
| DB | MongoDB Atlas | |
| Files | Cloudinary, uploaded directly from the browser with an unsigned preset | |
| Tests | CRA's default `App.test.tsx`, which fails (it looks for "learn react") | No backend tests |
| Deploy | None: no Docker, CI, env per stage or build config | |

### 1.3 Core flows (traced)

- **Register:** `Register.tsx` → `POST /register` → bcrypt hash → `User.save`.
- **Login:** `POST /login` → JWT signed with a hard-coded key (2 h expiry) → the frontend writes it to a **JS-readable cookie** (`authServices.ts`) → each page calls `jwtDecode` (which does **not** verify the token) to get `_id` → `GET /get-user-by-id/:id` with populate for `myProjects`, `involvedProjects` and `allTasks` → stored in Redux.
- **Dashboard:** the client splits `allTasks` into pending and completed. The "Overall Performance" figure is completed ÷ total.
- **Project page:** the project ID comes from `?id=` and is fetched with `GET /get-project-by-id`, which populates tasks, manager, members and comments. Every mutation then calls `triggerRerender()`, which toggles a boolean and refetches **everything**.
- **Task page:** works the same way as the project page. Status is binary: `In Progress` / `Completed`.
- **Media:** the browser uploads to Cloudinary (unsigned preset) and then POSTs the URL metadata to the API. "Remove media" deletes only the DB reference; the Cloudinary asset is never deleted.
- **Logout:** `POST /logout` with `userId` in the body sets `loginStatus=false`. The JWT stays valid.

### 1.4 Data model

```
User ──< myProjects[] ──> Project ──< projectMembers[] ──> User
  └──< involvedProjects[] ─┘   └──< allTasks[] ──> Task ──> assignedTo/assignedBy/project
  └──< allTasks[] ───────────────────────────────┘
Project/Task ──< comments[] ──> Comment {senderName, senderId, messageContent, timeStamp}
Project/Task.attachedMediaURLSet[] (embedded)
```

The same relationships are stored in several places (bidirectional arrays). Nothing is transactional. Dates are stored as strings (`dueDate`, `assignedOn`, `dateOfBirth`), and `startDate` is saved as `` `${new Date()}` ``. There are no indexes beyond the `unique` constraints, no timestamps, and no soft delete.

### 1.5 Auth & authorization

- Authentication exists only on the client: the route components check a cookie. The API is fully open.
- Authorization exists only in the UI: for example, `ProjectPageProjectInfo.tsx:86` hides edit and delete from people who are not the manager. The API checks nothing.
- `User.token` and `loginStatus` are written but never used meaningfully. `userLog.token = token` is never saved.

### 1.6 Design system & responsiveness

- There is a clear brand palette (navy `#012B39`, teal, light blue), defined **twice**: in `tailwind.config.js` and in `Constants.ts`, and the two copies disagree (`C44` is `#F4F4F4` in one and `#E1E5F2` in the other).
- Typography and spacing use arbitrary values (`text-[12px]`, `text-[10px]`, `text-[8px]`) instead of a scale. Much body text is 8–12 px, which is too small for comfortable reading.
- Modals are hand-rolled `absolute` overlays. They have no focus trap, no Escape-to-close and no `role="dialog"`. The repo contains **0** `aria-*` attributes.
- On mobile, the sidebar is hidden and a top bar is used instead. Some pages use fixed widths (for example, `ForgotPassword` uses `w-[30%]`).

### 1.7 Testing, error handling, deployment

- There are effectively no tests.
- Every backend controller uses the same `try/catch → 500 "Internal Server Error"` block, about 30 copies.
- The frontend services catch errors and **return the error object as if it were data**, so callers check `res.code === "ERR_NETWORK"` or `res.addStatus`. The success flag differs per endpoint: `success`, `status`, `addStatus`, `addSuccess`, `editStatus`, `updateStatus`, `deleteStatus` and `registerSuccess`.
- There is no deployment configuration. The API URL is hard-coded to `http://localhost:8000`.

---

## Phase 2: Audit findings

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low. Each finding lists where it is, the problem, why it matters, the fix and the impact.

### 2.1 Security & reliability (do these first)

| # | Sev | Where | Problem | Why it matters | Fix | Impact |
|---|---|---|---|---|---|---|
| S1 | 🔴 | `backend/server.js`, all routes | No auth middleware on any route. `verifyToken` is never mounted, and the frontend never sends a token. | Anyone on the internet has full read and write access, including mass deletes. | Mount the auth middleware globally except on `/auth/*`. Take the user ID **from the token**, never from `:userId` params or the body. | Closes the biggest hole |
| S2 | 🔴 | `backend/.env`, `frontend/.env`, `frontend/src/env/environment.ts`, `documentation/dummy.txt` | DB password, JWT key, Cloudinary API secret and demo user passwords are committed to a GitHub remote. The Cloudinary secret also ships in the JS bundle. | Credential compromise of the DB and the media account. | **Rotate all of them.** Purge them from history (`git filter-repo`), add `.env*` to `.gitignore`, provide `.env.example`, and keep only public config in the frontend (`VITE_API_URL`). | Required before showing the repo to anyone |
| S3 | 🔴 | `authController.js:81`, `middleware/auth.js:11`, `environment.ts:2` | The JWT secret is a hard-coded string and is also present in frontend code. | Anyone can forge tokens for any user. | Read it from env, require ≥32 random bytes, and fail at startup if it is missing. | |
| S4 | 🔴 | `routes/*` `delete-all-*`, `authController.delete_all_data` | Unauthenticated endpoints that wipe whole collections. (`delete_all_data` also throws a ReferenceError because `Task` and `Project` are not imported.) | One curl call deletes all data. | Delete them, and move seeding and reset into a `scripts/seed.ts` that only runs in dev. | |
| S5 | 🔴 | `userController.get_all_users` / `get_user_by_id` | Returns full user docs, **including bcrypt hashes and tokens**, to every client. `AddNewMemberModal` loads every user in the system. | Leaks credentials and PII (DOB, email). | Add `select: false` on `password`/`token`, and use response DTOs. Replace "all users" with a scoped `GET /users/search?q=` that has a limit. | |
| S6 | 🟠 | All mutating routes | No ownership or role checks: any user can edit or delete any project or task, remove members, or post comments as someone else (`senderName`/`senderId` come from the body). | Broken access control (OWASP A01). | RBAC: project roles `owner/admin/member/viewer`. Use a `requireProjectRole('admin')` middleware and derive the sender from `req.user`. | |
| S7 | 🟠 | `authServices.ts` | The JWT is stored in a JS-readable cookie and only *decoded* with `jwtDecode`, never verified. Logout does not revoke anything. | XSS gives token theft. An expired or forged token still "logs in" the UI. | Use a short-lived access token plus a rotating refresh token in **httpOnly, Secure, SameSite=Lax** cookies. Add `GET /auth/me` as the source of truth, and a server-side refresh-token denylist on logout. | |
| S8 | 🟠 | All controllers | No input validation. Inputs go straight into Mongoose (`req.body` spread, `$push: mediaDataArray`). | NoSQL operator injection, junk data, crashes on bad ObjectIds (only some handlers check `isValidObjectId`). | Add a Zod schema per route plus a `validate()` middleware, and enforce length limits on titles and comments. | |
| S9 | 🟠 | `*AddMediaModal.tsx:49/56` | Unsigned Cloudinary upload preset, with no size or type limits enforced server-side. | Anyone can use your Cloudinary account as free storage. | Use signed uploads: the API issues a signature scoped to the folder, size and type. Validate MIME type on the server, and delete the asset when it is removed. | |
| S10 | 🟠 | `server.js:10` | `cors()` allows all origins, with no Helmet, rate limiting or body-size limit. | Clickjacking, brute-force login, large-payload DoS. | Use a CORS allow-list, `helmet`, `express-rate-limit` (strict on `/auth/login`), `express.json({limit:'100kb'})`. | |
| S11 | 🟡 | `authController.register` | No password policy, email format check or username normalisation. Different errors for "username exists" and "user does not exist" let an attacker enumerate accounts. | Account enumeration, weak passwords. | Use a generic "invalid credentials" message, Zod rules, case-insensitive unique email, and optionally an email-verification flow. | |
| S12 | 🟡 | `frontend/src/setupProxy.ts` | Leftover proxy to a third-party domain (`clickdimensions.com`), containing zero-width characters. | Unexpected, and confusing to reviewers. | Delete it. | |
| S13 | 🟡 | Everywhere | `console.log` of request bodies (including login passwords in `authController.js:59`) and of user docs. | Secrets end up in logs. | Use structured logging (`pino`) with redaction, and log nothing on the client in production. | |
| S14 | 🟡 | `server.js:13-15` | Routes and `express.json()` are registered *inside* the `listen` callback after an un-awaited connect. The `try/catch` cannot catch connection failures. | The server can accept requests before routes or the DB exist. A DB failure leaves no process alive and no error is shown. | `await mongoose.connect()` → build the app → `listen`. Add graceful shutdown, `/healthz`, and a centralised error handler. | |
| S15 | 🔵 | `backend/node_modules`, `backend/uploads` | Dependencies and binary uploads are committed. | Repo bloat, and reviewers notice it immediately. | Remove them from the index and add them to `.gitignore`. | |

### 2.2 Correctness bugs (these fail today)

| # | Where | Bug | Fix |
|---|---|---|---|
| B1 | `projectController.js:49,70,106` | Uses `req.params.projectID` (wrong case, so it is `undefined`) and `Project.find({projectID})` (no such field, returns an array). Members, tasks-by-project and performance endpoints return garbage. `calculateOverallPerformance` reads a non-existent `completedTasks`. | Use `findById(req.params.projectId)`; calculate performance with an aggregation. |
| B2 | `projectController.js:183-197` | After sending a 404 there is no `return`, so the handler falls through to `res.status(201)`. This throws "headers already sent". `Task.deleteOne(newTask._id)` has the wrong signature. The assignee is not checked to be a project member. | Validate the project and assignee **before** creating the task, and do it in a transaction. |
| B3 | `userController.js:137,163` | The completed/pending endpoints use `User.find({userId})` (returns an array, wrong field) and read fields that don't exist in the schema. They are also not registered in `server.js`, so they 404. | Delete them, and replace with `GET /me/tasks?status=`. |
| B4 | `userController.js:241` | `update_user_profile` dereferences `USER` before the null check, and a duplicate username or email returns 500. | Use `findByIdAndUpdate` with validation, and map E11000 to 409. |
| B5 | `authController.js:61` | Missing `return` after the 400 response, so execution continues. | Add the `return`. |
| B6 | `taskController.js:86` | The error path returns `editStatus: true`. | Fix it as part of the response-shape standardisation (see Q3). |
| B7 | Comment components (`ProjectPageDiscussion.tsx:54`, `TaskPageTaskStatusMarker.tsx:51`) | Sets "loading" *before* validating, so an empty comment leaves the button stuck on "Posting…". `emptyState.timeStamp` is frozen at first render. | Validate first. The server sets the timestamp. |
| B8 | `Login.tsx:104` | Calls `window.atob(res.userId)` on a non-base64 ObjectId, which throws `InvalidCharacterError`. | Remove it. |
| B9 | `deleteProject`, `deleteTask` | Comments and Cloudinary assets are orphaned. User `allTasks` cleanup only covers *current* members. | Cascade deletes in a transaction, or (better) a relational schema with FK `ON DELETE CASCADE` or soft delete. |
| B10 | `App.test.tsx` | The default CRA test fails. | Replace it with real tests. |
| B11 | `ForgotPassword.tsx` | UI only: no submit handler and no backend. | Implement a proper reset flow with an emailed token, or hide the link. |
| B12 | `projectReducer.ts` | Missing `default:` return, so it returns `undefined` (dormant because it is not wired in). | Delete it, or move to RTK slices or TanStack Query. |

### 2.3 Code quality & maintainability

| # | Problem | Where | Why it matters | Fix | Impact |
|---|---|---|---|---|---|
| Q1 | RPC-style, inconsistent URLs (`/get-project-by-id/:id`, `/add-new-task-by-project-id/:id`, `/remove-media-from-task/:tasktId`). Each route is registered twice (`server.js` and the router file). | backend | Hard to discover and version, and doesn't look like a professional API. | REST resources under `/api/v1`: `GET /projects/:id`, `POST /projects/:id/tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id/attachments/:attId`. Mount each router once with `app.use('/api/v1/projects', projectRouter)`. Publish an OpenAPI spec (generated from Zod with `zod-to-openapi`) at `/docs`. | High (reviewers judge this quickly) |
| Q2 | No service layer. Controllers hold business logic, DB access and response formatting. | backend | Untestable, logic is duplicated. | Layers: `routes → controller (HTTP) → service (domain) → repository (Prisma)`. Add an `asyncHandler` plus typed `AppError` classes and one error middleware. | High |
| Q3 | 8 different success flags. Errors are returned as data from the frontend services. | both | Every caller needs special-case code, and errors are silently swallowed. | Successes return the resource. Errors return the RFC 7807 `problem+json` shape. The frontend `apiClient` throws a typed `ApiError`, which TanStack Query handles. | High |
| Q4 | 289 `any`, `props:any` everywhere, no shared types. | frontend | TypeScript gives almost no safety. | Shared `packages/types` (or types inferred from Zod schemas used by both sides). Turn on `noImplicitAny` and ESLint `@typescript-eslint/no-explicit-any`. | High |
| Q5 | Duplicate components: `ProjectPageAddMediaModal` and `TaskPageAddMediaModal` (~210 lines each), two comment threads, four "Delete … Confirmation" modals, `ProjectPageAttachedMedia` and `TaskPageAttachedMedia`. | frontend | Bugs get fixed in one copy only (B7 exists in both). | Generic `<ConfirmDialog>`, `<AttachmentUploader entity=…>`, `<CommentThread entityType entityId>`. | Medium-High, removes ~1,000 LOC |
| Q6 | Modal visibility is managed with ~12 `useState` booleans per page and threaded through props. | `ProjectPage.tsx` | Prop drilling, hard to deep-link. | Route-driven modals (`/projects/:id/tasks/:taskId` opens the task drawer) or a small modal store. | Medium |
| Q7 | Query-string routing (`/project-page?id=`). `navigate("*")` is used as a "not found". | frontend | Not shareable or idiomatic. | Use `/projects/:projectId` and `/tasks/:taskId`, and a proper `<NotFound>`. | Medium |
| Q8 | Dead code and leftovers: `FileDemo`, `AdminPanel`, `data/data.ts` (286 lines of dummy data still imported by 8 files), `model/file.js`, `multer`, `uuid`, `jsonwebtoken`/`cors`/`http-proxy-middleware` in the frontend, `react-redux` in the backend, `import { error } from 'console'` in a browser file, unused `isTemplateExpression` import. | both | Noise and bundle weight. | Delete them, and add `knip` or `depcheck` to CI. | Medium |
| Q9 | Two date libraries, two styling systems, two copies of the palette. | frontend | Inconsistency, larger bundle. | Keep `date-fns` or `dayjs` only. Use Tailwind tokens as the single source; drop `Constants.colors`. | Medium |
| Q10 | Naming: `C11/C22`, `Performace`, `setDeleteProjetModal`, `tasktId`, `SucessGreen`, controller names such as `add_new_media_to_project` inside `taskController`. | both | Reads as unfinished. | Semantic tokens (`primary`, `surface`, `danger`), consistent camelCase, spell-check in CI. | Low-Medium |
| Q11 | `document.title = …` in the render body; `useEffect` with missing dependencies. | pages | Side effects run on every render, and lint warnings are hidden. | Add a `useDocumentTitle` hook and enable `react-hooks/exhaustive-deps` as an error. | Low |
| Q12 | CRA is deprecated. TS 4.9, React Router v6 used from both `react-router` and `react-router-dom`. | frontend | Slow dev server, no maintenance. | Migrate to Vite + TS 5 + React 19 (or Next.js if you want SSR). | Medium |

### 2.4 Performance

| # | Problem | Where | Why it matters | Fix | Expected impact |
|---|---|---|---|---|---|
| P1 | **Refetch-everything on any change.** `triggerRerender()` reloads the whole project (tasks, members, comments) after one comment. | all pages | N× payload, UI flicker, lost scroll position. | TanStack Query with granular keys (`['project',id]`, `['project',id,'comments']`), targeted `invalidateQueries`, **optimistic updates** for status toggles and comments. | 5–20× less data per action, instant-feeling UI |
| P2 | **Over-populated user profile.** `GET /get-user-by-id` populates every project and task document, on every page load (Dashboard, Project and Task pages each call it again). | `userController.get_user_by_id` | Payload grows O(projects + tasks) on every page load. | `GET /auth/me` returns a slim user. The dashboard uses dedicated paginated endpoints (`/me/tasks?status=&limit=`, `/me/projects`). Cache `me` with `staleTime: 5min`. | Smaller payloads, fewer requests |
| P3 | No pagination anywhere (tasks, comments, users, media). | backend | Unbounded responses. | Cursor pagination (`?cursor=&limit=`) and infinite scroll for comments and activity. | Scales to large projects |
| P4 | No DB indexes on hot paths (`Task.project`, `Task.assignedTo + taskStatus`, comments by entity). | models | Collection scans. | Composite indexes (or Postgres indexes after migration). | Faster queries |
| P5 | Whole-app bundle: every route and all 22 modals load up front, plus MUI, moment (with locales), AOS and react-pdf. | frontend | Slow first load (CRA has no route splitting). | `React.lazy` per route and per heavy modal (PDF viewer). Drop moment and AOS. Import MUI icons per path, or switch to `lucide-react`. Check results with `vite-bundle-visualizer`. | Likely 40–60 % smaller initial JS |
| P6 | Derived state copied into `useState` + `useEffect` (pending/completed split, `filteredTasks`). | Dashboard, ProjectPage, ViewAllTaskModal | Extra renders, stale state. | `useMemo` derived values, or do the work on the server. | Fewer renders |
| P7 | Lists render without `key`, or with `key` on the wrong element (`Tooltip` wrapping a fragment). Comment lists use `<>` without keys. | several components | React warnings, unnecessary DOM reconciliation. | Stable `key={id}` on the outermost element. | Small |
| P8 | `getRandomColor()` (with `console.log`) runs during render, so avatar colours change on every render. | Sidebar/members | Visual jitter. | Deterministic colour from a hash of `userId`. | Small, but noticeable polish |
| P9 | Images and attachments are loaded at full resolution. | media lists | Bandwidth. | Cloudinary transformations (`f_auto,q_auto,w_…`) and `loading="lazy"` on thumbnails. | Faster media views |
| P10 | `setTimeout` error auto-clear is repeated in ~15 components. | modals | Duplicated code, potential state updates after unmount. | Centralised toast system (`sonner`) instead of local error boxes. | Cleaner code |

### 2.5 UI/UX

| # | Problem | Where | Why it matters | Fix |
|---|---|---|---|---|
| U1 | **Misleading "Overall Performance %".** It is completed ÷ total, so a user with 1 done task out of 1 scores 100 %, and someone who was assigned more work looks worse. The detailed modal is commented out. | Dashboard, Project page | Users read it as a judgement of their performance. | Replace it with flow metrics (see F6): completion this week, overdue count, cycle time trend. |
| U2 | Binary status (`In Progress`/`Completed`), with no To-do, In review, Blocked or custom states. | Task model and UI | This doesn't match how teams actually work. | Configurable workflow states per project, plus a Kanban board. |
| U3 | No board, list, calendar or timeline views. Tasks appear only as stacked lists, and "View all tasks" is a modal. | Project page | The core job of a task manager (seeing and moving work) is weak. | Board, list (sortable table) and calendar views, with filters saved in the URL. |
| U4 | Body text is 8–12 px and many labels are 10 px bold. Contrast `#012b3927` on `#F4F4F4` is about 1.3:1. | everywhere | Fails WCAG AA and is tiring to read. | Type scale starting at a 14 px base, and contrast checked tokens. |
| U5 | No accessibility: 0 `aria-*` attributes. Modals have no focus trap or Escape handling. Icon-only buttons rely on tooltips as their label. Clickable `div`s are used. Inputs have placeholders but no `<label>`. | everywhere | Unusable with a keyboard or screen reader, and reviewers increasingly check this. | Use Radix/shadcn primitives (Dialog, DropdownMenu, Popover), label every input, give icon buttons an `aria-label`, add axe checks in Playwright. |
| U6 | Loading states are plain text ("Accumulating Project Details…"). Errors are a single generic "An Error Occurred" with no retry. | pages | The app feels unfinished. | Skeleton loaders, inline retry buttons, route-level error boundaries. |
| U7 | Destructive actions use a modal confirmation but there is no undo. The success feedback is the whole page reloading. | modals | Error-prone and jarring. | Optimistic update plus an "Undo" toast (soft delete makes this possible). |
| U8 | No global navigation: the sidebar has only a logo, profile and logout. There is no project switcher, search or "My tasks" page. On non-dashboard pages the logout button is hidden. | Sidebar | Weak information architecture. | Proper app shell: workspace switcher, Home, My Tasks, Inbox, Projects (list with stars), Settings, a ⌘K command palette and the user menu. |
| U9 | Forgot Password link leads to a non-functional page. | Login | Broken promise to the user. | Implement it or remove it. |
| U10 | No dark mode, no avatars (initials only), no profile picture upload even though the schema has `profilePictureURL`. | | Looks dated. | Theme tokens with dark mode, avatar upload. |
| U11 | Mobile: dense two-column layouts collapse, but modals use `absolute` instead of `fixed`, so a modal appears off-screen if the page is scrolled. | modals | Mobile bugs. | `fixed inset-0` dialogs (Radix handles this), bottom sheets on mobile. |
| U12 | No empty-state guidance on a fresh dashboard. AOS animations are installed but barely used. | Dashboard | First-run experience is poor. | An onboarding checklist ("Create a project → invite a teammate → add a task"), illustrated empty states, a seeded sample project. |

---

## Phase 2.5: Target architecture (portfolio-grade)

A practical stack that hiring managers recognise, without over-engineering:

```
apps/
  web/        React 19 + Vite + TS, TanStack Query, TanStack Router (or RR7), Tailwind + shadcn/ui (Radix),
              react-hook-form + Zod, dnd-kit (board), Recharts, sonner (toasts), socket.io-client
  api/        Node 22 + Express 5 (or Fastify) + TS, Zod validation, Prisma ORM, pino, helmet, rate-limit,
              Socket.IO, BullMQ workers (notifications, digests, AI jobs)
packages/
  shared/     Zod schemas + inferred types + API client (single source of truth)
infra/
  docker-compose.yml   postgres, redis, api, web, mailpit
  .github/workflows    lint → typecheck → unit → integration (testcontainers) → e2e (Playwright) → deploy
```

**Key decisions**

| Decision | Recommendation | Reason |
|---|---|---|
| Database | **PostgreSQL + Prisma** (migrate from Mongo) | The domain is relational (memberships, assignments, comments, activity). FKs and transactions remove the whole class of drift bugs in B9. Full-text search and `pgvector` give search and AI features without another service. |
| Auth | Access JWT (15 min) + rotating refresh token in httpOnly cookies, `/auth/me`, optional Google/GitHub OAuth | Secure by default, and a common interview topic. |
| Authorization | Workspace → Project → Role (`owner/admin/member/viewer`), checked in one `can(user, action, resource)` policy module | Easy to test, explain and extend. |
| Real-time | Socket.IO rooms per project, which invalidate TanStack Query caches | Live collaboration without changing how state is managed. |
| Activity log | Append-only `Activity` table written by the service layer for every mutation | Backbone for the audit trail, notifications, undo, analytics and AI digests. |
| Files | Signed direct-to-Cloudinary (or S3) uploads, plus an `Attachment` table | Secure and scalable. |
| Observability | pino logs, Sentry (web + api), `/healthz`, basic OpenTelemetry traces | Production-ready signals. |
| Quality gates | ESLint + Prettier + `tsc --noEmit`, Vitest, Supertest + Testcontainers, Playwright + axe, ≥70 % service coverage | Shows engineering maturity. |
| Deploy | Web → Vercel/Netlify. API + worker → Fly.io/Render/Railway. Neon/Supabase Postgres, Upstash Redis. Preview environment per PR. | Live demo link with a seeded demo account. |

**Proposed relational schema (core)**

```
Workspace(id, name, slug)                    WorkspaceMember(workspaceId, userId, role)
User(id, email, name, avatarUrl, passwordHash?, createdAt)
Project(id, workspaceId, key "TMS", name, description, status, startDate, targetDate, archivedAt)
ProjectMember(projectId, userId, role)
WorkflowState(id, projectId, name, category[backlog|todo|in_progress|done|canceled], position, color)
Task(id, projectId, number, title, descriptionMd, stateId, priority, assigneeId, reporterId,
     dueDate DATE, estimate, parentId, position, createdAt, updatedAt, completedAt, deletedAt)
TaskDependency(blockerId, blockedId)         Label / TaskLabel
Comment(id, entityType, entityId, authorId, bodyMd, createdAt, editedAt)   Mention(commentId, userId)
Attachment(id, entityType, entityId, uploaderId, url, publicId, mime, size)
Activity(id, workspaceId, actorId, verb, entityType, entityId, diff JSONB, createdAt)
Notification(id, userId, activityId, readAt, snoozedUntil)
Integration(id, workspaceId, provider, config JSONB)       ApiToken / Webhook
```

---

## Phase 3: Features

The features fall into two groups. **Parity** features are expected in any modern task manager; build them, but they will not make the project stand out. **Signature** features are what make it memorable in a demo or interview. Each one has a clear technical story.

### 3.1 Parity features (needed for credibility)

1. **Kanban board + list + calendar views**, with drag-and-drop between custom workflow states (dnd-kit, fractional `position` ordering, optimistic reorder).
2. **Task detail drawer** with a Markdown description, sub-tasks, labels, estimate, watchers and a unified activity + comment timeline.
3. **@mentions and an in-app Inbox** (triage: mark done, snooze, open).
4. **Filters and saved views** stored in the URL (`?assignee=me&state=in_progress&label=bug`), shareable and bookmarkable.
5. **⌘K command palette** for jumping to project or task, creating a task and running quick actions. Keyboard shortcuts (`c` create, `j/k` navigate, `x` select).
6. **Workspace invites** by email link (instead of picking from a global list of all users), with role assignment.
7. **Dark mode, avatar upload, onboarding checklist** and a seeded demo workspace.

### 3.2 Signature features

Ranked by how much they would impress relative to effort. The first four are recommended as the headline features.

#### F1. AI daily standup & project digest ★ headline
- **What:** Each morning, every user gets a generated digest: what changed in their projects yesterday, what is blocked, what is due in 48 h, and who is waiting on them. Project owners get a weekly status report they can post to stakeholders in one click.
- **How:** A BullMQ cron job reads the `Activity` log per user or project and sends a compact, structured JSON summary to Claude (`claude-sonnet-5-5` for cost and quality). The output is **grounded**: every bullet links to the source task or comment. The result is delivered to the Inbox, email (Resend), and optionally Slack.
- **Why it stands out:** It shows event sourcing, background jobs and responsible LLM use (grounding, citations, token budgeting, caching). It also replaces a real meeting.

#### F2. Deadline risk radar ★ headline
- **What:** Each open task gets an "at risk" badge with an explanation, for example: *"Due in 2 days, typical cycle time for this assignee and priority is 5 days, no activity for 4 days, blocked by TMS-41."*
- **How:** Start with a transparent heuristic model: historical cycle-time percentiles per assignee/priority/label, staleness, open dependencies and remaining time. This is computed in SQL and stored on a schedule. Later this can be upgraded to a simple logistic regression trained on your own completion data. Always show the contributing factors.
- **Why it stands out:** It is explainable predictive analytics, not "AI because AI". It also gives the dashboard a purpose.

#### F3. Capacity-aware assignment & workload heatmap ★ headline
- **What:** A team heatmap (people × days) of open estimated work against capacity. When assigning a task, TMS suggests the best assignee, with reasons: lowest load, has done similar tasks before, not on leave.
- **How:** Estimates and per-member weekly capacity, plus SQL window functions. "Similar tasks" uses `pgvector` embeddings of task titles and descriptions.
- **Why it stands out:** It addresses the real "who is overloaded?" question that managers ask.

#### F4. GitHub integration: PRs ↔ tasks ★ headline
- **What:** Task keys (`TMS-123`) in branch names, PR titles or commit messages automatically link the PR to the task. When a PR opens, the task moves to *In review*; when it merges, the task moves to *Done*. CI status shows on the task.
- **How:** A GitHub App with webhooks to a signature-verified endpoint, idempotent processing in a queue, and a per-project mapping of events to workflow states.
- **Why it stands out:** Recruiters at engineering companies immediately understand it. It shows webhooks, OAuth apps, idempotency and HMAC verification.

#### F5. Natural-language task capture
- **What:** Type *"Fix login redirect bug for Priya, high, due Friday, blocks TMS-12"* in ⌘K and get a structured task preview to confirm. The same feature can turn pasted meeting notes into a batch of proposed tasks with owners.
- **How:** Claude tool-use with a strict JSON schema (the same Zod schema as the API), with the project's members and labels as context. Always preview the result before saving.
- **Why it stands out:** A useful AI feature, kept safe by schema validation and a human confirmation step.

#### F6. Flow analytics (replaces the "Overall Performance %")
- **What:** Burn-up chart, cumulative flow diagram, cycle-time scatter plot, throughput per week, an aging-WIP list, and overdue trend. Each has a per-project and per-person scope, plus a privacy toggle so that per-person charts are visible only to that person and admins.
- **How:** SQL over `Activity` state transitions (`completedAt`, time in each state). Charts with Recharts.
- **Why it stands out:** These are real agile metrics, not a vanity percentage.

#### F7. Real-time collaboration layer
- **What:** Live board updates, presence avatars on tasks ("Ana is viewing"), typing indicators in comments, and conflict-safe edits (last-write-wins with a version check, plus a "this task changed, reload?" notice).
- **How:** Socket.IO rooms per project, Redis adapter for horizontal scale, events that invalidate the TanStack Query cache, and an `updatedAt` precondition for optimistic concurrency.

#### F8. Dependencies, timeline & critical path
- **What:** "Blocked by / blocks" relationships, a Gantt-style timeline, critical path highlighting, and automatic shifting of dependent dates (with confirmation).
- **How:** A DAG in `TaskDependency`, cycle detection on insert, and a longest-path calculation.
- **Why it stands out:** Good algorithmic content to talk through in an interview.

#### F9. No-code automation rules
- **What:** "When a task moves to *Done* and has label `bug`, assign it to QA and notify #qa-channel." "When a task has been overdue for 2 days, ping the assignee and the project admin."
- **How:** Rules stored as JSON (trigger + conditions + actions), evaluated by a worker on `Activity` events, with an execution log and loop protection.

#### F10. Stakeholder status page
- **What:** A public, read-only, unguessable link per project showing progress, milestones and the latest AI weekly report. It can be revoked at any time.
- **How:** Signed share tokens and a separate public route with server-side rendering for fast loads and link previews.

#### F11. Semantic search & duplicate detection
- **What:** Global search across tasks, comments and file names that understands meaning ("login issues" finds "auth redirect bug"). When creating a task, TMS warns: *"Looks similar to TMS-88 (open)"*.
- **How:** Postgres full-text search combined with `pgvector` similarity (hybrid ranking), with embeddings generated asynchronously on write.

#### F12. Smart notifications
- **What:** Per-user preferences (in-app, email, Slack), digest batching instead of one message per event, quiet hours, and "only notify me for high priority or @mentions".
- **How:** A notification fan-out worker, with a preference matrix and a batching window.

#### F13. Light, team-positive gamification (optional)
- **What:** "Kudos" reactions on completed tasks and a weekly "shipped" highlight reel generated from the activity log. **No** individual leaderboards, because they push people to optimise for task count over quality and damage trust in the tool.

#### F14. Integrations pack
- An iCal feed of due dates (cheap and very useful), a Slack slash command `/tms create …`, an outgoing webhooks API with HMAC signatures, personal API tokens, and CSV/JSON import and export (including an import from Trello or Jira CSV).

---

## Phase 4: Roadmap

| Milestone | Duration | Outcome |
|---|---|---|
| **M0: Stop the bleeding** | 2–3 days | Rotate all secrets and purge them from history. Remove `node_modules`, `uploads` and `.env` from git. Delete the `delete-all-*` routes. Mount auth. Strip password hashes from responses. Fix B1–B8. |
| **M1: Foundation** | 1–2 weeks | Monorepo (pnpm + Turborepo). TypeScript API with Zod, a service layer and an error middleware. Postgres + Prisma schema and a migration script from Mongo. Cookie auth + RBAC. Vite web app with TanStack Query and shadcn. Docker Compose. CI with lint, typecheck and tests. |
| **M2: Core UX parity** | 2 weeks | App shell with navigation, board/list/calendar views, task drawer, comments with mentions, Inbox, filters in the URL, ⌘K palette, skeleton loaders, toasts with undo, accessibility pass, dark mode, onboarding + seed data. |
| **M3: Collaboration** | 1 week | Activity log, Socket.IO live updates and presence, notifications worker, email via Resend. |
| **M4: Intelligence** | 2 weeks | F2 risk radar, F6 flow analytics, F3 workload heatmap, F1 AI standup, F5 NL capture. |
| **M5: Integrations & polish** | 1–2 weeks | F4 GitHub App, iCal, webhooks, F10 status page, performance budget (Lighthouse ≥ 90), Sentry. |

### Resume-showcase checklist

- [ ] README with a live demo link, a one-click demo login, a GIF or Loom, an architecture diagram (Mermaid) and a "key engineering decisions" section
- [ ] `docs/adr/` with 4–6 Architecture Decision Records (Postgres over Mongo, cookie auth, activity log, AI grounding)
- [ ] OpenAPI docs hosted at `/docs`
- [ ] CI badges (build, coverage), Playwright e2e covering login → create project → add task → move on board
- [ ] Lighthouse and axe scores recorded in the README
- [ ] Security notes: RBAC matrix, rate limits, signed uploads, secret management
- [ ] A short "metrics" section, for example: "initial JS reduced 58 %, p95 API latency 80 ms with seeded 10k tasks"

---

## Appendix A: Quick wins (each under 1 hour)

1. Add a `return` after early responses (`authController.js:61`, `projectController.js:185,190`).
2. Fix `req.params.projectID` → `projectId` (3 places).
3. Remove `window.atob` in `Login.tsx:104`.
4. Move `setPostCommentStatus("post-loading")` after validation (2 components).
5. Delete `setupProxy.ts`, `FileDemo`, `AdminPanel`, `data/data.ts` imports, and `import { error } from 'console'`.
6. Add `select: false` to `User.password` and `User.token`.
7. Make `Constants.colors` and `tailwind.config.js` agree, or delete one.
8. Replace the default `App.test.tsx` with a smoke test that renders the login page.
9. Deterministic avatar colour from the user ID.
10. Move modals to `fixed` positioning and close them on Escape.

## Appendix B: Files to delete or untrack

`backend/node_modules/**`, `backend/uploads/**`, `backend/.env`, `frontend/.env`, `frontend/src/env/environment.ts` (replace with `import.meta.env`), `frontend/src/setupProxy.ts`, `frontend/src/pages/FileDemo.tsx`, `frontend/src/pages/AdminPanel.tsx`, `backend/model/file.js`, `documentation/dummy.txt`, `documentation/.$EntityRelationship.drawio.bkp`, `design/PhotsofUI.zip` (keep the PNGs).
