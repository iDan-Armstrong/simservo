// Copies the self-hosted runtime into site/vendor/ and writes a manifest:
//   site/vendor/pyodide/   Pyodide core files from node_modules/pyodide
//   site/vendor/rdsops-*.whl  the rdsops wheel from build/rdsops (npm run rdsops)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const vendor = join(root, "site", "vendor");
const pyodideSrc = join(root, "node_modules", "pyodide");
const wheelDir = process.env.RDSOPS_WHEEL_DIR || join(root, "build", "rdsops");

if (!existsSync(pyodideSrc)) throw new Error("node_modules/pyodide missing: run npm ci");
if (!existsSync(wheelDir)) throw new Error("rdsops wheel missing: run npm run rdsops");

rmSync(vendor, { recursive: true, force: true });
mkdirSync(join(vendor, "pyodide"), { recursive: true });
const core = ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
let pyodideBytes = 0;
for (const f of core) {
  copyFileSync(join(pyodideSrc, f), join(vendor, "pyodide", f));
  if (f === "pyodide.asm.wasm" || f === "python_stdlib.zip") pyodideBytes += statSync(join(pyodideSrc, f)).size;
}
const wheel = readdirSync(wheelDir).find((f) => f.startsWith("rdsops-") && f.endsWith(".whl"));
if (!wheel) throw new Error(`no rdsops wheel in ${wheelDir}`);
copyFileSync(join(wheelDir, wheel), join(vendor, wheel));

const manifest = {
  wheel,
  wheelBytes: statSync(join(wheelDir, wheel)).size,
  rdsopsRef: readFileSync(join(root, "RDSOPS_REF"), "utf8").trim(),
  pyodide: JSON.parse(readFileSync(join(pyodideSrc, "package.json"), "utf8")).version,
  pyodideBytes,
  built: new Date().toISOString(),
};
writeFileSync(join(vendor, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(manifest);
