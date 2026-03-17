import { parseTemplate, type TemplateManifest } from '@packages/template-engine';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const TEMPLATE_PATH = resolve(
  __dirname,
  '../../../../assets/template/master_template_v2_1_skeleton.docx',
);

let cachedManifest: TemplateManifest | null = null;

export async function getManifest(): Promise<TemplateManifest> {
  if (!cachedManifest) {
    const templateBuffer = readFileSync(TEMPLATE_PATH);
    cachedManifest = await parseTemplate(templateBuffer);
  }
  return cachedManifest;
}
