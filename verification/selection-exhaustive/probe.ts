import { readFile } from 'node:fs/promises';
import { StructureIngestionService } from '../../apps/api/src/structures/ingestion.ts';
import { evaluateSelectionQuery } from '../../apps/web/src/selection/selectionEngine.ts';
const service = new StructureIngestionService();
const buf = await readFile('tests/fixtures/mini-protein.pdb');
const result = await service.ingestLocal('mini-protein.pdb',buf);
const s=result.structure; console.log(s.atoms.length,s.id,s.scientificHash,s.atoms[0]);
for (const q of ['all','none','chain A','name CA','polymer.protein within 4 of organic','bad']) { const r=evaluateSelectionQuery(q,s); console.log(q,r.status,r.count,r.stableAtomIds.slice(0,3)); }
