import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const XS_TYPES = Object.freeze([
  "C_H", "C_P", "N_P", "N_D", "N_A", "N_DA", "O_P", "O_D", "O_A", "O_DA",
  "S_P", "P_P", "F_H", "Cl_H", "Br_H", "I_H",
]);

export const TERMS = Object.freeze(["G1", "G2", "REP", "HYD", "HB"]);

const hydrophobic = new Set(["C_H", "F_H", "Cl_H", "Br_H", "I_H"]);
const donors = new Set(["N_D", "N_DA", "O_D", "O_DA"]);
const acceptors = new Set(["N_A", "N_DA", "O_A", "O_DA"]);

let physicalOrdinal = 0;
const channels = [];
for (let xsId = 0; xsId < XS_TYPES.length; xsId += 1) {
  for (let termId = 0; termId < TERMS.length; termId += 1) {
    const xsType = XS_TYPES[xsId];
    const term = TERMS[termId];
    let omittedReason = null;
    if (term === "HYD" && !hydrophobic.has(xsType)) {
      omittedReason = "HYD_ZERO_FOR_NON_HYDROPHOBIC_LIGAND";
    } else if (term === "HB" && !donors.has(xsType) && !acceptors.has(xsType)) {
      omittedReason = "HB_ZERO_FOR_LIGAND_WITHOUT_DONOR_OR_ACCEPTOR_ROLE";
    }

    channels.push({
      logical_id: 5 * xsId + termId,
      xs_id: xsId,
      xs_type: xsType,
      term_id: termId,
      term,
      physical_ordinal: omittedReason === null ? physicalOrdinal++ : null,
      omitted_reason: omittedReason,
    });
  }
}

const map = {
  schema: "D3_SCI04_CHANNEL_MAP_V1",
  approval: "OWNER_APPROVED_DIRECTION_CONDITIONAL_PHYSICAL_ACCEPTANCE",
  xs_types: XS_TYPES,
  terms: TERMS,
  physical_schema_id: "ME_SCORING_FIELD_EXACT_ZERO_59_RESEARCH_V1",
  logical_channel_count: channels.length,
  physical_array_count: physicalOrdinal,
  omitted_hyd_channel_count: channels.filter((row) => row.omitted_reason === "HYD_ZERO_FOR_NON_HYDROPHOBIC_LIGAND").length,
  omitted_hb_channel_count: channels.filter((row) => row.omitted_reason === "HB_ZERO_FOR_LIGAND_WITHOUT_DONOR_OR_ACCEPTOR_ROLE").length,
  channels,
  proof_basis: {
    normative_source: "PHD-V2-06, XS chemistry and raw-term scoring equations",
    executable_oracle: "native/docking-reference/scoring/src/scoring.cpp at D3-TOR-01 SHA f0bd2eaf47b02faab4dea694e7c2677094969076",
    rule: "HYD requires hydrophobic receptor and ligand types; HB requires complementary donor/acceptor roles.",
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.argv[2] ?? resolve(here, "channel-map.json"));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(map, null, 2) + "\n", "utf8");
console.log("Wrote " + output + ": " + channels.length + " logical channels, " + physicalOrdinal + " physical arrays.");
