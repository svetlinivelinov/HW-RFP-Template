# HW RFP Template Operations Runbook

This guide is the standard way to start, run, and troubleshoot the app so common issues do not return.

## 1) One-time setup on a new PC

1. Install Node.js 20+.
2. Install pnpm globally, or use corepack.
3. Configure Git identity (required for commit/push):

   git config --global user.name "Svetlin Ivanov"
   git config --global user.email "svetlin.ivelinov@gmail.com"

4. Verify Git identity:

   git config --global --get user.name
   git config --global --get user.email

## 2) Daily startup (development)

From repo root:

1. Stop old processes first:

   .\stop-server.ps1

2. Start dev environment:

   .\start-dev.ps1

3. Open the app only at:

   http://localhost:3000

4. API health check:

   http://localhost:3001/api/health

Notes:
- Port 3000 is the web app.
- Port 3001 is the API.
- Opening API root by mistake is now safe and returns an API info message.

## 3) Daily startup (production mode)

From repo root:

1. Stop old processes:

   .\stop-server.ps1

2. Start production build/server:

   .\start-production.ps1

3. Open:

   http://localhost:3001

## 4) Script quick reference (start/stop .ps1)

Use these only from repo root:

1. Stop everything:

   .\stop-server.ps1

2. Start dev (API + web):

   .\start-dev.ps1

3. Start production build + API server:

   .\start-production.ps1

What each script does:
- `stop-server.ps1`: Stops API background job and all Node processes, then prints final remaining counts.
- `start-dev.ps1`: Builds template-engine, starts API, waits for API health, then starts web (Vite).
- `start-production.ps1`: Builds all packages and runs API in production mode serving static web files.

If script execution is blocked by policy:

   powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
   powershell -ExecutionPolicy Bypass -File .\stop-server.ps1

## 5) Quick verification checklist (before working)

1. Web responds:

   curl -I http://localhost:3000/

2. API responds:

   curl -I http://localhost:3001/api/health

3. Draft list API works:

   curl -i http://localhost:3000/api/drafts

Expected:
- 200 responses for health and drafts.
- No connection refused errors.

## 6) If common errors appear

### A) "Route GET:/ not found"
Cause:
- API server was opened at the wrong URL, or old API route behavior.

Action:
1. Use web URL for UI: http://localhost:3000
2. Use API health URL for backend: http://localhost:3001/api/health

### B) "Unsafe attempt to load URL http://localhost:3000 from chrome-error://chromewebdata"
Cause:
- Web server on 3000 was down while browser was on Chrome internal error page.

Action:
1. Start web server with .\start-dev.ps1 (or run apps/web with pnpm dev).
2. Open a fresh tab and navigate to http://localhost:3000
3. Hard refresh once (Ctrl+F5).

### C) GET /api/drafts 500 from web
Cause:
- Usually startup mismatch or API temporarily unavailable.

Action:
1. .\stop-server.ps1
2. .\start-dev.ps1
3. Verify http://localhost:3001/api/health
4. Re-test http://localhost:3000/api/drafts

### D) React Router future flag warnings
Status:
- Future flags are enabled in app router setup.

Action:
1. Hard refresh browser (Ctrl+F5).
2. Restart web dev server if warning cache persists.

### E) Cannot commit to GitHub (name/email)
Cause:
- Git identity not configured on this machine.

Action:
1. Set global identity (see section 1).
2. Retry commit and push.

## 7) Reliable recovery sequence (full reset)

If behavior is inconsistent, run this exact sequence:

1. .\stop-server.ps1
2. Close extra terminals running node, vite, or tsx watchers.
3. .\start-dev.ps1
4. Open http://localhost:3000 in a fresh tab.
5. Check http://localhost:3001/api/health

## 8) Team rule

Always stop first, then start once, then verify both ports before debugging UI behavior.
This avoids most false errors caused by stale processes or mixed startup state.
