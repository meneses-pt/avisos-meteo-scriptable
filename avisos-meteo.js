// Avisos Meteo – Widget iOS (Scriptable)
// UI moderna + agrupamento por tipo + agrupamento por (nível + descrição) com múltiplos intervalos
// Endpoint: https://avisos-meteo.andremeneses.workers.dev/?area=PTO

function runWidget() {
  var AREA = "PTO";
  var ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  var fam = (typeof config !== "undefined" && config.widgetFamily) ? config.widgetFamily : "medium";
  var ui = uiForFamily(fam);

  var w = new ListWidget();
  w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=PTO";

  // ===== Header (desenhada para NÃO cortar no medium) =====
  // Linha 1: título (esquerda) + pill (direita) com texto curto no medium
  var header1 = w.addStack();
  header1.centerAlignContent();

  var title = header1.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(ui.titleFont);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 1;
  if (title.minimumScaleFactor !== undefined) title.minimumScaleFactor = 0.65;

  header1.addSpacer();

  var statusPill = header1.addStack();
  statusPill.setPadding(4, 8, 4, 8);
  statusPill.cornerRadius = 10;

  var statusText = statusPill.addText("…");
  statusText.font = Font.boldSystemFont(ui.pillFont);

  // Linha 2: subtitle (se houver espaço)
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
    .then(function (data) {
      var warnings = (data && data.warnings) ? data.warnings : [];
      var originalCount = warnings.length;

      var maxLevel = getMaxLevelFromWarnings(warnings);
      applyStatusPill(statusPill, statusText, maxLevel, originalCount, ui);

      if (!warnings.length) {
        renderEmptyState(w, ui);
        w.addSpacer(); // empurra footer para baixo
        renderFooter(w);
        finish(w);
        return;
      }

      // Agrupar por tipo, e dentro do tipo agrupar por (level + description)
      var groups = groupByTypeThenByLevelText(warnings);

      // Ordenar tipos por gravidade máxima
      groups.sort(function (a, b) {
        var pa = priority(a.maxLevel);
        var pb = priority(b.maxLevel);
        if (pb !== pa) return pb - pa;
        return a.type.localeCompare(b.type);
      });

      // Quantos tipos/blocos mostramos por tamanho
      var maxTypes = ui.maxTypes;
      var maxBlocksPerType = ui.maxBlocksPerType;
      var shownTypes = Math.min(groups.length, maxTypes);

      for (var gi = 0; gi < shownTypes; gi++) {
        if (gi > 0) w.addSpacer(ui.betweenCardsSpace);
        renderTypeCard(w, groups[gi], ui, maxBlocksPerType);
      }

      // Resumo do que ficou fora (tipos escondidos)
      if (groups.length > shownTypes) {
        w.addSpacer(ui.betweenCardsSpace);
        renderHiddenTypesSummary(w, groups, shownTypes);
      }

      w.addSpacer(); // footer em baixo
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

// ===== UI Tuning =====

function uiForFamily(fam) {
  // iOS: small / medium / large
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
      maxBlocksPerType: 3,
      cardTitleFont: 12,
      timeFont: 10,
      descFont: 10,
      showDescriptions: false,
      showExtraIntervals: false,
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
      subtitleText: "Porto · Próximos avisos",
      afterHeaderSpace: 10,
      betweenCardsSpace: 10,
      maxTypes: 3,
      maxBlocksPerType: 6,
      cardTitleFont: 13,
      timeFont: 11,
      descFont: 10,
      showDescriptions: true,
      showExtraIntervals: true,
    };
  }

  // medium (o “segundo maior”) – super compacto para não cortar
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
    maxTypes: 1,          // medium: 1 tipo com mais detalhe costuma ser melhor
    maxBlocksPerType: 4,
    cardTitleFont: 12,
    timeFont: 10,
    descFont: 10,
    showDescriptions: false,
    showExtraIntervals: false,
  };
}

// ===== Rendering =====

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

function renderTypeCard(w, group, ui, maxBlocksPerType) {
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

  var chip = top.addStack();
  chip.setPadding(3, 8, 3, 8);
  chip.cornerRadius = 10;

  var chipStyle = colorsForLevel(group.maxLevel);
  chip.backgroundColor = chipStyle.bg;

  var chipText = chip.addText(levelLabel(group.maxLevel));
  chipText.font = Font.boldSystemFont(ui.pillFont);
  chipText.textColor = chipStyle.fg;

  card.addSpacer(8);

  // Blocos (cada bloco = mesma gravidade + mesma descrição, com vários intervalos)
  var blocks = group.blocks;
  // ordenar blocos por “primeiro start”
  blocks.sort(function (a, b) {
    return String(a.intervals[0].start || "").localeCompare(String(b.intervals[0].start || ""));
  });

  var shown = Math.min(blocks.length, maxBlocksPerType);
  for (var i = 0; i < shown; i++) {
    if (i > 0) card.addSpacer(8);
    renderBlockWithIntervals(card, blocks[i], ui);
  }

  if (blocks.length > shown) {
    var more = card.addText("+" + (blocks.length - shown) + " blocos");
    more.font = Font.systemFont(10);
    more.textColor = new Color("#7E8AA6");
  }
}

function renderBlockWithIntervals(parent, block, ui) {
  // Linha 1: “Resumo” do bloco: nível + (opcional) 1a linha de descrição em large
  var row = parent.addStack();
  row.centerAlignContent();

  var lvl = (block.level || "").toLowerCase();
  var pill = row.addStack();
  pill.setPadding(2, 7, 2, 7);
  pill.cornerRadius = 10;

  var style = colorsForLevel(lvl);
  pill.backgroundColor = style.bg;

  var txt = pill.addText(levelLabel(lvl));
  txt.font = Font.boldSystemFont(10);
  txt.textColor = style.fg;

  row.addSpacer(8);

  var label = row.addText("Intervalos");
  label.font = Font.systemFont(10);
  label.textColor = new Color("#7E8AA6");

  // Intervalos (lista)
  var intervals = block.intervals;
  var maxIntervalsToShow = ui.showExtraIntervals ? 4 : 4; // igual, mas no large mostramos também descrição
  var shown = Math.min(intervals.length, maxIntervalsToShow);

  for (var i = 0; i < shown; i++) {
    var itv = intervals[i];
    var line = parent.addText(shortPeriod(itv.start, itv.end));
    line.font = Font.systemFont(ui.timeFont);
    line.textColor = new Color("#A6B0C3");
    line.lineLimit = 1;
    if (line.minimumScaleFactor !== undefined) line.minimumScaleFactor = 0.7;
  }

  if (intervals.length > shown) {
    var more = parent.addText("+" + (intervals.length - shown) + " intervalos");
    more.font = Font.systemFont(10);
    more.textColor = new Color("#7E8AA6");
  }

  // Descrição só em large (para não “rebentar” medium)
  if (ui.showDescriptions && block.text) {
    parent.addSpacer(4);
    var d = parent.addText(block.text);
    d.font = Font.systemFont(ui.descFont);
    d.textColor = new Color("#D5DBE7");
    d.lineLimit = 2;
  }
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
    line += groups[j].type + " (" + groups[j].originalCount + ")";
  }

  var more = box.addText(line);
  more.font = Font.systemFont(10);
  more.textColor = new Color("#7E8AA6");
  more.lineLimit = 2;
}

// ===== Grouping logic =====

function groupByTypeThenByLevelText(warnings) {
  // type -> {type, originalCount, maxLevel, blocksMap}
  var map = {};
  for (var i = 0; i < warnings.length; i++) {
    var w = warnings[i];
    var type = w.type || "Aviso";

    if (!map[type]) {
      map[type] = {
        type: type,
        originalCount: 0,
        maxLevel: "green",
        blocksMap: {} // key -> block
      };
    }

    map[type].originalCount += 1;

    var lvl = String(w.level || "").toLowerCase();
    if (priority(lvl) > priority(map[type].maxLevel)) map[type].maxLevel = lvl;

    // chave por (level + normalized text)
    var key = lvl + "||" + normText(w.text);

    if (!map[type].blocksMap[key]) {
      map[type].blocksMap[key] = {
        level: w.level,
        text: w.text,
        intervals: []
      };
    }

    map[type].blocksMap[key].intervals.push({ start: w.start, end: w.end });
  }

  // transformar em array e ordenar intervalos
  var out = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;

    var blocks = [];
    var bm = map[k].blocksMap;
    for (var key2 in bm) {
      if (!bm.hasOwnProperty(key2)) continue;

      bm[key2].intervals.sort(function (a, b) {
        return String(a.start || "").localeCompare(String(b.start || ""));
      });

      blocks.push(bm[key2]);
    }

    out.push({
      type: map[k].type,
      originalCount: map[k].originalCount,
      maxLevel: map[k].maxLevel,
      blocks: blocks
    });
  }

  return out;
}

// ===== Status pill =====

function applyStatusPill(pill, textNode, maxLevel, originalCount, ui) {
  if (!originalCount) {
    pill.backgroundColor = new Color("#15311F");
    textNode.textColor = new Color("#9AF0B5");
    textNode.text = "Sem avisos";
    return;
  }

  var style = colorsForLevel(maxLevel);
  pill.backgroundColor = style.bg;
  textNode.textColor = style.fg;

  // No medium usamos texto mais curto para não cortar
  if (ui && ui.maxTypes === 1 && ui.titleFont <= 14) {
    textNode.text = originalCount + " (máx. " + levelLabel(maxLevel) + ")";
  } else {
    textNode.text = originalCount + " avisos (máx. " + levelLabel(maxLevel) + ")";
  }
}

function getMaxLevelFromWarnings(warnings) {
  var max = "green";
  for (var i = 0; i < warnings.length; i++) {
    var lvl = (warnings[i].level || "").toLowerCase();
    if (priority(lvl) > priority(max)) max = lvl;
  }
  return max;
}

// ===== Utils =====

function normText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
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
  return shortDate(startIso) + " → " + shortDate(endIso);
}

function shortDate(iso) {
  try {
    var d = new Date(iso); // converte para timezone do iPhone automaticamente
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
