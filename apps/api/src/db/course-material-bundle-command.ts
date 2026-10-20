import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { exportCourseMaterialBundle, importCourseMaterialBundle } from "./course-material-bundle.js";

const [command, directory = "deploy/elearning-materials"] = process.argv.slice(2);
if ((command !== "export" && command !== "import") || process.argv.length > 4) {
  throw new Error("Usage: course-material-bundle-command.ts <export|import> [bundle directory]");
}
const bundleDirectory = resolve(fileURLToPath(new URL("../../../../", import.meta.url)), directory);
try {
  if (command === "export") {
    const result = await exportCourseMaterialBundle(pool, bundleDirectory);
    console.info(`Exported ${result.fileCount} files and ${result.referenceCount} course references to ${bundleDirectory}.`);
  } else {
    const result = await importCourseMaterialBundle(pool, bundleDirectory);
    console.info(`Imported ${result.importedFiles} files and linked ${result.linkedMaterials} course materials.`);
  }
} finally {
  await pool.end();
}
