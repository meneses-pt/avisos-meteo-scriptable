// Script remoto (GitHub raw) para Scriptable
// Timeline em 2 linhas, sem ellipsis, largura total, legendas ordenadas

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

  /* ---------- HEADER ---------- */
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

  /* ---------- LOAD DATA ---------- */
  let cached = null;
  if (fm.fileExists(cachePath)) {
    try { cached = JSON.parse(fm.readString(cachePath)); } catch {}
  }

  let data = null;
  try {
    const r = new Request(ENDPOINT);
    r.timeoutInterval = 5;
    data = await r.loadJSON();
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

  /* ---------- GROUPS ---------- */
  const groups = groupByType(warnings);
  groups.sort((a, b) => priority(b.maxLevel) - priority(a.maxLevel));

  for (let i = 0; i < groups.length; i++) {
    if (i > 0) w.addSpacer(10);
    renderTypeCard(w, groups[i], ui);
  }

  w.addSpacer();
  finish(w);
}

/* ================= CARD ================= */

function renderTypeCard(w, group, ui) {
  const card = w.addStack();
  card.layoutVertically();
  card.size = new Size(0, 0); // força largura total
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");

  const top = card.addStack();
  top.centerAlignContent();

  top.addText(iconForType(group.type)).font =
    Font.systemFont(ui.cardTitleFont + 2);

  top.addSpacer(6);

  const name = top.addText(group.type);
  name.font = Font.boldSystemFont(ui.cardTitleFont);
  name.textColor = Color.white();
  name.lineLimit = 1;
  name.minimumScaleFactor = 0.75;

  card.addSpacer(8);

  const content = card.addStack();
  content.size = new Size(0, 0);
  content.topAlignContent();

  const left = content.addStack();
  left.layoutVertically();

  content.addSpacer(10);

  const right = content.addStack();
  right.layoutVertically();
  right.size = new Size(ui.rightColWidth, 0);

  /* ----- RIGHT: legends (ordered Yellow → Orange → Red) ----- */
  const summaries = buildLevelSummaries(group.items)
    .sort((a, b) => priority(a.level) - priority(b.level));

  for (let i = 0; i < summaries.length; i++) {
    if (i > 0) right.addSpacer(8);

    const lvl = right.addText(levelLabel(summaries[i].level).toUpperCase());
    lvl.font = Font.boldSystemFont(ui.levelFont);
    lvl.textColor = levelColor(summaries[i].level);

    right.addSpacer(3);

    const txt = right.addText(summaries[i].text);
    txt.font = Font.systemFont(ui.descFont);
    txt.textColor = new Color("#D5DBE7");
    // sem lineLimit → wrap natural
  }

  /* ----- LEFT: timeline (compact) ----- */
  const blocks = buildTimelineBlocks(group.items)
    .slice(0, ui.maxTimelineBlocks);

  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) left.addSpacer(6);

    const r1 = left.addStack();
    r1.centerAlignContent();

    const dot = r1.addText("●");
    dot.font = Font.boldSystemFont(ui.timelineFont + 2);
    dot.textColor = levelColor(blocks[i].level);

    r1.addSpacer(6);

    const start = r1.addText(blocks[i].startLabel);
    start.font = Font.systemFont(ui.timelineFont);
    start.textColor = new Color("#A6B0C3");

    if (blocks[i].endLabel) {
      const r2 = left.addStack();
      r2.addSpacer(6 + 14);
      const end = r2.addText(blocks[i].endLabel);
      end.font = Font.systemFont(ui.timelineFontSmall);
      end.textColor = new Color("#7E8AA6");
    }
  }
}

/* ================= HELPERS ================= */

function buildTimelineBlocks(items) {
  const sorted = [...items].sort((a, b) =>
    String(a.start).localeCompare(String(b.start))
  );

  return sorted.map((cur, i) => {
    const next = sorted[i + 1];
    const end =
      !next || cur.end !== next.start
        ? "até " + fmtTime(cur.end)
        : null;

    return {
      level: cur.level,
      startLabel: fmtStart(cur.start),
      endLabel: end
    };
  });
}

function buildLevelSummaries(items) {
  const out = {};
  items.forEach(w => {
    if (!out[w.level]) out[w.level] = w;
  });
  return Object.values(out);
}

function groupByType(ws) {
  const m = {};
  ws.forEach(w => {
    if (!m[w.type]) m[w.type] = { type: w.type, items: [], maxLevel: "green" };
    m[w.type].items.push(w);
    if (priority(w.level) > priority(m[w.type].maxLevel))
      m[w.type].maxLevel = w.level;
  });
  return Object.values(m);
}

/* ================= FORMATTING ================= */

function fmtStart(i) {
  const d = new Date(i);
  return d.toLocaleDateString("pt-PT", { weekday: "short" }) + " " +
         d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}
function fmtTime(i) {
  return new Date(i).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

/* ================= LEVELS ================= */

function priority(l) { return { yellow: 1, orange: 2, red: 3, green: 0 }[l] ?? 0; }
function levelLabel(l) { return { yellow: "Amarelo", orange: "Laranja", red: "Vermelho" }[l]; }
function levelColor(l) {
  return new Color({ yellow: "#FFE27A", orange: "#FFB86B", red: "#FF6B6B" }[l]);
}
function getMaxLevel(ws) {
  return ws.reduce((m, w) => priority(w.level) > priority(m) ? w.level : m, "green");
}
function setTopPill(p, t, n, l) {
  p.backgroundColor = new Color("#333");
  t.textColor = levelColor(l);
  t.text = n + " avisos";
}
function iconForType(t) {
  t = t.toLowerCase();
  if (t.includes("mar")) return "🌊";
  if (t.includes("vento")) return "💨";
  if (t.includes("chuva")) return "🌧️";
  return "⚠️";
}
function finish(w) { Script.setWidget(w); Script.complete(); }
