# Template Directory

This directory should contain the built-in DOCX template file:

- `master_template_v2_1_skeleton.docx` - The main template file

## Template Requirements

The template must be a valid .docx file that can contain:

### Markers

**Blocks** (toggleable sections):
```
[[BLOCK:section_name]]
Content that can be toggled on/off
[[END:section_name]]
```

**Static Blocks** (always included, markers removed):
```
[[STATIC:section_name]]
Content that is always included
[[END:STATIC]]
```

**Placeholders** (text replacement):
```
{{placeholder_name}}
```

**Tables** (data population):
```
[[TABLE:table_name]]
```
(followed by a Word table where the second row is the prototype)

## Usage

The template file is read by the backend API and parsed to extract:
- Available blocks
- Available placeholders
- Available tables with their column structure
- Static sections

Users can then:
1. Toggle blocks on/off
2. Fill in placeholder values
3. Add/edit table rows
4. Export a rendered DOCX file
