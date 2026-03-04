# Copilot Instructions — Honeywell RFP Template Builder (TSI)

## Purpose
You are assisting on a web app that builds proposal .docx files from ONE bundled Word template in the repo.
The app uses:
- blocks: `[[BLOCK:name]]` ... `[[END:name]]`
- placeholders: `{{field_name}}`
- tables: `[[TABLE:table_name]]`
- statics: `[[STATIC:name]]` ... `[[END:STATIC]]`

Template rendering must remain unchanged.

---

## Golden Rules (DO NOT BREAK)

### 1) One-template-only rule
There is exactly ONE active template file at runtime:
- `assets/template/master_template_v2_1_skeleton.docx`

No template catalog. No uploading templates. No second library of content.

### 2) Blocks are NOT inserted
A "block" is a region inside the single template file.
Blocks are enabled/disabled per draft. Disabled blocks are removed during export.
Never implement "copy blocks from another docx" or "insert block content into template."

### 3) Never touch rendering behavior unless asked
The JSZip-based template engine and its DOCX manipulation logic must not be changed unless explicitly requested.
Prefer changes in parser/manifest/metadata/UI only.

---

## How the system works (use this mental model)

### Content lives in the template
All paragraphs/images/styles are in the template docx.
Drafts only store:
- field values for placeholders
- rows for tables
- enabled/disabled flags for blocks

as JSON (`draft_json` column in SQLite).

### Block Library UI
The Block Library is navigation + status + quick actions:
- list blocks grouped by category
- toggle enabled/disabled
- show completion status (Empty / Partial / Complete)
- click block to edit its fields/tables only

It does NOT store separate Word blocks.

---

## Editing rules for Word templates (CRITICAL)

When working on `assets/template/master_template_v2_1_skeleton.docx`:
1. NEVER rename or remove existing block markers.
2. Always keep markers paired — every `[[BLOCK:x]]` must have exactly one `[[END:x]]`.
3. Block names must be `lowercase_snake_case`.
4. Placeholders must be `{{snake_case}}`.
5. Tables must be `[[TABLE:snake_case]]`.
6. Statics must remain always-included and never togglable.
7. Do not split a block unless asked; prefer TOC-aligned blocks.

---

## Manifest + completion (what Copilot must enforce)

Manifest must compute for each block:
- `fieldsUsed`: all `{{placeholders}}` inside the block region
- `tablesUsed`: all `[[TABLE:name]]` inside the block region

Also build reverse indexes:
- `fieldToBlocks: { [fieldName]: string[] }`
- `tableToBlocks: { [tableName]: string[] }`

Completion algorithm:
- field filled if `trimmed length > 0`
- table filled if it has `>= 1 row`
- block state: `Empty` (0%) / `Partial` (1–99%) / `Complete` (100%) based on % filled

---

## SQLite schema — keep it minimal

| Table | Purpose |
|---|---|
| `drafts` | `id`, `name`, `draft_json`, `created_at`, `updated_at` |
| `files` | Rendered `.docx` file paths linked to a draft |
| `block_meta` | Optional UI overrides: `title`, `category`, `description`, `sort_order`, `is_optional` per block |

Block content (values, tables, toggles) lives inside `draft_json` only — NOT in separate SQL columns.
Do NOT add workflow, versioning, or user-management tables.

---

## API surface (current)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/template/manifest` | Full parsed manifest |
| GET | `/api/template/block-library` | Blocks merged with `block_meta` overrides |
| PATCH | `/api/template/block-meta` | Update display metadata for a block |
| GET | `/api/drafts` | List all drafts |
| POST | `/api/drafts` | Create draft |
| GET | `/api/drafts/:id` | Get draft |
| PATCH | `/api/drafts/:id` | Update draft data |
| PATCH | `/api/drafts/:id/name` | Rename draft |
| DELETE | `/api/drafts/:id` | Delete draft |
| GET | `/api/drafts/:id/block-status` | Per-block completion state |
| POST | `/api/drafts/:id/render` | Render to `.docx` |
| GET | `/api/files/:id/download` | Download rendered file |

---

## Key files

| File | Role |
|---|---|
| `assets/template/*.docx` | The one master template |
| `packages/template-engine/src/parser.ts` | Parses docx, extracts blocks/fields/tables/manifest |
| `packages/template-engine/src/renderer.ts` | Renders draft JSON → final docx (DO NOT MODIFY unless asked) |
| `packages/template-engine/src/types.ts` | Shared TypeScript types |
| `apps/api/src/db.ts` | SQLite schema + repositories |
| `apps/api/src/routes/template.ts` | Template manifest + block-library endpoints |
| `apps/api/src/routes/drafts.ts` | Draft CRUD + block-status |
| `apps/api/src/routes/files.ts` | Render + download |
| `apps/web/src/api.ts` | Frontend API client + all TypeScript types |
| `apps/web/src/pages/DraftEditor.tsx` | Main editor page (sidebar + panel layout) |
| `apps/web/src/components/BlockLibrarySidebar.tsx` | Left nav panel |
| `apps/web/src/components/BlockEditorPanel.tsx` | Per-block field/table editor |
| `apps/web/src/components/GlobalFieldSearch.tsx` | Cross-block field search |

---

## What to do when implementing changes

### Preferred workflow
1. Update parsing/manifest calculations first (`parser.ts`).
2. Update block-status computation second.
3. Update UI (`BlockLibrarySidebar`, `BlockEditorPanel`, `GlobalFieldSearch`).
4. Only then touch template files if needed.

### Build command
```powershell
pnpm build   # runs tsc --build --force for all packages
```

### Safe defaults
- If `block_meta` table is empty, infer metadata and categories from `DEFAULT_CATEGORY_MAP` in `parser.ts`.
- Keep SQLite minimal; do not add workflow/versioning features.

---

## Output discipline
When asked for code changes:
- Output the complete, updated code for the files changed.
- Do not propose a second library or a new template storage model unless explicitly asked.
- Do not modify `renderer.ts` unless rendering behaviour is explicitly the subject of the request.
