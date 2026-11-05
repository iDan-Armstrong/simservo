// Copies the self-hosted runtime into site/vendor/ and writes a manifest:
//   site/vendor/pyodide/      Pyodide core files from node_modules/pyodide
//   site/vendor/rdsops-*.whl  rdsops at RDSOPS_REF   (npm run rdsops)
//   site/vendor/egisops-*.whl egisops at EGISOPS_REF (npm run egisops)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const vendor = join(root, "site", "vendor");
const pyodideSrc = join(root, "node_modules", "pyodide");
const wheelDir = process.env.RDSOPS_WHEEL_DIR || join(root, "build", "rdsops");
const egisDir = process.env.EGISOPS_WHEEL_DIR || join(root, "build", "egisops");

if (!existsSync(pyodideSrc)) throw new Error("node_modules/pyodide missing: run npm ci");

rmSync(vendor, { recursive: true, force: true });
mkdirSync(join(vendor, "pyodide"), { recursive: true });
const core = ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
let pyodideBytes = 0;
for (const f of core) {
  copyFileSync(join(pyodideSrc, f), join(vendor, "pyodide", f));
  if (f === "pyodide.asm.wasm" || f === "python_stdlib.zip") pyodideBytes += statSync(join(pyodideSrc, f)).size;
}
const wheels = [];
for (const [pkg, dir, refFile] of [["rdsops", wheelDir, "RDSOPS_REF"], ["egisops", egisDir, "EGISOPS_REF"]]) {
  if (!existsSync(dir)) throw new Error(`${pkg} wheel missing: run npm run ${pkg}`);
  const file = readdirSync(dir).find((f) => f.startsWith(`${pkg}-`) && f.endsWith(".whl"));
  if (!file) throw new Error(`no ${pkg} wheel in ${dir}`);
  copyFileSync(join(dir, file), join(vendor, file));
  wheels.push({ package: pkg, file, bytes: statSync(join(dir, file)).size, ref: readFileSync(join(root, refFile), "utf8").trim() });
}

const manifest = {
  wheels,
  pyodide: JSON.parse(readFileSync(join(pyodideSrc, "package.json"), "utf8")).version,
  pyodideBytes,
  built: new Date().toISOString(),
};
writeFileSync(join(vendor, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(manifest);
