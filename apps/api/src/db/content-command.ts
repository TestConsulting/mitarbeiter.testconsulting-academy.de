import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { exportPortalContent, importPortalContent } from "./portal-content.js";

const [command, file] = process.argv.slice(2);
if (!["export", "import", "import-missing"].includes(command) || !file || process.argv.length !== 4) {
  throw new Error("Usage: content-command.ts <export|import|import-missing> <JSON file>");
}
// npm workspace commands run in apps/api; relative file paths refer to the repository root.
const path = resolve(fileURLToPath(new URL("../../../../", import.meta.url)), file);
try {
  if (command === "export") {
    const content = await exportPortalContent(pool);
    await writeFile(path, `${JSON.stringify(content, null, 2)}\n`, "utf8");
    console.info(`Exported ${content.links.length} links and ${content.benefits.length} benefits to ${path}.`);
  } else {
    const content: unknown = JSON.parse(await readFile(path, "utf8"));
    const added = await importPortalContent(pool, content, command === "import-missing" ? "missing-only" : "configured");
    console.info(`Added ${added.links} missing links and ${added.benefits} missing benefits. ${command === "import-missing" ? "Existing content left unchanged." : "Existing content updated only when updateExistingLinks or updateExistingBenefits is enabled."}`);
  }
} finally {
  await pool.end();
}
