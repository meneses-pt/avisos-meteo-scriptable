// Avisos Meteo – Widget iOS (Scriptable)
// 2 colunas por categoria: timeline à esquerda + descrições/resumo à direita
// Pode consumir: (A) Cloudflare Worker ou (B) IPMA direto

function runWidget() {
  var AREA = "PTO";

  // === Escolhe a fonte ===
  // true  -> usa o teu Worker (recomendado: cache + controlo)
  // false -> vai direto ao IPMA (sem Worker)
  var USE_WORKER = true;

  var ENDPOINT = USE_WORKER
    ? ("https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA)
    : "https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json";

  var fam = (typeof config !== "undefined" && config.widgetFamily) ? config.widgetFamily : "medium";
  var ui = uiForFamily(fam);

  var w = new ListWidget();
  w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=" + AREA;

  // Header: título + pill (apenas "X avisos", com cor do máximo)
  var header = w.addStack();
  header.centerAlignContent();

  var title = header.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(ui.titleFont);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 1;
  if (title.minimumScaleFactor !== undefined) title.minimumScaleFactor = 0.65;

  header.addSpacer();

  var statusPill = header.addStack();
  statusPill.setPadding(4, 8, 4, 8);
  statusPill.cornerRadius = 10;

  var statusText = statusPill.addText("…");
  statusText.font = Font.boldSystemFont(ui.pillFont);

  if (ui.showSubtitle) {
    w.addSpacer(2);
    var subtitle = w.addText(ui.subtitleText);
    subtitle.font = Font.systemFont(ui.subtitleFont);
    subtitle.textColor = new Color("#A6B0C3");
    subtitle.lineLimit = 1;
    if (subtitle.minimumScaleFactor !== undefined) subtitle.minimumScaleFactor = 0.7;
  }

  w.addSpacer(ui.afterHeaderSpace);

  var req = new Request(ENDPOINT);
  req.timeoutInterval = 10;

  req.loadJSON()
    .then(function (raw) {
      // Normalizar para formato interno:
      // [{type, level, start, end, text}]
      var warnings = USE_WORKER ? normalizeFromWorker(raw) : normalizeFromIPMA(raw, AREA);

      var originalCount = warnings.length;
      var maxLevel = getMaxLevelFromWarnings(warnings);
      applyStatusPillCountOnly(statusPill, statusText, maxLevel, originalCount);

      if (!warnings.length) {
        renderEmptyState(w, ui);
        w.addSpacer();
        renderFooter(w);
        finish(w);
        return;
      }

      // Agrupar por tipo
      var groups = groupByType(warnings);

      // Ordenar tipos por gravidade máxima
      groups.sort(function (a, b) {
        var pa = priority(a.maxLevel);
        var pb = priority(b.maxLevel);
        if (pb !== pa) return pb - pa;
        return a.type.localeCompare(b.type);
      });

      // Render: por tamanho
      var shownTypes = Math.min(groups.length, ui.maxTypes);
      for (var gi = 0; gi < shownTypes; gi++) {
        if (gi > 0) w.addSpacer(ui.betweenCardsSpace);
        renderTypeTwoColumns(w, groups[gi], ui);
      }

      if (groups.length > shownTypes) {
        w.addSpacer(ui.betweenCardsSpace);
        renderHiddenTypesSummary(w, groups, shownTypes);
      }

      w.addSpacer();
      renderFooter(w);

      w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
      finish(w);
    })
    .catch(function (err) {
      statusPill.backgroundColor = new Color("#3B1D1D");
      statusText.textColor = new Color("#FFB4B4");
      statusText.text = "Erro";

      var t = w.addText("Erro ao obter avisos.");
      t.font = Font.systemFont(ui.bodyFont);
      t.textColor = new Color("#FFFFFF");

      w.addSpacer(6);

      var e = w.addText(String(err));
      e.font = Font.systemFont(10);
      e.textColor = new Color("#A6B0C3");
      e.lineLimit = 3;

      w.addSpacer();
      renderFooter(w);
      finish(w);
    });
}

// ---------------- Fonte: normalização ----------------

function normalizeFromWorker(raw) {
  var arr = (raw && raw.warnings) ? raw.warnings : [];
  // já vem no formato desejado
  return arr.map(function (w) {
    return {
      type: w.type || "Aviso",
      level: w.level || "green",
      start: w.start,
      end: w.end,
      text: w.text || ""
    };
  });
}

function normalizeFromIPMA(raw, area) {
  // IPMA: array de objetos com idAreaAviso, awarenessTypeName, awarenessLevelID, startTime, endTime, text
  var out = [];
  for (var i = 0; i < (raw ? raw.length : 0); i++) {
    var w = raw[i];
    if (!w) continue;
    if (String(w.idAreaAviso || "") !== String(area)) continue;

    // filtrar "green" (podes remover se quiseres ver tudo)
    var lvl = String(w.awarenessLevelID || "green").toLowerCase();
    if (lvl === "green") continue;

    out.push({
      type: w.awarenessTypeName || "Aviso",
      level: lvl,
      start: w.startTime,
      end: w.endTime,
      text: w.text || ""
    });
  }
  return out;
}

// ---------------- UI ----------------

function uiForFamily(fam) {
  if (fam === "small") {
    return {
      pad: 10,
      titleFont: 14,
      subtitleFont: 10,
      pillFont: 10,
      bodyFont: 12,
      showSubtitle: false,
      subtitleText: "",
      afterHeaderSpace: 8,
      betweenCardsSpace: 8,
      maxTypes: 1,
      maxTimelineRows: 6,
      cardTitleFont: 12,
      descFont: 10,
      timelineFont: 10,
      showDescriptions: false,
      rightColWidth: 120,
    };
  }
  if (fam === "large") {
    return {
      pad: 14,
      titleFont: 16,
      subtitleFont: 11,
      pillFont: 11,
      bodyFont: 13,
      showSubtitle: true,
      subtitleText: "Porto · próximos avisos",
      afterHeaderSpace: 10,
      betweenCardsSpace: 10,
      maxTypes: 2,
      maxTimelineRows: 14,
      cardTitleFont: 13,
      descFont: 10,
      timelineFont: 11,
      showDescriptions: true,
      rightColWidth: 170,
    };
  }
  // medium: é aqui que o 2-colunas brilha
  return {
    pad: 10,
    titleFont: 14,
    subtitleFont: 10,
    pillFont: 10,
    bodyFont: 13,
    showSubtitle: true,
    subtitleText: "Porto · avisos",
    afterHeaderSpace: 8,
    betweenCardsSpace: 9,
    maxTypes: 1,
    maxTimelineRows: 10,
    cardTitleFont: 12,
    descFont: 10,
    timelineFont: 10,
    showDescriptions: true,
    rightColWidth: 155,
  };
}

function renderEmptyState(w, ui) {
  var box = w.addStack();
  box.layoutVertically();
  box.setPadding(12, 12, 12, 12);
  box.cornerRadius = 16;
  box.backgroundColor = new Color("#111B2E");

  var row = box.addStack();
  row.centerAlignContent();

  var icon = row.addText("✅");
  icon.font = Font.systemFont(16);
  row.addSpacer(8);

  var txtStack = row.addStack();
  txtStack.layoutVertically();

  var t1 = txtStack.addText("Sem avisos");
  t1.font = Font.boldSystemFont(ui.bodyFont);
  t1.textColor = new Color("#FFFFFF");
  t1.lineLimit = 1;

  var t2 = txtStack.addText("Nada relevante previsto para já.");
  t2.font = Font.systemFont(ui.subtitleFont);
  t2.textColor = new Color("#A6B0C3");
  t2.lineLimit = 2;
}

function renderFooter(w) {
  var footer = w.addStack();
  footer.centerAlignContent();

  var updated = footer.addText("Atualizado " + fmtTime(new Date()));
  updated.font = Font.systemFont(10);
  updated.textColor = new Color("#7E8AA6");

  footer.addSpacer();

  var hint = footer.addText("Abrir IPMA ↗");
  hint.font = Font.systemFont(10);
  hint.textColor = new Color("#7E8AA6");
}

function renderHiddenTypesSummary(w, groups, startIdx) {
  var box = w.addStack();
  box.layoutVertically();
  box.setPadding(10, 12, 10, 12);
  box.cornerRadius = 16;
  box.backgroundColor = new Color("#0F1930");

  var t = box.addText("Outros:");
  t.font = Font.boldSystemFont(11);
  t.textColor = new Color("#A6B0C3");

  box.addSpacer(6);

  var line = "";
  for (var j = startIdx; j < groups.length; j++) {
    if (line.length > 0) line += " · ";
    line += groups[j].type + " (" + groups[j].items.length + ")";
  }

  var more = box.addText(line);
  more.font = Font.systemFont(10);
  more.textColor = new Color("#7E8AA6");
  more.lineLimit = 2;
}

// ---------------- Render 2 colunas ----------------

function renderTypeTwoColumns(w, group, ui) {
  var card = w.addStack();
  card.layoutVertically();
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");

  // Header do tipo
  var top = card.addStack();
  top.centerAlignContent();

  var icon = top.addText(iconForType(group.type));
  icon.font = Font.systemFont(14);

  top.addSpacer(6);

  var name = top.addText(group.type);
  name.font = Font.boldSystemFont(ui.cardTitleFont);
  name.textColor = new Color("#FFFFFF");
  name.lineLimit = 1;
  if (name.minimumScaleFactor !== undefined) name.minimumScaleFactor = 0.75;

  top.addSpacer();

  // chip do max do tipo (mantém-se útil)
  var chip = top.addStack();
  chip.setPadding(3, 8, 3, 8);
  chip.cornerRadius = 10;
  var style = colorsForLevel(String(group.maxLevel || "").toLowerCase());
  chip.backgroundColor = style.bg;
  var chipText = chip.addText(levelLabel(String(group.maxLevel || "").toLowerCase()));
  chipText.font = Font.boldSystemFont(ui.pillFont);
  chipText.textColor = style.fg;

  card.addSpacer(10);

  // Conteúdo: 2 colunas
  var content = card.addStack();
  content.topAlignContent();

  var left = content.addStack();
  left.layoutVertically();

  content.addSpacer(10);

  var right = content.addStack();
  right.layoutVertically();
  right.size = new Size(ui.rightColWidth, 0);

  // RIGHT: descrições por nível (uma por nível: a que acontece primeiro)
  if (ui.showDescriptions) {
    var levelSummaries = buildLevelSummaries(group.items);
    // ordenar por gravidade desc e depois por inicio
    levelSummaries.sort(function (a, b) {
      var pa = priority(String(a.level || "").toLowerCase());
      var pb = priority(String(b.level || "").toLowerCase());
      if (pb !== pa) return pb - pa;
      return String(a.firstStart || "").localeCompare(String(b.firstStart || ""));
    });

    for (var d = 0; d < levelSummaries.length; d++) {
      var txt = levelSummaries[d].text ? levelSummaries[d].text : "";
      if (!txt) continue;

      if (d > 0) right.addSpacer(6);

      var rrow = right.addStack();
      rrow.centerAlignContent();

      var lvl = String(levelSummaries[d].level || "").toLowerCase();

      var dot = rrow.addText("●");
      dot.font = Font.boldSystemFont(ui.descFont + 2);
      dot.textColor = dotColor(lvl);

      rrow.addSpacer(6);

      var line = rrow.addText(txt);
      line.font = Font.systemFont(ui.descFont);
      line.textColor = new Color("#D5DBE7");
      line.lineLimit = 2;
      if (line.minimumScaleFactor !== undefined) line.minimumScaleFactor = 0.6;
    }
  }

  // LEFT: timeline
  var items = group.items.slice(0);
  items.sort(function (a, b) {
    return String(a.start || "").localeCompare(String(b.start || ""));
  });

  var shown = Math.min(items.length, ui.maxTimelineRows);
  for (var i = 0; i < shown; i++) {
    if (i > 0) left.addSpacer(6);
    renderTimelineRowLeft(left, items[i], ui);
  }

  if (items.length > shown) {
    left.addSpacer(8);
    var more = left.addText("+" + (items.length - shown) + " intervalos");
    more.font = Font.systemFont(10);
    more.textColor = new Color("#7E8AA6");
  }
}

function renderTimelineRowLeft(parent, warn, ui) {
  var row = parent.addStack();
  row.centerAlignContent();

  var lvl = String(warn.level || "").toLowerCase();

  var dot = row.addText("●");
  dot.font = Font.boldSystemFont(ui.timelineFont + 2);
  dot.textColor = dotColor(lvl);

  row.addSpacer(8);

  var time = row.addText(timelinePeriodCompact(warn.start, warn.end));
  time.font = Font.systemFont(ui.timelineFont);
  time.textColor = new Color("#A6B0C3");
  time.lineLimit = 1;
  if (time.minimumScaleFactor !== undefined) time.minimumScaleFactor = 0.6;
}

// ---------------- Data shaping ----------------

function groupByType(warnings) {
  var map = {};
  for (var i = 0; i < warnings.length; i++) {
    var w = warnings[i];
    var type = w.type || "Aviso";

    if (!map[type]) map[type] = { type: type, items: [], maxLevel: "green" };
    map[type].items.push(w);

    var lvl = String(w.level || "").toLowerCase();
    if (priority(lvl) > priority(map[type].maxLevel)) map[type].maxLevel = lvl;
  }

  var out = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    out.push(map[k]);
  }
  return out;
}

// níveis únicos + descrição: escolhe a descrição do aviso que começa mais cedo para cada nível
function buildLevelSummaries(items) {
  var byLevel = {};
  for (var i = 0; i < items.length; i++) {
    var w = items[i];
    var lvl = String(w.level || "").toLowerCase();
    if (lvl === "green") continue;

    var start = String(w.start || "");
    var txt = normText(w.text);

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

  var out = [];
  for (var k in byLevel) {
    if (!byLevel.hasOwnProperty(k)) continue;
    out.push(byLevel[k]);
  }
  return out;
}

// ---------------- Top pill (count only) ----------------

function applyStatusPillCountOnly(pill, textNode, maxLevel, count) {
  var style = colorsForLevel(String(maxLevel || "").toLowerCase());
  pill.backgroundColor = count ? style.bg : new Color("#15311F");
  textNode.textColor = count ? style.fg : new Color("#9AF0B5");
  textNode.text = count + " avisos";
}

// ---------------- Time formatting (mais compacto) ----------------

function timelinePeriodCompact(startIso, endIso) {
  var s = new Date(startIso);
  var e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return String(startIso || "") + " – " + String(endIso || "");

  var sameDay = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();

  var sH = hhmm(s);
  var eH = hhmm(e);

  if (sameDay) return dowShort(s) + " " + sH + "–" + eH;
  return dowShort(s) + " " + sH + "–" + dowShort(e) + " " + eH;
}

function hhmm(d) {
  try { return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}

function dowShort(d) {
  try { return d.toLocaleDateString("pt-PT", { weekday: "short" }); }
  catch (e) { return ""; }
}

function fmtTime(d) {
  try { return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
}

// ---------------- Levels / colors / icons ----------------

function getMaxLevelFromWarnings(warnings) {
  var max = "green";
  for (var i = 0; i < warnings.length; i++) {
    var lvl = String(warnings[i].level || "").toLowerCase();
    if (priority(lvl) > priority(max)) max = lvl;
  }
  return max;
}

function priority(level) {
  if (level === "red") return 4;
  if (level === "orange") return 3;
  if (level === "yellow") return 2;
  if (level === "green") return 1;
  return 0;
}

function colorsForLevel(level) {
  if (level === "red") return { bg: new Color("#3B1D1D"), fg: new Color("#FFB4B4") };
  if (level === "orange") return { bg: new Color("#3A2B10"), fg: new Color("#FFD7A1") };
  if (level === "yellow") return { bg: new Color("#3A3610"), fg: new Color("#FFF0A6") };
  return { bg: new Color("#15311F"), fg: new Color("#9AF0B5") };
}

function dotColor(level) {
  if (level === "red") return new Color("#FF6B6B");
  if (level === "orange") return new Color("#FFB86B");
  if (level === "yellow") return new Color("#FFE27A");
  return new Color("#8EF0B2");
}

function levelLabel(level) {
  if (level === "red") return "Vermelho";
  if (level === "orange") return "Laranja";
  if (level === "yellow") return "Amarelo";
  if (level === "green") return "Verde";
  return "Aviso";
}

function iconForType(type) {
  var t = String(type || "").toLowerCase();
  if (t.indexOf("agitação") >= 0 || t.indexOf("mar") >= 0) return "🌊";
  if (t.indexOf("vento") >= 0) return "💨";
  if (t.indexOf("precip") >= 0 || t.indexOf("chuva") >= 0) return "🌧️";
  if (t.indexOf("trovo") >= 0) return "⛈️";
  if (t.indexOf("nevo") >= 0) return "🌫️";
  if (t.indexOf("frio") >= 0) return "🥶";
  if (t.indexOf("quente") >= 0 || t.indexOf("calor") >= 0) return "🥵";
  return "⚠️";
}

function normText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function finish(w) {
  Script.setWidget(w);
  Script.complete();
}

runWidget();
