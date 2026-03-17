Copilot Instructions — Ingest & Map Blocks from New Proposal DOCX (v1.3 Add-on)
Purpose: add an ingestion workflow that reads a new proposal Word document (.docx), extracts its content into reusable block variants, maps content to existing skeleton block names, and stores results in the Block Content Repository (SQLite table block_content).
Non‑Negotiable Constraints
• Do NOT create or use multiple templates. The only template used for final rendering remains master_template_v2_1_skeleton.docx.
• Do NOT modify existing rendering logic except to optionally resolve selected blockVariants at render time (already implemented).
• Do NOT allow users to edit block content variants. Ingestion is an admin/power-user operation.
• Block definitions (block_name) must match blocks present in the skeleton template manifest.
New Capability
Implement a server-side ingestion endpoint that:
1) Accepts a new proposal DOCX (uploaded or referenced by path).
2) Detects and extracts candidate content for each known block_name.
3) Produces preview_html for each extracted block variant.
4) Stores each variant in block_content with traceability (source_project, variant_name).
5) Returns a summary mapping report (what mapped, what was skipped, what needs manual mapping).
6) Performs duplicate detection before storing variants.
Data Model (Repository)
Use existing table block_content:
• id TEXT PK
• block_name TEXT (must match skeleton)
• variant_name TEXT (human label)
• source_project TEXT (e.g., O-1024811)
• content_xml TEXT (canonical inner WordprocessingML fragment)
• preview_html TEXT (cached preview)
• created_at TEXT, created_by TEXT
• version, updated_at, updated_by, parent_id (see v1.2)
• tags, description, usage_count, quality_rating, content_hash (see v1.2)
Ingestion API (Backend)
Add minimal endpoints (Fastify):
POST /api/block-content/ingest
  Body (multipart): file (.docx) + metadata {sourceProject, variantPrefix?, notes?}
  Response: {ingestionId, results:[{block_name, stored:boolean, reason?, block_content_id?, isDuplicate:boolean, duplicateOf?}], warnings:[]}
GET /api/block-content/:id/preview
  Returns {block_name, variant_name, source_project, preview_html}
GET /api/block-content?block_name=...
  Lists variants for a block for the Block Library UI.
Duplicate Detection Algorithm
Before storing each extracted variant:
1. Compute SHA-256 hash of normalized content_xml (strip whitespace, normalize run boundaries)
2. Query: SELECT id, variant_name FROM block_content WHERE block_name = ? AND content_hash = ?
3. If match found:
   - Skip insertion
   - Add to report: {block_name, stored:false, isDuplicate:true, duplicateOf:existing_id, reason:'Identical to <variant_name> from <source_project>'}
4. If no match: proceed with insertion
Normalization rules for hashing:
- Remove xml:space attributes
- Strip all w:rsid* attributes (revision IDs)
- Collapse consecutive whitespace in text nodes
- Merge adjacent <w:r> runs with identical <w:rPr>
- Sort attributes alphabetically within tags
Mapping Algorithm (Must be Deterministic)
Inputs:
• skeleton manifest blocks[] (authoritative list of block_name)
• proposal doc text/structure
Output:
• 0..N block_content rows mapped to existing block_name

Mapping rules in priority order:
A) Direct marker match (best):
   If the incoming doc contains [[BLOCK:<name>]] ... [[END:<name>]], extract inner XML and map to <name>.
B) Heading/TOC match (fallback):
   If no markers exist, map by detecting section headings that match known block titles (e.g., "Telephone System", "LAN / WAN System").
   Use a configurable dictionary in code: headingPattern -> block_name.
B2) Fuzzy heading match (if B exact match fails):
   - Normalize both extracted heading and dictionary patterns (lowercase, remove punctuation, collapse whitespace)
   - Compute Levenshtein distance to all dictionary entries
   - If distance ≤ 3 or similarity ≥ 85%, treat as match with confidence score
   - Add to warnings: 'Fuzzy matched "<extracted>" to "<pattern>" (confidence: 87%)'
   - Examples: "PAGA System" matches "Public Address" | "LAN/WAN" matches "LAN / WAN System" | "Structured Cable" matches "Structured Cabling"
C) Manual review bucket:
   Any content not mapped by A or B is returned as "unmapped" with detected heading text and page/position hints (best-effort).
Heading Dictionary (Recommended Default)
Provide a default mapping dictionary for TSI proposals:
• "Executive Summary" -> executive_summary
• "Basis of Proposal" -> basis_of_proposal
• "Definitions" -> definitions
• "Assumptions and Exclusions" -> assumptions_and_exclusions
• "Telephone System" -> telephone_system__overview + telephone_system__hardware (see splitting rule below)
• "LAN / WAN System" -> lan_wan_system__overview + lan_wan_system__hardware
• "CCTV System" -> cctv_system__overview + cctv_system__hardware
• "PAGA" or "Public Address" -> paga_system__hardware (or overview+hardware if your skeleton has both)
• "Structured Cabling" -> structured_cabling__overview + structured_cabling__hardware
• "Project Execution Plan" -> project_execution_plan
• "Bill of Material" -> bill_of_materials
Fuzzy match aliases (automatically handled by B2 rule):
• "PAGA System", "PA System", "PA/GA" all match "Public Address"
• "LAN-WAN", "LAN WAN", "Network System" match "LAN / WAN System"
• "Structured Cable", "Cabling System" match "Structured Cabling"
Splitting Rule for Overview vs Hardware
If a single heading like "Telephone System" contains sub-headings such as "Solution Overview" and "Hardware Details":
• Extract two variants:
  - telephone_system__overview = content between "Solution Overview" and "Hardware Details"
  - telephone_system__hardware = content from "Hardware Details" to the next top-level section
If sub-headings are missing:
• Store the entire section into the overview block and leave hardware unmapped (warning).
DOCX Extraction Requirements
Implementation MUST be robust to Word run-splitting:
• Markers/headings may be split across multiple <w:t> nodes.
• Implement a run-aware text index (linearize paragraph text while retaining XML offsets) to locate boundaries.
• Never rely on naive string find on raw document.xml.

Content_xml format:
• Store an inner fragment that can be inserted inside an existing block boundary.
• Do not include outer <w:document> wrapper.
• Preserve styles/formatting as-is (do not add inline styling).
Image Handling Strategy
Images embedded in proposal blocks are handled as follows:
1. Image Extraction
When extracting content_xml from a block containing images:
- Identify <w:drawing> elements with <a:blip r:embed="rIdN"/>
- Extract corresponding image files from word/media/ (e.g., image1.png, image2.jpg)
- Convert images to base64 data URIs
- Rewrite <a:blip> to use data URI instead of rId: <a:blip r:embed="data:image/png;base64,..."/>
2. Storage
- Store content_xml with embedded base64 images (self-contained fragment)
- Alternative: Store images separately in block_content_images table with {block_content_id, image_id, image_data, media_type} and reference via custom scheme: <a:blip r:embed="block-image://image_id"/>
- Recommendation: Use base64 embedding for simplicity (single-row storage)
3. Rendering
When injecting content_xml into skeleton at render time:
- If using base64: Decode data URIs, write images to output DOCX word/media/, update relationships in _rels/document.xml.rels, rewrite <a:blip> to reference new rId
- Maintain image numbering to avoid conflicts (e.g., image15.png, image16.png)
- Add content types to [Content_Types].xml if new formats (e.g., .svg, .webp)
4. Preview HTML
- Convert images to <img src="data:image/png;base64,..."> in preview_html
- Preserve dimensions from <wp:extent cx="..." cy="..."/> (convert EMU to pixels: 1 EMU = 1/914400 inch)
5. Size Limits
- Warn if total base64 image payload > 5MB per block variant
- Consider compression or image table strategy for large proposals
Preview Generation (Read-only)
Generate preview_html for each stored variant:
• Convert extracted WordprocessingML fragment to safe HTML (minimal tags).
• Strip scripts and external resources.
• Keep tables as <table> where possible for readability.
• Cache preview_html in block_content; do not regenerate on each request unless missing.
UI Integration (Block Library)
In Block Library sidebar, for each block_name:
• Call GET /api/block-content?block_name=<name> to list variants.
• Clicking a variant loads preview via /api/block-content/:id/preview into the single shared preview panel.
• Draft changes only on "Use this block" (already implemented).
Ingestion Report (Required Output)
After ingest, return a report:
• mapped: list of {block_name, block_content_id, variant_name}
• skipped: list of {block_name, reason}
• duplicates: list of {block_name, duplicateOf, existingVariantName, reason}
• unmappedSections: list of {detectedHeading, snippet, positionHint}
• warnings: list of strings (e.g., "Hardware Details not found; stored full section as overview", "Fuzzy matched 'PAGA System' to 'Public Address' (confidence: 92%)")
Acceptance Criteria
• Ingesting a proposal with explicit [[BLOCK:...]] markers maps blocks 1:1 and stores variants.
• Ingesting a proposal without markers maps by headings using the dictionary and produces a mapping report.
• Preview panel can display preview_html for any stored block variant.
• No changes to the final render output format and no additional templates are introduced.
• Duplicate detection: Identical content is not stored twice; ingestion report lists duplicates with references to existing variants.
• Fuzzy matching: Variants of heading names (e.g., 'PAGA' vs 'Public Address') are correctly mapped with confidence scores in warnings.
• Image handling: Blocks with embedded images render correctly in exported DOCX with proper media relationships.
Implementation Order
1) Add block_content list + preview endpoints if not present
2) Implement /ingest with direct marker extraction
3) Add heading-based fallback mapping + splitting
4) Add fuzzy heading matching with Levenshtein distance
5) Implement duplicate detection with content_hash
6) Add image extraction and base64 embedding
7) Add preview_html generation + caching
8) Wire UI: variants list + preview panel + Use this block action
