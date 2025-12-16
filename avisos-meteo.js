// Avisos Meteo – Widget iOS (Scriptable) | UI moderna + agrupamento por tipo + merge consecutivo
// Endpoint: https://avisos-meteo.andremeneses.workers.dev/?area=PTO

function runWidget() {
  var AREA = "PTO";
  var ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  var fam = (typeof config !== "undefined" && config.widgetFamily) ? config.widgetFamily : "medium";

  // Afinar UI por tamanho (garantir que no "médio" o título não corta)
  var ui = uiForFamily(fam);

  var w = new ListWidget();
  w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=PTO";

  // Header
  var header = w.addStack();
  header.centerAlignContent();

  var left = header.addStack();
  left.layoutVertically();

  var title = left.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(ui.titleFont);
  title.textColor = new Color("#FFFFFF");
  title.lineLimit = 1;
  if (title.minimumScaleFactor !== undefined) title.minimumScaleFactor = 0.7;

  var subtitle = left.addText(ui.subtitleText);
  subtitle.font = Font.systemFont(ui.subtitleFont);
  subtitle.textColor = new Color("#A6B0C3");
  subtitle.lineLimit = 1;
  if (subtitle.minimumScaleFactor !== undefined) subtitle.minimumScaleFactor = 0.7;

  header.addSpacer();

  var statusPill = header.addStack();
  statusPill.setPadding(4, 8, 4, 8);
  statusPill.cornerRadius = 10;

  var statusText = statusPill.addText("…");
  statusText.font = Font.boldSystemFont(ui.pillFont);

  w.addSpacer(ui.afterHeaderSpace);

  var req = new Request(ENDPOINT);
  req.timeoutInterval = 10;

  req.loadJSON()
    .then(function (data) {
      var warnings = (data && data.warnings) ? data.warnings : [];
      var originalCount = warnings.length;

      // Estado no topo (máx nível dos avisos originais)
      var maxLevel = getMaxLevelFromWarnings(warnings);
      applyStatusPill(statusPill, statusText, maxLevel, originalCount);

      if (!warnings.length) {
        renderEmptyState(w, ui);
        // Empurrar footer para baixo
        w.addSpacer();
        renderFooter(w, ui);
        finish(w);
        return;
      }

      // Agrupar por tipo e fazer merge consecutivo (same level + same text + intervals consecutivos)
      var groups = groupByTypeAndMerge(warnings);

      // Ordenar tipos por gravidade máxima (do tipo), depois por nome
      groups.sort(function (a, b) {
        var pa = priority(a.maxLevel);
        var pb = priority(b.maxLevel);
        if (pb !== pa) return pb - pa;
        return a.type.localeCompare(b.type);
      });

      // Render por tamanho
      var maxTypes = ui.maxTypes;
      var maxBlocksPerType = ui.maxBlocksPerType;

      var shownTypes = Math.min(groups.length, maxTypes);
      for (var gi = 0; gi < shownTypes; gi++) {
        if (gi > 0) w.addSpacer(ui.betweenCardsSpace);
        renderTypeCard(w, groups[gi], ui, maxBlocksPerType);
      }

      // Resumo do que não coube (tipos escondidos)
      if (groups.length > shownTypes) {
        w.addSpacer(ui.betweenCardsSpace);
        renderHiddenTypesSummary(w, groups, shownTypes, ui);
      }

      // Empurrar footer para o fundo
      w.addSpacer();
      renderFooter(w, ui);

      // refresh
      w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

      finish(w);
    })
    .catch(function (err) {
      statusPill.backgroundColor = new Color("#3B1D1D");
      statusText.textColor = new Color("#FFB4B4");
      statusText.text = "Erro";

      var t = w.addText("Não foi possível obter avisos.");
      t.font = Font.systemFont(ui.bodyFont);
      t.textColor = new Color("#FFFFFF");
      w.addSpacer(6);

      var e = w.addText(String(err));
      e.font = Font.systemFont(10);
      e.textColor = new Color("#A6B0C3");
      e.lineLimit = 3;

      w.addSpacer();
      renderFooter(w, ui);

      finish(w);
    });
}

function uiForFamily(fam) {
  // iOS: small / medium / large
  if (fam === "small") {
    return {
      pad: 12,
      titleFont: 14,
      subtitleFont: 10,
      pillFont: 10,
      bodyFont: 12,
      subtitleText: "Porto",
      afterHeaderSpace: 8,
      betweenCardsSpace: 8,
      maxTypes: 1,
      maxBlocksPerType: 3,
      cardTitleFont: 12,
      timeFont: 10,
      descFont: 10,
    };
  }
  if (fam === "large") {
    return {
      pad: 14,
      titleFont: 16,
      subtitleFont: 11,
      pillFont: 11,
      bodyFont: 13,
      subtitleText: "Porto · Próximos avisos",
      afterHeaderSpace: 10,
      betweenCardsSpace: 10,
      maxTypes: 3,
      maxBlocksPerType: 6,
      cardTitleFont: 13,
      timeFont: 11,
      descFont: 10,
    };
  }
  // medium (segundo maior) – evitar cortes
  return {
    pad: 12,
    titleFont: 15,
    subtitleFont: 10,
    pillFont: 10,
    bodyFont: 13,
    subtitleText: "Porto · avisos",
    afterHeaderSpace: 8,
    betweenCardsSpace: 9,
    maxTypes: 2,
    maxBlocksPerType: 4,
    cardTitleFont: 12,
    timeFont: 11,
    descFont: 10,
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

function renderFooter(w, ui) {
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

  // Blocos (já com merge)
  var blocks = group.blocks;
  var shown = Math.min(blocks.length, maxBlocksPerType);

  for (var i = 0; i < shown; i++) {
    if (i > 0) card.addSpacer(6);
    renderMergedBlock(card, blocks[i], ui);
  }

  // Se houver mais blocos, indicar quantos
  if (blocks.length > shown) {
    card.addSpacer(8);
    var more = card.addText("+" + (blocks.length - shown) + " blocos");
    more.font = Font.systemFont(10);
    more.textColor = new Color("#7E8AA6");
  }
}

function renderMergedBlock(parent, block, ui) {
  // Linha principal: intervalo (primeiro) + nível
  var row = parent.addStack();
  row.centerAlignContent();

  var first = block.intervals[0];
  var when = row.addText(shortPeriod(first.start, first.end));
  when.font = Font.systemFont(ui.timeFont);
  when.textColor = new Color("#A6B0C3");
  when.lineLimit = 1;
  if (when.minimumScaleFactor !== undefined) when.minimumScaleFactor = 0.7;

  row.addSpacer();

  var lvl = (block.level || "").toLowerCase();
  var pill = row.addStack();
  pill.setPadding(2, 7, 2, 7);
  pill.cornerRadius = 10;

  var style = colorsForLevel(lvl);
  pill.backgroundColor = style.bg;

  var txt = pill.addText(levelLabel(lvl));
  txt.font = Font.boldSystemFont(10);
  txt.textColor = style.fg;

  // Mostrar intervalos adicionais (compacto)
  if (block.intervals.length > 1) {
    parent.addSpacer(4);

    // Em medium/small mostramos só “+N intervalos”
    // Em large mostramos até 2 extra (e depois +N)
    if (ui.maxTypes >= 3) {
      var extraToShow = Math.min(block.intervals.length - 1, 2);
      for (var i = 0; i < extraToShow; i++) {
        var itv = block.intervals[i + 1];
        var line = parent.addText("· " + shortPeriod(itv.start, itv.end));
        line.font = Font.systemFont(10);
        line.textColor = new Color("#7E8AA6");
        line.lineLimit = 1;
        if (line.minimumScaleFactor !== undefined) line.minimumScaleFactor = 0.75;
      }
      if (block.intervals.length - 1 > extraToShow) {
        var more = parent.addText("· +" + (block.intervals.length - 1 - extraToShow) + " intervalos");
        more.font = Font.systemFont(10);
        more.textColor = new Color("#7E8AA6");
      }
    } else {
      var more2 = parent.addText("· +" + (block.intervals.length - 1) + " intervalos");
      more2.font = Font.systemFont(10);
      more2.textColor = new Color("#7E8AA6");
    }
  }

  // Descrição: mostrar só em large, e curta
  if (ui.maxTypes >= 3 && block.text) {
    parent.addSpacer(4);
    var d = parent.addText(block.text);
    d.font = Font.systemFont(ui.descFont);
    d.textColor = new Color("#D5DBE7");
    d.lineLimit = 2;
  }
}

function renderHiddenTypesSummary(w, groups, startIdx, ui) {
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

function applyStatusPill(pill, textNode, maxLevel, originalCount) {
  if (!originalCount) {
    pill.backgroundColor = new Color("#15311F");
    textNode.textColor = new Color("#9AF0B5");
    textNode.text = "Sem avisos";
    return;
  }

  var style = colorsForLevel(maxLevel);
  pill.backgroundColor = style.bg;
  textNode.textColor = style.fg;

  textNode.text = originalCount + " avisos (máx. " + levelLabel(maxLevel) + ")";
}

function groupByTypeAndMerge(warnings) {
  // map: type -> {type, originalCount, maxLevel, items[]}
  var map = {};
  for (var i = 0; i < warnings.length; i++) {
    var w = warnings[i];
    var type = w.type || "Aviso";

    if (!map[type]) {
      map[type] = { type: type, originalCount: 0, maxLevel: "green", items: [] };
    }

    map[type].originalCount += 1;
    map[type].items.push(w);

    var lvl = (w.level || "").toLowerCase();
    if (priority(lvl) > priority(map[type].maxLevel)) map[type].maxLevel = lvl;
  }

  var out = [];
  for (var k in map) {
    if (!map.hasOwnProperty(k)) continue;

    // ordenar por start
    map[k].items.sort(function (a, b) {
      return String(a.start || "").localeCompare(String(b.start || ""));
    });

    // fazer merge consecutivo por same level + same text + end->start
    var mergedBlocks = mergeConsecutiveSame(map[k].items);

    out.push({
      type: map[k].type,
      originalCount: map[k].originalCount,
      maxLevel: map[k].maxLevel,
      blocks: mergedBlocks,
    });
  }
  return out;
}

function mergeConsecutiveSame(items) {
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var cur = items[i];

    var curLevel = String(cur.level || "").toLowerCase();
    var curText = normText(cur.text);

    var last = out.length ? out[out.length - 1] : null;

    if (
      last &&
      String(last.level || "").toLowerCase() === curLevel &&
      normText(last.text) === curText &&
      areConsecutive(last.intervals[last.intervals.length - 1].end, cur.start)
    ) {
      last.intervals.push({ start: cur.start, end: cur.end });
    } else {
      out.push({
        level: cur.level,
        text: cur.text,
        intervals: [{ start: cur.start, end: cur.end }],
      });
    }
  }
  return out;
}

function normText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function parseDateSafe(iso) {
  var d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function areConsecutive(aEnd, bStart) {
  // consecutivos se end == start, ou diferença <= 5 min
  var da = parseDateSafe(aEnd);
  var db = parseDateSafe(bStart);
  if (!da || !db) return String(aEnd) === String(bStart);
  var diffMs = Math.abs(db.getTime() - da.getTime());
  return diffMs <= 5 * 60 * 1000;
}

function getMaxLevelFromWarnings(warnings) {
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
