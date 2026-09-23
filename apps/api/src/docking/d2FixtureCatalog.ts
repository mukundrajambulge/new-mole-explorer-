export type D2FixtureExpectedStatus = "SUPPORTED" | "AMBIGUOUS" | "INVALID" | "UNSUPPORTED" | "WARNING";
export type D2FixtureFamily = "REP-FX" | "REC-FX" | "LIG-FX" | "SITE-FX" | "INT-FX";

export type D2FixtureCase = Readonly<{
  id: string;
  family: D2FixtureFamily;
  expectedStatus: D2FixtureExpectedStatus;
  contractFocus: string;
}>;

const numbered = (prefix: "REC-FX" | "LIG-FX" | "SITE-FX", count: number): string[] => Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`);

export const D2_REPRESENTATION_FIXTURES: readonly D2FixtureCase[] = [
  { id: "REP-FX-001", family: "REP-FX", expectedStatus: "SUPPORTED", contractFocus: "stable AtomUID and source alias mapping" },
  { id: "REP-FX-002", family: "REP-FX", expectedStatus: "SUPPORTED", contractFocus: "formal charge versus partial-charge evidence" },
  { id: "REP-FX-003", family: "REP-FX", expectedStatus: "SUPPORTED", contractFocus: "PDB structural identity and explicit coordinate state" },
  { id: "REP-FX-004", family: "REP-FX", expectedStatus: "SUPPORTED", contractFocus: "mmCIF auth/label namespace preservation proof" },
  { id: "REP-FX-005", family: "REP-FX", expectedStatus: "SUPPORTED", contractFocus: "SDF V2000 graph and coordinate semantics" },
  { id: "REP-FX-006", family: "REP-FX", expectedStatus: "SUPPORTED", contractFocus: "MOL2 typed evidence without canonical partial-charge overwrite" },
  { id: "REP-FX-007", family: "REP-FX", expectedStatus: "SUPPORTED", contractFocus: "SMILES graph-only import" },
  { id: "REP-FX-008", family: "REP-FX", expectedStatus: "UNSUPPORTED", contractFocus: "PDBQT non-authoritative execution evidence" },
  { id: "REP-FX-009", family: "REP-FX", expectedStatus: "INVALID", contractFocus: "nonfinite coordinate rejection" },
  { id: "REP-FX-010", family: "REP-FX", expectedStatus: "AMBIGUOUS", contractFocus: "unknown bond/stereo evidence" },
];

export const D2_RECEPTOR_FIXTURE_EXPECTATIONS: readonly D2FixtureCase[] = [
  { id: "REC-FX-001", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "clean explicit single-chain receptor" },
  { id: "REC-FX-002", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "explicit homodimer assembly" },
  { id: "REC-FX-003", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "asymmetric unit versus biological assembly" },
  { id: "REC-FX-004", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "multiple MODEL records" },
  { id: "REC-FX-005", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "NMR model set" },
  { id: "REC-FX-006", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "binding-site altloc choice" },
  { id: "REC-FX-007", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "occupancy tie" },
  { id: "REC-FX-008", family: "REC-FX", expectedStatus: "WARNING", contractFocus: "missing non-site side-chain atom" },
  { id: "REC-FX-009", family: "REC-FX", expectedStatus: "INVALID", contractFocus: "missing binding-site residue" },
  { id: "REC-FX-010", family: "REC-FX", expectedStatus: "WARNING", contractFocus: "remote missing loop" },
  { id: "REC-FX-011", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "engineered mutation/tag preservation" },
  { id: "REC-FX-012", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "source-backed disulfide" },
  { id: "REC-FX-013", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "ambiguous cysteine pair" },
  { id: "REC-FX-014", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "histidine microstate" },
  { id: "REC-FX-015", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "explicit buried acidic chemical state" },
  { id: "REC-FX-016", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "true chain terminus" },
  { id: "REC-FX-017", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "internal chain break is not a terminus" },
  { id: "REC-FX-018", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "structural-water dry-profile limitation" },
  { id: "REC-FX-019", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "metal-coordinating water" },
  { id: "REC-FX-020", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "direct zinc coordination" },
  { id: "REC-FX-021", family: "REC-FX", expectedStatus: "WARNING", contractFocus: "remote structural metal" },
  { id: "REC-FX-022", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "heme cofactor support" },
  { id: "REC-FX-023", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "FAD cofactor support" },
  { id: "REC-FX-024", family: "REC-FX", expectedStatus: "WARNING", contractFocus: "remote glycan role" },
  { id: "REC-FX-025", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "glycan-shaped pocket" },
  { id: "REC-FX-026", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "protein-DNA complex" },
  { id: "REC-FX-027", family: "REC-FX", expectedStatus: "UNSUPPORTED", contractFocus: "nonstandard residue near pocket" },
  { id: "REC-FX-028", family: "REC-FX", expectedStatus: "SUPPORTED", contractFocus: "reference-ligand removal with evidence retention" },
  { id: "REC-FX-029", family: "REC-FX", expectedStatus: "INVALID", contractFocus: "nonfinite coordinate" },
  { id: "REC-FX-030", family: "REC-FX", expectedStatus: "AMBIGUOUS", contractFocus: "unknown hetero component near site" },
];

const D2_LIGAND_FIXTURE_OVERRIDES: readonly D2FixtureCase[] = [
  { id: "LIG-FX-008", family: "LIG-FX", expectedStatus: "AMBIGUOUS", contractFocus: "unspecified tetrahedral stereocentre" },
  { id: "LIG-FX-012", family: "LIG-FX", expectedStatus: "AMBIGUOUS", contractFocus: "salt component selection" },
  { id: "LIG-FX-013", family: "LIG-FX", expectedStatus: "AMBIGUOUS", contractFocus: "arbitrary disconnected mixture" },
  { id: "LIG-FX-023", family: "LIG-FX", expectedStatus: "UNSUPPORTED", contractFocus: "macrocycle-special execution" },
  { id: "LIG-FX-027", family: "LIG-FX", expectedStatus: "UNSUPPORTED", contractFocus: "boron chemistry profile" },
  { id: "LIG-FX-028", family: "LIG-FX", expectedStatus: "UNSUPPORTED", contractFocus: "selenium chemistry profile" },
  { id: "LIG-FX-029", family: "LIG-FX", expectedStatus: "UNSUPPORTED", contractFocus: "metal/organometallic chemistry" },
  { id: "LIG-FX-030", family: "LIG-FX", expectedStatus: "INVALID", contractFocus: "malformed valence" },
  { id: "LIG-FX-031", family: "LIG-FX", expectedStatus: "INVALID", contractFocus: "nonfinite 3D coordinates" },
  { id: "LIG-FX-032", family: "LIG-FX", expectedStatus: "UNSUPPORTED", contractFocus: "PDBQT-only incomplete chemical truth" },
  { id: "LIG-FX-033", family: "LIG-FX", expectedStatus: "UNSUPPORTED", contractFocus: "unknown MOL2 charge model" },
  { id: "LIG-FX-035", family: "LIG-FX", expectedStatus: "INVALID", contractFocus: "conformer-generation failure" },
];

export const D2_LIGAND_FIXTURE_EXPECTATIONS: readonly D2FixtureCase[] = numbered("LIG-FX", 35).map((id) => D2_LIGAND_FIXTURE_OVERRIDES.find((override) => override.id === id) ?? ({ id, family: "LIG-FX", expectedStatus: "SUPPORTED", contractFocus: "PHD-V2-04 ligand explicit-state fixture" }));

export const D2_SITE_FIXTURE_EXPECTATIONS: readonly D2FixtureCase[] = numbered("SITE-FX", 30).map((id) => ({ id, family: "SITE-FX", expectedStatus: "SUPPORTED", contractFocus: "PHD-V2-05 SearchRegion/site fixture" }));

export const D2_INTEGRATION_FIXTURES: readonly D2FixtureCase[] = [
  { id: "INT-FX-001", family: "INT-FX", expectedStatus: "SUPPORTED", contractFocus: "D1 canonical round trip regression" },
  { id: "INT-FX-002", family: "INT-FX", expectedStatus: "SUPPORTED", contractFocus: "D1 six-state JobStatus regression" },
  { id: "INT-FX-003", family: "INT-FX", expectedStatus: "SUPPORTED", contractFocus: "D1 orthogonal status regression" },
  { id: "INT-FX-004", family: "INT-FX", expectedStatus: "SUPPORTED", contractFocus: "D1 PDBQT/command guard regression" },
  { id: "INT-FX-005", family: "INT-FX", expectedStatus: "SUPPORTED", contractFocus: "explicit receptor assembly/model/altloc/chemical state" },
  { id: "INT-FX-006", family: "INT-FX", expectedStatus: "AMBIGUOUS", contractFocus: "ambiguous receptor protonation blocks without auto-pKa" },
  { id: "INT-FX-007", family: "INT-FX", expectedStatus: "SUPPORTED", contractFocus: "explicit ligand ChemicalState and 3D CoordinateState sealing" },
  { id: "INT-FX-008", family: "INT-FX", expectedStatus: "AMBIGUOUS", contractFocus: "missing stereo/tautomer resolution blocks without auto-enumeration" },
  { id: "INT-FX-009", family: "INT-FX", expectedStatus: "UNSUPPORTED", contractFocus: "SMILES-only input blocks pending mapped explicit 3D" },
  { id: "INT-FX-010", family: "INT-FX", expectedStatus: "SUPPORTED", contractFocus: "closed SearchRegion face inclusion and one-ULP exclusion" },
];

export const D2_FIXTURE_CATALOG = Object.freeze({
  representation: D2_REPRESENTATION_FIXTURES,
  receptor: D2_RECEPTOR_FIXTURE_EXPECTATIONS,
  ligand: D2_LIGAND_FIXTURE_EXPECTATIONS,
  site: D2_SITE_FIXTURE_EXPECTATIONS,
  integration: D2_INTEGRATION_FIXTURES,
});

export const assertD2FixtureCatalog = (): void => {
  if (D2_RECEPTOR_FIXTURE_EXPECTATIONS.length !== 30) throw new Error("REC-FX catalog must contain 30 fixtures.");
  if (D2_LIGAND_FIXTURE_EXPECTATIONS.length !== 35) throw new Error("LIG-FX catalog must contain 35 fixtures.");
  if (D2_SITE_FIXTURE_EXPECTATIONS.length !== 30) throw new Error("SITE-FX catalog must contain 30 fixtures.");
  if (D2_INTEGRATION_FIXTURES.length !== 10) throw new Error("INT-FX D1+D2 catalog must contain 10 fixtures.");
};
