# DOCX Template App

Minimal web app for Word document template processing with toggleable blocks, placeholders, and table rendering.

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React + Vite + TypeScript + MUI
- **Backend**: Fastify + TypeScript + SQLite
- **Template Engine**: Custom DOCX parser/renderer with JSZip

## Project Structure

```
/packages/template-engine   # Core DOCX processing logic
/apps/api                   # Fastify backend
/apps/web                   # React frontend
/assets/template            # Built-in template (add your .docx here)
/output                     # Generated documents
```

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Add Your Template

Place your `master_template_v2_1_skeleton.docx` file in the `/assets/template/` directory.

The template should contain markers:
- **Blocks**: `[[BLOCK:name]]` ... `[[END:name]]`
- **Placeholders**: `{{placeholder_name}}`
- **Tables**: `[[TABLE:name]]` (followed by a Word table)
- **Static blocks**: `[[STATIC:name]]` ... `[[END:STATIC]]`

See `/assets/template/README.md` for detailed template requirements.

### 3. Run Development Servers

```bash
# Run both frontend and backend
pnpm dev
```

Or run them separately:

```bash
# Terminal 1 - Backend API (port 3001)
cd apps/api
pnpm dev

# Terminal 2 - Frontend Web (port 3000)
cd apps/web
pnpm dev
```

### 4. Access the Application

Open your browser to: http://localhost:3000

## Features

### Document Management
- Create and manage multiple drafts
- Each draft is stored with its configuration in SQLite

### Template Editing
- **Blocks Tab**: Toggle sections ON/OFF
- **Fields Tab**: Fill in placeholders (grouped by prefix, searchable)
- **Tables Tab**: Edit table data in a grid interface

### Export
- One-click export to DOCX
- Downloads automatically
- Files saved to `/output/` directory

## Running the Application

### Development Mode (2 servers, hot reload)

```bash
# Terminal 1 - API server (port 3001)
cd apps/api
npx tsx src/index.ts

# Terminal 2 - Vite dev server (port 3000)
cd apps/web
pnpm dev
```

Open http://localhost:3000

### Production Mode (single server)

```bash
# Build all packages
pnpm build

# Start production server (serves both API and static files)
cd apps/api
$env:NODE_ENV = "production"   # PowerShell
# export NODE_ENV=production   # Bash/Linux
node dist/index.js
```

Open http://localhost:3001

## API Endpoints

### Drafts
- `POST /api/drafts` - Create new draft
- `GET /api/drafts` - List all drafts
- `GET /api/drafts/:id` - Get draft details
- `PATCH /api/drafts/:id` - Update draft data
- `PATCH /api/drafts/:id/name` - Update draft name
- `DELETE /api/drafts/:id` - Delete draft

### Files
- `POST /api/drafts/:id/render` - Render draft to DOCX
- `GET /api/files/:id/download` - Download rendered file
- `GET /api/drafts/:id/files` - List files for draft

### Template
- `GET /api/template/manifest` - Get template metadata

## Project Details

### Template Engine (`/packages/template-engine`)

The core DOCX processing library that:
- Parses DOCX files to extract markers
- Handles Word's run-splitting robustly
- Renders templates with data

Key features:
- **Robust run-splitting**: Markers can be split across `<w:r>` runs
- **Block processing**: Remove or keep sections
- **Placeholder replacement**: Replace `{{key}}` with values
- **Table rendering**: Duplicate prototype rows with data
- **Static blocks**: Always included, markers removed

### Backend API (`/apps/api`)

Fastify server with:
- SQLite database for drafts and files
- CRUD operations for drafts
- Template parsing and caching
- Document rendering

### Frontend Web (`/apps/web`)

React application with:
- Material-UI components
- React Query for data fetching
- React Router for navigation
- Organized tabs for different editing modes

## Development Tips

### Testing the Template Engine

```bash
cd packages/template-engine
pnpm test
```

### Database Location

SQLite database is created at: `apps/api/data/app.sqlite`

### Output Files

Generated DOCX files are saved to: `output/`

### Clearing Data

```bash
# Remove database
rm apps/api/data/app.sqlite

# Remove generated files
rm -rf output/*
```

## Troubleshooting

### Template not found error
Make sure `master_template_v2_1_skeleton.docx` is in `/assets/template/`

### Port already in use
Change ports in:
- Backend: `apps/api/src/index.ts` (default 3001)
- Frontend: `apps/web/vite.config.ts` (default 3000)

### Build errors
Ensure all dependencies are installed:
```bash
pnpm install
```

## License

MIT
