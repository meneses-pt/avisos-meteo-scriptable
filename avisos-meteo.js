// Avisos Meteo – Widget iOS (Scriptable) | UI moderna
// Endpoint: https://avisos-meteo.andremeneses.workers.dev/?area=PTO

function runWidget() {
  var AREA = "PTO";
  var ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  var w = new ListWidget();
  w.setPadding(14, 14, 14, 14);
  w.backgroundColor = new Color("#0B1220"); // navy/charcoal
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=PTO";

  // Header
  var header = w.addStack();
  header.centerAlignContent();

  var titleStack = header.addStack();
  titleStack.layoutVertically();

  var title = titleStack.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(16);
  title.textColor = new Color("#FFFFFF");

  var subtitle = titleStack.addText("Porto · Próximos avisos");
  subtitle.font = Font.systemFont(11);
  subtitle.textColor = new Color("#A6B0C3");

  header.addSpacer();

  // “badge” de estado (preenchido após fetch)
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

      // Determinar “nível máximo” para o estado no topo
      var maxLevel = getMaxLevel(warnings);
      applyStatusPill(statusPill, statusText, maxLevel, warnings.length);

      if (!warnings.length) {
        renderEmptyState(w);
        finish(w);
        return;
      }

      // Lista (até 3)
      var count = Math.min(warnings.length, 3);
      for (var i = 0; i < count; i++) {
        if (i > 0) w.addSpacer(10);
        renderWarningCard(w, warnings[i]);
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
      // pill em “erro”
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

function renderWarningCard(w, warn) {
  var card = w.addStack();
  card.layoutVertically();
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");

  // Linha 1: tipo + chip nível
  var top = card.addStack();
  top.centerAlignContent();

  var typeIcon = top.addText(iconForType(warn.type));
  typeIcon.font = Font.systemFont(14);

  top.addSpacer(6);

  var type = top.addText(warn.type || "Aviso");
  type.font = Font.boldSystemFont(13);
  type.textColor = new Color("#FFFFFF");

  top.addSpacer();

  var chip = top.addStack();
  chip.setPadding(3, 8, 3, 8);
  chip.cornerRadius = 10;

  var lvl = (warn.level || "").toLowerCase();
  var chipStyle = colorsForLevel(lvl);
  chip.backgroundColor = chipStyle.bg;

  var chipText = chip.addText(levelLabel(lvl));
  chipText.font = Font.boldSystemFont(11);
  chipText.textColor = chipStyle.fg;

  card.addSpacer(8);

  // Linha 2: janela temporal
  var time = card.addText(fmtPeriod(warn.start, warn.end));
  time.font = Font.systemFont(11);
  time.textColor = new Color("#A6B0C3");

  // Linha 3: descrição (curta)
  if (warn.text) {
    card.addSpacer(6);
    var desc = card.addText(warn.text);
    desc.font = Font.systemFont(11);
    desc.textColor = new Color("#D5DBE7");
    desc.lineLimit = 3;
  }
}

function applyStatusPill(pill, textNode, maxLevel, count) {
  if (!count) {
    pill.backgroundColor = new Color("#15311F");
    textNode.textColor = new Color("#9AF0B5");
    textNode.text = "OK";
    return;
  }

  var style = colorsForLevel(maxLevel);
  pill.backgroundColor = style.bg;
  textNode.textColor = style.fg;

  var label = levelLabel(maxLevel);
  textNode.text = label + " · " + count;
}

function getMaxLevel(warnings) {
  // prioridade: red > orange > yellow > green > unknown
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
  // Cores modernas (não “berrantes”)
  if (level === "red") {
    return { bg: new Color("#3B1D1D"), fg: new Color("#FFB4B4") };
  }
  if (level === "orange") {
    return { bg: new Color("#3A2B10"), fg: new Color("#FFD7A1") };
  }
  if (level === "yellow") {
    return { bg: new Color("#3A3610"), fg: new Color("#FFF0A6") };
  }
  // green / unknown
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

function fmtPeriod(startIso, endIso) {
  var s = fmtDate(startIso);
  var e = fmtDate(endIso);
  return s + " → " + e;
}

function fmtDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleString("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
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

// run
runWidget();
