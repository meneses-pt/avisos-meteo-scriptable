// Avisos IPMA – Widget iOS (Scriptable)
// Cloudflare Worker + cache local + timeout curto (evita "Received timeout")

async function runWidget() {
  const AREA = "PTO";
  const ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  const fam = config.widgetFamily || "medium";
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

  // 1) tenta carregar cache primeiro (para ter algo SEMPRE rápido)
  let cached = null;
  if (fm.fileExists(cachePath)) {
    try {
      cached = JSON.parse(fm.readString(cachePath));
    } catch (_) {
      cached = null;
    }
  }

  // 2) tenta buscar online, com timeout curto; se falhar, usa cache
  let data = null;
  try {
    const req = new Request(ENDPOINT);
    req.timeoutInterval = 5; // <= importante para widgets
    req.headers = { "Accept": "application/json" };
    data = await req.loadJSON();

    // valida e guarda cache
    if (data && typeof data === "object" && Array.isArray(data.warnings)) {
      fm.writeString(cachePath, JSON.stringify({
        savedAt: new Date().toISOString(),
        payload: data
      }));
    }
  } catch (e) {
    // falha de rede/timeout -> data continua null
  }

  // escolher fonte final (preferir online; senão cache)
  let payload = null;
  let isFromCache = false;

  if (data && Array.isArray(data.warnings)) {
    payload = data;
  } else if (cached && cached.payload && Array.isArray(cached.payload.warnings)) {
    payload = cached.payload;
    isFromCache = true;
  } else {
    payload = { warnings: [] };
  }

  const warnings = payload.warnings || [];

  // pill topo
  const maxLevel = getMaxLevel(warnings);
  setTopPill(pill, pillText, warnings.length, maxLevel);

  if (!warnings.length) {
    const t = w.addText("Sem avisos relevantes.");
    t.font = Font.systemFont(ui.bodyFont);
    t.textColor = new Color("#D5DBE7");

    if (isFromCache && cached && cached.savedAt) {
      w.addSpacer(6);
      const c = w.addText("Offline · cache " + shortWhen(cached.savedAt));
      c.font = Font.systemFont(10);
      c.textColor = new Color("#7E8AA6");
    }

    finish(w);
    return;
  }

  // render cards
  const groups = groupByType(warnings);
  groups.sort((a, b) => priority(b.maxLevel) - priority(a.maxLevel));

  for (let i = 0; i < groups.length; i++) {
    if (i > 0) w.addSpacer(10);
    renderTypeCard(w, groups[i], ui);
  }

  w.addSpacer();

  // footer + cache info
  renderFooter(w, isFromCache, cached ? cached.savedAt : null);

  // refresh (não garante, mas ajuda)
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

  finish(w);
}

/* ================= UI CONFIG ================= */

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
      descFont: 12,
      levelFont: 11,
      rightColWidth: 190,
      cardTitleFont: 13,
    };
  }

  // medium (default)
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
    descFont: 12,
    levelFont: 10,
    rightColWidth: 165,
    cardTitleFont: 12,
  };
}

/* ================= CARD RENDER ================= */

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

  // RIGHT – descrições por nível (wrap natural)
  const summaries = buildLevelSummaries(group.items);
  summaries.forEach((s, idx) => {
    if (idx > 0) right.addSpacer(10);

    const lvl = right.addText(levelLabel(s.level).toUpperCase());
    lvl.font = Font.boldSystemFont(ui.levelFont);
    lvl.textColor = levelColor(s.level);

    right.addSpacer(4);

    const txt = right.addText(s.text || "");
    txt.font = Font.systemFont(ui.descFont);
    txt.textColor = new Color("#D5DBE7");
  });

  // LEFT – timeline
  const items = [...group.items].sort((a, b) =>
    String(a.start || "").localeCompare(String(b.start || ""))
  );

  // limitar um pouco para garantir performance (se houver muitos)
  const MAX_ROWS = (config.widgetFamily === "large") ? 14 : 10;

  items.slice(0, MAX_ROWS).forEach((it, i) => {
    if (i > 0) left.addSpacer(6);

    const row = left.addStack();
    row.centerAlignContent();

    const dot = row.addText("●");
    dot.font = Font.boldSystemFont(ui.timelineFont + 2);
    dot.textColor = levelColor(it.level);

    row.addSpacer(8);

    const time = row.addText(formatPeriod(it.start, it.end));
    time.font = Font.systemFont(ui.timelineFont);
    time.textColor = new Color("#A6B0C3");
  });

  if (items.length > MAX_ROWS) {
    left.addSpacer(6);
    const more = left.addText("+" + (items.length - MAX_ROWS));
    more.font = Font.systemFont(10);
    more.textColor = new Color("#7E8AA6");
  }
}

/* ================= DATA ================= */

function groupByType(warnings) {
  const map = {};
  warnings.forEach(w => {
    const type = w.type || "Aviso";
    const level = (w.level || "green").toLowerCase();

    if (!map[type]) map[type] = { type, items: [], maxLevel: "green" };
    map[type].items.push({
      type,
      level,
      start: w.start,
      end: w.end,
      text: w.text || ""
    });

    if (priority(level) > priority(map[type].maxLevel)) map[type].maxLevel = level;
  });
  return Object.values(map);
}

function buildLevelSummaries(items) {
  const map = {};
  // escolhe a primeira ocorrência por nível (normalmente a mais cedo se já vier ordenado;
  // se quiseres garantir, posso ordenar por start antes)
  items.forEach(w => {
    if (!map[w.level]) map[w.level] = w;
  });
  return Object.values(map).sort((a, b) => priority(b.level) - priority(a.level));
}

/* ================= HEADER PILL ================= */

function setTopPill(pill, text, count, level) {
  pill.backgroundColor = levelBg(level);
  text.textColor = levelFg(level);
  text.text = count + " avisos";
}

/* ================= FOOTER ================= */

function renderFooter(w, isFromCache, savedAtIso) {
  const line1 = w.addText("Atualizado " + new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
  line1.font = Font.systemFont(10);
  line1.textColor = new Color("#7E8AA6");

  if (isFromCache && savedAtIso) {
    const line2 = w.addText("Offline · cache " + shortWhen(savedAtIso));
    line2.font = Font.systemFont(10);
    line2.textColor = new Color("#7E8AA6");
  }
}

function shortWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* ================= TIME ================= */

function formatPeriod(startIso, endIso) {
  try {
    const s = new Date(startIso);
    const e = new Date(endIso);
    return (
      s.toLocaleDateString("pt-PT", { weekday: "short" }) +
      " " +
      s.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) +
      "–" +
      e.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "";
  }
}

/* ================= LEVELS / COLORS ================= */

function priority(l) {
  return { green: 1, yellow: 2, orange: 3, red: 4 }[l] || 0;
}

function getMaxLevel(ws) {
  return ws.reduce(
    (m, w) => (priority((w.level || "green").toLowerCase()) > priority(m) ? (w.level || "green").toLowerCase() : m),
    "green"
  );
}

function levelLabel(l) {
  return { yellow: "Amarelo", orange: "Laranja", red: "Vermelho", green: "Verde" }[l] || "Aviso";
}

function levelColor(l) {
  return new Color(
    { yellow: "#FFE27A", orange: "#FFB86B", red: "#FF6B6B", green: "#8EF0B2" }[l] || "#CCCCCC"
  );
}

function levelBg(l) {
  return new Color(
    { yellow: "#3A3610", orange: "#3A2B10", red: "#3B1D1D", green: "#15311F" }[l] || "#15311F"
  );
}

function levelFg(l) {
  return new Color(
    { yellow: "#FFF0A6", orange: "#FFD7A1", red: "#FFB4B4", green: "#9AF0B5" }[l] || "#FFFFFF"
  );
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

await runWidget();
