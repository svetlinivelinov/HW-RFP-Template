import JSZip from 'jszip';
import crypto from 'crypto';
import {
  parseXML, getParagraphs, getParagraphText, consolidateRunsForMarker,
  serializeNode, parseXMLFragment,
} from '@packages/template-engine';

// Parse DOCX and extract block content as serialized <w:p> XML per block name.
// Source document must use [[BLOCK:name]] / [[END:name]] markers.
export async function parseDocxBlocks(buffer: Buffer, blockNames: string[]): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('DOCX missing document.xml');

  const doc = parseXML(documentXml);
  const paragraphs = getParagraphs(doc);
  const blocks: Record<string, string> = {};

  for (const blockName of blockNames) {
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < paragraphs.length; i++) {
      consolidateRunsForMarker(paragraphs[i], new RegExp(`\\[\\[BLOCK:${blockName}\\]\\]`));
      consolidateRunsForMarker(paragraphs[i], new RegExp(`\\[\\[END:${blockName}\\]\\]`));
      const text = getParagraphText(paragraphs[i]);
      if (text.includes(`[[BLOCK:${blockName}]]`)) startIdx = i;
      else if (startIdx !== -1 && text.includes(`[[END:${blockName}]]`)) { endIdx = i; break; }
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx + 1) {
      // Serialize only the paragraphs between the markers (exclusive)
      blocks[blockName] = paragraphs
        .slice(startIdx + 1, endIdx)
        .map(p => serializeNode(p))
        .join('');
    }
  }

  return blocks;
}

// Normalize content_xml for hashing
export function normalizeContentXml(xml: string): string {
  // Remove xml:space, w:rsid*, collapse whitespace
  return xml
    .replace(/xml:space="[^"]*"/g, '')
    .replace(/w:rsid\w+="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Compute SHA-256 hash
export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Generate a simple text-based HTML preview from stored paragraph XML
export function generatePreviewHtml(contentXml: string): string {
  try {
    const elements = parseXMLFragment(contentXml);
    const lines: string[] = [];
    for (const el of elements) {
      if (el.localName === 'p') {
        const text = getParagraphText(el);
        if (text.trim()) {
          lines.push(`<p style="margin:2px 0;font-size:13px">${escapeHtml(text)}</p>`);
        }
      }
    }
    return lines.length
      ? `<div>${lines.join('')}</div>`
      : '<div><em>No text preview available</em></div>';
  } catch {
    return '<div><em>Preview not available</em></div>';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
