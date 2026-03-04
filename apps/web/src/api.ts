import axios from 'axios';

const API_BASE = '/api';

export interface Draft {
  id: string;
  name: string;
  updated_at: string;
}

export interface DraftDetails {
  id: string;
  name: string;
  data: {
    blocks: Record<string, boolean>;
    values: Record<string, string>;
    tables: Record<string, Record<string, string>[]>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TemplateManifest {
  blocks: string[];
  placeholders: string[];
  tables: Record<string, string[]>;
  statics: string[];
}

export interface BlockLibraryEntry {
  name: string;
  title: string;
  category: string;
  description: string;
  sortOrder: number;
  isOptional: boolean;
  occurrences: number;
  fieldsUsed: string[];
  tablesUsed: string[];
}

export type BlockState = 'Empty' | 'Partial' | 'Complete';

export interface BlockStatus {
  name: string;
  enabled: boolean;
  completionPercent: number;
  state: BlockState;
}

export interface RenderResponse {
  fileId: string;
  filename: string;
}

export const api = {
  // Drafts
  async createDraft(name: string): Promise<{ id: string }> {
    const { data } = await axios.post(`${API_BASE}/drafts`, { name });
    return data;
  },

  async getDrafts(): Promise<Draft[]> {
    const { data } = await axios.get(`${API_BASE}/drafts`);
    return data;
  },

  async getDraft(id: string): Promise<DraftDetails> {
    const { data } = await axios.get(`${API_BASE}/drafts/${id}`);
    return data;
  },

  async updateDraft(
    id: string,
    updates: {
      blocks?: Record<string, boolean>;
      values?: Record<string, string>;
      tables?: Record<string, Record<string, string>[]>;
    }
  ): Promise<void> {
    await axios.patch(`${API_BASE}/drafts/${id}`, updates);
  },

  async updateDraftName(id: string, name: string): Promise<void> {
    await axios.patch(`${API_BASE}/drafts/${id}/name`, { name });
  },

  async deleteDraft(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/drafts/${id}`);
  },

  // Template
  async getTemplateManifest(): Promise<TemplateManifest> {
    const { data } = await axios.get(`${API_BASE}/template/manifest`);
    return data;
  },

  async getBlockLibrary(): Promise<BlockLibraryEntry[]> {
    const { data } = await axios.get(`${API_BASE}/template/block-library`);
    return data;
  },

  async updateBlockMeta(
    blockName: string,
    updates: {
      title?: string;
      category?: string;
      description?: string;
      sortOrder?: number;
      isOptional?: boolean;
    }
  ): Promise<void> {
    await axios.patch(`${API_BASE}/template/block-meta`, { blockName, ...updates });
  },

  async getBlockStatus(draftId: string): Promise<BlockStatus[]> {
    const { data } = await axios.get(`${API_BASE}/drafts/${draftId}/block-status`);
    return data;
  },

  // Files
  async renderDraft(draftId: string): Promise<RenderResponse> {
    const { data } = await axios.post(`${API_BASE}/drafts/${draftId}/render`);
    return data;
  },

  getDownloadUrl(fileId: string): string {
    return `${API_BASE}/files/${fileId}/download`;
  },
};
