import { cp, rm, mkdir } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");
const sourceDir = path.resolve(workspaceRoot, "artifacts/financeiro/dist/public");
const targetDir = path.resolve(workspaceRoot, "public");

async function main() {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
