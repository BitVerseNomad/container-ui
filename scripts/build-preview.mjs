// Builds preview/index.html: the real UI code with a simulated backend, in one file, no install needed.
// Usage: npm run preview   (then open preview/index.html)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcDir = path.join(root, "src");

// --- sources: everything under src/ (not tests) plus the mock backend, keyed by path relative to src ---
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
const sources = walk(srcDir).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
const modId = (f) => path.relative(srcDir, f).replace(/\\/g, "/").replace(/\.tsx?$/, "");
const entries = [...sources.map((f) => [modId(f), f]), ["mock", path.join(root, "preview", "mock.ts")]];

// --- React ships CommonJS production builds; run them through the same tiny module loader ---
const pkgDir = (name, from) =>
  path.dirname((from ? createRequire(path.join(from, "package.json")) : require).resolve(`${name}/package.json`));
const pick = (pkg, names, from) => {
  const hit = names.map((n) => path.join(pkgDir(pkg, from), n)).find((p) => fs.existsSync(p));
  if (!hit) throw new Error(`preview: no production build found for ${pkg}`);
  return fs.readFileSync(hit, "utf8");
};
const vendor = {
  "react": pick("react", ["cjs/react.production.js", "cjs/react.production.min.js"]),
  "react/jsx-runtime": pick("react", ["cjs/react-jsx-runtime.production.js", "cjs/react-jsx-runtime.production.min.js"]),
  "react-dom": pick("react-dom", ["cjs/react-dom.production.js", "cjs/react-dom.production.min.js"]),
  "scheduler": pick("scheduler", ["cjs/scheduler.production.js", "cjs/scheduler.production.min.js"], pkgDir("react-dom")),
};
const clientFile = path.join(pkgDir("react-dom"), "cjs/react-dom-client.production.js");
vendor["react-dom/client"] = fs.existsSync(clientFile)
  ? fs.readFileSync(clientFile, "utf8")
  : 'module.exports = { createRoot: require("react-dom").createRoot };'; // React 18 layout

const wrap = (name, code) => `${JSON.stringify(name)}: function (module, exports, require) {\n${code}\n}`;
const modules = entries.map(([name, file]) => {
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText;
  return wrap(name, js);
});
const vendorDefs = Object.entries(vendor).map(([name, code]) => wrap("vendor:" + name, code));

const runtime = `
var defs = {${[...modules, ...vendorDefs].join(",\n")}};
var cache = {};
function resolve(from, req) {
  var parts = from.split("/");
  parts.pop();
  req.replace(/\\.(tsx?|css)$/, "").split("/").forEach(function (seg) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  });
  return parts.join("/");
}
function load(name) {
  if (cache[name]) return cache[name].exports;
  var module = (cache[name] = { exports: {} });
  defs[name](module, module.exports, function (req) {
    if (/\\.css$/.test(req)) return {};
    if (req.charAt(0) === ".") return load(resolve(name, req));
    if (defs["vendor:" + req]) return load("vendor:" + req);
    if (req === "@tauri-apps/api/core" || req === "@tauri-apps/api/event") return load("mock");
    throw new Error("preview: unknown module " + req);
  });
  return module.exports;
}
load("main");`;

const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const css = read("src", "ui", "tokens.css") + read("src", "styles.css").replace(/@import[^;]+;/g, "");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Colima UI (preview)</title>
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
${css}
.preview-note{position:fixed;right:10px;bottom:calc(8px + env(safe-area-inset-bottom,0px));font-size:11px;color:var(--muted);pointer-events:none}</style></head>
<body><div id="root"></div><div class="preview-note">Preview: simulated Docker data</div>
<script>${runtime.replace(/<\/script/gi, "<\\/script")}</script>
</body></html>`;

fs.mkdirSync(path.join(root, "preview"), { recursive: true });
fs.writeFileSync(path.join(root, "preview", "index.html"), html);
console.log(`preview/index.html written (${Math.round(html.length / 1024)} KB)`);
