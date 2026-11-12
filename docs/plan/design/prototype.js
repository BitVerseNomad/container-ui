// OpenPier prototype: three visual directions over one small state model.
// Nothing here talks to Docker. It only shows how the app would behave.

const fresh = () => ({
  open: { shop: true },
  sel: null,            // what the inspector shows: "p:<problem>", "s:<project>/<service>", "j:<project>"
  page: "projects",
  toast: "",
  projects: [
    { id: "shop", dir: "~/code/shop", services: [
      { n: "api", img: "acme/billing-api:3.1", st: "bad", port: 8080, want: 8080, prob: "health" },
      { n: "web", img: "nginx:1.27", st: "ok" },
      { n: "db", img: "postgres:16", st: "ok", port: 5432, want: 5432 },
      { n: "queue", img: "redis:7", st: "ok" },
      { n: "worker", img: "acme/worker:3.1", st: "warn", prob: "restart" },
      { n: "report-job", img: "acme/report:3.1", st: "bad", down: true, prob: "oom" },
      { n: "cache", img: "memcached:1.6", st: "off" } ] },
    { id: "billing", dir: "~/code/billing", services: [
      { n: "web", img: "nginx:1.27", st: "ok", port: 8081, want: 8080 },
      { n: "db", img: "postgres:16", st: "ok", port: 5433, want: 5432 },
      { n: "mail", img: "mailpit:1.20", st: "ok", port: 8025, want: 8025 } ] },
    { id: "search", dir: "~/work/search-service", services: [
      { n: "api", img: "acme/search-api:2.0", st: "off", want: 8080 },
      { n: "index", img: "opensearch:2", st: "off", want: 9200 },
      { n: "db", img: "postgres:16", st: "off", want: 5432 },
      { n: "queue", img: "redis:7", st: "off" } ] },
  ],
  loose: [
    { n: "kafka-ui", img: "provectuslabs/kafka-ui", st: "bad", port: 8082, prob: "kafka" },
    { n: "kafka", img: "apache/kafka:3.8", st: "warn", note: "Only reachable from your Mac" },
    { n: "scratch-postgres", img: "postgres:16", st: "ok", port: 5434 },
  ],
});
let S = fresh();

const PROBLEMS = {
  health: { where: "shop / api", title: "Its health check is failing", short: "Its health check is failing",
    body: "The container is running, but 5 checks in a row could not connect to port 8080 inside it. The app listens on another port.",
    said: "14:02:11 curl -f http://localhost:8080/health\n<b>curl: (7) Failed to connect to localhost port 8080: Connection refused</b>\n14:02:11 exit 7",
    steps: ["The logs say <b>Listening on :3000</b>. The app and the check disagree on the port.", "The Compose file sets the check to 8080 and <b>PORT</b> is not set."],
    fix: "Set PORT to 8080 and restart", done: "api restarted with PORT=8080. Its health check passes." },
  restart: { where: "shop / worker", title: "It keeps restarting", short: "Keeps restarting, 6 times in 10 minutes",
    body: "The container starts, stops after 2 seconds with an error, and Docker starts it again. It needs a setting that is missing.",
    said: "14:01:40 worker starting\n<b>Error: REDIS_URL is not set</b>\n14:01:42 exit 1",
    steps: ["The project has a service called <b>queue</b> (redis:7) that is running.", "Other services of this project reach it at <b>redis://queue:6379</b>."],
    fix: "Set REDIS_URL to redis://queue:6379 and restart", done: "worker restarted with REDIS_URL. It has been up for 10 seconds." },
  oom: { where: "shop / report-job", title: "It ran out of memory", short: "Ran out of memory. Its limit is 256 MB",
    body: "The container was stopped by the system because it used more memory than its limit of 256 MB. The machine has 2.9 GB free.",
    said: "13:58:03 building report for 2026-10\n<b>Killed (out of memory), limit 256 MB, peak 255 MB</b>",
    steps: ["Its last three runs all stopped at the same step.", "Similar jobs in this project run with <b>512 MB</b>."],
    fix: "Raise the limit to 512 MB and start", done: "report-job started with a 512 MB limit." },
  kafka: { where: "kafka-ui", title: "It can't reach Kafka", short: "Can't reach Kafka",
    body: "kafka-ui looks for Kafka at kafka:9092, and the two containers are on different networks, so the name does not resolve.",
    said: "14:00:12 connecting to kafka:9092\n<b>java.net.UnknownHostException: kafka</b>",
    steps: ["<b>kafka</b> is on the network <b>bridge</b>. <b>kafka-ui</b> is on <b>devnet</b>.", "Kafka only announces itself to your Mac, at localhost:9092."],
    fix: "Put both on devnet and restart them", done: "kafka and kafka-ui are on devnet. kafka-ui is connected." },
};

/* ---------- reading the state ---------- */
const up = (s) => s.st !== "off" && !s.down;
const allC = () => [...S.projects.flatMap(p => p.services.map(s => ({ ...s, proj: p.id }))), ...S.loose.map(s => ({ ...s, proj: "" }))];
const problems = () => allC().filter(c => c.prob).map(c => ({ key: c.prob, c, ...PROBLEMS[c.prob] }));
const pState = (p) => { const r = p.services.filter(up).length; return { r, t: p.services.length, st: r === 0 ? "off" : p.services.some(s => s.st === "bad") ? "bad" : p.services.some(s => s.st === "warn") ? "warn" : "ok" }; };
const pText = (p) => { const x = pState(p); return x.r === 0 ? "Not started" : `${x.r} of ${x.t} running`; };
const ports = (p) => p.services.filter(s => up(s) && s.port);
const used = () => new Set(allC().filter(c => up(c) && c.port).map(c => c.port));
const meters = () => { const n = allC().filter(up).length; return { cpu: 2 + n, mem: (0.9 + n * 0.38).toFixed(1), memPct: Math.round((0.9 + n * 0.38) / 8 * 100), disk: 41 }; };
const esc = (t) => String(t).replace(/</g, "&lt;");

/* ---------- changing the state ---------- */
const say = (t) => { S.toast = t; clearTimeout(say.t); say.t = setTimeout(() => { S.toast = ""; render(); }, 3200); };
function startProject(id) {
  const p = S.projects.find(x => x.id === id), taken = used(), moved = [];
  p.services.forEach(s => {
    if (up(s)) return;
    s.st = "ok"; s.down = false; delete s.prob;
    if (s.want) { let port = s.want; while (taken.has(port)) port++; taken.add(port); s.port = port; if (port !== s.want) moved.push(`${s.want} was taken, ${s.n} uses ${port}`); }
  });
  say(moved.length ? `Started ${id} next to the others. ${moved.join("; ")}.` : `Started ${id}.`);
}
function stopProject(id) { S.projects.find(x => x.id === id).services.forEach(s => { s.st = "off"; s.down = false; delete s.prob; }); say(`Stopped ${id}. Its data is kept.`); }
function find(key) { const [proj, n] = key.split("/"); return proj ? S.projects.find(p => p.id === proj).services.find(s => s.n === n) : S.loose.find(s => s.n === n); }
const ACT = {
  nav: (a) => { S.page = a; S.sel = null; },
  dir: (a) => { hash({ dir: a }); },
  toggle: (a) => { S.open[a] = !S.open[a]; },
  sel: (a) => { S.sel = S.sel === a ? null : a; },
  close: () => { S.sel = null; },
  proj: (a) => { pState(S.projects.find(p => p.id === a)).r ? stopProject(a) : startProject(a); },
  svc: (a) => { const s = find(a); if (up(s)) { s.st = "off"; delete s.prob; say(`Stopped ${s.n}.`); } else { s.st = "ok"; s.down = false; delete s.prob; if (s.want && !s.port) { const t = used(); let port = s.want; while (t.has(port)) port++; s.port = port; } say(`Started ${s.n}.`); } },
  fix: (a) => {
    const P = PROBLEMS[a];
    allC().forEach(c => { if (c.prob === a) { const s = find(`${c.proj}/${c.n}`); s.st = "ok"; s.down = false; delete s.prob; } });
    if (a === "kafka") { const k = S.loose.find(s => s.n === "kafka"); k.st = "ok"; delete k.note; }
    S.sel = null; say(P.done);
  },
  add: () => say("Add project opens the folder picker. Not part of this prototype."),
  noop: (a) => say(`${a} is not part of this prototype.`),
};

/* ---------- shared pieces ---------- */
const blocks = (list) => list.map(s => `<u class="${up(s) ? (s.st === "ok" ? "" : s.st) : (s.down ? "bad" : "off")}" title="${s.n}"></u>`).join("");
const spark = (seed, flat) => { const pts = Array.from({ length: 12 }, (_, i) => flat ? 2 : 2 + ((seed * (i + 3) * 7) % 9)); return `<svg class="spark" viewBox="0 0 86 18"><polyline points="${pts.map((y, i) => `${i * (86 / 11)},${18 - y}`).join(" ")}"/></svg>`; };
const stWord = (s) => s.down ? "Out of memory" : s.st === "off" ? "Stopped" : s.prob === "health" ? "Unhealthy" : s.prob === "restart" ? "Restarting" : s.prob === "kafka" ? "Can't reach Kafka" : "Running";
const dotColor = (st) => `var(--${{ ok: "ok", warn: "warn", bad: "bad", off: "faint" }[st]})`;

function inspector() {
  const k = S.sel; if (!k) return "";
  if (k.startsWith("p:")) {
    const P = PROBLEMS[k.slice(2)];
    if (!problems().some(x => x.key === k.slice(2))) return "";
    return `<div class="ins"><div class="crumb">${P.where}</div><h2>${P.title}</h2><p>${P.body}</p>
      <div><div class="lbl" style="margin-bottom:6px">What it said</div><pre>${P.said}</pre></div>
      <div><div class="lbl" style="margin-bottom:6px">What OpenPier found</div><div class="steps">${P.steps.map((s, i) => `<div><i>${i + 1}</i><span>${s}</span></div>`).join("")}</div></div>
      <div class="acts"><button class="b pri" data-act="fix" data-arg="${k.slice(2)}">${P.fix}</button><button class="b" data-act="noop" data-arg="Open logs">Open logs</button><button class="b" data-act="noop" data-arg="Open a shell">Open a shell</button></div></div>`;
  }
  if (k.startsWith("j:")) {
    const p = S.projects.find(x => x.id === k.slice(2)), x = pState(p);
    return `<div class="ins"><div class="crumb">${p.dir} · Colima · default</div><h2>${p.id}</h2><p>${pText(p)}. ${ports(p).some(s => s.port !== s.want) ? "Some ports were moved so it can run next to the others. Your Compose file was not changed." : ""}</p>
      <div>${p.services.map(s => `<div class="svc"><i style="background:${dotColor(up(s) ? s.st : s.down ? "bad" : "off")}"></i><b>${s.n}</b><span>${up(s) && s.port ? ":" + s.port + (s.port !== s.want ? " (wanted " + s.want + ")" : "") : ""}</span><span>${stWord(s)}</span></div>`).join("")}</div>
      <div class="acts"><button class="b pri" data-act="proj" data-arg="${p.id}">${x.r ? "Stop" : "Start"} ${p.id}</button><button class="b" data-act="noop" data-arg="Open folder">Open folder</button></div></div>`;
  }
  const c = allC().find(c => `s:${c.proj}/${c.n}` === k); if (!c) return "";
  return `<div class="ins"><div class="crumb">${c.proj ? c.proj + " / " : ""}${c.n} · ${c.img}</div><h2>${c.n}</h2><p>${stWord(c)}${up(c) && c.port ? `. Open it at localhost:${c.port}` : ""}. ${c.note || "Nothing needs attention."}</p>
    <div class="acts"><button class="b pri" data-act="svc" data-arg="${c.proj}/${c.n}">${up(c) ? "Stop" : "Start"}</button><button class="b" data-act="noop" data-arg="Open logs">Open logs</button></div></div>`;
}
const placeholder = (name) => `<div class="ph">${name} is not part of this prototype.<br>Projects and Containers are.</div>`;
const PAGES = ["Projects", "Containers", "Images", "Volumes", "Networks", "Kubernetes"];

/* ---------- A. Manifest ---------- */
function A(dark) {
  const m = meters(), pr = problems();
  const btn = (label, act, arg, pri) => `<button class="btn ${pri ? "pri" : ""}" data-act="${act}" data-arg="${arg}">${label}</button>`;
  const svcRow = (s, proj) => `
    <div class="tr kid" data-act="sel" data-arg="${s.prob ? "p:" + s.prob : "s:" + proj + "/" + s.n}"><span></span><span class="nm">${s.n}</span><span class="blocks">${blocks([s])}</span><span class="sub">${s.img}</span><span class="ports num">${up(s) && s.port ? `<a>${s.port}</a>` : ""}</span>${up(s) ? spark(s.n.length, s.st === "ok") : "<span></span>"}<span class="state ${up(s) && !s.prob ? "" : s.st === "warn" ? "" : s.st === "off" ? "off" : "bad"}" ${s.st === "warn" ? 'style="color:var(--warn);font-weight:600"' : ""}>${stWord(s)}</span>${btn(up(s) ? "Stop" : "Start", "svc", proj + "/" + s.n)}</div>
    ${s.prob ? `<div class="tr why" data-act="sel" data-arg="p:${s.prob}"><span></span><span><em>${PROBLEMS[s.prob].short}.</em> ${PROBLEMS[s.prob].body.split(". ")[0]}.</span>${btn("See why", "sel", "p:" + s.prob, true)}</div>` : ""}`;
  const projRow = (p) => { const x = pState(p); return `
    <div class="tr" data-act="toggle" data-arg="${p.id}"><span class="chev">${S.open[p.id] ? "▼" : "▶"}</span><span class="nm">${p.id}</span><span class="blocks">${blocks(p.services)}</span><span class="sub">${p.dir}</span><span class="ports num">${ports(p).map(s => `<a>${s.port}</a>`).join("")}</span>${x.r ? spark(p.id.length + 2) : "<span></span>"}<span class="state ${x.st === "bad" ? "bad" : x.st === "off" ? "off" : ""}">${pText(p)}</span>${btn(x.r ? "Stop" : "Start", "proj", p.id)}</div>
    ${S.open[p.id] ? p.services.map(s => svcRow(s, p.id)).join("") : ""}`; };
  const head = (c2, c4) => `<div class="tr th"><span></span><span>${c2}</span><span>Services</span><span>${c4}</span><span>Ports</span><span>CPU, 10 min</span><span>State</span><span></span></div>`;
  const table = S.page === "projects"
    ? head("Project", "Folder") + S.projects.map(projRow).join("") + `<div class="cap">Not in a project</div>` + S.loose.map(s => svcRow(s, "").replace('class="tr kid"', 'class="tr"')).join("")
    : S.page === "containers" ? head("Container", "Image") + allC().map(c => svcRow(c, c.proj).replace('class="tr kid"', 'class="tr"')).join("")
    : placeholder(S.page[0].toUpperCase() + S.page.slice(1));
  const sheet = inspector();
  return `<div class="A ${dark ? "dark" : ""}">
    <aside>
      <div class="eng"><span style="width:8px;height:8px;border-radius:50%;background:var(--ok)"></span><div><b>Colima · default</b><small>Running</small></div></div>
      ${PAGES.map(n => `<div class="nav" data-act="nav" data-arg="${n.toLowerCase()}" ${S.page === n.toLowerCase() ? 'aria-current="page"' : ""}>${n}${n === "Projects" ? `<b>${S.projects.length}</b>` : n === "Containers" ? `<b>${allC().length}</b>` : ""}</div>`).join("")}
      <div style="flex:1"></div>
      <div class="nav" data-act="nav" data-arg="doctor" ${S.page === "doctor" ? 'aria-current="page"' : ""}>Doctor ${pr.length ? `<b class="alert">${pr.length}</b>` : ""}</div><div class="nav" data-act="nav" data-arg="settings">Settings</div>
    </aside>
    <main>
      <header><h1>${S.page[0].toUpperCase() + S.page.slice(1)}</h1><span class="sub">${pr.length ? `${pr.length} ${pr.length === 1 ? "thing needs" : "things need"} attention` : "Everything is running fine"}</span>
        <div class="meters num">
          <div class="meter" style="--v:${m.cpu}%">CPU <i></i> ${m.cpu}%</div>
          <div class="meter ${m.memPct > 60 ? "hot" : ""}" style="--v:${m.memPct}%">Memory <i></i> ${m.mem} of 8 GB</div>
          <div class="meter" style="--v:68%">Disk <i></i> ${m.disk} of 60 GB</div>
        </div>
        <button class="btn pri" data-act="add">Add project</button></header>
      <div class="tbl">${table}</div>
      ${sheet ? `<div class="sheet"><button class="x" data-act="close" aria-label="Close">✕</button>${sheet}</div>` : ""}
    </main></div>`;
}

/* ---------- B. Control room ---------- */
function B(dark) {
  const m = meters(), pr = problems();
  const it = (key, st, name, small, right, why, cls = "") => `<div class="it ${cls} ${S.sel === key ? "sel" : ""}" data-act="sel" data-arg="${key}"><i class="d ${st === "ok" ? "" : st}"></i><span class="n">${name} <small>${small}</small></span><span class="v num">${right}</span>${why ? `<span class="w">${why}</span>` : ""}</div>`;
  const fine = allC().filter(c => up(c) && !c.prob);
  const list = S.page === "projects" || S.page === "containers" ? `
    ${pr.length ? `<div class="grp">Needs attention<b>${pr.length}</b></div>` + pr.map(p => it("p:" + p.key, p.c.st, p.c.n, p.c.proj, p.c.port && up(p.c) ? ":" + p.c.port : "", p.short, p.c.st)).join("") : `<div class="grp">Needs attention<b>0</b></div><div class="it"><i class="d"></i><span class="n" style="font-weight:400;color:var(--mute)">Nothing. Everything is running fine.</span></div>`}
    ${S.page === "projects" ? `<div class="grp">Projects<b>${S.projects.length}</b></div>` + S.projects.map(p => { const x = pState(p); return it("j:" + p.id, x.st, p.id, p.dir, x.r ? `${x.r}/${x.t}` : "off"); }).join("") : ""}
    <div class="grp">Running fine<b>${fine.length}</b></div>${fine.map(c => it(`s:${c.proj}/${c.n}`, "ok", c.n, c.proj, c.port ? ":" + c.port : "")).join("")}
    ${S.page === "containers" ? `<div class="grp">Stopped<b>${allC().filter(c => !up(c)).length}</b></div>` + allC().filter(c => !up(c)).map(c => it(`s:${c.proj}/${c.n}`, "off", c.n, c.proj, "off")).join("") : ""}` : placeholder(S.page[0].toUpperCase() + S.page.slice(1));
  const ins = inspector();
  return `<div class="B ${dark ? "" : "light"}">
    <div class="top"><b>colima/default</b><span class="ok">running</span>
      <div class="r num"><span>cpu <b>${m.cpu}%</b></span><span>mem <b>${m.mem}</b>/8G</span><span>disk <b>${m.disk}</b>/60G</span><span>⌘K</span></div></div>
    <div class="rail">${PAGES.map(n => `<span data-act="nav" data-arg="${n.toLowerCase()}" ${S.page === n.toLowerCase() ? 'aria-current="page"' : ""}>${n}</span>`).join("")}
      <span style="margin-top:auto" data-act="nav" data-arg="doctor" ${S.page === "doctor" ? 'aria-current="page"' : ""}>Doctor${pr.length ? `<b>${pr.length}</b>` : ""}</span><span data-act="nav" data-arg="settings">Settings</span></div>
    <div class="list">${list}</div>
    <div class="insp">${ins || `<div class="calm">${pr.length ? "Pick something on the left to see what is wrong and how to fix it." : "Nothing needs you. Pick a project or a container to see it."}</div>`}</div>
  </div>`;
}

/* ---------- C. Quay ---------- */
function C(dark) {
  const m = meters(), pr = problems();
  const needs = pr.length ? `<section class="needs">
      <div><h2 class="din">${pr.length} ${pr.length === 1 ? "thing<br>needs" : "things<br>need"} you</h2><p>Everything else is running fine.</p></div>
      <div>${pr.map(p => `<div class="need"><i class="${p.c.st === "warn" ? "warn" : ""}"></i><div data-act="sel" data-arg="p:${p.key}"><b>${p.c.n}</b>${p.c.proj ? " in " + p.c.proj : ""}: ${p.short[0].toLowerCase() + p.short.slice(1)}. <span>${p.steps[0].replace(/<\/?b>/g, "")}</span></div><span style="display:flex;gap:6px"><button class="btn q" data-act="sel" data-arg="p:${p.key}">See why</button><button class="btn" data-act="fix" data-arg="${p.key}">Fix it</button></span></div>`).join("")}</div>
    </section>` : `<section class="needs calm"><h2 class="din">All clear</h2><p style="margin:6px 0 0;color:var(--bandmute)">Nothing needs you. ${allC().filter(up).length} containers are running fine.</p></section>`;
  const berth = (p) => { const x = pState(p); return `<div class="berth ${x.st === "bad" ? "bad" : x.st === "off" ? "off" : ""}" data-act="sel" data-arg="j:${p.id}"><h4 class="din">${p.id}</h4><div class="path">${p.dir}</div>
      <div class="stack">${blocks(p.services)}<span>${pText(p)}</span></div>
      <div class="foot">${ports(p).map(s => `<span class="port num">${s.port}${s.port !== s.want ? `<s>not ${s.want}</s>` : ""}</span>`).join("")}<button class="btn" data-act="proj" data-arg="${p.id}">${x.r ? "Stop" : "Start"}</button></div></div>`; };
  const chip = (c) => `<div class="chipc" data-act="sel" data-arg="${c.prob ? "p:" + c.prob : "s:" + c.proj + "/" + c.n}"><i class="${up(c) ? (c.st === "ok" ? "" : c.st) : ""}" style="${up(c) ? "" : "background:var(--off)"}"></i><b>${c.n}</b><span>${c.proj ? c.proj + " · " : ""}${up(c) ? (c.port ? ":" + c.port : stWord(c)) : stWord(c)}</span></div>`;
  const body = S.page === "projects" ? `${needs}
      <div class="row"><h3 class="din">Projects</h3><span>${S.projects.length}, ${S.projects.filter(p => pState(p).r).length} running side by side</span><button class="btn" data-act="add">Add project</button></div>
      <div class="grid">${S.projects.map(berth).join("")}</div>
      <div class="row"><h3 class="din">On their own</h3><span>containers not in a project</span></div>
      <div class="loose">${S.loose.map(c => chip({ ...c, proj: "" })).join("")}</div>`
    : S.page === "containers" ? `${needs}<div class="row"><h3 class="din">Containers</h3><span>${allC().length}, ${allC().filter(up).length} running</span></div><div class="loose">${allC().map(chip).join("")}</div>`
    : placeholder(S.page[0].toUpperCase() + S.page.slice(1));
  const sheet = inspector();
  return `<div class="C ${dark ? "dark" : ""}">
    <nav><span class="logo din">OpenPier</span>
      ${PAGES.slice(0, 5).map(n => `<span class="tab" data-act="nav" data-arg="${n.toLowerCase()}" ${S.page === n.toLowerCase() ? 'aria-current="page"' : ""}>${n}</span>`).join("")}
      <span class="tab" data-act="nav" data-arg="doctor" ${S.page === "doctor" ? 'aria-current="page"' : ""}>Doctor ${pr.length ? `<b>${pr.length}</b>` : ""}</span>
      <div class="engine num"><i></i><b>Colima</b><span>${m.cpu}% CPU · ${m.mem} of 8 GB</span></div></nav>
    <div class="wrap">${body}</div>
    ${sheet ? `<div class="sheet"><button class="x" data-act="close" aria-label="Close">✕</button>${sheet}</div>` : ""}
  </div>`;
}

/* ---------- wiring ---------- */
const params = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const hash = (o) => { location.hash = new URLSearchParams({ ...params(), ...o }).toString(); };
function render() {
  const p = params(), d = p.dir || "a", dark = p.theme === "dark";
  document.body.classList.toggle("bare", p.bare === "1");
  document.getElementById("root").innerHTML = (d === "b" ? B(dark) : d === "c" ? C(dark) : A(dark)) + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
}
document.getElementById("root").addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  ACT[el.dataset.act](el.dataset.arg); render();
});
document.querySelectorAll("#bar [data-d]").forEach(b => b.onclick = () => hash({ dir: b.dataset.d }));
document.getElementById("th").onclick = () => hash({ theme: params().theme === "dark" ? "light" : "dark" });
document.getElementById("rs").onclick = () => { S = fresh(); render(); };
addEventListener("keydown", (e) => { if (e.key === "Escape") { S.sel = null; render(); } });
addEventListener("hashchange", render);
render();
