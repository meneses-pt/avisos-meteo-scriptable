// Script remoto (GitHub raw) para Scriptable
// Requer: o loader chama `await main()`
// Fonte: Cloudflare Worker
// Anti-timeout: timeout curto + cache local dos avisos
// Timeline: início e fim em linhas diferentes; o fim só aparece se for diferente do início seguinte

async function main() {
  const AREA = "PTO";
  const ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  const fam = (typeof config !== "undefined" && config.widgetFamily) ? config.widgetFamily : "medium";
  const ui = uiForFamily(fam);

  const fm = FileManager.local();
  const cacheDir = fm.joinPath(fm.documentsDirectory(), "avisos-meteo");
  const cachePath = fm.joinPath(cacheDir, `warnings-${AREA}.json`);
  if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

  const w = new ListWidget();
  w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=" + AREA;

  // Header
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

  // Cache read
  let cached = null;
  if (fm.fileExists(cachePath)) {
    try { cached = JSON.parse(fm.readString(cachePath)); } catch {}
  }

  // Fetch online (fast)
  let data = null;
  let fetchError = null;

  try {
    const req = new Request(ENDPOINT);
    req.timeoutInterval = 5;
    req.headers = { Accept: "application/json" };
    data = await req.loadJSON();

    if (data && typeof data === "object" && Array.isArray(data.warnings)) {
      fm.writeString(cachePath, JSON.stringify({
        savedAt: new Date().toISOString(),
        payload: data
      }));
    }
  } catch (e) {
    fetchError = e;
    data = null;
  }

  // Pick source
  let payload = null;
  let fromCache = false;
  let cachedAt = null;

  if (data && Array.isArray(data.warnings)) {
    payload = data;
  } else if (cached && cached.payload && Array.isArray(cached.payload.warnings)) {
    payload = cached.payload;
    fromCache = true;
    cachedAt = cached.savedAt || null;
  } else {
    payload = { warnings: [] };
  }

  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];

  // Top pill
  setTopPill(pill, pillText, warnings.length, getMaxLevel(warnings));

  if (!warnings.length) {
    const t = w.addText("Sem avisos relevantes.");
    t.font = Font.systemFont(ui.bodyFont);
    t.textColor = new Color("#D5DBE7");

    if (fetchError && !fromCache) {
      w.addSpacer(6);
      const e = w.addText("Sem rede/timeout.");
      e.font = Font.systemFont(10);
      e.textColor = new Color("#7E8AA6");
    }

    w.addSpacer();
    renderFooter(w, fromCache, cachedAt);
    finish(w);
    return;
  }

  // Render groups
  const groups = groupByType(warnings);
  groups.sort((a, b) => priority(b.maxLevel) - priority(a.maxLevel));

  for (let i = 0; i < groups.length; i++) {
    if (i > 0) w.addSpacer(10);
    renderTypeCard(w, groups[i], ui);
  }

  w.addSpacer();
  renderFooter(w, fromCache, cachedAt);

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
      timelineFont: 13,
      timelineFontSmall: 11,
      descFont: 12,
      levelFont: 11,
      rightColWidth: 190,
      cardTitleFont: 13,
      maxTimelineBlocks: 14,
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
      timelineFont: 12,
      timelineFontSmall: 10,
      descFont: 11,
      levelFont: 10,
      rightColWidth: 150,
      cardTitleFont: 12,
      maxTimelineBlocks: 8,
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
    timelineFont: 12,
    timelineFontSmall: 10,
    descFont: 12,
    levelFont: 10,
    rightColWidth: 165,
    cardTitleFont: 12,
    maxTimelineBlocks: 10,
  };
}

/* ================= Card ================= */

function renderTypeCard(w, group, ui) {
  const card = w.addStack();
  card.layoutVertically();
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

  card.addSpacer(10);

  const content = card.addStack();
  content.topAlignContent();

  const left = content.addStack();
  left.layoutVertically();

  content.addSpacer(12);

  const right = content.addStack();
  right.layoutVertically();
  right.size = new Size(ui.rightColWidth, 0);

  // RIGHT: descrições por nível (wrap natural, sem pills/bolas)
  const summaries = buildLevelSummaries(group.items);
  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    if (i > 0) right.addSpacer(10);

    const lvl = right.addText(levelLabel(s.level).toUpperCase());
    lvl.font = Font.boldSystemFont(ui.levelFont);
    lvl.textColor = levelColor(s.level);

    right.addSpacer(4);

    const txt = right.addText(s.text || "");
    txt.font = Font.systemFont(ui.descFont);
    txt.textColor = new Color("#D5DBE7");
  }

  // LEFT: timeline em 2 linhas (início sempre; fim só se diferente do início seguinte)
  const items = [...group.items].sort((a, b) =>
    String(a.start || "").localeCompare(String(b.start || ""))
  );

  const blocks = buildTimelineBlocks(items);
  const shown = blocks.slice(0, ui.maxTimelineBlocks);

  for (let i = 0; i < shown.length; i++) {
    if (i > 0) left.addSpacer(8);

    const b = shown[i];

    // Linha 1: dot + start
    const r1 = left.addStack();
    r1.centerAlignContent();

    const dot = r1.addText("●");
    dot.font = Font.boldSystemFont(ui.timelineFont + 2);
    dot.textColor = levelColor(b.level);

    r1.addSpacer(8);

    const startText = r1.addText(b.startLabel);
    startText.font = Font.systemFont(ui.timelineFont);
    startText.textColor = new Color("#A6B0C3");
    startText.lineLimit = 1; // não queremos wrap aqui, é curto

    // Linha 2 (opcional): end, alinhada com o texto (sem dot)
    if (b.endLabel) {
      const r2 = left.addStack();
      r2.centerAlignContent();
      r2.addSpacer(8 + 18); // indent approx (dot + gap). Ajusta se quiseres.

      const endText = r2.addText(b.endLabel);
      endText.font = Font.systemFont(ui.timelineFontSmall);
      endText.textColor = new Color("#7E8AA6");
      endText.lineLimit = 1;
    }
  }

  if (blocks.length > shown.length) {
    left.addSpacer(6);
    const more = left.addText("+" + (blocks.length - shown.length));
    more.font = Font.systemFont(10);
    more.textColor = new Color("#7E8AA6");
  }
}

/* ================= Timeline blocks ================= */

// Regra: mostrar start; mostrar end só se end != next.start (em ms)
function buildTimelineBlocks(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    const next = (i + 1 < items.length) ? items[i + 1] : null;

    const startMs = safeMs(cur.start);
    const endMs = safeMs(cur.end);
    const nextStartMs = next ? safeMs(next.start) : null;

    const startLabel = fmtStart(cur.start);
    let endLabel = null;

    // mostrar fim se:
    // - for o último, ou
    // - não for igual ao início do próximo
    if (endMs !== null) {
      const shouldShowEnd = (nextStartMs === null) || (endMs !== nextStartMs);
      if (shouldShowEnd) endLabel = "até " + fmtEnd(cur.end);
    }

    out.push({
      level: String(cur.level || "green").toLowerCase(),
      startLabel,
      endLabel
    });
  }
  return out;
}

function safeMs(iso) {
  try {
    const d = new Date(iso);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

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
    const d = new Date(iso);
    // aqui podes decidir se queres repetir o dia no fim; por agora só hora fica mais compacto
    return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* ================= Data shaping ================= */

function groupByType(warnings) {
  const map = {};
  for (let i = 0; i < warnings.length; i++) {
    const w = warnings[i] || {};
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

    if (priority(level) > priority(map[type].maxLevel)) map[type].maxLevel = level;
  }
  return Object.values(map);
}

// Para cada nível: descrição do aviso mais cedo
function buildLevelSummaries(items) {
  const byLevel = {};
  for (let i = 0; i < items.length; i++) {
    const w = items[i];
    const lvl = String(w.level || "").toLowerCase();
    const start = String(w.start || "");
    const txt = normText(w.text);

    if (!byLevel[lvl]) {
      byLevel[lvl] = { level: lvl, text: txt, firstStart: start };
    } else {
      if (start && byLevel[lvl].firstStart && start.localeCompare(byLevel[lvl].firstStart) < 0) {
        byLevel[lvl].firstStart = start;
        byLevel[lvl].text = txt;
      }
      if (!byLevel[lvl].text && txt) byLevel[lvl].text = txt;
    }
  }
  return Object.values(byLevel).sort((a, b) => priority(b.level) - priority(a.level));
}

/* ================= Header pill + footer ================= */

function setTopPill(pill, text, count, level) {
  pill.backgroundColor = levelBg(level);
  text.textColor = levelFg(level);
  text.text = count + " avisos";
}

function renderFooter(w, fromCache, cachedAtIso) {
  const line1 = w.addText("Atualizado " + nowHM());
  line1.font = Font.systemFont(10);
  line1.textColor = new Color("#7E8AA6");

  if (fromCache && cachedAtIso) {
    const line2 = w.addText("Offline · cache " + shortWhen(cachedAtIso));
    line2.font = Font.systemFont(10);
    line2.textColor = new Color("#7E8AA6");
  }
}

function nowHM() {
  return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function shortWhen(iso) {
  try {
    return new Date(iso).toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return "";
  }
}

/* ================= Levels / colors / icons ================= */

function priority(level) {
  if (level === "red") return 4;
  if (level === "orange") return 3;
  if (level === "yellow") return 2;
  if (level === "green") return 1;
  return 0;
}

function getMaxLevel(ws) {
  let max = "green";
  for (let i = 0; i < ws.length; i++) {
    const lvl = String(ws[i]?.level || "green").toLowerCase();
    if (priority(lvl) > priority(max)) max = lvl;
  }
  return max;
}

function levelLabel(l) {
  if (l === "red") return "Vermelho";
  if (l === "orange") return "Laranja";
  if (l === "yellow") return "Amarelo";
  return "Verde";
}

function levelColor(l) {
  if (l === "red") return new Color("#FF6B6B");
  if (l === "orange") return new Color("#FFB86B");
  if (l === "yellow") return new Color("#FFE27A");
  return new Color("#8EF0B2");
}

function levelBg(l) {
  if (l === "red") return new Color("#3B1D1D");
  if (l === "orange") return new Color("#3A2B10");
  if (l === "yellow") return new Color("#3A3610");
  return new Color("#15311F");
}

function levelFg(l) {
  if (l === "red") return new Color("#FFB4B4");
  if (l === "orange") return new Color("#FFD7A1");
  if (l === "yellow") return new Color("#FFF0A6");
  return new Color("#9AF0B5");
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

function normText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/* ================= End ================= */

function finish(w) {
  Script.setWidget(w);
  Script.complete();
}
