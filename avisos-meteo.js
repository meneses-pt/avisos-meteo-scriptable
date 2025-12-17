// Avisos Meteo – Widget iOS (Scriptable)
// 2 colunas por categoria, descrições editoriais, timeline legível
// Fonte: Cloudflare Worker

function runWidget() {
  var AREA = "PTO";
  var ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  var fam = config.widgetFamily || "medium";
  var ui = uiForFamily(fam);

  var w = new ListWidget();
  w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=" + AREA;

  /* ================= HEADER ================= */

  var header = w.addStack();
  header.centerAlignContent();

  var title = header.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(ui.titleFont);
  title.textColor = Color.white();
  title.lineLimit = 1;
  title.minimumScaleFactor = 0.7;

  header.addSpacer();

  var pill = header.addStack();
  pill.setPadding(4, 10, 4, 10);
  pill.cornerRadius = 10;

  var pillText = pill.addText("…");
  pillText.font = Font.boldSystemFont(ui.pillFont);

  if (ui.showSubtitle) {
    w.addSpacer(2);
    var sub = w.addText(ui.subtitleText);
    sub.font = Font.systemFont(ui.subtitleFont);
    sub.textColor = new Color("#A6B0C3");
  }

  w.addSpacer(ui.afterHeaderSpace);

  /* ================= DATA ================= */

  var req = new Request(ENDPOINT);
  req.loadJSON().then(function (data) {
    var warnings = data.warnings || [];

    var maxLevel = getMaxLevel(warnings);
    setTopPill(pill, pillText, warnings.length, maxLevel);

    if (!warnings.length) {
      w.addText("Sem avisos relevantes.")
        .font = Font.systemFont(ui.bodyFont);
      finish(w);
      return;
    }

    var groups = groupByType(warnings);
    groups.sort((a, b) => priority(b.maxLevel) - priority(a.maxLevel));

    renderType(w, groups[0], ui); // medium: só 1 tipo

    w.addSpacer();
    renderFooter(w);
    finish(w);
  });
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
      afterHeaderSpace: 12,
      timelineFont: 13,
      descFont: 12,
      levelFont: 11,
      rightColWidth: 180
    };
  }
  return {
    pad: 10,
    titleFont: 14,
    subtitleFont: 10,
    pillFont: 11,
    bodyFont: 13,
    showSubtitle: true,
    subtitleText: "Porto · avisos",
    afterHeaderSpace: 10,
    timelineFont: 12,
    descFont: 12,
    levelFont: 10,
    rightColWidth: 160
  };
}

/* ================= TYPE RENDER ================= */

function renderType(w, group, ui) {
  var card = w.addStack();
  card.layoutVertically();
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");

  // Title
  var t = card.addText(group.type);
  t.font = Font.boldSystemFont(13);
  t.textColor = Color.white();

  card.addSpacer(10);

  var content = card.addStack();

  /* LEFT: TIMELINE */
  var left = content.addStack();
  left.layoutVertically();

  content.addSpacer(12);

  /* RIGHT: DESCRIPTIONS */
  var right = content.addStack();
  right.layoutVertically();
  right.size = new Size(ui.rightColWidth, 0);

  // Descriptions grouped by level
  var summaries = levelSummaries(group.items);
  summaries.forEach(function (s) {
    var lvl = right.addText(levelLabel(s.level).toUpperCase());
    lvl.font = Font.boldSystemFont(ui.levelFont);
    lvl.textColor = levelColor(s.level);

    right.addSpacer(2);

    var txt = right.addText(s.text);
    txt.font = Font.systemFont(ui.descFont);
    txt.textColor = new Color("#D5DBE7");

    right.addSpacer(8);
  });

  // Timeline
  group.items.forEach(function (w, i) {
    if (i > 0) left.addSpacer(6);

    var row = left.addStack();
    row.centerAlignContent();

    var dot = row.addText("●");
    dot.font = Font.boldSystemFont(ui.timelineFont + 2);
    dot.textColor = levelColor(w.level);

    row.addSpacer(8);

    var time = row.addText(period(w.start, w.end));
    time.font = Font.systemFont(ui.timelineFont);
    time.textColor = new Color("#A6B0C3");
  });
}

/* ================= HELPERS ================= */

function setTopPill(pill, text, count, level) {
  pill.backgroundColor = levelBg(level);
  text.textColor = levelFg(level);
  text.text = count + " avisos";
}

function renderFooter(w) {
  var f = w.addText("Atualizado " + new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
  f.font = Font.systemFont(10);
  f.textColor = new Color("#7E8AA6");
}

function groupByType(ws) {
  var m = {};
  ws.forEach(w => {
    if (!m[w.type]) m[w.type] = { type: w.type, items: [], maxLevel: "green" };
    m[w.type].items.push(w);
    if (priority(w.level) > priority(m[w.type].maxLevel)) m[w.type].maxLevel = w.level;
  });
  return Object.values(m);
}

function levelSummaries(items) {
  var m = {};
  items.forEach(w => {
    if (!m[w.level]) m[w.level] = w;
  });
  return Object.values(m);
}

function period(s, e) {
  var sd = new Date(s), ed = new Date(e);
  return sd.toLocaleDateString("pt-PT", { weekday: "short" }) +
    " " + sd.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) +
    "–" + ed.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

/* ================= COLORS ================= */

function priority(l) { return { green: 1, yellow: 2, orange: 3, red: 4 }[l] || 0; }
function getMaxLevel(ws) { return ws.reduce((m, w) => priority(w.level) > priority(m) ? w.level : m, "green"); }
function levelLabel(l) { return { yellow: "Amarelo", orange: "Laranja", red: "Vermelho" }[l] || "Aviso"; }
function levelColor(l) { return { yellow: "#FFE27A", orange: "#FFB86B", red: "#FF6B6B" }[l] ? new Color({ yellow: "#FFE27A", orange: "#FFB86B", red: "#FF6B6B" }[l]) : Color.gray(); }
function levelBg(l) { return { yellow: "#3A3610", orange: "#3A2B10", red: "#3B1D1D" }[l] ? new Color({ yellow: "#3A3610", orange: "#3A2B10", red: "#3B1D1D" }[l]) : new Color("#15311F"); }
function levelFg(l) { return { yellow: "#FFF0A6", orange: "#FFD7A1", red: "#FFB4B4" }[l] ? new Color({ yellow: "#FFF0A6", orange: "#FFD7A1", red: "#FFB4B4" }[l]) : Color.white(); }

function finish(w) {
  Script.setWidget(w);
  Script.complete();
}

runWidget();
