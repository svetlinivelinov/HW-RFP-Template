# HW RFP Template — New Computer Setup Guide

Step-by-step instructions to get the project running on a new or different machine.

---

## 1. Prerequisites

Install the following tools before cloning the repo.

### Node.js 20 (required)
> Node 20 is required. Node 22+ may break the `better-sqlite3` native module.

Download and install from:
https://nodejs.org/en/download (choose **Node.js 20 LTS**)

Or via winget (Windows):
```powershell
winget install OpenJS.NodeJS.20
```

Verify:
```powershell
node --version   # should print v20.x.x
```

### pnpm (package manager)
```powershell
npm install -g pnpm
```

Verify:
```powershell
pnpm --version   # should print 10.x.x or higher
```

### Git
Download from: https://git-scm.com/download/win

After installing, **close and reopen** VS Code / terminal so the PATH updates.

---

## 2. Clone the Repository

```powershell
git clone https://github.com/svetlinivelinov/HW-RFP-Template.git
cd HW-RFP-Template
```

If you already have it cloned, just pull the latest:
```powershell
git pull origin main
```

---

## 3. Install Dependencies

```powershell
pnpm install
```

This installs all packages for:
- `packages/template-engine`
- `apps/api`
- `apps/web`

---

## 4. Add the Word Template File

The `.docx` template is **not committed to Git** (it may contain confidential content).

Copy the file manually to:
```
assets/template/master_template_v2_1_skeleton.docx
```

> Without this file the app will start but template parsing will fail.

---

## 5. Run the App

### Production Mode (single server — recommended for normal use)

```powershell
.\start-production.ps1
```

Then open: **http://localhost:3001**

This will:
1. Build all packages (`template-engine`, `api`, `web`)
2. Start a single Fastify server that serves both the API and the React frontend

---

### Development Mode (two servers, hot reload)

```powershell
.\start-dev.ps1
```

- Frontend (React/Vite): **http://localhost:3000**
- Backend (Fastify API): **http://localhost:3001**

Changes to the frontend will hot-reload automatically.  
Changes to the backend require restarting the API job.

---

## 6. Stop the App

```powershell
.\stop-server.ps1
```

This stops all running Node processes and the background API job.

---

## 7. What Is and Isn't Transferred by Git

| Item | Committed? | Action on new machine |
|---|---|---|
| Source code | ✅ Yes | `git pull` |
| `package.json` / `pnpm-lock.yaml` | ✅ Yes | `pnpm install` |
| `node_modules/` | ❌ No | `pnpm install` recreates it |
| `apps/api/data/app.sqlite` | ❌ No | Created fresh on first run |
| `output/` (generated DOCX files) | ❌ No | Recreated when you export |
| `assets/template/*.docx` | ❌ No | **Copy manually between machines** |
| `.tsbuildinfo` (build cache) | ❌ No | Created on first build |

---

## 8. Troubleshooting

### `pnpm` or `node` not recognized
Add them to PATH manually for the current session:
```powershell
$env:Path += ";C:\Program Files\nodejs;$env:APPDATA\npm"
```

Or permanently via System → Environment Variables → Path.

### Port already in use
If ports 3000 or 3001 are blocked:
```powershell
.\stop-server.ps1
```
Then retry. If still blocked, identify the process:
```powershell
netstat -ano | Select-String ':3001'
```

### Template not found error
Ensure the file exists at:
```
assets/template/master_template_v2_1_skeleton.docx
```

### Build errors after `git pull`
Always re-run `pnpm install` after pulling — package versions may have changed:
```powershell
pnpm install
pnpm build
```

### SQLite native module error
Make sure you are using **Node 20** (not Node 22 or 24). Check with:
```powershell
node --version
```

---

## 9. Project Structure (Quick Reference)

```
/apps/api                   # Fastify backend (port 3001)
/apps/web                   # React + Vite frontend (port 3000)
/packages/template-engine   # Core DOCX parser & renderer
/assets/template            # Place master_template_v2_1_skeleton.docx here
/output                     # Generated DOCX files (auto-created)
/apps/api/data              # SQLite database (auto-created)
start-production.ps1        # One-click production start
start-dev.ps1               # One-click dev start
stop-server.ps1             # One-click stop
```
