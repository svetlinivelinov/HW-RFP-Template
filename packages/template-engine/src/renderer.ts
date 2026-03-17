import JSZip from 'jszip';
import { DraftData } from './types.js';
import {
  parseXML,
  serializeXML,
  getParagraphs,
  getParagraphText,
  getRuns,
  getRunText,
  setRunText,
  consolidateRunsForMarker,
  getTables,
  getTableRows,
  getTableCells,
  cloneRun,
  createRunFromTemplate,
  getChildElements,
  parseXMLFragment,
} from './xml-utils.js';

/**
 * Regular expressions for markers (non-global for single match)
 */
const PATTERNS = {
  block: /\[\[BLOCK:([^\]]+)\]\]/,
  blockEnd: /\[\[END:([^\]]+)\]\]/,
  static: /\[\[STATIC:([^\]]+)\]\]/,
  staticEnd: /\[\[END:STATIC\]\]/,
  table: /\[\[TABLE:([^\]]+)\]\]/,
  placeholder: /\{\{([^}]+)\}\}/,
};

/**
 * Render a DOCX template with draft data
 * @param templateBuffer - The raw DOCX template buffer
 * @param draftData - The draft data containing blocks, values, and tables
 * @returns Rendered DOCX buffer
 */
export async function render(
  templateBuffer: Buffer,
  draftData: DraftData,
  variantXmlMap: Record<string, string> = {},
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);
  
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('Invalid DOCX file: word/document.xml not found');
  }
  
  const documentXmlString = await documentXmlFile.async('text');
  const doc = parseXML(documentXmlString);
  
  // Rendering pipeline (order matters!)
  // 0. Substitute block content variants (replaces skeleton content with stored XML)
  if (Object.keys(variantXmlMap).length > 0) {
    processBlockVariants(doc, variantXmlMap);
  }

  // 1. Expand/Remove Blocks
  processBlocks(doc, draftData.blocks);
  
  // 2. Remove STATIC markers but keep content
  processStatics(doc);
  
  // 3. Render Tables FIRST (before placeholders to preserve table placeholders)
  processTables(doc, draftData.tables);
  
  // 4. Replace global Placeholders (after tables so table placeholders aren't clobbered)
  replacePlaceholders(doc, draftData.values);
  
  // Serialize back to XML
  const modifiedXml = serializeXML(doc);
  
  // Update the document.xml in the zip
  zip.file('word/document.xml', modifiedXml);
  
  // Generate output buffer
  const outputBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  
  return outputBuffer;
}

/**
 * Substitute block content variants: replace skeleton paragraph content between
 * [[BLOCK:name]] and [[END:name]] markers with stored variant XML paragraphs.
 * This runs BEFORE processBlocks so the marker stripping still happens.
 */
function processBlockVariants(doc: Document, variantXmlMap: Record<string, string>): void {
  for (const [blockName, contentXml] of Object.entries(variantXmlMap)) {
    if (!contentXml.trim()) continue;

    const paragraphs = getParagraphs(doc);
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < paragraphs.length; i++) {
      consolidateRunsForMarker(paragraphs[i], new RegExp(`\\[\\[BLOCK:${blockName}\\]\\]`));
      consolidateRunsForMarker(paragraphs[i], new RegExp(`\\[\\[END:${blockName}\\]\\]`));
      const text = getParagraphText(paragraphs[i]);
      if (text.includes(`[[BLOCK:${blockName}]]`)) startIdx = i;
      else if (startIdx !== -1 && text.includes(`[[END:${blockName}]]`)) { endIdx = i; break; }
    }

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) continue;

    const endMarkerParagraph = paragraphs[endIdx];

    // Remove existing skeleton content between markers (keep the markers themselves)
    for (let i = endIdx - 1; i > startIdx; i--) {
      paragraphs[i].parentNode?.removeChild(paragraphs[i]);
    }

    // Parse variant XML and insert paragraphs before the END marker
    const variantParagraphs = parseXMLFragment(contentXml);
    for (const p of variantParagraphs) {
      const imported = doc.importNode(p, true);
      endMarkerParagraph.parentNode?.insertBefore(imported, endMarkerParagraph);
    }
  }
}

/**
 * Process blocks: remove disabled blocks, keep enabled ones, remove markers
 */
function processBlocks(doc: Document, blocks: Record<string, boolean>): void {
  const body = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'body')[0];
  if (!body) return;
  
  const paragraphs = getParagraphs(doc);
  const elementsToRemove: Element[] = [];
  
  let i = 0;
  while (i < paragraphs.length) {
    const paragraph = paragraphs[i];
    
    // Consolidate runs for block markers
    consolidateRunsForMarker(paragraph, PATTERNS.block);
    consolidateRunsForMarker(paragraph, PATTERNS.blockEnd);
    
    const text = getParagraphText(paragraph);
    const blockStartMatch = text.match(PATTERNS.block);
    
    if (blockStartMatch) {
      const blockName = blockStartMatch[1];
      const isEnabled = blocks[blockName] !== false; // Default to true if not specified
      
      // Find the matching END marker
      let endIndex = -1;
      for (let j = i + 1; j < paragraphs.length; j++) {
        const endText = getParagraphText(paragraphs[j]);
        const endMatch = endText.match(PATTERNS.blockEnd);
        
        if (endMatch && endMatch[1] === blockName) {
          endIndex = j;
          break;
        }
      }
      
      if (endIndex === -1) {
        // No matching end found, skip this block marker
        i++;
        continue;
      }
      
      if (!isEnabled) {
        // Remove all elements from start to end (inclusive)
        for (let j = i; j <= endIndex; j++) {
          elementsToRemove.push(paragraphs[j]);
        }
        i = endIndex + 1;
      } else {
        // Keep block content but remove the marker paragraphs
        elementsToRemove.push(paragraphs[i]); // Remove start marker
        elementsToRemove.push(paragraphs[endIndex]); // Remove end marker
        i = endIndex + 1;
      }
    } else {
      i++;
    }
  }
  
  // Remove marked elements
  for (const element of elementsToRemove) {
    element.parentNode?.removeChild(element);
  }
}

/**
 * Process static blocks: remove markers but keep content
 */
function processStatics(doc: Document): void {
  const paragraphs = getParagraphs(doc);
  const elementsToRemove: Element[] = [];
  
  for (const paragraph of paragraphs) {
    consolidateRunsForMarker(paragraph, PATTERNS.static);
    consolidateRunsForMarker(paragraph, PATTERNS.staticEnd);
    
    const text = getParagraphText(paragraph);
    
    if (PATTERNS.static.test(text) || PATTERNS.staticEnd.test(text)) {
      elementsToRemove.push(paragraph);
    }
  }
  
  // Remove marker paragraphs
  for (const element of elementsToRemove) {
    element.parentNode?.removeChild(element);
  }
}

/**
 * Replace placeholders with values
 */
function replacePlaceholders(doc: Document, values: Record<string, string>): void {
  const paragraphs = getParagraphs(doc);
  
  for (const paragraph of paragraphs) {
    // Consolidate runs for each placeholder that might appear
    // We need to check the full text first
    const fullText = getParagraphText(paragraph);
    const placeholderMatches = Array.from(fullText.matchAll(/\{\{([^}]+)\}\}/g));
    
    // Consolidate for each unique placeholder
    for (const match of placeholderMatches) {
      const placeholder = match[0];
      const pattern = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      consolidateRunsForMarker(paragraph, pattern);
    }
    
    // Now replace placeholders in runs
    const runs = getRuns(paragraph);
    for (const run of runs) {
      let runText = getRunText(run);
      
      // Replace all placeholders in this run
      runText = runText.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        return values[key] || match; // Keep placeholder if no value
      });
      
      setRunText(run, runText);
    }
  }
  
  // Also process placeholders in tables
  const tables = getTables(doc);
  for (const table of tables) {
    const rows = getTableRows(table);
    
    for (const row of rows) {
      const cells = getTableCells(row);
      
      for (const cell of cells) {
        const cellParagraphs = cell.getElementsByTagNameNS(
          'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
          'p'
        );
        
        for (let i = 0; i < cellParagraphs.length; i++) {
          const cellParagraph = cellParagraphs[i] as Element;
          
          // Consolidate runs for placeholders
          const cellText = getParagraphText(cellParagraph);
          const cellMatches = Array.from(cellText.matchAll(/\{\{([^}]+)\}\}/g));
          
          for (const match of cellMatches) {
            const placeholder = match[0];
            const pattern = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            consolidateRunsForMarker(cellParagraph, pattern);
          }
          
          // Replace placeholders
          const runs = getRuns(cellParagraph);
          for (const run of runs) {
            let runText = getRunText(run);
            runText = runText.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              return values[key] || match;
            });
            setRunText(run, runText);
          }
        }
      }
    }
  }
}

/**
 * Process table markers and populate tables with data
 */
function processTables(doc: Document, tables: Record<string, Record<string, string>[]>): void {
  const body = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'body')[0];
  if (!body) return;
  
  const paragraphs = getParagraphs(doc);
  const tablesToProcess: Array<{ markerParagraph: Element; tableName: string; table: Element }> = [];
  
  // Find all table markers and their corresponding tables
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    consolidateRunsForMarker(paragraph, PATTERNS.table);
    
    const text = getParagraphText(paragraph);
    const tableMatch = text.match(PATTERNS.table);
    
    if (tableMatch) {
      const tableName = tableMatch[1];
      
      // Find the next table after this paragraph
      const table = findNextTableElement(body, paragraph);
      
      if (table) {
        tablesToProcess.push({
          markerParagraph: paragraph,
          tableName,
          table,
        });
      }
    }
  }
  
  // Process each table
  for (const { markerParagraph, tableName, table } of tablesToProcess) {
    const data = tables[tableName] || [];
    
    // Remove the marker paragraph
    markerParagraph.parentNode?.removeChild(markerParagraph);
    
    // Get table rows
    const rows = getTableRows(table);
    if (rows.length === 0) continue;
    
    // First row is header, second (or last) is prototype
    const headerRow = rows[0];
    const prototypeRow = rows.length > 1 ? rows[1] : rows[0];
    
    // If data is empty, keep header + blank prototype (per user preference)
    if (data.length === 0) {
      // Remove all rows except header and one blank prototype
      for (let i = rows.length - 1; i > 1; i--) {
        rows[i].parentNode?.removeChild(rows[i]);
      }
      continue;
    }
    
    // Clone prototype row for each data item
    const newRows: Element[] = [];
    
    // Placeholder pattern for consolidation
    const placeholderPattern = /\{\{[^}]+\}\}/;
    
    for (const rowData of data) {
      const newRow = prototypeRow.cloneNode(true) as Element;
      
      // Replace placeholders in the new row
      const cells = getTableCells(newRow);
      for (const cell of cells) {
        const cellParagraphs = cell.getElementsByTagNameNS(
          'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
          'p'
        );
        
        for (let i = 0; i < cellParagraphs.length; i++) {
          const cellParagraph = cellParagraphs[i] as Element;
          
          // Consolidate any split placeholders before replacing
          consolidateRunsForMarker(cellParagraph, placeholderPattern);
          
          const runs = getRuns(cellParagraph);
          
          for (const run of runs) {
            let runText = getRunText(run);
            runText = runText.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              return rowData[key] || match;
            });
            setRunText(run, runText);
          }
        }
      }
      
      newRows.push(newRow);
    }
    
    // Remove old data rows (keep header)
    for (let i = rows.length - 1; i >= 1; i--) {
      rows[i].parentNode?.removeChild(rows[i]);
    }
    
    // Insert new rows after header
    for (const newRow of newRows) {
      table.appendChild(newRow);
    }
  }
}

/**
 * Find the next table element after a given paragraph in the body
 */
function findNextTableElement(body: Element, afterParagraph: Element): Element | null {
  let found = false;
  const children = getChildElements(body);
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    if (child === afterParagraph) {
      found = true;
      continue;
    }
    
    if (found && child.localName === 'tbl') {
      return child;
    }
  }
  
  return null;
}
