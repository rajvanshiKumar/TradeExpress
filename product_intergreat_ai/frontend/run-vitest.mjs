/**
 * Runs Vitest from this folder with a consistent Windows drive letter.
 *
 * Terminals that open the folder as "c:\..." (lower-case drive, e.g. the VS Code terminal) make Vitest load
 * itself twice, and every test file then fails with "Vitest failed to find the current suite". Starting Vitest
 * with the folder spelled "C:\..." avoids that. On other systems this just runs Vitest.
 *
 *   npm test                 -> vitest run
 *   npm run test:watch       -> vitest (watch mode)
 *   npm test -- src/lib      -> any extra Vitest arguments are passed through
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const dir = import.meta.dirname.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const vitest = path.join(dir, "node_modules", "vitest", "vitest.mjs");

const result = spawnSync(process.execPath, [vitest, ...process.argv.slice(2)], { cwd: dir, stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
