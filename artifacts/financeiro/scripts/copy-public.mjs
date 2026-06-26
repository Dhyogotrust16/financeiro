import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "dist/public");
const targetDir = process.env.VERCEL
  ? path.resolve(rootDir, "../..", "public")
  : path.join(rootDir, "public");

if (!existsSync(sourceDir)) {
  throw new Error(`Frontend build output not found at ${sourceDir}`);
}

mkdirSync(targetDir, { recursive: true });
rmSync(path.join(targetDir, "assets"), { recursive: true, force: true });
rmSync(path.join(targetDir, "index.html"), { force: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Copied frontend build from ${sourceDir} to ${targetDir}`);
