/**
 * Represents the structure of a template
 */
export interface TemplateManifest {
  blocks: string[];
  placeholders: string[];
  tables: Record<string, string[]>; // table name -> column names
  statics: string[];
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
}
