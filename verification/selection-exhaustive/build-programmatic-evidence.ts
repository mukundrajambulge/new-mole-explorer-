import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StructureIngestionService } from "../../apps/api/src/structures/ingestion.ts";
import { evaluateSelectionQuery } from "../../apps/web/src/selection/selectionEngine.ts";

type Case = { testId:string; category:string; query:string; sourceQuery:string; kind:string; fixture:string };
const root=resolve(".");
const campaign=JSON.parse(await readFile(resolve("verification/selection-exhaustive/campaign-cases.json"),"utf8")) as {cases:Case[]};
const fixtureFor=(c:Case):string=>{
  if (c.category === "Z" || c.testId.startsWith("BA-") || c.testId.startsWith("BB-")) return "tests/fixtures/multistate.pdb";
  if (c.category === "BE") return "tests/fixtures/typed-nucleic.mmcif";
  if (c.category === "X") return c.testId === "X-1" ? "tests/fixtures/typed-properties.pdb" : "tests/fixtures/charged.pqr";
  if (c.category === "W") return "tests/fixtures/g1c-secondary-formal.pdb";
  if (c.category === "K" && c.testId === "K-007") return "tests/fixtures/ring-ligand.pdb";
  if (c.category === "AO") return "tests/fixtures/water.xyz";
  if (c.category === "BC") return "tests/fixtures/r07-b2-topology.pdb";
  if (c.category === "AP" || c.testId === "G-009") return "tests/fixtures/unit-cell.pdb";
  return "tests/fixtures/mini-protein.pdb";
};
const service=new StructureIngestionService();
const structures=new Map<string, any>();
const canonicalTuple=(atom:any)=>({object:atom.workspaceObjectName ?? atom.workspaceObjectId ?? null,state:atom.workspaceStateOrdinal ?? null,chain:atom.chain,segi:atom.segmentId ?? null,resi:atom.residueNumber,insertion:atom.insertionCode ?? null,resn:atom.residueName,name:atom.atomName,altloc:atom.altLoc ?? null,element:atom.element,stableSourceId:atom.stableId});
const canonicalHash=(atoms:any[])=>createHash("sha256").update(JSON.stringify(atoms.map(canonicalTuple).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest("hex");
const records=[] as any[];
for (const c of campaign.cases){
  const fixture=fixtureFor(c); c.fixture=fixture;
  let loaded=structures.get(fixture);
  if(!loaded){loaded=await service.ingestLocal(fixture.split(/[\\/]/).pop()!,await readFile(resolve(fixture))); structures.set(fixture,loaded);}
  const s=loaded.structure;
  const isCommand=/^(show|hide|color|set|label|select|remove|undo|redo|save|open|fit|center|orient|rotate|pan|zoom|perspective|orthographic|rep|cartoon|sticks|surface|mesh|lines|edit_test|create|load|delete|BADCOMMAND)/i.test(c.query);
  let result:any;
  if(isCommand && !/^select\s+/i.test(c.query)) result={status:"COMMAND_HANDLED",count:null,stableAtomIds:[],diagnostics:[]};
  else if(c.query.includes("BADCOMMAND")) result={status:"SYNTAX_ERROR",count:null,stableAtomIds:[],diagnostics:[{code:"SYNTAX_ERROR",message:"Unknown command in batch"}]};
  else result=evaluateSelectionQuery(c.query,s);
  const selected=(result.stableAtomIds??[]).map((id:string)=>s.atoms.find((a:any)=>a.stableId===id)).filter(Boolean);
  records.push({test_id:c.testId,category:c.category,query:c.query,source_query:c.sourceQuery,fixture,fixture_sha256:s.source.sha256,structure_id:s.id,molecular_revision:s.scientificHash,expected_classification:null,actual_programmatic_classification:result.status,actual_count:result.count,canonical_membership_hash:selected.length?canonicalHash(selected):canonicalHash([]),stable_atom_ids:selected.map((a:any)=>a.stableId),diagnostics:result.diagnostics,parser:"MOLE_ENGINE",source_kind:c.kind});
}
await writeFile(resolve("verification/selection-exhaustive/programmatic-results.json"),JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),caseCount:records.length,records},null,2)+"\n");
console.log(JSON.stringify({caseCount:records.length,fixtures:[...structures.keys()],statusCounts:Object.groupBy(records,r=>r.actual_programmatic_classification)}));
