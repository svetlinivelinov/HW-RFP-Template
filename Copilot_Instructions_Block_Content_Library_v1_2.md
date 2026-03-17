Copilot Instructions — Block Content Library & Preview (v1.2 Add-on)
Goal
Extend the existing Block Library with a persistent Block Content Repository and a single reusable preview panel. Users can browse, preview, and explicitly apply reusable block content from previous projects without modifying the Word template.
Core Principles
1. Single Word template only.
2. Blocks define structure, not content.
3. Block content is read-only.
4. Preview first, apply explicitly.
Conceptual Model
Block Definition: comes from the skeleton template and defines layout.
Block Content Variant: stored in database, reusable content for a specific block.
Database Model
Table: block_content
- id (PK)
- block_name
- variant_name
- source_project
- content_xml
- preview_html
- created_at
- created_by
- version (default: 1)
- updated_at (NULL for version 1)
- updated_by (NULL for version 1)
- parent_id (NULL if original, references id of previous version)
- tags (JSON array, e.g., ["telecom", "voip", "cisco"])
- description (short summary, max 500 chars)
- usage_count (default: 0, incremented when applied)
- quality_rating (1-5, NULL if not rated)
- content_hash (SHA-256 of content_xml for duplicate detection)
Versioning Strategy
Block content variants are versioned to track evolution over time:
- New ingestion creates version 1 (parent_id = NULL)
- Updates create new row with incremented version, parent_id references previous
- UI shows latest version by default, allows browsing history via parent_id chain
- Drafts reference specific block_content.id (not block_name), so already-applied variants remain stable
Metadata Fields Usage
tags: Enable filtering (e.g., show all "cisco" or "data-center" blocks)
description: Display in variant list as tooltip/preview
usage_count: Sort by popularity, identify most successful variants
quality_rating: Manual curation metric for highlighting best variants
content_hash: Automatic duplicate detection during ingestion (see v1.3)
Preview Panel
A single reusable preview panel is used for all blocks. Clicking a block variant only loads a read-only preview. No draft state is changed.
Preview HTML security: Strip all <script>, <iframe>, <object>, <embed> tags and external resource URLs (http/https) except for data: URIs for inline images. Whitelist allowed tags: p, div, span, h1-h6, ul, ol, li, table, tr, td, th, strong, em, br.
Applying a Block Variant
Draft is modified only when user clicks 'Use this block'. The selected block variant ID is stored in the draft JSON.
When applied: Increment usage_count for the selected variant via UPDATE block_content SET usage_count = usage_count + 1 WHERE id = ?
Rendering Behavior
At render time, enabled blocks load their selected content_xml and inject it into the skeleton template. Rendering pipeline remains unchanged.
Exact Rendering Integration Point
During DOCX assembly (existing pipeline):
1. Load skeleton template master_template_v2_1_skeleton.docx
2. Parse draft JSON to get blocks_enabled[] and blockVariants{} map
3. For each enabled block in blocks_enabled:
   a. Check if blockVariants[block_name] exists
   b. If yes: SELECT content_xml FROM block_content WHERE id = blockVariants[block_name]
   c. Replace [[BLOCK:name]]...[[END:name]] in skeleton with fetched content_xml
   d. If no variant selected: keep existing placeholder replacement logic (draft.fields)
4. Continue with existing table injection, field replacement, and final assembly
Note: content_xml is a WordprocessingML fragment containing <w:p> and <w:tbl> elements, ready to inject. No further parsing required.
Block Library UI
Sidebar lists blocks and their variants. Selecting a variant opens the preview panel.
Variant list displays: variant_name, source_project, description (truncated), usage_count, quality_rating (stars). Sort options: Most recent, Most used, Highest rated.
Tag filter: Multi-select dropdown to filter variants by tags.
Content Ingestion
Admin process: extract block content from approved proposals, store each as a block_content record.
Out of Scope
Editing block content, multiple templates, automatic diffs, inline previews.
Acceptance Criteria
Users can preview blocks, explicitly apply them, reuse one preview panel, and export DOCX unchanged.
Variant versioning: Users can view version history and apply previous versions if needed.
Metadata filtering: Users can filter variants by tags and sort by usage/rating.
Usage tracking: usage_count increments correctly when variant is applied.
