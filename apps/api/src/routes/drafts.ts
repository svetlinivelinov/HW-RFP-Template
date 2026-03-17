import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { draftRepository } from '../db.js';
import { getManifest } from '../utils/manifest-cache.js';

// Validation schemas
const CreateDraftSchema = z.object({
  name: z.string().min(1).max(255),
});

const UpdateDraftSchema = z.object({
  blocks: z.record(z.boolean()).optional(),
  values: z.record(z.string()).optional(),
  tables: z.record(z.array(z.record(z.string()))).optional(),
  // null value signals deletion of that key from the stored map
  blockVariants: z.record(z.union([z.string(), z.null()])).optional(),
});

const UpdateDraftNameSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function draftRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/drafts
   * Create a new draft
   */
  fastify.post('/', async (request, reply) => {
    const body = CreateDraftSchema.parse(request.body);
    
    const id = nanoid();
    
    // Load template and parse manifest to get default blocks
    let defaultBlocks: Record<string, boolean> = {};
    
    try {
      const manifest = await getManifest();
      
      // Default all blocks to true
      manifest.blocks.forEach((blockName: string) => {
        defaultBlocks[blockName] = true;
      });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to load template');
      // Continue with empty defaults if template not found
    }
    
    const draftData = {
      blocks: defaultBlocks,
      values: {},
      tables: {},
    };
    
    draftRepository.create(id, body.name, JSON.stringify(draftData));
    
    return { id };
  });

  /**
   * GET /api/drafts
   * List all drafts
   */
  fastify.get('/', async (request, reply) => {
    const drafts = draftRepository.findAll();
    return drafts;
  });

  /**
   * GET /api/drafts/:id
   * Get a specific draft
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const draft = draftRepository.findById(id);
    
    if (!draft) {
      return reply.status(404).send({ error: 'Draft not found' });
    }
    
    return {
      id: draft.id,
      name: draft.name,
      data: JSON.parse(draft.draft_json),
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
    };
  });

  /**
   * PATCH /api/drafts/:id
   * Update draft data (blocks/values/tables)
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = UpdateDraftSchema.parse(request.body);
    
    const draft = draftRepository.findById(id);
    
    if (!draft) {
      return reply.status(404).send({ error: 'Draft not found' });
    }
    
    const currentData = JSON.parse(draft.draft_json);
    
    // Merge updates
    const updatedData = {
      blocks: updates.blocks !== undefined ? { ...currentData.blocks, ...updates.blocks } : currentData.blocks,
      values: updates.values !== undefined ? { ...currentData.values, ...updates.values } : currentData.values,
      tables: updates.tables !== undefined ? { ...currentData.tables, ...updates.tables } : currentData.tables,
      blockVariants: (() => {
        if (updates.blockVariants === undefined) return currentData.blockVariants ?? {};
        const merged = { ...(currentData.blockVariants ?? {}), ...updates.blockVariants };
        // Remove keys whose value was explicitly set to null (deletion signal)
        for (const key of Object.keys(merged)) {
          if (merged[key] === null) delete merged[key];
        }
        return merged;
      })(),
    };
    
    draftRepository.update(id, JSON.stringify(updatedData));
    
    return { success: true };
  });

  /**
   * PATCH /api/drafts/:id/name
   * Update draft name
   */
  fastify.patch('/:id/name', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateDraftNameSchema.parse(request.body);
    
    const draft = draftRepository.findById(id);
    
    if (!draft) {
      return reply.status(404).send({ error: 'Draft not found' });
    }
    
    draftRepository.updateName(id, body.name);
    
    return { success: true };
  });

  /**
   * DELETE /api/drafts/:id
   * Delete a draft
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const draft = draftRepository.findById(id);
    
    if (!draft) {
      return reply.status(404).send({ error: 'Draft not found' });
    }
    
    draftRepository.delete(id);
    
    return { success: true };
  });

  /**
   * GET /api/drafts/:id/block-status
   * Returns per-block completion state for a draft:
   *   enabled, completionPercent, state (Empty | Partial | Complete)
   */
  fastify.get('/:id/block-status', async (request, reply) => {
    const { id } = request.params as { id: string };

    const draft = draftRepository.findById(id);
    if (!draft) {
      return reply.status(404).send({ error: 'Draft not found' });
    }

    let manifest: any;
    try {
      manifest = await getManifest();
    } catch (err) {
      fastify.log.error({ err }, 'Failed to load template for block-status');
      return reply.status(500).send({ error: 'Failed to load template' });
    }

    const data = JSON.parse(draft.draft_json);

    const statuses = manifest.blockEntries.map((entry: any) => {
      const enabled: boolean = data.blocks?.[entry.name] ?? false;

      const totalItems = entry.fieldsUsed.length + entry.tablesUsed.length;
      let filledItems = 0;

      for (const field of entry.fieldsUsed) {
        if (data.values?.[field] && String(data.values[field]).trim() !== '') {
          filledItems++;
        }
      }
      for (const table of entry.tablesUsed) {
        if (Array.isArray(data.tables?.[table]) && data.tables[table].length > 0) {
          filledItems++;
        }
      }

      let state: 'Empty' | 'Partial' | 'Complete';
      let completionPercent: number;

      // A block with an applied content variant is always Complete
      const hasVariant = !!(data.blockVariants?.[entry.name]);

      if (hasVariant) {
        completionPercent = 100;
        state = 'Complete';
      } else if (totalItems === 0) {
        // Block has no tracked content — completion is driven by enabled state
        completionPercent = 100;
        state = enabled ? 'Complete' : 'Empty';
      } else {
        completionPercent = Math.round((filledItems / totalItems) * 100);
        if (filledItems === 0) state = 'Empty';
        else if (filledItems < totalItems) state = 'Partial';
        else state = 'Complete';
      }

      return { name: entry.name, enabled, completionPercent, state };
    });

    return statuses;
  });
}
