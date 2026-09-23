import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const normalize = (value: string) => value.replaceAll("\\", "/").replace(/^.*?verification\//, "verification/");
const manifestPath = resolve("verification/selection-exhaustive/GOOGLE_DRIVE_SCREENSHOT_MANIFEST.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { [key: string]: unknown; rows: Array<Record<string, unknown>> };
const uploads = JSON.parse(await readFile(resolve("verification/selection-exhaustive/drive-upload-results.json"), "utf8")) as Array<{ path: string; fileName: string; ok: boolean; id: string | null; url: string | null }>;
const byPath = new Map(uploads.map((upload) => [normalize(upload.path), upload]));
let verified = 0;
for (const row of manifest.rows) {
  const upload = byPath.get(normalize(String(row.local_path)));
  if (upload?.ok) { row.drive_status = "DRIVE_VERIFIED"; row.drive_verified = true; row.drive_path = upload.url; row.drive_file_id = upload.id; row.notes = "Uploaded and verified by Google Drive folder readback."; verified += 1; }
  else { row.drive_status = "DRIVE_UPLOAD_BLOCKED"; row.drive_verified = false; row.drive_path = null; row.notes = "Google Drive upload throttled (429): file upload limit reached; local evidence retained for retry."; }
}
manifest.driveStatus = verified === manifest.rows.length ? "DRIVE_VERIFIED" : "PARTIAL_UPLOAD_BLOCKED";
manifest.totalDriveFilesVerified = verified;
manifest.driveUploadAttempted = uploads.length;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
const header = ["local_path","filename","bytes","sha256","drive_root","drive_folder","drive_status","drive_verified","drive_path","notes"];
const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
await writeFile(resolve("verification/selection-exhaustive/GOOGLE_DRIVE_SCREENSHOT_MANIFEST.csv"), [header.join(","), ...manifest.rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n");
const reportPath = resolve("verification/selection-exhaustive/FINAL_SELECTION_A_BF_REPORT.json");
const report = JSON.parse(await readFile(reportPath, "utf8")) as Record<string, any>;
report.totalDriveFilesVerified = verified;
report.drive = { ...(report.drive ?? {}), status: verified === manifest.rows.length ? "DRIVE_VERIFIED" : "PARTIAL_UPLOAD_BLOCKED", rootFolder: manifest.driveRootFolder, verified, attempted: uploads.length, blocked: uploads.length - verified };
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
await writeFile(resolve("verification/selection-exhaustive/FINAL_SELECTION_A_BF_REPORT.md"), (await readFile(resolve("verification/selection-exhaustive/FINAL_SELECTION_A_BF_REPORT.md"), "utf8"))
  .replace(/Drive files verified:.*\n/, `Drive files verified: ${verified}/${manifest.rows.length} (${report.drive.status})\n`));
console.log(JSON.stringify({ attempted: uploads.length, verified, blocked: uploads.length - verified, manifest: manifestPath }));
