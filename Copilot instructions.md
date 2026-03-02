# Copilot Project Instructions — Minimal Web App (SQLite) with ONE Preloaded Skeleton Template

## Objective (v1)
Build a very practical web app that lets a user:
1) Create a document draft from a SINGLE preloaded Word skeleton template (.docx)
2) Toggle sections ON/OFF (blocks)
3) Fill placeholders via a friendly UI
4) Edit tables via a grid UI
5) Export a professional output .docx that opens in Word cleanly

### Marker support (must implement)
- Blocks: [[BLOCK:name]] ... [[END:name]]
- Tables: [[TABLE:name]]
- Placeholders: {{placeholder_name}}
- Static blocks: [[STATIC:name]] ... [[END:STATIC]] (always included, markers removed)
- (Optional later) Images: [[IMAGE:name]]
- (Optional later) Footers: [[FOOTER:name]]

### Explicitly Out of Scope (v1)
- No user accounts / authentication
- No roles/permissions
- No template upload, no template catalog (ONE built-in template only)
- No versioning/revisions/workflows
- No PDF conversion
- No WYSIWYG Word editor

---

## One Template Only (Hardcoded)
Bundle exactly one template in the repo:
- /assets/template/master_template_v2_1_skeleton.docx

At runtime, the backend always uses this template file.
No UI for changing templates.

---

## Tech Stack (Simple & Reliable)
### Monorepo
- pnpm workspaces
- TypeScript everywhere

### Frontend
- React + Vite + TypeScript
- UI: MUI (Material UI)
- Data/state: React Query

### Backend
- Node.js + TypeScript
- Fastify
- Zod validation
- SQLite persistence (better-sqlite3 preferred)
- File storage on disk for generated outputs

### Document Engine
- /packages/template-engine
- Read/write .docx with JSZip
- Modify word/document.xml (minimum)
- Keep it robust to Word run-splitting

---

## IMPORTANT – FORMATTING RULES (DO NOT CHANGE LOGIC)

The Word skeleton template relies exclusively on native Word paragraph styles and table styles for all formatting. The template engine MUST follow these rules:

1. Do NOT add, remove, infer, or modify any fonts, colors, sizes, bold, italics, or alignment.
2. Do NOT introduce any new markers, tags, or metadata related to styling.
3. Do NOT apply inline formatting in document.xml.
4. Preserve all existing paragraph styles and table styles exactly as defined in the .docx template.
5. Responsibilities are strictly limited to:
   - Expanding or removing `[[BLOCK:...]]` sections
   - Removing `[[STATIC:...]]` markers while keeping their content
   - Replacing `{{placeholders}}` with text values
   - Rendering tables by duplicating existing prototype rows
6. When duplicating table rows, preserve all existing cell and row styles without modification.
7. If a paragraph or table already has a style applied, it must remain unchanged in the output document.

**No changes to the rendering pipeline, parsing logic, data model, APIs, or application behavior are allowed based on styling. This instruction is additive and must not break or alter existing functionality.**

---

## Data Model (SQLite)
Keep it minimal:
1) drafts
- id TEXT PRIMARY KEY
- name TEXT
- draft_json TEXT
- created_at TEXT
- updated_at TEXT

2) files
- id TEXT PRIMARY KEY
- draft_id TEXT
- path TEXT
- mime TEXT
- created_at TEXT

### Draft JSON structure
{
  "blocks": { "cover_page": true, "design_basis": false, ... },
  "values": { "project_title": "X", "customer_name": "Y", ... },
  "tables": { "revision_log": [ { "rev":"0", "date":"...", ... } ] }
}

---

## Backend API (Minimal)
- POST /api/drafts
  - body { name }
  - create new draft with defaults:
    - blocks default true for all discovered blocks
    - values empty
    - tables empty arrays
  - return {id}

- GET /api/drafts
  - list drafts (id, name, updatedAt)

- GET /api/drafts/:id
  - return draft_json

- PATCH /api/drafts/:id
  - partial update to blocks/values/tables
  - persist to SQLite

- POST /api/drafts/:id/render
  - load the ONE template from /assets/template/
  - render docx using draft_json
  - save output under /output/
  - store file record in SQLite
  - return downloadable docx

- GET /api/files/:id/download
  - downloads rendered docx

Additionally:
- GET /api/template/manifest
  - derived manifest computed from the ONE template:
    - list blocks, placeholders, tables, statics
  - may be computed on startup and cached in memory

---

## Template Manifest (Computed, not stored)
Compute from the one template:
- blocks: list of block names
- placeholders: list of unique {{...}}
- tables: table names and inferred columns
- statics: static block names

Return manifest to UI so it can build forms automatically.

---

## Rendering Pipeline (Order MUST be deterministic)
1) Expand/Remove Blocks
2) Remove STATIC markers but keep content
3) Replace Placeholders {{...}}
4) Render Tables for [[TABLE:...]]
5) (Optional later) Images + Footers
6) Produce output .docx

---

## Critical: Word Run Splitting
Markers may be split across <w:r> runs.
Implement robust matching:
- For each paragraph, concatenate text of runs
- Locate markers in concatenated text
- Rebuild affected runs so marker becomes a single run
- Then replace/remove

Must work for:
- {{placeholders}}
- [[BLOCK:*]] / [[END:*]]
- [[TABLE:*]]
- [[STATIC:*]] / [[END:STATIC]]

---

## Table Rendering (v1)
For each [[TABLE:name]]:
- Find the first Word table AFTER the marker
- Identify header row = first row
- Identify prototype row = second row (or last row if only 1)
- Duplicate prototype row for each dataset item
- Replace {{col}} placeholders inside each duplicated row
- If dataset empty:
  - keep header only (remove prototype row) OR keep blank prototype (choose one config and implement it)

Infer columns:
- scan prototype row cells for {{col}} placeholders

---

## Frontend UX (Very Practical)
### Pages
1) Drafts list
   - Create new draft
   - Open existing draft

2) Draft Editor (single screen)
   Left tabs:
   - Blocks (toggle list)
   - Fields (searchable inputs grouped by prefix, e.g. project_, customer_, etc.)
   - Tables (grid editors for each table)
   Top bar:
   - Draft name (editable)
   - Save indicator
   - Export DOCX button
   - Link to last export

3) Optional simple preview
   - a plain-text preview can be “best effort”
   - export docx is the real preview

---

## Template Engine Deliverables
Implement /packages/template-engine with:
- parseTemplate(docxBuffer) -> manifest
- render(docxBuffer, draftData) -> outputDocxBuffer

Unit tests:
- block removal
- placeholder replacement across split runs
- table replication correctness

---

## Acceptance Criteria
- App starts with ONE built-in template
- User creates a draft, toggles blocks, fills fields, edits tables
- Exported docx opens cleanly in Word
- No template upload needed
