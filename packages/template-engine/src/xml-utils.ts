import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/**
 * XML namespace constants for Word documents
 */
export const NAMESPACES = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
};

const parser = new DOMParser();
const serializer = new XMLSerializer();

/**
 * Parse XML string into Document
 */
export function parseXML(xmlString: string): Document {
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * Serialize XML document back to string
 */
export function serializeXML(doc: Document): string {
  return serializer.serializeToString(doc);
}

/**
 * Serialize a single XML element to string
 */
export function serializeNode(node: Element): string {
  return serializer.serializeToString(node);
}

/**
 * Parse a fragment of concatenated Word XML elements (e.g. <w:p> nodes)
 * into an array of Elements, with Word namespaces pre-declared on the root.
 */
export function parseXMLFragment(xmlContent: string): Element[] {
  const wrapped = `<w:body xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">${xmlContent}</w:body>`;
  const doc = parser.parseFromString(wrapped, 'text/xml');
  return getChildElements(doc.documentElement);
}

/**
 * Get text content from a Word run element
 */
export function getRunText(run: Element): string {
  const textElements = run.getElementsByTagNameNS(NAMESPACES.w, 't');
  let text = '';
  for (let i = 0; i < textElements.length; i++) {
    text += textElements[i].textContent || '';
  }
  return text;
}

/**
 * Set text content in a Word run element
 */
export function setRunText(run: Element, text: string): void {
  const textElements = run.getElementsByTagNameNS(NAMESPACES.w, 't');
  
  if (textElements.length === 0) {
    // Create a new <w:t> element
    const rPr = run.getElementsByTagNameNS(NAMESPACES.w, 'rPr')[0];
    const wT = run.ownerDocument.createElementNS(NAMESPACES.w, 'w:t');
    
    // Add xml:space="preserve" to preserve spaces
    wT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    wT.textContent = text;
    
    if (rPr) {
      run.insertBefore(wT, rPr.nextSibling);
    } else {
      run.appendChild(wT);
    }
  } else {
    // Update existing <w:t> element
    textElements[0].textContent = text;
    textElements[0].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    
    // Remove extra <w:t> elements if any
    for (let i = textElements.length - 1; i > 0; i--) {
      textElements[i].parentNode?.removeChild(textElements[i]);
    }
  }
}

/**
 * Helper to get child elements (xmldom uses childNodes, not children)
 */
export function getChildElements(parent: Element): Element[] {
  const children: Element[] = [];
  const nodes = parent.childNodes;
  if (!nodes) return children;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType === 1) { // ELEMENT_NODE
      children.push(node as Element);
    }
  }
  return children;
}

/**
 * Get all paragraphs from the document body
 */
export function getParagraphs(doc: Document): Element[] {
  const body = doc.getElementsByTagNameNS(NAMESPACES.w, 'body')[0];
  if (!body) return [];
  
  const paragraphs: Element[] = [];
  const children = getChildElements(body);
  
  for (let i = 0; i < children.length; i++) {
    if (children[i].localName === 'p' && children[i].namespaceURI === NAMESPACES.w) {
      paragraphs.push(children[i]);
    }
  }
  
  return paragraphs;
}

/**
 * Get all runs from a paragraph
 */
export function getRuns(paragraph: Element): Element[] {
  const runs: Element[] = [];
  const children = getChildElements(paragraph);
  
  for (let i = 0; i < children.length; i++) {
    if (children[i].localName === 'r' && children[i].namespaceURI === NAMESPACES.w) {
      runs.push(children[i]);
    }
  }
  
  return runs;
}

/**
 * Get full text content from a paragraph
 */
export function getParagraphText(paragraph: Element): string {
  const runs = getRuns(paragraph);
  return runs.map(run => getRunText(run)).join('');
}

/**
 * Clone a run element with all its properties
 */
export function cloneRun(run: Element): Element {
  return run.cloneNode(true) as Element;
}

/**
 * Create a new run with specific text and properties from a template run
 */
export function createRunFromTemplate(templateRun: Element, text: string): Element {
  const newRun = cloneRun(templateRun);
  setRunText(newRun, text);
  return newRun;
}

/**
 * Consolidate runs in a paragraph to make markers appear in single runs
 * This is critical for handling Word's run splitting behavior
 */
export function consolidateRunsForMarker(paragraph: Element, markerPattern: RegExp): void {
  const runs = getRuns(paragraph);
  if (runs.length === 0) return;
  
  const fullText = runs.map(r => getRunText(r)).join('');
  const match = fullText.match(markerPattern);
  
  if (!match) return;
  
  const markerStart = match.index!;
  const markerEnd = markerStart + match[0].length;
  
  // Calculate which runs contain the marker
  let currentPos = 0;
  let startRunIdx = -1;
  let endRunIdx = -1;
  
  for (let i = 0; i < runs.length; i++) {
    const runText = getRunText(runs[i]);
    const runStart = currentPos;
    const runEnd = currentPos + runText.length;
    
    if (startRunIdx === -1 && runEnd > markerStart) {
      startRunIdx = i;
    }
    
    if (runEnd >= markerEnd) {
      endRunIdx = i;
      break;
    }
    
    currentPos = runEnd;
  }
  
  if (startRunIdx === -1 || endRunIdx === -1 || startRunIdx === endRunIdx) {
    return; // Marker already in a single run or not found
  }
  
  // Merge runs from startRunIdx to endRunIdx only
  // Calculate text in the AFFECTED runs only (not all runs)
  let affectedText = '';
  let affectedStart = 0;
  for (let i = 0; i < runs.length; i++) {
    const runText = getRunText(runs[i]);
    if (i < startRunIdx) {
      affectedStart += runText.length;
    } else if (i <= endRunIdx) {
      affectedText += runText;
    }
  }
  
  // Calculate positions relative to affected runs
  const relativeMarkerStart = markerStart - affectedStart;
  const relativeMarkerEnd = markerEnd - affectedStart;
  
  const beforeMarker = affectedText.substring(0, relativeMarkerStart);
  const marker = affectedText.substring(relativeMarkerStart, relativeMarkerEnd);
  const afterMarker = affectedText.substring(relativeMarkerEnd);
  
  // Use the first run's properties as template
  const templateRun = runs[startRunIdx];
  
  // Rebuild runs
  const newRuns: Element[] = [];
  
  if (beforeMarker.length > 0) {
    newRuns.push(createRunFromTemplate(templateRun, beforeMarker));
  }
  
  newRuns.push(createRunFromTemplate(templateRun, marker));
  
  if (afterMarker.length > 0) {
    newRuns.push(createRunFromTemplate(templateRun, afterMarker));
  }
  
  // Remove old runs and insert new ones
  const firstRun = runs[startRunIdx];
  const lastRun = runs[endRunIdx];
  
  // Insert new runs before the first affected run
  newRuns.forEach(newRun => {
    paragraph.insertBefore(newRun, firstRun);
  });
  
  // Remove old affected runs
  for (let i = startRunIdx; i <= endRunIdx; i++) {
    paragraph.removeChild(runs[i]);
  }
}

/**
 * Find all tables in the document
 */
export function getTables(doc: Document): Element[] {
  const body = doc.getElementsByTagNameNS(NAMESPACES.w, 'body')[0];
  if (!body) return [];
  
  const tables: Element[] = [];
  const allTables = doc.getElementsByTagNameNS(NAMESPACES.w, 'tbl');
  
  for (let i = 0; i < allTables.length; i++) {
    tables.push(allTables[i]);
  }
  
  return tables;
}

/**
 * Get rows from a table
 */
export function getTableRows(table: Element): Element[] {
  const rows: Element[] = [];
  const trElements = table.getElementsByTagNameNS(NAMESPACES.w, 'tr');
  
  for (let i = 0; i < trElements.length; i++) {
    rows.push(trElements[i]);
  }
  
  return rows;
}

/**
 * Get cells from a table row
 */
export function getTableCells(row: Element): Element[] {
  const cells: Element[] = [];
  const tcElements = row.getElementsByTagNameNS(NAMESPACES.w, 'tc');
  
  for (let i = 0; i < tcElements.length; i++) {
    cells.push(tcElements[i]);
  }
  
  return cells;
}
