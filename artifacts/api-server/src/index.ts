import app from "./app";
import { logger } from "./lib/logger";
import { startAccessAuditRetention } from "./lib/lkt-access-audit";
import { startReferenceDigestScheduler } from "./lib/lkt-reference-digest";
import { startAccessNotificationWorker } from "./lib/lkt-access-notifications";
import { provisionInitialEvidenceArchives } from "./lib/lkt-evidence-provision";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  try {
    const restored = await provisionInitialEvidenceArchives();
    logger.info({ restored }, "Initial evidence archive metadata ready");
  } catch {
    logger.error("Initial evidence archives unavailable. Run migrate:lkt-evidence-archives and evidence:provision in the target environment with access to the original App Storage objects. Refusing to serve an empty initial archive library.");
    process.exit(1);
  }
  app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startAccessAuditRetention();
  startReferenceDigestScheduler();
  startAccessNotificationWorker();
  });
}
void start();
