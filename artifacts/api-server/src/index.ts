import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapEvolutionWebhook } from "./lib/whatsapp-settings";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void bootstrapEvolutionWebhook(port)
    .then((result) => {
      if (!result.ok) {
        logger.warn({ result }, "WhatsApp webhook bootstrap skipped");
      } else {
        logger.info({ url: result.url, status: result.status }, "WhatsApp webhook bootstrapped");
      }
    })
    .catch((err) => {
      logger.warn({ err }, "WhatsApp webhook bootstrap failed");
    });
});
