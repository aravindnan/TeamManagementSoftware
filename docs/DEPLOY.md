# Deploying TMS

```
Browser ──► Vercel (static web + /api rewrite) ──► Render (API, Docker) ──► Neon (Postgres)
```

The browser only talks to the Vercel domain. `/api/*` is proxied to Render (`frontend/vercel.json`), so the session cookie is first-party and works in Safari and Chrome with third-party cookies blocked.

Pushes to `main` run CI; when it passes, `.github/workflows/deploy.yml` copies the API settings from GitHub secrets into Render, triggers a Render deploy (the container applies pending Prisma migrations on start), and builds and deploys the web app to Vercel. The database starts empty: people register fresh.

## 1. Neon (database)
1. Create a project at neon.tech. Copy the **direct** connection string (not the "pooled" one: migrations need a direct connection). It ends with `?sslmode=require`.

## 2. Render (API)
1. Dashboard → New → **Blueprint** → pick this repo. It reads `render.yaml` and creates `tms-api`. When asked for the `sync: false` values, enter any placeholder: the workflow overwrites them on every deploy.
2. Account settings → **API Keys** → create one.
3. Open the service; the id (`srv-...`) is in its URL.
4. If `tms-api.onrender.com` is taken, Render gives another host: put it in `frontend/vercel.json` (`destination`).

## 3. Vercel (web)
1. `cd frontend && npx vercel link` and create a project. **Leave "Root Directory" empty** (the workflow runs inside `frontend/`).
2. `frontend/.vercel/project.json` now holds `orgId` and `projectId`. Create a token at vercel.com/account/tokens.

## 4. Google (optional)
Create an OAuth Web client and add the Vercel URL under "Authorized JavaScript origins". Leave the secret empty to hide the Google buttons.

## 5. GitHub secrets
Repo → Settings → Secrets and variables → Actions, or `gh secret set NAME` (it prompts, so the value never lands in shell history):

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Neon direct connection string |
| `JWT_SECRET` | 96 hex characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `APP_URL` | Your Vercel URL, no trailing slash, e.g. `https://tms.vercel.app` (used for CORS and invite links) |
| `CLOUDINARY_CLOUDNAME`, `CLOUDINARY_APIKEY`, `CLOUDINARY_API_SECRET` | From the Cloudinary console (use freshly rotated values) |
| `GOOGLE_CLIENT_ID` | Optional |
| `RENDER_API_KEY`, `RENDER_SERVICE_ID` | Step 2 |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Step 3 |

Then run **Actions → Deploy → Run workflow**, or push to `main`.

## Notes
- Render's free plan sleeps after inactivity: the first request after a pause takes about 30 s.
- Rotate a secret by changing it in GitHub and re-running Deploy.
- Old MongoDB data is not migrated. Delete the Atlas cluster once you no longer need it.
