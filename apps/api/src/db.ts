import Database, { Database as DatabaseType } from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbPath = resolve(__dirname, '../../data/app.sqlite');

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

// Initialize database
export const db: DatabaseType = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  // Drafts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      path TEXT NOT NULL,
      mime TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
    )
  `);

  // Block metadata table (optional overrides for title/category/description/sort_order)
  db.exec(`
    CREATE TABLE IF NOT EXISTS block_meta (
      block_name TEXT PRIMARY KEY,
      title TEXT,
      category TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_optional INTEGER DEFAULT 1
    )
  `);

    // Block content table for reusable block variants
    db.exec(`
      CREATE TABLE IF NOT EXISTS block_content (
        id TEXT PRIMARY KEY,
        block_name TEXT NOT NULL,
        variant_name TEXT NOT NULL,
        source_project TEXT,
        content_xml TEXT NOT NULL,
        preview_html TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT,
        version INTEGER DEFAULT 1,
        updated_at TEXT,
        updated_by TEXT,
        parent_id TEXT,
        tags TEXT,
        description TEXT,
        usage_count INTEGER DEFAULT 0,
        quality_rating INTEGER,
        content_hash TEXT,
        FOREIGN KEY (parent_id) REFERENCES block_content(id)
      )
    `);
  console.log('Database initialized');
}

/**
 * Draft repository
 */
export const draftRepository = {
  create(id: string, name: string, draftJson: string) {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO drafts (id, name, draft_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, name, draftJson, now, now);
  },

  findAll() {
    const stmt = db.prepare('SELECT id, name, updated_at FROM drafts ORDER BY updated_at DESC');
    return stmt.all() as Array<{ id: string; name: string; updated_at: string }>;
  },

  findById(id: string) {
    const stmt = db.prepare('SELECT * FROM drafts WHERE id = ?');
    return stmt.get(id) as { id: string; name: string; draft_json: string; created_at: string; updated_at: string } | undefined;
  },

  update(id: string, draftJson: string) {
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE drafts SET draft_json = ?, updated_at = ? WHERE id = ?');
    stmt.run(draftJson, now, id);
  },

  updateName(id: string, name: string) {
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE drafts SET name = ?, updated_at = ? WHERE id = ?');
    stmt.run(name, now, id);
  },

  delete(id: string) {
    const stmt = db.prepare('DELETE FROM drafts WHERE id = ?');
    stmt.run(id);
  },
};

/**
 * File repository
 */
export const fileRepository = {
  create(id: string, draftId: string, path: string, mime: string) {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO files (id, draft_id, path, mime, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, draftId, path, mime, now);
  },

  findById(id: string) {
    const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
    return stmt.get(id) as { id: string; draft_id: string; path: string; mime: string; created_at: string } | undefined;
  },

  findByDraftId(draftId: string) {
    const stmt = db.prepare('SELECT * FROM files WHERE draft_id = ? ORDER BY created_at DESC');
    return stmt.all(draftId) as Array<{ id: string; draft_id: string; path: string; mime: string; created_at: string }>;
  },
};

/**
 * Block metadata repository — stores optional UI overrides per block
 */
export interface BlockMeta {
  block_name: string;
  title: string | null;
  category: string | null;
  description: string | null;
  sort_order: number;
  is_optional: number;
}

// Block content repository
export interface BlockContent {
  id: string;
  block_name: string;
  variant_name: string;
  source_project: string;
  content_xml: string;
  preview_html: string;
  created_at: string;
  created_by: string;
  version: number;
  updated_at: string | null;
  updated_by: string | null;
  parent_id: string | null;
  tags: string | null;
  description: string | null;
  usage_count: number;
  quality_rating: number | null;
  content_hash: string;
}

export const blockContentRepository = {
  insert(content: Omit<BlockContent, 'id' | 'created_at'>): string {
    const id = nanoid();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO block_content (
        id, block_name, variant_name, source_project, content_xml, preview_html, created_at, created_by, version, updated_at, updated_by, parent_id, tags, description, usage_count, quality_rating, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      content.block_name,
      content.variant_name,
      content.source_project,
      content.content_xml,
      content.preview_html,
      now,
      content.created_by,
      content.version,
      content.updated_at,
      content.updated_by,
      content.parent_id,
      content.tags,
      content.description,
      content.usage_count,
      content.quality_rating,
      content.content_hash
    );
    return id;
  },
  findByHash(block_name: string, content_hash: string): BlockContent | undefined {
    const stmt = db.prepare('SELECT * FROM block_content WHERE block_name = ? AND content_hash = ?');
    return stmt.get(block_name, content_hash) as BlockContent | undefined;
  },
  findById(id: string): BlockContent | undefined {
    const stmt = db.prepare('SELECT * FROM block_content WHERE id = ?');
    return stmt.get(id) as BlockContent | undefined;
  },
  findByBlockName(block_name: string): BlockContent[] {
    const stmt = db.prepare('SELECT * FROM block_content WHERE block_name = ? ORDER BY created_at DESC');
    return stmt.all(block_name) as BlockContent[];
  },
  incrementUsage(id: string): void {
    const stmt = db.prepare('UPDATE block_content SET usage_count = usage_count + 1 WHERE id = ?');
    stmt.run(id);
  }
};

export const blockMetaRepository = {
  findAll(): BlockMeta[] {
    const stmt = db.prepare('SELECT * FROM block_meta ORDER BY sort_order ASC, block_name ASC');
    return stmt.all() as BlockMeta[];
  },

  findByName(blockName: string): BlockMeta | undefined {
    const stmt = db.prepare('SELECT * FROM block_meta WHERE block_name = ?');
    return stmt.get(blockName) as BlockMeta | undefined;
  },

  upsert(meta: Partial<BlockMeta> & { block_name: string }): void {
    const stmt = db.prepare(`
      INSERT INTO block_meta (block_name, title, category, description, sort_order, is_optional)
      VALUES (@block_name, @title, @category, @description, @sort_order, @is_optional)
      ON CONFLICT(block_name) DO UPDATE SET
        title = COALESCE(@title, title),
        category = COALESCE(@category, category),
        description = COALESCE(@description, description),
        sort_order = COALESCE(@sort_order, sort_order),
        is_optional = COALESCE(@is_optional, is_optional)
    `);
    stmt.run({
      block_name: meta.block_name,
      title: meta.title ?? null,
      category: meta.category ?? null,
      description: meta.description ?? null,
      sort_order: meta.sort_order ?? 0,
      is_optional: meta.is_optional ?? 1,
    });
  },
};
