import { pool } from "@workspace/db";
import { provisionInitialEvidenceArchives } from "../lib/lkt-evidence-provision";
import { archiveFile, verifyArchiveBytes } from "../lib/lkt-evidence-archive";

// Operator credentials only; no company/member/editor HTTP route can run this.
// Optional transfer root is a non-secret App Storage bucket/prefix the operator
// is authorized to read; never a URL, token, or signed CDN location.
try {
  const args = process.argv.slice(2);
  const sourceRoot = args[0] === "--from-app-storage-root" && args.length === 2 ? args[1] : undefined;
  if (args.length && (!sourceRoot || !/^\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9/_-]+$/.test(sourceRoot))) {
    throw new Error("Use no arguments, or --from-app-storage-root /bucket/prefix for an authorized App Storage source.");
  }
  const count = await provisionInitialEvidenceArchives(undefined, sourceRoot ? async row => {
    const source = archiveFile(row.objectPath, sourceRoot);
    const [bytes] = await source.download();
    verifyArchiveBytes(bytes, row);
    const target = archiveFile(row.objectPath);
    try {
      await target.save(bytes, { resumable: false, contentType: row.contentType, preconditionOpts: { ifGenerationMatch: 0 } });
    } catch (error) {
      if ((error as { code?: number }).code !== 412) throw error;
    }
    const [copied] = await target.download();
    verifyArchiveBytes(copied, row);
    return copied;
  } : undefined);
  process.stdout.write(`Initial evidence archives ready; restored ${count} metadata attachments. Findings unchanged.\n`);
} catch {
  process.stderr.write("Initial evidence provisioning failed. Run the archive migration in the target database and ensure the target App Storage contains the original archived objects. If using another bucket, run this trusted command with --from-app-storage-root after authorizing read access. No original source was re-fetched and no history was overwritten.\n");
  process.exitCode = 1;
} finally { await pool.end(); }
