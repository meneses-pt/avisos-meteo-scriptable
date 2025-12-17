// avisos-meteo.js (REMOTO) — Scriptable
// Fixes: largura total + wrap real das descrições + timeline compacta + legendas ordenadas

async function main() {
  const AREA = "PTO";
  const ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  const fam = config?.widgetFamily ?? "medium";
  const ui = uiForFamily(fam);

  const fm = FileManager.local();
  const cacheDir = fm.joinPath(fm.documentsDirectory(), "avisos-meteo");
  const cachePath = fm.joinPath(cacheDir, `warnings-${AREA}.json`);
  if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

  const w = new ListWidget();
  w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=" + AREA;

  // HEADER
  const header = w.addStack();
  header.centerAlignContent();

  const title = header.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(ui.titleFont);
  title.textColor = Color.white();
  title.lineLimit = 1;
  title.minimumScaleFactor = 0.7;

  header.addSpacer();

  const pill = header.addStack();
  pill.setPadding(4, 10, 4, 10);
  pill.cornerRadius = 10;

  const pillText = pill.addText("…");
  pillText.font = Font.boldSystemFont(ui.pillFont);

  if (ui.showSubtitle) {
    w.addSpacer(4);
    const sub = w.addText(ui.subtitleText);
    sub.font = Font.systemFont(ui.subtitleFont);
    sub.textColor = new Color("#A6B0C3");
  }

  w.addSpacer(ui.afterHeaderSpace);

  // DATA (cache + fetch)
  let cached = null;
  if (fm.fileExists(cachePath)) {
    try { cached = JSON.parse(fm.readString(cachePath)); } catch {}
  }

  let data = null;
  try {
    const req = new Request(ENDPOINT);
    req.timeoutInterval = 5;
    req.headers = { Accept: "application/json" };
    data = await req.loadJSON();
    if (Array.isArray(data?.warnings)) {
      fm.writeString(cachePath, JSON.stringify({
        savedAt: new Date().toISOString(),
        payload: data
      }));
    }
  } catch {}

  const payload =
    Array.isArray(data?.warnings) ? data :
    Array.isArray(cached?.payload?.warnings) ? cached.payload :
    { warnings: [] };

  const warnings = payload.warnings;

  setTopPill(pill, pillText, warnings.length, getMaxLevel(warnings));

  if (!warnings.length) {
    const t = w.addText("Sem avisos relevantes.");
    t.font = Font.systemFont(ui.bodyFont);
    t.textColor = new Color("#D5DBE7");
    finish(w);
    return;
  }

  const groups = groupByType(warnings);
  groups.sort((a, b) => priorityDesc(b.maxLevel) - priorityDesc(a.maxLevel));

  for (let i = 0; i < groups.length; i++) {
    if (i > 0) w.addSpacer(10);
    renderTypeCard(w, groups[i], ui);
  }

  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  finish(w);
}

/* ================= UI ================= */

function uiForFamily(fam) {
  if (fam === "large") {
    return {
      pad: 14,
      titleFont: 16,
      subtitleFont: 11,
      pillFont: 12,
      bodyFont: 13,
      showSubtitle: true,
      subtitleText: "Porto · próximos avisos",
      afterHeaderSpace: 14,
      cardTitleFont: 13,
      rightColWidth: 200,
      levelFont: 11,
      descFont: 12,
      timelineFont: 13,
      timelineFontSmall: 11,
      maxTimelineBlocks: 14,
      blockGap: 5,
      lineGap: 2,
      dotGap: 6,
      indent: 20,
    };
  }

  if (fam === "small") {
    return {
      pad: 10,
      titleFont: 14,
      subtitleFont: 10,
      pillFont: 11,
      bodyFont: 12,
      showSubtitle: false,
      subtitleText: "",
      afterHeaderSpace: 10,
      cardTitleFont: 12,
      rightColWidth: 150,
      levelFont: 10,
      descFont: 11,
      timelineFont: 12,
      timelineFontSmall: 10,
      maxTimelineBlocks: 8,
      blockGap: 4,
      lineGap: 2,
      dotGap: 6,
      indent: 18,
    };
  }

  // medium
  return {
    pad: 10,
    titleFont: 14,
    subtitleFont: 10,
    pillFont: 11,
    bodyFont: 13,
    showSubtitle: true,
    subtitleText: "Porto · avisos",
    afterHeaderSpace: 12,
    cardTitleFont: 12,
    rightColWidth: 180,
    levelFont: 10,
    descFont: 12,
    timelineFont: 12,
    timelineFontSmall: 10,
    maxTimelineBlocks: 10,
    blockGap: 4,
    lineGap: 2,
    dotGap: 6,
    indent: 18,
  };
}

/* ================= RENDER ================= */

function renderTypeCard(w, group, ui) {
  const card = w.addStack();
  card.layoutVertically();
  card.size = new Size(0, 0); // tenta ocupar a largura disponível
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");

  const top = card.addStack();
  top.centerAlignContent();

  const emoji = top.addText(iconForType(group.type));
  emoji.font = Font.systemFont(ui.cardTitleFont + 2);

  top.addSpacer(6);

  const name = top.addText(group.type);
  name.font = Font.boldSystemFont(ui.cardTitleFont);
  name.textColor = Color.white();
  name.lineLimit = 1;
  name.minimumScaleFactor = 0.75;

  card.addSpacer(8);

  // 2 colunas
  // *** ISTO FORÇA MESMO O CARD A OCUPAR A LARGURA TODA ***
  const content = card.addStack();
  content.topAlignContent();
  content.size = new Size(0, 0);
  
  const left = content.addStack();
  left.layoutVertically();
  
  content.addSpacer(10);
  
  const right = content.addStack();
  right.layoutVertically();
  right.size = new Size(ui.rightColWidth, 0);

  // RIGHT: legendas ordenadas (Amarelo → Laranja → Vermelho)
  const summaries = buildLevelSummaries(group.items)
    .sort((a, b) => priorityAsc(a.level) - priorityAsc(b.level));

  for (let i = 0; i < summaries.length; i++) {
    if (i > 0) right.addSpacer(8);

    const lvl = right.addText(levelLabel(summaries[i].level).toUpperCase());
    lvl.font = Font.boldSystemFont(ui.levelFont);
    lvl.textColor = levelColor(summaries[i].level);
    lvl.lineLimit = 0;

    right.addSpacer(3);

    const txt = right.addText(summaries[i].text || "");
    txt.font = Font.systemFont(ui.descFont);
    txt.textColor = new Color("#D5DBE7");
    txt.lineLimit = 0; // *** WRAP REAL ***
  }

  // LEFT: timeline compacta (2 linhas)
  const blocks = buildTimelineBlocks(group.items).slice(0, ui.maxTimelineBlocks);

  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) left.addSpacer(3); // mais compacto
  
    const row = left.addStack();
    row.centerAlignContent();
  
    const dot = row.addText("●");
    dot.font = Font.boldSystemFont(ui.timelineFont + 2);
    dot.textColor = levelColor(blocks[i].level);
  
    row.addSpacer(5);
  
    const start = row.addText(blocks[i].startLabel);
    start.font = Font.systemFont(ui.timelineFont);
    start.textColor = new Color("#A6B0C3");
    start.lineLimit = 1;
  
    // só cria a segunda linha se existir "até"
    if (blocks[i].endLabel) {
      left.addSpacer(1);
  
      const endRow = left.addStack();
      endRow.addSpacer(ui.indent);
  
      const end = endRow.addText(blocks[i].endLabel);
      end.font = Font.systemFont(ui.timelineFontSmall);
      end.textColor = new Color("#7E8AA6");
      end.lineLimit = 1;
    }
  }

/* ================= DATA ================= */

function groupByType(ws) {
  const map = {};
  for (const w of ws) {
    const type = w.type || "Aviso";
    const level = String(w.level || "green").toLowerCase();

    if (!map[type]) map[type] = { type, items: [], maxLevel: "green" };
    map[type].items.push({
      type,
      level,
      start: w.start,
      end: w.end,
      text: w.text || ""
    });

    if (priorityDesc(level) > priorityDesc(map[type].maxLevel)) {
      map[type].maxLevel = level;
    }
  }
  return Object.values(map);
}

function buildLevelSummaries(items) {
  const map = {};
  for (const w of items) {
    if (!map[w.level]) map[w.level] = w;
  }
  return Object.values(map);
}

function buildTimelineBlocks(items) {
  const sorted = [...items].sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));

  return sorted.map((cur, i) => {
    const next = sorted[i + 1];
    const endMs = safeMs(cur.end);
    const nextStartMs = next ? safeMs(next.start) : null;
    const showEnd = (endMs !== null) && (nextStartMs === null || endMs !== nextStartMs);

    return {
      level: cur.level,
      startLabel: fmtStart(cur.start),
      endLabel: showEnd ? ("até " + fmtEnd(cur.end)) : null
    };
  });
}

function safeMs(iso) {
  try {
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

/* ================= FORMATTING ================= */

function fmtStart(iso) {
  try {
    const d = new Date(iso);
    const wd = d.toLocaleDateString("pt-PT", { weekday: "short" });
    const hm = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    return wd + " " + hm;
  } catch {
    return "";
  }
}

function fmtEnd(iso) {
  try {
    return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* ================= LEVELS ================= */

function priorityAsc(l) { return { yellow: 1, orange: 2, red: 3, green: 9 }[l] ?? 9; }
function priorityDesc(l) { return { green: 1, yellow: 2, orange: 3, red: 4 }[l] ?? 0; }

function getMaxLevel(ws) {
  let max = "green";
  for (const w of ws) {
    const lvl = String(w.level || "green").toLowerCase();
    if (priorityDesc(lvl) > priorityDesc(max)) max = lvl;
  }
  return max;
}

function levelLabel(l) {
  return { yellow: "Amarelo", orange: "Laranja", red: "Vermelho", green: "Verde" }[l] || "Aviso";
}

function levelColor(l) {
  return new Color({ yellow: "#FFE27A", orange: "#FFB86B", red: "#FF6B6B", green: "#8EF0B2" }[l] || "#CCCCCC");
}

function setTopPill(pill, text, count, maxLevel) {
  pill.backgroundColor = new Color("#1A243A");
  text.textColor = levelColor(maxLevel);
  text.text = count + " avisos";
}

function iconForType(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("agitação") || t.includes("mar")) return "🌊";
  if (t.includes("vento")) return "💨";
  if (t.includes("precip") || t.includes("chuva")) return "🌧️";
  if (t.includes("trovo")) return "⛈️";
  if (t.includes("nevo")) return "🌫️";
  if (t.includes("frio")) return "🥶";
  if (t.includes("calor")) return "🥵";
  return "⚠️";
}

/* ================= END ================= */

function finish(w) {
  Script.setWidget(w);
  Script.complete();
}
