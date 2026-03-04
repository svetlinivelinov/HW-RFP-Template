import JSZip from 'jszip';
import { BlockManifestEntry, TemplateManifest } from './types.js';
import {
  parseXML,
  getParagraphs,
  getParagraphText,
  getTables,
  getTableRows,
  getTableCells,
  getChildElements,
} from './xml-utils.js';

/**
 * Regular expressions for detecting markers
 */
const PATTERNS = {
  block: /\[\[BLOCK:([^\]]+)\]\]/g,
  blockEnd: /\[\[END:([^\]]+)\]\]/g,
  static: /\[\[STATIC:([^\]]+)\]\]/g,
  staticEnd: /\[\[END:STATIC\]\]/g,
  table: /\[\[TABLE:([^\]]+)\]\]/g,
  placeholder: /\{\{([^}]+)\}\}/g,
};

/**
 * Default category mapping for known block names (used when no block_meta override exists)
 */
const DEFAULT_CATEGORY_MAP: Record<string, string> = {
  cover_page: 'Core',
  revision_history: 'Core',
  table_of_contents: 'Core',
  abbreviations: 'Core',
  executive_summary: 'Core',
  basis_of_proposal: 'Core',
  design_basis: 'Design',
  assumptions_and_exclusions: 'Design',
  icss_system: 'Systems',
  deliverables_and_receivables: 'Project',
  project_execution: 'Project',
  annexures: 'Annexes',
};

/**
 * Infer a human-readable title from a snake_case block name
 */
function inferTitle(blockName: string): string {
  return blockName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Infer category for a block name, falling back to 'General' if unknown
 */
function inferCategory(blockName: string): string {
  return DEFAULT_CATEGORY_MAP[blockName] ?? 'General';
}

/**
 * Extract the text content of a block region (between BLOCK and END markers)
 * Returns empty string if markers are not found
 */
function extractBlockRegion(fullText: string, blockName: string): string {
  const startMarker = `[[BLOCK:${blockName}]]`;
  const endMarker = `[[END:${blockName}]]`;
  const startIdx = fullText.indexOf(startMarker);
  const endIdx = fullText.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return '';
  return fullText.substring(startIdx + startMarker.length, endIdx);
}

/**
 * Parse a DOCX template buffer and extract its manifest
 * @param docxBuffer - The raw DOCX file buffer
 * @returns Template manifest with blocks, placeholders, tables, and statics
 */
export async function parseTemplate(docxBuffer: Buffer): Promise<TemplateManifest> {
  const zip = await JSZip.loadAsync(docxBuffer);
  
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('Invalid DOCX file: word/document.xml not found');
  }
  
  const documentXmlString = await documentXmlFile.async('text');
  const doc = parseXML(documentXmlString);
  
  const manifest: TemplateManifest = {
    blocks: [],
    placeholders: [],
    tables: {},
    statics: [],
    blockEntries: [],
    fieldToBlocks: {},
    tableToBlocks: {},
  };
  
  // Extract blocks and statics from paragraphs
  const paragraphs = getParagraphs(doc);
  const fullText = paragraphs.map(p => getParagraphText(p)).join('\n');
  
  // Find all blocks
  const blockMatches = Array.from(fullText.matchAll(PATTERNS.block));
  manifest.blocks = [...new Set(blockMatches.map(m => m[1]))];
  
  // Find all statics
  const staticMatches = Array.from(fullText.matchAll(PATTERNS.static));
  manifest.statics = [...new Set(staticMatches.map(m => m[1]))];
  
  // Find all placeholders
  const placeholderMatches = Array.from(fullText.matchAll(PATTERNS.placeholder));
  manifest.placeholders = [...new Set(placeholderMatches.map(m => m[1]))];
  
  // Find all tables and infer their columns
  const tables = getTables(doc);
  const tableMarkers = Array.from(fullText.matchAll(PATTERNS.table));
  
  for (const match of tableMarkers) {
    const tableName = match[1];
    
    // Find the table after this marker
    // This is a simplified approach - find table marker in paragraphs
    const markerText = match[0];
    let markerParagraphIndex = -1;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const pText = getParagraphText(paragraphs[i]);
      if (pText.includes(markerText)) {
        markerParagraphIndex = i;
        break;
      }
    }
    
    if (markerParagraphIndex >= 0) {
      // Find the next table after this paragraph
      const table = findNextTable(doc, paragraphs[markerParagraphIndex]);
      
      if (table) {
        const columns = inferTableColumns(table);
        manifest.tables[tableName] = columns;
      }
    }
  }
  
  // Build per-block metadata (fieldsUsed, tablesUsed, category, etc.)
  const fieldToBlocks: Record<string, string[]> = {};
  const tableToBlocks: Record<string, string[]> = {};

  const blockEntries: BlockManifestEntry[] = manifest.blocks.map(blockName => {
    const region = extractBlockRegion(fullText, blockName);

    // Scan region for {{placeholders}}
    const fieldsUsed = [...new Set(
      Array.from(region.matchAll(/\{\{([^}]+)\}\}/g)).map(m => m[1])
    )];

    // Scan region for [[TABLE:name]]
    const tablesUsed = [...new Set(
      Array.from(region.matchAll(/\[\[TABLE:([^\]]+)\]\]/g)).map(m => m[1])
    )];

    // Count occurrences of the block start marker in full text
    const occurrences = Array.from(
      fullText.matchAll(new RegExp(`\\[\\[BLOCK:${blockName}\\]\\]`, 'g'))
    ).length;

    // Build reverse indexes
    for (const field of fieldsUsed) {
      if (!fieldToBlocks[field]) fieldToBlocks[field] = [];
      if (!fieldToBlocks[field].includes(blockName)) fieldToBlocks[field].push(blockName);
    }
    for (const table of tablesUsed) {
      if (!tableToBlocks[table]) tableToBlocks[table] = [];
      if (!tableToBlocks[table].includes(blockName)) tableToBlocks[table].push(blockName);
    }

    return {
      name: blockName,
      title: inferTitle(blockName),
      occurrences,
      inferredCategory: inferCategory(blockName),
      description: '',
      fieldsUsed,
      tablesUsed,
    };
  });

  manifest.blockEntries = blockEntries;
  manifest.fieldToBlocks = fieldToBlocks;
  manifest.tableToBlocks = tableToBlocks;

  return manifest;
}

/**
 * Find the next table element after a given paragraph
 */
function findNextTable(doc: Document, afterParagraph: Element): Element | null {
  const body = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'body')[0];
  if (!body) return null;
  
  let foundParagraph = false;
  const children = getChildElements(body);
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    if (child === afterParagraph) {
      foundParagraph = true;
      continue;
    }
    
    if (foundParagraph && child.localName === 'tbl') {
      return child;
    }
  }
  
  return null;
}

/**
 * Infer column names from a table's prototype row
 */
function inferTableColumns(table: Element): string[] {
  const rows = getTableRows(table);
  if (rows.length === 0) return [];
  
  // Use second row as prototype (first is header)
  // If only one row, use that row
  const prototypeRow = rows.length > 1 ? rows[1] : rows[0];
  const cells = getTableCells(prototypeRow);
  
  const columns: string[] = [];
  
  for (const cell of cells) {
    // Get all paragraphs in the cell
    const cellParagraphs = cell.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'p'
    );
    
    let cellText = '';
    for (let i = 0; i < cellParagraphs.length; i++) {
      const pElement = cellParagraphs[i] as Element;
      cellText += getParagraphText(pElement);
    }
    
    // Extract placeholders from cell text
    const placeholders = Array.from(cellText.matchAll(PATTERNS.placeholder));
    for (const match of placeholders) {
      columns.push(match[1]);
    }
  }
  
  return [...new Set(columns)];
}
