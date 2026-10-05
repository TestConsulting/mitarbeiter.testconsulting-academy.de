import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "./db/pool.js";

const port = Number(process.env.API_PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("API_PORT must be a valid TCP port.");
}

const app = createApp();
const server = app.listen(port, () => {
  console.info(`Portal API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);