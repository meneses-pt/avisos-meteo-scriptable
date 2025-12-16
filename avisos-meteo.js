// Avisos Meteo – Widget iOS (Scriptable) | UI moderna + agrupamento por tipo

function runWidget() {
  var AREA = "PTO";
  var ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  var w = new ListWidget();
  w.setPadding(14, 14, 14, 14);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=PTO";

  // Header
  var header = w.addStack();
  header.centerAlignContent();

  var left = header.addStack();
  left.layoutVertically();

  var title = left.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(16);
  title.textColor = new Color("#FFFFFF");

  var subtitle = left.addText("Porto · Próximos avisos");
  subtitle.font = Font.systemFont(11);
  subtitle.textColor = new Color("#A6B0C3");

  header.addSpacer();

  var statusPill = header.addStack();
  statusPill.setPadding(4, 8, 4, 8);
  statusPill.cornerRadius = 10;

  var statusText = statusPill.addText("…");
  statusText.font = Font.boldSystemFont(11);

  w.addSpacer(10);

  var req = new Request(ENDPOINT);
  req.timeoutInterval = 10;

  req.loadJSON()
    .then(function (data) {
      var warnings = (data && data.warnings) ? data.warnings : [];

      var maxLevel = getMaxLevel(warnings);
      applyStatusPill(statusPill, statusText, maxLevel, warnings.length);

      if (!warnings.length) {
        renderEmptyState(w);
        finish(w);
        return;
      }

      // Agrupar por tipo
      var groups = groupByType(warnings);

      // Ordenar tipos por “gravidade máxima”, depois por nome
      groups.sort(function (a, b) {
        var pa = priority(a.maxLevel);
        var pb = priority(b.maxLevel);
        if (pb !== pa) return pb - pa;
        return a.type.localeCompare(b.type);
      });

      // Limites por tamanho do widget
      var fam = (config && config.widgetFamily) ? config.widgetFamily : "medium";
      var maxTypes = fam === "large" ? 3 : 2;       // quantos tipos mostramos
      var maxItemsPerType = fam === "large" ? 5 : 3; // quantos timeframes por tipo

      for (var gi = 0; gi < Math.min(groups.length, maxTypes); gi++) {
        if (gi > 0) w.addSpacer(10);
        renderTypeCard(w, groups[gi], maxItemsPerType, fam);
      }

      w.addSpacer(10);

      // Footer
      var footer = w.addStack();
      footer.centerAlignContent();

      var updated = footer.addText("Atualizado " + fmtTime(new Date()));
      updated.font = Font.systemFont(10);
      updated.textColor = new Color("#7E8AA6");

      footer.addSpacer();

      var hint = footer.addText("Abrir IPMA ↗");
      hint.font = Font.systemFont(10);
      hint.textColor = new Color("#7E8AA6");

      w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

      finish(w);
    })
    .catch(function (err) {
      statusPill.backgroundColor = new Color("#3B1D1D");
      statusText.textColor = new Color("#FFB4B4");
      statusText.text = "Erro";

      var t = w.addText("Não foi possível obter avisos.");
      t.font = Font.systemFont(13);
      t.textColor = new Color("#FFFFFF");
      w.addSpacer(6);

      var e = w.addText(String(err));
      e.font = Font.systemFont(10);
      e.textColor = new Color("#A6B0C3");
      e.lineLimit = 3;

      finish(w);
    });
}

function renderEmptyState(w) {
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
  t1.font = Font.boldSystemFont(14);
  t1.textColor = new Color("#FFFFFF");

  var t2 = txtStack.addText("Nada relevante previsto para já.");
  t2.font = Font.systemFont(11);
  t2.textColor = new Color("#A6B0C3");
}

function renderTypeCard(w, group, maxItemsPerType, fam) {
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
  name.font = Font.boldSystemFont(13);
  name.textColor = new Color("#FFFFFF");

  top.addSpacer();

  var chip = top.addStack();
  chip.setPadding(3, 8, 3, 8);
  chip.cornerRadius = 10;

  var chipStyle = colorsForLevel(group.maxLevel);
  chip.backgroundColor = chipStyle.bg;

  var chipText = chip.addText(levelLabel(group.maxLevel));
  chipText.font = Font.boldSystemFont(11);
  chipText.textColor = chipStyle.fg;

  card.addSpacer(8);

  // Lista de timeframes (compacta)
  var items = group.items.slice(0, maxItemsPerType);
  for (var i = 0; i < items.length; i++) {
    if (i > 0) card.addSpacer(6);
    renderTimeRow(card, items[i], fam);
  }

  // Se houver mais do que mostramos, indicar “+N”
  if (group.items.length > items.length) {
    card.addSpacer(8);
    var more = card.addText("+" + (group.items.length - items.length) + " intervalos");
    more.font = Font.systemFont(10);
    more.textColor = new Color("#7E8AA6");
  }
}

function renderTimeRow(parent, warn, fam) {
  var row = parent.addStack();
  row.centerAlignContent();

  // left: datas
  var when = row.addText(shortPeriod(warn.start, warn.end));
  when.font = Font.systemFont(11);
  when.textColor = new Color("#A6B0C3");

  row.addSpacer();

  // right: nível
  var lvl = (warn.level || "").toLowerCase();
  var pill = row.addStack();
  pill.setPadding(2, 7, 2, 7);
  pill.cornerRadius = 10;

  var style = colorsForLevel(lvl);
  pill.backgroundColor = style.bg;

  var txt = pill.addText(levelLabel(lvl));
  txt.font = Font.boldSystemFont(10);
  txt.textColor = style.fg;

  // opcional: texto (só em large, para não rebentar)
  if (fam === "large" && warn.text) {
    parent.addSpacer(4);
    var d = parent.addText(warn.text);
    d.font = Font.systemFont(10);
    d.textColor = new Color("#D5DBE7");
    d.lineLimit = 2;
  }
}

function groupByType(warnings) {
  var map = {}; // type -> {type, items, maxLevel}
  for (var i = 0; i < warnings.length; i++) {
    var w = warnings[i];
    var type = w.type || "Aviso";
    if (!map[type]) {
      map[type] = { type: type, items: [], maxLevel: "green" };
    }
    map[type].items.push(w);

    var lvl = (w.level || "").toLowerCase();
    if (priority(lvl) > priority(map[type].maxLevel)) {
      map[type].maxLevel = lvl;
    }
  }

  // ordenar items dentro de cada tipo por start
  var out = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;
    map[k].items.sort(function (a, b) {
      return String(a.start || "").localeCompare(String(b.start || ""));
    });
    out.push(map[k]);
  }
  return out;
}

function applyStatusPill(pill, textNode, maxLevel, totalCount) {
  if (!totalCount) {
    pill.backgroundColor = new Color("#15311F");
    textNode.textColor = new Color("#9AF0B5");
    textNode.text = "Sem avisos";
    return;
  }

  var style = colorsForLevel(maxLevel);
  pill.backgroundColor = style.bg;
  textNode.textColor = style.fg;

  // mais explícito do que “Laranja · 4”
  textNode.text = totalCount + " avisos · máx " + levelLabel(maxLevel);
}

function getMaxLevel(warnings) {
  var max = "green";
  for (var i = 0; i < warnings.length; i++) {
    var lvl = (warnings[i].level || "").toLowerCase();
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

function levelLabel(level) {
  if (level === "red") return "Vermelho";
  if (level === "orange") return "Laranja";
  if (level === "yellow") return "Amarelo";
  if (level === "green") return "Verde";
  return "Aviso";
}

function iconForType(type) {
  var t = (type || "").toLowerCase();
  if (t.indexOf("agitação") >= 0 || t.indexOf("mar") >= 0) return "🌊";
  if (t.indexOf("vento") >= 0) return "💨";
  if (t.indexOf("precip") >= 0 || t.indexOf("chuva") >= 0) return "🌧️";
  if (t.indexOf("trovo") >= 0) return "⛈️";
  if (t.indexOf("nevo") >= 0) return "🌫️";
  if (t.indexOf("frio") >= 0) return "🥶";
  if (t.indexOf("quente") >= 0 || t.indexOf("calor") >= 0) return "🥵";
  return "⚠️";
}

function shortPeriod(startIso, endIso) {
  // compacto: "ter 16 12:37 → qua 17 03:00"
  return shortDate(startIso) + " → " + shortDate(endIso);
}

function shortDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleString("pt-PT", {
      weekday: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return String(iso || "");
  }
}

function fmtTime(d) {
  try {
    return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

function finish(w) {
  Script.setWidget(w);
  Script.complete();
}

runWidget();
