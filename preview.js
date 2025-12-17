// preview.js — usado apenas no browser (GitHub Pages)

const ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=PTO";

fetch(ENDPOINT)
  .then(r => r.json())
  .then(data => render(data.warnings || []))
  .catch(err => {
    document.getElementById("content").innerText = "Erro a carregar dados";
    console.error(err);
  });

function render(warnings) {
  const root = document.getElementById("content");
  root.innerHTML = "";

  const groups = groupByType(warnings);

  groups.forEach(g => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-header">
        <span class="emoji">${iconForType(g.type)}</span>
        <span class="title">${g.type}</span>
      </div>
      <div class="card-body">
        <div class="timeline"></div>
        <div class="legend"></div>
      </div>
    `;

    const tl = card.querySelector(".timeline");
    const blocks = buildTimelineBlocks(g.items);

    blocks.forEach(b => {
      const div = document.createElement("div");
      div.className = "tl-block " + b.level;
      div.innerHTML = `
        <div class="start">${b.startLabel}</div>
        ${b.endLabel ? `<div class="end">${b.endLabel}</div>` : ""}
      `;
      tl.appendChild(div);
    });

    const legend = card.querySelector(".legend");
    buildLevelSummaries(g.items)
      .sort((a, b) => priority(a.level) - priority(b.level))
      .forEach(s => {
        const l = document.createElement("div");
        l.className = "legend-item " + s.level;
        l.innerHTML = `
          <div class="level">${label(s.level)}</div>
          <div class="text">${s.text}</div>
        `;
        legend.appendChild(l);
      });

    root.appendChild(card);
  });
}

/* ======= SHARED LOGIC (copiada do Scriptable) ======= */

function buildTimelineBlocks(items) {
  const sorted = [...items].sort((a, b) =>
    String(a.start).localeCompare(String(b.start))
  );

  return sorted.map((cur, i) => {
    const next = sorted[i + 1];
    const showEnd = !next || cur.end !== next.start;

    return {
      level: cur.level,
      startLabel: fmtStart(cur.start),
      endLabel: showEnd ? "até " + fmtTime(cur.end) : null
    };
  });
}

function buildLevelSummaries(items) {
  const map = {};
  items.forEach(w => {
    if (!map[w.level]) map[w.level] = w;
  });
  return Object.values(map);
}

function groupByType(ws) {
  const m = {};
  ws.forEach(w => {
    if (!m[w.type]) m[w.type] = { type: w.type, items: [] };
    m[w.type].items.push(w);
  });
  return Object.values(m);
}

/* ======= helpers ======= */

function fmtStart(i) {
  const d = new Date(i);
  return d.toLocaleDateString("pt-PT", { weekday: "short" }) + " " +
         d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
function fmtTime(i) {
  return new Date(i).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
function priority(l) { return { yellow: 1, orange: 2, red: 3 }[l] ?? 9; }
function label(l) { return { yellow: "Amarelo", orange: "Laranja", red: "Vermelho" }[l]; }
function iconForType(t) {
  t = t.toLowerCase();
  if (t.includes("mar")) return "🌊";
  if (t.includes("vento")) return "💨";
  if (t.includes("chuva")) return "🌧️";
  return "⚠️";
}
