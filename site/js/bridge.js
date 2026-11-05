// Loads Pyodide and the real rdsops and egisops wheels, all served from this site, and reports real
// byte counts so the setup wizard's progress bars are honest.

async function fetchWithProgress(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !res.body.getReader) {
    const buf = await res.arrayBuffer();
    onBytes(buf.byteLength, buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onBytes(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

export async function loadManifest(base = "./") {
  const res = await fetch(`${base}vendor/manifest.json`);
  if (!res.ok) throw new Error("vendor/manifest.json missing: run `npm run build`");
  return res.json();
}

// Stage callbacks: onStage(name, info) with name in
//   "firmware" (bytes), "flash", "rules" (bytes), "selftest" (lines)
export async function bootPython({ base = "./", onStage = () => {} } = {}) {
  // Absolute URLs: a dynamic import() resolves against this module, not the page.
  base = new URL(base, document.baseURI).href;
  const manifest = await loadManifest(base);
  const pyBase = `${base}vendor/pyodide/`;

  // 1. Firmware download: the two big Pyodide files, streamed so progress is real.
  //    The browser cache then serves them to loadPyodide below.
  const big = ["pyodide.asm.wasm", "python_stdlib.zip"];
  const loadedBy = {};
  await Promise.all(
    big.map((f) =>
      fetchWithProgress(pyBase + f, (loaded) => {
        loadedBy[f] = loaded;
        const l = Object.values(loadedBy).reduce((a, b) => a + b, 0);
        onStage("firmware", { loaded: l, total: Math.max(manifest.pyodideBytes || 0, l) });
      })
    )
  );

  // 2. Flash: start the interpreter.
  onStage("flash", { state: "start" });
  const { loadPyodide } = await import(`${pyBase}pyodide.mjs`);
  const pyodide = await loadPyodide({ indexURL: pyBase });
  onStage("flash", { state: "done", python: pyodide.runPython("import sys; sys.version.split()[0]") });

  // 3. Rules engines: the real rdsops and egisops wheels, unpacked into site-packages.
  const sitePackages = pyodide.runPython("import site; site.getsitepackages()[0]");
  const wheels = manifest.wheels;
  const totalBytes = wheels.reduce((a, w) => a + w.bytes, 0);
  let done = 0;
  for (const w of wheels) {
    const buf = await fetchWithProgress(`${base}vendor/${w.file}`, (loaded) =>
      onStage("rules", { loaded: done + loaded, total: totalBytes })
    );
    done += buf.byteLength;
    pyodide.unpackArchive(buf, "wheel", { extractDir: sitePackages });
  }
  const bridgeSrc = await (await fetch(`${base}py/simservo_bridge.py`)).text();
  pyodide.FS.writeFile(`${sitePackages}/simservo_bridge.py`, bridgeSrc);
  const bridge = pyodide.pyimport("simservo_bridge");

  // 4. Self-test: the real rules answering a known question.
  const lines = bridge.self_test().split("\n");
  onStage("selftest", { lines });

  return {
    manifest,
    rdsopsVersion: bridge.version(),
    evaluate(snapshot) {
      return JSON.parse(bridge.evaluate(JSON.stringify(snapshot)));
    },
    drillPlan(payload) {
      return JSON.parse(bridge.drill_plan(JSON.stringify(payload)));
    },
    drillEvaluate(payload) {
      return JSON.parse(bridge.drill_evaluate(JSON.stringify(payload)));
    },
  };
}
