const ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=PTO";

main().catch(err => {
  document.getElementById("content").textContent = "Erro: " + String(err);
  console.error(err);
});

async function main() {
  const r = await fetch(ENDPOINT, { cache: "no-store" });
  const data = await r.json();
  const warnings = data.warnings || [];

  const root = document.getElementById("content");
  root.innerHTML = "";

  if (!warnings.length) {
    root.textContent = "Sem avisos.";
    return;
  }

  const groups = groupByType(warnings);

  for (const g of groups) {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-header">${iconForType(g.type)} ${g.type}</div>
      <div class="grid">
        <div class="tl"></div>
        <div class="legend"></div>
      </div>
    `;

    const tl = card.querySelector(".tl");
    const blocks = buildTimelineBlocks(g.items);
    for (const b of blocks) {
      const wrap = document.createElement("div");
      wrap.className = "b";
      wrap.innerHTML = `
        <div class="start"><span class="${b.level}">●</span> ${b.startLabel}</div>
        ${b.endLabel ? `<div class="end">${b.endLabel}</div>` : ""}
      `;
      tl.appendChild(wrap);
    }

    const legend = card.querySelector(".legend");
    const summaries = buildLevelSummaries(g.items).sort((a,b)=>priority(a.level)-priority(b.level));
    for (const s of summaries) {
      const div = document.createElement("div");
      div.innerHTML = `
        <div class="lvl ${s.level}">${label(s.level).toUpperCase()}</div>
        <div class="desc">${escapeHtml(s.text || "")}</div>
      `;
      legend.appendChild(div);
    }

    root.appendChild(card);
  }
}

function buildTimelineBlocks(items) {
  const sorted = [...items].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  return sorted.map((cur,i) => {
    const next = sorted[i+1];
    const showEnd = !next || cur.end !== next.start;
    return {
      level: cur.level,
      startLabel: fmtStart(cur.start),
      endLabel: showEnd ? ("até " + fmtTime(cur.end)) : null
    };
  });
}

function buildLevelSummaries(items) {
  const m = {};
  for (const w of items) if (!m[w.level]) m[w.level] = w;
  return Object.values(m);
}

function groupByType(ws) {
  const m = {};
  for (const w of ws) {
    (m[w.type] ||= { type:w.type, items:[] }).items.push(w);
  }
  return Object.values(m);
}

function fmtStart(i){ const d=new Date(i); return d.toLocaleDateString("pt-PT",{weekday:"short"})+" "+d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}); }
function fmtTime(i){ return new Date(i).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}); }

function priority(l){ return {yellow:1, orange:2, red:3}[l] ?? 9; }
function label(l){ return {yellow:"Amarelo", orange:"Laranja", red:"Vermelho"}[l] || "Aviso"; }
function iconForType(t){ t=t.toLowerCase(); if(t.includes("mar"))return"🌊"; if(t.includes("vento"))return"💨"; if(t.includes("chuva"))return"🌧️"; return"⚠️"; }

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
