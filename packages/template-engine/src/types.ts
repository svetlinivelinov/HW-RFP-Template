/**
 * Per-block metadata computed from the template
 */
export interface BlockManifestEntry {
  name: string;
  title: string;
  occurrences: number;
  inferredCategory: string;
  description: string;
  fieldsUsed: string[];
  tablesUsed: string[];
}

/**
 * Represents the structure of a template
 */
export interface TemplateManifest {
  blocks: string[];
  placeholders: string[];
  tables: Record<string, string[]>; // table name -> column names
  statics: string[];
  /** Extended per-block metadata with fieldsUsed / tablesUsed */
  blockEntries: BlockManifestEntry[];
  /** Reverse index: placeholder name -> block names that use it */
  fieldToBlocks: Record<string, string[]>;
  /** Reverse index: table name -> block names that use it */
  tableToBlocks: Record<string, string[]>;
}

/**
 * Map of block names to their enabled state
 */
export type BlocksMap = Record<string, boolean>;

/**
 * Map of placeholder names to their values
 */
export type ValuesMap = Record<string, string>;

/**
 * Map of table names to their row data
 */
export type TablesMap = Record<string, Record<string, string>[]>;

/**
 * Complete draft data structure
 */
export interface DraftData {
  blocks: BlocksMap;
  values: ValuesMap;
  tables: TablesMap;
  /** Optional map of blockName → applied variant content XML (injected at render time) */
  blockVariants?: Record<string, string>;
}
