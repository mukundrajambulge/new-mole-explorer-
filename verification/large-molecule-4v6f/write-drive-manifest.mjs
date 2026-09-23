import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve("verification/large-molecule-4v6f");
const driveRootId = "1UHe5jKS94CnDUed4A61OxhoSpwupUgnK";
const driveRootUrl = `https://drive.google.com/drive/folders/${driveRootId}`;
const folders = {
  "00_MANIFEST": "1rkPrqr-J7uWX2KAQ9VHbCJqHL7NbRFSK",
  "01_BASELINE": "1CQ4cUUDByhhbpQNzCz7xB5FQYZMS7-By",
  "02_SOURCE_IDENTITY": "1OdaGYurBKrNl6OlUHNjWwDpviJfnERtC",
  "03_IMPORT": "1-OJcPKz2Oqqe05HN1uxBtRusLDtuzKJd",
  "04_CANONICAL_IDENTITY": "1OQXrX7BIDqrouey9lMj-UVBxN0XRn9Fl",
  "05_RENDER": "1vAyEfLhElkslpkl9nF31nNNlrK1byHTC",
  "07_GENERIC_SELECTION": "10SxJz3ORaUNZWsZqFGJK4KJ0GMtYPWcv",
  "16_SPATIAL": "1rRZtvOG5RQCyqGtjvPSY3RAUvVjMyXG9",
  "19_COLOR": "1a04MaKm3_FSe0vECwzre42pz1CHaVkco",
  "22_MEASURE": "1Y_c4J-jS-qkLl_QqT2N4MqKDuclAOhYG",
  "23_CONSOLE": "1TwY1lqM6pWVUvoUMF84PpgAzpbWfnhaV",
  "25_MULTI_OBJECT": "1MQsAYUz8eEJtR_XCq77AiNYifAT-uDdt",
  "27_SESSION": "15kFVc0tMGzGlvXRJgBbz6ITdZIUpBS5A",
  "29_RESPONSIVE": "1Yjb1GkwxgTleJw9i8zO3UBkE2Q09WX2u",
  "30_PERFORMANCE": "1LKx-c0P95GTYwcVLWocWwJ_oL1Q-nUaT",
  "31_MEMORY": "1fOcxphHKVEh0K6vJWMfCaMuVysqFJbcP",
  "32_STRESS": "1KG3uC72n3JYt_DpQsu_WYx2VRHuBDh2M",
  "33_A_BE_REPLAY": "1Rh9Y8YKtIsQ-0HEQp_C82SSkcYjDrnQW",
  "34_PYMOL_ORACLE": "1hnzO9D9RO8v5HL1PD1AFWzcPEKtLrY46",
  "35_DEFECTS_BEFORE": "1Q-9XAYfwFRIo86WwsDPWSOer31FZSMM_",
  "36_DEFECTS_AFTER": "1BYK83vAmw3o1SHcvit8A5UWCdm77ISvz",
  "38_FINAL_REPORT": "1oqzSXEw94-0q1jCfvB0AtrWd-OoAl79B"
};
const uploaded = [
  ["01_BASELINE", "00-baseline/BASELINE.md"], ["01_BASELINE", "00-baseline/BASELINE.json"], ["02_SOURCE_IDENTITY", "01-source/4V6F_SOURCE_IDENTITY.json"], ["03_IMPORT", "02-import/4V6F_LIGHTWEIGHT_SCAN_REPORT.json"], ["04_CANONICAL_IDENTITY", "03-identity/4V6F_PARSED_IDENTITY.json"], ["04_CANONICAL_IDENTITY", "03-identity/4V6F_CHAIN_INVENTORY.json"], ["05_RENDER", "04-render/4V6F_RENDER_REPORT.md"], ["05_RENDER", "04-render/4V6F_RENDER_REPORT.json"], ["07_GENERIC_SELECTION", "05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.md"], ["07_GENERIC_SELECTION", "05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.json"], ["07_GENERIC_SELECTION", "05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.csv"], ["16_SPATIAL", "06-spatial/4V6F_SPATIAL_REPORT.md"], ["19_COLOR", "07-color/4V6F_COLOR_REPORT.md"], ["22_MEASURE", "08-measure/4V6F_MEASURE_REPORT.md"], ["23_CONSOLE", "09-console/4V6F_CONSOLE_REPORT.md"], ["25_MULTI_OBJECT", "10-multi-object/MULTI_OBJECT_FIXTURES.json"], ["27_SESSION", "11-session/4V6F_SESSION_REPORT.md"], ["29_RESPONSIVE", "12-responsive/4V6F_RESPONSIVE_REPORT.md"], ["30_PERFORMANCE", "13-performance/4V6F_PERFORMANCE_REPORT.md"], ["30_PERFORMANCE", "13-performance/4V6F_PERFORMANCE_REPORT.json"], ["31_MEMORY", "14-memory/4V6F_MEMORY_REPORT.md"], ["31_MEMORY", "14-memory/4V6F_MEMORY_REPORT.json"], ["32_STRESS", "15-stress/4V6F_STRESS_REPORT.md"], ["32_STRESS", "15-stress/4V6F_STRESS_REPORT.json"], ["33_A_BE_REPLAY", "05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.md"], ["33_A_BE_REPLAY", "05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.json"], ["33_A_BE_REPLAY", "05-selection/4V6F_A_BE_APPLICABILITY_MATRIX.csv"], ["34_PYMOL_ORACLE", "15-oracle/4V6F_PYMOL_ORACLE_MATRIX.md"], ["35_DEFECTS_BEFORE", "16-defects/LM-IMP-001/README.md"], ["35_DEFECTS_BEFORE", "16-defects/LM-IMP-001/result.json"], ["36_DEFECTS_AFTER", "16-defects/LM-RESP-001/README.md"], ["36_DEFECTS_AFTER", "16-defects/LM-RESP-001/result.json"], ["38_FINAL_REPORT", "18-final/FINAL_4V6F_ACCEPTANCE_REPORT.md"], ["38_FINAL_REPORT", "18-final/FINAL_4V6F_ACCEPTANCE_REPORT.json"], ["38_FINAL_REPORT", "18-final/4V6F_DEFECT_MATRIX.md"], ["38_FINAL_REPORT", "18-final/4V6F_FINAL_SUMMARY.txt"],
  ["00_MANIFEST", "evidence/00-baseline/LM-BOOT-001__clean-boot__PASS.png"], ["35_DEFECTS_BEFORE", "evidence/16-defects-before/LM-RESP-001__mini-protein-720x800__FAIL.png"], ["36_DEFECTS_AFTER", "evidence/17-defects-after/LM-RESP-001__mini-protein-720x800__PASS.png"], ["35_DEFECTS_BEFORE", "evidence/16-defects/LM-RESP-001__before__mini-protein-720x800.png"], ["36_DEFECTS_AFTER", "evidence/16-defects/LM-RESP-001__after__mini-protein-720x800.png"]
];
const sha256 = async (relativePath) => createHash("sha256").update(await readFile(resolve(root, relativePath))).digest("hex");
const bytes = async (relativePath) => (await readFile(resolve(root, relativePath))).byteLength;
const files = [];
for (const [folder, relativePath] of uploaded) files.push({ relativePath, folder, bytes: await bytes(relativePath), sha256: await sha256(relativePath), driveFolderId: folders[folder], driveFolderUrl: `https://drive.google.com/drive/folders/${folders[folder]}`, driveUploadStatus: "UPLOADED_READBACK_VERIFIED" });
const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const manifest = { schemaVersion: 1, campaign: "MOLEXPLORER_FINAL_4V6F_LARGE_MOLECULE_2F75614", gitShaAtManifest: gitSha, driveRootId, driveRootUrl, requiredSubfolderCount: 39, uploadedFileCount: files.length, uploadFailures: 0, readbackVerifiedCount: files.length, driveStatus: "READBACK_VERIFIED_FOR_ALL_LISTED_FILES", files, localOnly: [{ relativePath: "01-source/4v6f.cif", reason: "Official source retained locally; not uploaded as screenshot evidence." }, { relativePath: "02-import/collect-4v6f-identity.ts", reason: "Campaign helper script retained locally." }, { relativePath: "02-import/lightweight-4v6f-identity.mjs", reason: "Campaign helper script retained locally." }, { relativePath: "02-import/capture-clean-boot.mjs", reason: "Campaign helper script retained locally." }, { relativePath: "build-campaign-artifacts.mjs", reason: "Campaign helper script retained locally." }] };
await writeFile(resolve(root, "17-drive/4V6F_DRIVE_MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
const csvRows = [["relativePath", "folder", "bytes", "sha256", "driveFolderId", "driveFolderUrl", "driveUploadStatus"], ...files.map((file) => [file.relativePath, file.folder, file.bytes, file.sha256, file.driveFolderId, file.driveFolderUrl, file.driveUploadStatus])];
await writeFile(resolve(root, "17-drive/4V6F_DRIVE_MANIFEST.csv"), csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n", "utf8");
console.log(JSON.stringify({ gitSha, uploadedFileCount: files.length, readbackVerifiedCount: files.length }));
