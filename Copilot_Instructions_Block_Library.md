“Implement the Block Library feature exactly as described. Extend manifest parsing to compute fieldsUsed/tablesUsed per block, build block completion status, and add the left sidebar navigation + block editor panel + global field search. Keep template rendering unchanged.”

# Copilot Instructions — Block Library (v1.1 Add-on)

## Goal
Add a “Block Library” feature to the document builder so users can work comfortably with long templates (50–100+ pages) without scrolling.
Block Library = navigation + metadata + completion indicators + quick actions.

This MUST NOT complicate template functionality:
- still one template
- still blocks ON/OFF + placeholders + tables
- only adds structure and UX

The underlying template already contains:
- [[BLOCK:name]] ... [[END:name]]
- [[TABLE:name]]
- {{placeholders}}
- [[STATIC:name]] ... [[END:STATIC]]

---

## What “Block Library” means in this app
A UI and data layer that:
1) Lists all blocks found in the template
2) Groups blocks into logical categories (Core / Design / Systems / Project / Annexes)
3) Shows per-block “status”:
   - Empty (no fields filled, no table rows)
   - Partial
   - Complete
4) Provides one-click actions:
   - Enable/Disable block
   - Jump to block editor
   - Clear block data
   - Fill block with sample text (optional helper)

Block Library DOES NOT store blocks as separate Word files.
Blocks remain in the single Word template and are toggled/filled by draft JSON.

---

## Data Model (SQLite) — minimal additions
Add one optional table to keep block metadata editable without changing code:

table: block_meta
- block_name TEXT PRIMARY KEY
- title TEXT
- category TEXT
- description TEXT
- sort_order INTEGER
- is_optional INTEGER (0/1)

If block_meta table is empty, auto-generate metadata from defaults in code.

No revisions. No user roles. Keep it simple.

---

## Manifest Extensions (computed on startup)
Extend the template manifest with:
- blocks: [{
    name,
    occurrences,
    inferredCategory,
    title,
    description,
    fieldsUsed: string[],
    tablesUsed: string[],
    dependsOn?: string[]
  }]

How to compute fieldsUsed/tablesUsed:
- For each block region text, scan for {{placeholders}} and [[TABLE:name]] inside that region.
- Store unique lists.

Also expose a reverse index:
- fieldToBlocks: { [fieldName]: string[] }
- tableToBlocks: { [tableName]: string[] }

---

## Block Completion Status Algorithm (v1)
Given a draft JSON:
- A field is “filled” if values[field] exists and trimmed length > 0
- A table is “filled” if tables[tableName] exists and has length > 0
- A block is:
  - Empty: 0% filled
  - Partial: 1–99% filled
  - Complete: 100% filled (all fieldsUsed filled AND all tablesUsed have >=1 row)
Also compute “completionPercent” for display.

This is a best-effort heuristic. No complex rules.

---

## UX Requirements (Block Library)
Add a left sidebar:
- Search box (filters by title/name/description)
- Category sections with collapsible groups
- Each block row shows:
  - Toggle switch (enabled/disabled)
  - Status badge (Empty/Partial/Complete)
  - Progress % (small text)
  - Warning icon if enabled but empty (optional)

When user clicks a block:
- Open “Block Editor” panel showing ONLY:
  - fieldsUsed inputs
  - tablesUsed editors
- Provide a “Clear Block” button:
  - clears values for fieldsUsed
  - clears tablesUsed rows
  - does NOT disable the block

Add a “Global Search” panel:
- search placeholders
- show “used in blocks” list
- click result navigates to block editor

---

## Backend API additions (minimal)
- GET /api/template/block-library
  - returns blocks with metadata + fieldsUsed/tablesUsed + category ordering

- GET /api/drafts/:id/block-status
  - returns status for each block {enabled, completionPercent, state}

- PATCH /api/block-meta
  - updates title/category/description/order for a block (optional; can be skipped in v1)

If skipping block_meta editing:
- hardcode a default mapping in backend.

---

## Default Category Mapping (useful for ICSS skeleton)
Provide a default mapping in code if block_meta is empty:
- Core:
  - cover_page
  - revision_history
  - table_of_contents
  - abbreviations
  - executive_summary
  - basis_of_proposal
- Design:
  - design_basis
  - assumptions_and_exclusions
- Systems:
  - icss_system (treat as repeatable later; for now single)
- Project:
  - deliverables_and_receivables
  - project_execution
- Annexes:
  - annexures

This mapping is only a UI grouping; it does not change template behavior.

---

## Acceptance Criteria
- Block list loads instantly for the one template
- User can:
  - toggle blocks ON/OFF without leaving the editor
  - click a block to edit only its fields/tables
  - see completion status update as they type
  - export docx same as before (no change to render engine)
- No new complexity added to template rendering

---

## Implementation Order
1) Extend manifest parsing to compute fieldsUsed/tablesUsed per block
2) Add block status computation based on draft JSON
3) Build left sidebar Block Library UI + Block Editor panel
4) Add Global Search (fields -> blocks)
5) Optional: persist block_meta to SQLite

Addendum: Advanced Block Usage (Clarifications)
Nested Blocks
Blocks MAY be nested inside other blocks. Each [[BLOCK:name]] … [[END:name]] region is treated as an independent unit when computing fieldsUsed, tablesUsed, block completion status, and Block Library UI listing. Nested blocks do not alter template rendering behavior.

Block Naming Stability and Conventions
Block names are stable identifiers. Use lowercase snake_case (e.g. lan_core_switch, cctv_dvm). Avoid spaces or special characters. Renaming a block requires updating draft JSON only and does not affect rendering or parsing.
