// Docs sitesi üreticisi: sayfa blokları → HTML + sitemap + llms.txt + llms-full.txt.
// Araç referansı elle yazılmıyor: yayınlanmış MCP paketi başlatılıp `tools/list` ve
// örnek çağrıların GERÇEK yanıtları alınıyor, yani dokümantasyon sunucudan ayrışamaz.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { renderMd } from "./lib/blocks.mjs";
import { BASE, CSS, JS, MAIN, ORG, buildNav, page } from "./lib/layout.mjs";

const require = createRequire(import.meta.url);
const S = JSON.parse(readFileSync(new URL("./content/shared.json", import.meta.url), "utf8"));
// `data` ve `embed` paketleri package.json'ı `exports`ta açmıyor: yolu ana dosyadan türet.
const dataDir = dirname(require.resolve("thefaceanalysis-data"));
const embedDir = dirname(dirname(require.resolve("thefaceanalysis-embed")));
const mcpDir = join(dirname(require.resolve("thefaceanalysis-mcp/dist/stdio.js")), "..");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const dataPkg = readJson(join(dataDir, "package.json"));
const mcpPkg = readJson(join(mcpDir, "package.json"));
const embedPkg = readJson(join(embedDir, "package.json"));
const changelog = readJson(join(dataDir, "changelog.json"));
const ref = readJson(join(dataDir, "reference-set.json"));

const UPDATED = "2026-10-17";
const URL_MCP = S.MCP_URL;
const code = (label, c) => ({ t: "code", label, code: c });

/* ------------------------------------------------ gerçek MCP: araç şemaları */
const client = new Client({ name: "docs-build", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: [require.resolve("thefaceanalysis-mcp/dist/stdio.js")] }));
const { tools } = await client.listTools();
const SAMPLE = {
  get_reference_statistics: { measure: "fwhr", group: "all" },
  list_face_types: { category: "face" },
  get_face_type: { category: "face", slug: "oval" },
  classify_face_shape: { face_length: 1.3, cheekbone_width: 1, forehead_width: 0.9, jaw_width: 0.8 },
  get_methodology: {},
  get_citation: {},
  get_embed_snippet: { size: "wide" },
};
const calls = {};
for (const t of tools) {
  const r = await client.callTool({ name: t.name, arguments: SAMPLE[t.name] ?? {} });
  calls[t.name] = JSON.parse(r.content[0].text);
}
await client.close();

const clip = (obj, max = 2200) => {
  const s = JSON.stringify(obj, null, 2);
  return s.length <= max ? s : `${s.slice(0, max).replace(/\n[^\n]*$/, "")}\n  … (truncated)`;
};

const toolBlocks = tools.flatMap((t) => {
  const props = t.inputSchema?.properties ?? {};
  const req = new Set(t.inputSchema?.required ?? []);
  const rows = Object.entries(props).map(([k, v]) => [
    `\`${k}\``,
    v.enum ? `enum: ${v.enum.map((e) => `\`${e}\``).join(", ")}` : v.type,
    req.has(k) ? "yes" : "no",
    v.description ?? "",
  ]);
  const args = SAMPLE[t.name] ?? {};
  const out = calls[t.name];
  const big = t.name === "get_methodology";
  return [
    { t: "h2", text: t.name },
    { t: "p", text: t.description },
    rows.length ? { t: "table", head: ["Parameter", "Type", "Required", "Description"], rows } : { t: "p", text: "No parameters." },
    code("Example request (MCP tools/call)", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: t.name, arguments: args } }, null, 2)),
    big
      ? { t: "p", text: `The response is large. Its top-level keys are ${Object.keys(out).map((k) => `\`${k}\``).join(", ")}; the thresholds and validity blocks are the same ones documented on the [dataset page](/data).` }
      : code("Real response (from the published server at build time)", clip(out)),
  ];
});

/* ------------------------------------------------------------------- sayfalar */
const clients = S.MCP_CLIENTS;
const pages = [];

pages.push({
  path: "/", label: "Overview", title: "The Face Analysis Developer Docs: MCP Server, Dataset and Widget",
  description: "Developer documentation for The Face Analysis: an MCP server for AI assistants, a face measurement dataset (JSON and CSV, CC BY 4.0) and an embeddable face shape widget. Free and open source.",
  h1: "The Face Analysis developer docs",
  lede: "Three free, open-source building blocks from [The Face Analysis](" + MAIN + "): an MCP server that lets AI assistants look up sourced face measurement statistics, the dataset behind those statistics as JSON and CSV, and an embeddable widget that puts the face shape finder on any website.",
  blocks: [
    { t: "h2", text: "Start here" },
    { t: "table", head: ["I want to…", "Go to"], rows: [
      ["Let Claude, ChatGPT, Codex or Cursor look up face measurement data", "[MCP server](/mcp)"],
      ["Download the numbers as JSON or CSV", "[Dataset](/data)"],
      ["Put a face shape finder on my website", "[Embed widget](/embed)"],
      ["Try everything in two minutes", "[Quickstart](/quickstart)"],
    ] },
    { t: "h2", text: "What is published" },
    { t: "table", head: ["Package", "Version", "What it is", "Source"], rows: [
      ["`thefaceanalysis-mcp`", mcpPkg.version, "Read-only MCP server, stdio and hosted HTTP", `[GitHub](${S.MCP_REPO})`],
      ["`thefaceanalysis-data`", dataPkg.version, "Statistics, type rules and thresholds as JSON and CSV", `[GitHub](${S.DATA_REPO})`],
      ["`thefaceanalysis-embed`", embedPkg.version, "Web component and React wrapper for the widget", `[GitHub](${S.EMBED_REPO})`],
    ] },
    { t: "h2", text: "What it is based on" },
    { t: "p", text: `All numbers come from ${ref.sample.n} adult faces (${ref.sample.female} women, ${ref.sample.male} men) of the Face Research Lab London Set, measured with a ${ref.engine.landmarks}-point MediaPipe landmarker. They describe those faces, not a population, and the face type splits show how the detectors divide them, not how common a type is. The [methodology](${MAIN}/methodology) states every threshold and what a photo cannot measure.` },
    { t: "h2", text: "Licenses" },
    { t: "ul", items: ["**Code** (MCP server, dataset package, widget, these docs): MIT.", "**Aggregate numbers** (JSON and CSV): CC BY 4.0. Cite The Face Analysis, link the [statistics page](" + MAIN + "/face-measurement-statistics) and credit the photo set."] },
  ],
});

pages.push({
  path: "/quickstart", label: "Quickstart", title: "Quickstart: Connect an AI Assistant to Face Measurement Data in Two Minutes",
  description: "Add the hosted MCP server to Claude, ChatGPT, Codex or Cursor, ask a question, verify with curl, then use the dataset and the widget. Copy-paste commands.",
  h1: "Quickstart",
  lede: "Connect an AI assistant to the face measurement data, check it works, then use the dataset and the widget. No account and no API key are needed for any step.",
  blocks: [
    { t: "h2", text: "1. Connect your assistant" },
    { t: "p", text: "The hosted server works in every client that supports remote MCP servers. Claude Code is one command:" },
    code("Claude Code", `claude mcp add --transport http --scope user thefaceanalysis ${URL_MCP}`),
    { t: "p", text: `For other clients use the same URL: \`${URL_MCP}\`. Step-by-step pages: ${clients.map((c) => `[${c.name}](/mcp/${c.id})`).join(", ")}.` },
    { t: "h2", text: "2. Ask a question" },
    { t: "p", text: S.MCP_CHECK_PROMPT },
    { t: "p", text: "The answer should be **1.78**, the median fWHR across the 102 reference faces, returned by the `get_reference_statistics` tool." },
    { t: "h2", text: "3. Check without a client" },
    code("curl", `curl -s ${URL_MCP} \\\n  -H 'content-type: application/json' \\\n  -H 'accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`),
    { t: "p", text: "`https://mcp.thefaceanalysis.com/health` answers `ok`. The server is stateless and accepts only `POST /mcp`, so a browser visit to `/mcp` shows 405." },
    { t: "h2", text: "4. Use the data directly" },
    code("JavaScript", `npm install thefaceanalysis-data\n\nimport { median } from "thefaceanalysis-data";\nmedian("fwhr"); // 1.78`),
    { t: "p", text: "Files, columns and examples in Python and R are on the [dataset page](/data)." },
    { t: "h2", text: "5. Put the widget on a page" },
    code("HTML", `<div data-tfa-widget="face-shape" data-size="standard"></div>\n<script async src="${MAIN}/embed.js"></script>`),
    { t: "p", text: "Sizes, the npm and React versions and the terms are on the [embed page](/embed)." },
  ],
});

pages.push({
  path: "/mcp", label: "Overview", title: "MCP Server: Face Measurement Statistics and Face Shape Classifier for AI Assistants",
  description: "A free, read-only MCP server with sourced face measurement statistics from 102 faces, face type rules, methodology and a seven-rule face shape classifier. Hosted URL or npx; open source.",
  h1: "MCP server",
  lede: `A free, read-only Model Context Protocol server. It gives an AI assistant sourced face measurement statistics, the exact rules behind each face, eye, lip and nose type, the methodology with its limits, and the site's seven-rule face shape classifier. Hosted at \`${URL_MCP}\`, or run locally with \`npx -y ${S.MCP_NPM}\`.`,
  blocks: [
    { t: "h2", text: "Hosted or local" },
    { t: "table", head: ["", "Hosted", "Local (npx)"], rows: [
      ["Install", "Nothing", `Node.js 18+, \`npx -y ${S.MCP_NPM}\``],
      ["Works in ChatGPT and Claude custom connectors", "Yes", "No (they cannot start a local process)"],
      ["Works offline", "No", "Yes"],
      ["Tools", "Same seven", "Same seven"],
    ] },
    { t: "h2", text: "Connect your client" },
    { t: "ul", items: clients.map((c) => `[${c.name}](/mcp/${c.id}): ${c.summary.replace(/`/g, "")}`) },
    { t: "h2", text: "Tools" },
    { t: "table", head: ["Tool", "What it returns"], rows: S.MCP_TOOLS.map((t) => [`[\`${t.name}\`](/mcp/tools#${t.name.replace(/_/g, "-")})`, t.returns]) },
    { t: "p", text: "Parameters and real example responses are on the [tool reference](/mcp/tools)." },
    { t: "h2", text: "What it does not do" },
    { t: "ul", items: S.NOT_DOING },
    { t: "h2", text: "Example questions" },
    { t: "ul", items: S.MCP_EXAMPLES.map((e) => `“${e}”`) },
  ],
});

for (const c of clients) {
  pages.push({
    path: `/mcp/${c.id}`, label: c.name,
    title: `Connect ${c.name} to The Face Analysis MCP Server`,
    description: `How to add The Face Analysis MCP server to ${c.name}: ${c.summary.replace(/`/g, "")}`.slice(0, 200),
    h1: `Connect ${c.name}`,
    lede: c.summary,
    blocks: [
      { t: "h2", text: "Steps" },
      { t: "ol", items: c.steps },
      { t: "h2", text: "Configuration" },
      ...c.code.map((b) => code(b.label, b.code)),
      { t: "h2", text: "Check it works" },
      { t: "p", text: `Ask: “${S.MCP_CHECK_PROMPT}” The answer should be 1.78.` },
      ...(c.note ? [{ t: "note", text: c.note }] : []),
      { t: "p", text: `Source for the ${c.name} syntax: [${c.source.label}](${c.source.url}). Client menus and file locations change; if a step no longer matches, follow that page and tell us on [GitHub](${S.MCP_REPO}/issues).` },
      { t: "p", text: "See also the [tool reference](/mcp/tools) and [troubleshooting](/faq#troubleshooting)." },
    ],
  });
}

pages.push({
  path: "/mcp/tools", label: "Tool reference", title: "MCP Tool Reference: Parameters and Real Responses",
  description: "Reference for all seven tools of The Face Analysis MCP server: parameters, types, example requests and real responses generated from the published server.",
  h1: "Tool reference",
  lede: `Seven read-only tools. This page is generated at build time from the published \`${S.MCP_NPM}@${mcpPkg.version}\` package: the parameters come from the server's own \`tools/list\` and the responses from calling each tool, so it cannot drift from the server.`,
  blocks: [{ t: "note", text: "Every tool is read-only, needs no authentication and takes no photo. Invalid input returns a result with `isError: true` and a message that lists the valid options." }, ...toolBlocks],
});

const colRows = S.CSV_COLUMNS.map(([c, v]) => [`\`${c}\``, v]);
pages.push({
  path: "/data", label: "Files and schema", title: "Face Measurement Dataset: JSON and CSV Files, Schema, Examples and License",
  description: "Download face measurement statistics from 102 faces as JSON and CSV: fWHR, midface ratio, symmetry, canthal tilt, pupillary distance, type rules and thresholds. Columns, examples in curl, JavaScript, Python and R. CC BY 4.0.",
  h1: "Face measurement dataset",
  lede: `Four files carry the statistics shown on the [face measurement statistics page](${MAIN}/face-measurement-statistics): percentiles of each measurement from ${ref.sample.n} adult faces, the face, eye, lip and nose type rules, every classification threshold and the dated change history. Free to download and reuse under CC BY 4.0. No file contains a photo or a per-face value.`,
  blocks: [
    { t: "h2", text: "Files" },
    { t: "table", head: ["File", "Contents", "Address"], rows: S.DATA_FILES.map((f) => [`\`${f.file}\``, f.what, `${MAIN}${f.path}`]) },
    { t: "p", text: "All four are static, served with CORS open (`Access-Control-Allow-Origin: *`) and cached for an hour, so a browser app can fetch them directly. The same files ship in the npm package `thefaceanalysis-data`." },
    { t: "h2", text: "CSV columns" },
    { t: "table", head: ["Column", "Values"], rows: colRows },
    { t: "p", text: "One row per measure and group: seven measures and three groups make 21 rows." },
    { t: "h2", text: "reference-set.json structure" },
    { t: "table", head: ["Key", "Contains"], rows: [
      ["`measurements`", "Percentiles keyed measure → group. The CSV is this block flattened."],
      ["`thresholds`", "Every cut-off the detectors use: face shape rules, eye, lip and nose thresholds, the pupillary distance model."],
      ["`score`", "How the composite and the 1-10 score are built, with weights."],
      ["`validity`", "Spearman correlations between the measurements and 2,513 raters' attractiveness ratings, with 95% confidence intervals."],
      ["`sample`", `How many faces: ${ref.sample.n} in total, ${ref.sample.female} women and ${ref.sample.male} men.`],
      ["`methodology`", "The method page, when the method last changed and the revision count."],
      ["`license`, `citeAs`, `source`", "License, citation text and the source photo set."],
    ] },
    { t: "h2", text: "Examples" },
    { t: "p", text: "Median fWHR across all 102 faces is 1.78. These four snippets all read it." },
    ...S.DATA_EXAMPLES.map((e) => code(e.label, e.code)),
    { t: "h2", text: "License and citation" },
    { t: "p", text: `The aggregate numbers are licensed [${ref.license.name}](${ref.license.url}). Cite The Face Analysis, link the [statistics page](${MAIN}/face-measurement-statistics) and credit the photo set.` },
    code("Cite as", `${ref.citeAs} ${ref.page}`),
    code("Photos", ref.source.citation),
    { t: "h2", text: "Limits" },
    { t: "p", text: `The photos are ${ref.sample.n} adults photographed under the same conditions in London in April 2012. The numbers describe those faces, not a population. Face type splits show how the detectors divide these faces, not how common a type is, and no accuracy figure is claimed for any label. A different photo of the same person can move a borderline reading. Read the [methodology](${MAIN}/methodology) before quoting a number as a norm.` },
    { t: "h2", text: "Versions" },
    { t: "p", text: `The files change only when the measurement code or the reference data changes, and every such change is dated in the [changelog](/changelog). The npm package version follows: a changed threshold or number is a new version, so a pinned dependency never shifts under you. Current package version: \`${dataPkg.version}\`.` },
  ],
});

pages.push({
  path: "/embed", label: "Embed the face shape finder", title: "Embed the Face Shape Finder on Your Website: Script, Web Component and React",
  description: "Add the free face shape finder to a salon, optician, beard or beauty site. Script tag, web component or React; sizes, attributes, resize messages and terms of use.",
  h1: "Embed the face shape finder",
  lede: "A free face shape finder for your own site. The visitor chooses a photo, the measurement runs in their browser with no sign-up, and the widget shows their face shape, fWHR and symmetry. Three ways to add it: a script tag, a web component or a React component.",
  blocks: [
    { t: "p", text: `A code builder with a live preview is on [thefaceanalysis.com/embed](${MAIN}/embed).` },
    { t: "h2", text: "Script tag" },
    code("HTML", `<div data-tfa-widget="face-shape" data-size="standard"></div>\n<script async src="${MAIN}/embed.js"></script>`),
    { t: "p", text: "The script builds the iframe, keeps its height equal to its content and writes a visible credit link under it into your page." },
    { t: "h2", text: "npm: web component" },
    code("Install", "npm install thefaceanalysis-embed"),
    code("Use", `<script type="module">import "thefaceanalysis-embed";</script>\n<face-analysis-widget tool="face-shape" size="standard"></face-analysis-widget>`),
    { t: "h2", text: "npm: React" },
    code("React", `import { FaceAnalysisWidget } from "thefaceanalysis-embed/react";\n\n<FaceAnalysisWidget size="wide" />`),
    { t: "p", text: "The wrapper loads the web component on the client only, so it is safe in server-rendered apps." },
    { t: "h2", text: "Plain iframe" },
    { t: "p", text: "For pages that block scripts. Include the credit link yourself." },
    code("HTML", `<iframe src="${MAIN}/embed/face-shape" title="Face shape detector by The Face Analysis" width="480" height="600" style="border:0;width:100%;max-width:480px" loading="lazy"></iframe>\n<p style="text-align:center;font:12px system-ui,sans-serif">Face analysis by <a href="${MAIN}/face-shape" target="_blank" rel="noopener">The Face Analysis</a></p>`),
    { t: "h2", text: "Options" },
    { t: "table", head: ["Option", "Script tag", "Web component / React", "Values"], rows: [
      ["Which widget", "`data-tfa-widget`", "`tool`", "`face-shape` (currently the only one)"],
      ["Size", "`data-size`", "`size`", "`compact` (360 px), `standard` (480 px), `wide` (720 px)"],
    ] },
    { t: "h2", text: "Resize messages" },
    { t: "p", text: "The widget posts its content height to the parent window so the iframe can match it. The script and the web component handle this for you; with a plain iframe you can listen yourself." },
    code("JavaScript", `window.addEventListener("message", (e) => {\n  if (e.origin !== "${MAIN}") return;\n  const m = e.data;\n  if (m && m.source === "tfa-embed" && m.type === "resize") {\n    iframe.style.height = Math.ceil(m.height) + "px";\n  }\n});`),
    { t: "h2", text: "Privacy and what is counted" },
    { t: "p", text: "The measurement runs in the visitor's browser: the page is free, needs no sign-up and loads the face landmark model only after a photo is chosen. We count widget use per embedding site (the hostname only) to see which embeds are used; no photo, measurement or result is part of that count." },
    { t: "h2", text: "Terms of use" },
    { t: "ul", items: [
      "Free to use on any website, including commercial ones.",
      "Keep the credit link under the widget visible. Do not hide it, restyle it to invisibility or remove it.",
      "Do not alter the widget's content or present its reading as a medical or cosmetic diagnosis. It measures proportions in one photo.",
      "We may change or retire the widget.",
    ] },
    { t: "p", text: `Source: [thefaceanalysis-embed](${S.EMBED_REPO}).` },
  ],
});

const trouble = S.MCP_TROUBLESHOOTING;
const faq = S.MCP_FAQ;
pages.push({
  path: "/faq", label: "FAQ and troubleshooting", title: "FAQ and Troubleshooting for the MCP Server, Dataset and Widget",
  description: "Answers about The Face Analysis MCP server, dataset and widget: accounts, accuracy, citing, licenses, and fixes when tools do not appear or a connector option is missing.",
  h1: "FAQ and troubleshooting",
  lede: "Answers to the common questions about the MCP server, the dataset and the widget, and fixes for the problems people hit most often.",
  faq,
  blocks: [
    { t: "h2", text: "Frequently asked questions" },
    ...faq.flatMap((f) => [{ t: "h3", text: f.q }, { t: "p", text: f.a }]),
    { t: "h2", text: "Troubleshooting" },
    ...trouble.flatMap((f) => [{ t: "h3", text: f.q }, { t: "p", text: f.a }]),
  ],
});

const entries = [...changelog.entries].sort((a, b) => (a.date < b.date ? 1 : -1));
pages.push({
  path: "/changelog", label: "Changelog", title: "Changelog: Packages, Docs and Method Changes",
  description: "Dated changes to The Face Analysis developer packages and to the measurement method behind the dataset: thresholds, formulas and reference data.",
  h1: "Changelog",
  lede: "Two histories: what changed in the developer packages and these docs, and every change to the measurement method that moves the numbers in the dataset.",
  blocks: [
    { t: "h2", text: "Packages and docs" },
    { t: "table", head: ["Date", "Change"], rows: [
      [UPDATED, `First release of \`${S.MCP_NPM}\`, \`thefaceanalysis-data\` and \`thefaceanalysis-embed\` at 0.1.0; these docs; the hosted MCP server at \`${URL_MCP}\`.`],
    ] },
    { t: "h2", text: "Measurement method" },
    { t: "p", text: `The method last changed ${changelog.methodology.lastChanged} (${changelog.methodology.revisions} revisions). Each entry says what changed and whether any previous result is affected. The same list is available as [changelog.json](${MAIN}/data/changelog.json).` },
    { t: "table", head: ["Date", "Kind", "Subject", "Change"], rows: entries.map((e) => [e.date, e.kind, e.subject, e.change]) },
  ],
});

/* -------------------------------------------------------------------- çıktı */
const nav = buildNav(clients);
const flat = nav.flatMap(([, items]) => items.map(([path, label]) => ({ path, label }))).filter((x) => x.path !== "/llms.txt");
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/assets", { recursive: true });
// public/: IndexNow anahtar dosyası gibi kökte durması gereken dosyalar.
cpSync("public", "dist", { recursive: true });
writeFileSync("dist/assets/docs.css", CSS.trim());
writeFileSync("dist/assets/docs.js", JS.trim());
const outPath = (p) => (p === "/" ? "dist/index.html" : `dist${p}.html`);
for (const p of pages) {
  mkdirSync(dirname(outPath(p.path)), { recursive: true });
  writeFileSync(outPath(p.path), page({ p, nav, flat, updated: UPDATED }));
}
writeFileSync("dist/404.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | The Face Analysis developer docs</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/assets/docs.css"></head><body><main style="max-width:640px;margin:15vh auto;padding:0 20px"><h1>Page not found</h1><p>That page is not in the docs. Start from the <a href="/">overview</a> or the <a href="/quickstart">quickstart</a>.</p></main></body></html>`);
writeFileSync("dist/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
writeFileSync("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${BASE}${p.path === "/" ? "/" : p.path}</loc><lastmod>${UPDATED}</lastmod></url>`).join("\n")}\n</urlset>\n`);

const llms = [
  "# The Face Analysis developer docs", "",
  "> Documentation for the free, open-source developer tools of The Face Analysis (thefaceanalysis.com): a read-only MCP server with sourced face measurement statistics and a face shape classifier, the dataset as JSON and CSV (CC BY 4.0), and an embeddable face shape widget. Numbers come from 102 faces and describe those faces, not a population.", "",
  `Hosted MCP server: ${URL_MCP}`, `Source: ${ORG}`, "",
  "## Docs", "",
  ...pages.map((p) => `- [${p.h1}](${BASE}${p.path}): ${p.description}`), "",
  "## Optional", "",
  `- [Methodology](${MAIN}/methodology): how every number is made and what is not measured.`,
  `- [Face measurement statistics](${MAIN}/face-measurement-statistics): the data as a page.`,
  `- [Full documentation as one file](${BASE}/llms-full.txt)`, "",
].join("\n");
writeFileSync("dist/llms.txt", llms);
writeFileSync("dist/llms-full.txt", [
  "# The Face Analysis developer docs (full text)", "", `Source: ${BASE} · Updated ${UPDATED}`, "",
  ...pages.map((p) => `# ${p.h1}\n\nURL: ${BASE}${p.path}\n\n${renderMd([{ t: "p", text: p.lede }, ...p.blocks], BASE)}\n`),
].join("\n\n"));
console.log(`built ${pages.length} pages · tools documented: ${tools.length} · mcp ${mcpPkg.version} · data ${dataPkg.version} · embed ${embedPkg.version}`);
