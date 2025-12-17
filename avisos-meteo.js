// Avisos IPMA – Widget iOS (Scriptable)
// Layout 2 colunas: timeline à esquerda, descrições à direita
// Fonte: Cloudflare Worker (parsing defensivo)

async function runWidget() {
  const AREA = "PTO";
  const ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  const fam = config.widgetFamily || "medium";
  const ui = uiForFamily(fam);

  const w = new ListWidget();
  w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=" + AREA;

  /* ================= HEADER ================= */

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
    w.addSpacer(4); // mais ar no topo
    const sub = w.addText(ui.subtitleText);
    sub.font = Font.systemFont(ui.subtitleFont);
    sub.textColor = new Color("#A6B0C3");
  }

  w.addSpacer(ui.afterHeaderSpace);

  /* ================= DATA ================= */

  let data;
  try {
    const req = new Request(ENDPOINT);
    req.timeoutInterval = 10;
    data = await req.loadJSON();
  } catch (e) {
    renderError(w, "Erro ao contactar o serviço", e);
    finish(w);
    return;
  }

  // Parsing defensivo
  let warnings = [];
  if (data && typeof data === "object") {
    if (Array.isArray(data.warnings)) {
      warnings = data.warnings;
    } else if (Array.isArray(data)) {
      warnings = data;
    }
  }

  const maxLevel = getMaxLevel(warnings);
  setTopPill(pill, pillText, warnings.length, maxLevel);

  if (!warnings.length) {
    const t = w.addText("Sem avisos relevantes.");
    t.font = Font.systemFont(ui.bodyFont);
    t.textColor = new Color("#D5DBE7");
    finish(w);
    return;
  }

  const groups = groupByType(warnings);
  groups.sort((a, b) => priority(b.maxLevel) - priority(a.maxLevel));

  for (let i = 0; i < groups.length; i++) {
    if (i > 0) w.addSpacer(10);
    renderTypeCard(w, groups[i], ui);
  }

  w.addSpacer();
  renderFooter(w);
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
  };
}

/* ================= CARD RENDER ================= */

function renderTypeCard(w, group, ui) {
  const card = w.addStack();
  card.layoutVertically();
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");

  // Header da categoria
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

  // Conteúdo 2 colunas
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

  items.forEach((it, i) => {
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
}

/* ================= DATA ================= */

function groupByType(warnings) {
  const map = {};
  warnings.forEach(w => {
    if (!map[w.type]) {
      map[w.type] = { type: w.type, items: [], maxLevel: "green" };
    }
    map[w.type].items.push(w);
    if (priority(w.level) > priority(map[w.type].maxLevel)) {
      map[w.type].maxLevel = w.level;
    }
  });
  return Object.values(map);
}

function buildLevelSummaries(items) {
  const map = {};
  items.forEach(w => {
    if (!map[w.level]) map[w.level] = w;
  });
  return Object.values(map);
}

/* ================= HEADER PILL ================= */

function setTopPill(pill, text, count, level) {
  pill.backgroundColor = levelBg(level);
  text.textColor = levelFg(level);
  text.text = count + " avisos";
}

/* ================= FOOTER ================= */

function renderFooter(w) {
  const f = w.addText(
    "Atualizado " +
      new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  );
  f.font = Font.systemFont(10);
  f.textColor = new Color("#7E8AA6");
}

/* ================= ERROR ================= */

function renderError(w, title, err) {
  const t = w.addText(title);
  t.font = Font.boldSystemFont(12);
  t.textColor = Color.red();

  if (err) {
    w.addSpacer(6);
    const d = w.addText(String(err));
    d.font = Font.systemFont(10);
    d.textColor = new Color("#A6B0C3");
    d.lineLimit = 3;
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

/* ================= LEVELS ================= */

function priority(l) {
  return { green: 1, yellow: 2, orange: 3, red: 4 }[l] || 0;
}

function getMaxLevel(ws) {
  return ws.reduce(
    (m, w) => (priority(w.level) > priority(m) ? w.level : m),
    "green"
  );
}

function levelLabel(l) {
  return { yellow: "Amarelo", orange: "Laranja", red: "Vermelho" }[l] || "Aviso";
}

function levelColor(l) {
  return new Color(
    { yellow: "#FFE27A", orange: "#FFB86B", red: "#FF6B6B" }[l] || "#CCCCCC"
  );
}

function levelBg(l) {
  return new Color(
    { yellow: "#3A3610", orange: "#3A2B10", red: "#3B1D1D" }[l] || "#15311F"
  );
}

function levelFg(l) {
  return new Color(
    { yellow: "#FFF0A6", orange: "#FFD7A1", red: "#FFB4B4" }[l] || "#FFFFFF"
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

runWidget();
