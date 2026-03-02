# Template v2.2 Impact Analysis

> Note: The template content is **v2_2**, but the file is intentionally kept as
> `assets/template/master_template_v2_1_skeleton.docx` to avoid code path changes.

## Summary
**NO CODE CHANGES REQUIRED** - The new template with 36 styled headings will work correctly with existing code.

## Template Comparison

### Original (v2_1)
- **Headings**: 0 (no styled headings)
- **Placeholders**: 39
- **Blocks**: 12
- **Tables**: 2 markers (but no actual table elements)
- **Static Markers**: 5 unpaired

### Updated (v2_2)
- **Headings**: 36 (11 H1, 21 H2, 4 H3) ✅
- **Placeholders**: 32 (7 removed)
- **Blocks**: 12 (unchanged)
- **Tables**: 2 markers (but no actual table elements) ⚠️
- **Static Markers**: 5 unpaired ⚠️

## Removed Placeholders (replaced with static headings)

1. `basis_of_proposal_text` → now static section heading
2. `cabinet_installation_philosophy` → H2: "Cabinet Installation Philosophy"
3. `general_design_philosophy` → H2: "General Design Philosophy"
4. `gpm_description` → H2: "Global Project Methodology (GPM)"
5. `power_heat_basis` → H2: "Power & Heat Basis"
6. `project_execution_strategy` → H2: "Project Execution Strategy"
7. `redundancy_philosophy` → H2: "Redundancy Philosophy"

## Heading Structure Analysis

### Block Organization (Correct ✅)
Headings are properly nested **inside** block markers:

```
[[BLOCK:design_basis]]
  Heading1: Design Basis
    Heading2: General Design Philosophy
    Heading2: System Loading Criteria
    Heading2: Redundancy Philosophy
    Heading2: I/O Design Basis
    Heading2: Cabinet Installation Philosophy
    Heading2: Power & Heat Basis
[[END:design_basis]]
```

This means:
- ✅ Headings will be removed when blocks are disabled
- ✅ Headings will be preserved when blocks are enabled
- ✅ Document structure is hierarchical and well-organized

## Code Compatibility Analysis

### 1. Parser (`parseTemplate()`)
**Status**: ✅ No changes needed

- Extracts marker-based content only (blocks, placeholders, tables, statics)
- Does NOT extract heading styles (correct behavior - headings are structural)
- Will correctly identify 32 placeholders from v2_2

### 2. Renderer (`render()`)
**Status**: ✅ No changes needed

#### Block Processing
- Removes/keeps entire sections based on block enable/disable
- Headings are paragraphs with style attributes - automatically handled
- XML structure preserved (including `<w:pStyle w:val="Heading1"/>`)

#### Placeholder Replacement
- Works on text content regardless of paragraph style
- Headings are static text (not placeholders) - no conflict

#### Table Processing
- Tables are separate from headings - no interaction

### 3. Frontend UI
**Status**: ✅ No changes needed

- Blocks tab: same 12 blocks (unchanged)
- Fields tab: will show 32 fields (7 fewer due to headings replacing placeholders)
- Tables tab: will show 0 tables (until actual table elements added)

## Known Issues (Pre-existing)

### Issue 1: Missing Table Elements ⚠️
**Impact**: Tables feature non-functional until fixed

- Markers exist: `[[TABLE:revision_log]]`, `[[TABLE:abbreviations_table]]`
- Actual Word table elements: **0**
- Fix: ChatGPT must add real `<w:tbl>` structures after markers

### Issue 2: Unpaired STATIC Markers ⚠️
**Impact**: Low (engine tolerates unpaired markers)

- 5 `[[STATIC:...]]` markers
- 0 `[[END:STATIC]]` markers
- Current behavior: Marker paragraphs removed, content kept (works as intended)
- Fix: Optional - add `[[END:STATIC]]` pairs for completeness

### Issue 3: Block Removal Logic Bug (Dormant) 🐛
**Impact**: None currently, but potential future issue

**Current behavior**: `processBlocks()` only removes **paragraph** elements between block markers

**Potential issue**: If future templates have tables or images **inside** blocks:
```
[[BLOCK:name]]
  <w:p>Paragraph</w:p>
  <w:tbl>Table</w:tbl>  ← Would NOT be removed!
  <w:p>[[END:name]]</w:p>
```

**Why not triggered**: Current template blocks only contain paragraphs (no tables/images inside blocks)

**Recommended fix** (proactive):
```typescript
// Instead of removing just paragraphs, remove ALL body children between markers
// Modify processBlocks() to track body element indices, not just paragraph indices
```

## Migration Checklist

### Before Using v2_2

1. ✅ **Filename strategy in place**: v2_2 content is already stored in
   `master_template_v2_1_skeleton.docx` to keep existing code paths unchanged

2. ⚠️ **Add missing table structures** (blocking issue):
   - Open in Word
   - After `[[TABLE:revision_log]]`, insert table with header + prototype row
   - After `[[TABLE:abbreviations_table]]`, insert table with header + prototype row
   - Prototype rows should contain placeholders like `{{revision_number}}`, `{{abbreviation}}`

3. ⚠️ **Pair STATIC markers** (optional but recommended):
   - Add `[[END:STATIC]]` after each STATIC section
   - Ensures proper section boundaries

4. ✅ **Apply Word styles to placeholders** (for formatting):
   - Review remaining 32 placeholders
   - Apply character/paragraph styles in Word for consistent rendering

### After Migration

1. **Clear cached manifest**:
   ```powershell
   # Delete drafts.db or restart API to force re-parsing
   ```

2. **Test workflow**:
   - Create new draft
   - Toggle blocks (verify headings appear/disappear correctly)
   - Fill fields (32 fields instead of 39)
   - Export DOCX and verify heading hierarchy preserved

## Conclusion

The new template with 36 headings is a **structural improvement** that requires **zero code changes**. The existing rendering engine automatically preserves Word paragraph styles (including headings) during XML manipulation.

**Critical blockers before use**:
- Must add actual Word table elements for tables feature to work
- Optionally pair STATIC markers for completeness

**No code changes needed** - engine already compatible.
