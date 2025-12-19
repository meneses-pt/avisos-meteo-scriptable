// avisos-meteo.js (REMOTO) — Scriptable
// Fixes: wrap real + margens ajustadas + footer no fundo

const SCRIPT_VERSION = "v1.0.25";

async function main() {
  // ✅ LOG DA VERSÃO
  console.log("========================================");
  console.log("AVISOS IPMA - " + SCRIPT_VERSION);
  console.log("========================================");
  
  const AREA = "PTO";
  const ENDPOINT = "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  const fam = config?.widgetFamily ?? "medium";
  const ui = uiForFamily(fam);

  const fm = FileManager.local();
  const cacheDir = fm.joinPath(fm.documentsDirectory(), "avisos-meteo");
  const cachePath = fm.joinPath(cacheDir, `warnings-${AREA}.json`);
  if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir, true);

  const w = new ListWidget();
  
  // ✅ FORÇA ALINHAMENTO AO TOPO
  w.topAlignContent = true;
  
  // Margens assimétricas (mais lateral no large)
  if (fam === "large") {
    w.setPadding(18, 20, 14, 20); // topo, direita, baixo, esquerda
  } else if (fam === "medium") {
    w.setPadding(12, 14, 10, 14);
  } else {
    w.setPadding(ui.pad, ui.pad, ui.pad, ui.pad);
  }
  
  w.backgroundColor = new Color("#0B1220");
  w.url = "https://www.ipma.pt/pt/otempo/prev-sam/?p=" + AREA;

  // HEADER
  const header = w.addStack();
  header.centerAlignContent();

  const title = header.addText("Avisos IPMA");
  title.font = Font.boldSystemFont(ui.titleFont);
  title.textColor = Color.white();
  title.lineLimit = 1;

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

  // DATA (cache + fetch)
  let cached = null;
  if (fm.fileExists(cachePath)) {
    try { cached = JSON.parse(fm.readString(cachePath)); } catch {}
  }

  let data = null;
  try {
    const req = new Request(ENDPOINT);
    req.timeoutInterval = 5;
    req.headers = { Accept: "application/json" };
    data = await req.loadJSON();
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

  const groups = groupByType(warnings);
  
  // ✅ Ordena pela data do primeiro evento de cada tipo
  groups.sort((a, b) => {
    const aFirst = a.items.reduce((earliest, item) => {
      const startMs = safeMs(item.start);
      return (startMs !== null && (earliest === null || startMs < earliest)) ? startMs : earliest;
    }, null);
    
    const bFirst = b.items.reduce((earliest, item) => {
      const startMs = safeMs(item.start);
      return (startMs !== null && (earliest === null || startMs < earliest)) ? startMs : earliest;
    }, null);
    
    // Se ambos têm data, ordena por data
    if (aFirst !== null && bFirst !== null) return aFirst - bFirst;
    
    // Se só um tem data, esse vem primeiro
    if (aFirst !== null) return -1;
    if (bFirst !== null) return 1;
    
    // Se nenhum tem data, mantém ordem original
    return 0;
  });
  
  // ✅ Primeiras 2 categorias: card completo, restantes: card compacto
  for (let i = 0; i < groups.length; i++) {
    if (i > 0) w.addSpacer(10);
    
    if (i < 2) {
      renderTypeCard(w, groups[i], ui);
    } else {
      // A partir da 3ª categoria, mostra card compacto
      renderCompactCards(w, groups.slice(2), ui);
      break; // Não continua o loop
    }
  }

  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  
  // Empurrar footer para o fundo
  w.addSpacer();
  
  const footer = w.addStack();
  footer.bottomAlignContent();
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  
  const info = footer.addText(SCRIPT_VERSION + " · " + timeStr);
  info.font = Font.systemFont(8);
  info.textColor = new Color("#3A4A5A");
  info.opacity = 0.6;
  
  footer.addSpacer();
  
  finish(w);
}

/* ================= UI ================= */

function uiForFamily(fam) {
  if (fam === "large") {
    return {
      pad: 18,
      titleFont: 16,
      subtitleFont: 11,
      pillFont: 12,
      bodyFont: 13,
      showSubtitle: true,
      subtitleText: "Porto · próximos avisos",
      afterHeaderSpace: 16,
      cardTitleFont: 13,
      leftColWidth: 95,
      rightColWidth: 220,
      colGap: 14,
      levelFont: 11,
      descFont: 12,
      timelineFont: 13,
      timelineFontSmall: 11,
      maxTimelineBlocks: 14,
      indent: 22,
      timelineSpacing: 2,
      timelineEndSpacing: 1,
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
      cardTitleFont: 12,
      leftColWidth: 85,
      rightColWidth: 120,
      colGap: 8,
      levelFont: 10,
      descFont: 11,
      timelineFont: 12,
      timelineFontSmall: 10,
      maxTimelineBlocks: 8,
      indent: 18,
      timelineSpacing: 1,
      timelineEndSpacing: 0,
    };
  }

  // medium
  return {
    pad: 12,
    titleFont: 14,
    subtitleFont: 10,
    pillFont: 11,
    bodyFont: 13,
    showSubtitle: true,
    subtitleText: "Porto · avisos",
    afterHeaderSpace: 12,
    cardTitleFont: 12,
    leftColWidth: 100,
    rightColWidth: 165,
    colGap: 10,
    levelFont: 10,
    descFont: 12,
    timelineFont: 12,
    timelineFontSmall: 10,
    maxTimelineBlocks: 10,
    indent: 18,
    timelineSpacing: 1,
    timelineEndSpacing: 0,
  };
}

/* ================= TEXT WRAP ================= */

function estimateTextWidth(text, fontSize) {
  let totalWidth = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Caracteres largos (maiúsculas, números, alguns símbolos)
    if (/[A-Z0-9MWÕÃ]/.test(char)) {
      totalWidth += fontSize * 0.68;
    }
    // Caracteres estreitos (i, l, pontuação)
    else if (/[il\.,:;!']/.test(char)) {
      totalWidth += fontSize * 0.32;
    }
    // Espaços
    else if (char === ' ') {
      totalWidth += fontSize * 0.37;
    }
    // Caracteres normais (minúsculas, acentos)
    else {
      totalWidth += fontSize * 0.54;
    }
  }
  
  return totalWidth;
}

function wrapTextToWidth(text, maxWidth, fontSize) {
  if (!text) return [""];
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const estimatedWidth = estimateTextWidth(testLine, fontSize);
    
    if (estimatedWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  
  return lines.length > 0 ? lines : [""];
}

/* ================= RENDER ================= */

function renderTypeCard(w, group, ui) {
  const card = w.addStack();
  card.layoutVertically();
  card.topAlignContent();
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");

  // Header do card
  const top = card.addStack();
  top.centerAlignContent();

  const emoji = top.addText(iconForType(group.type));
  emoji.font = Font.systemFont(ui.cardTitleFont + 2);

  top.addSpacer(6);

  const name = top.addText(group.type);
  name.font = Font.boldSystemFont(ui.cardTitleFont);
  name.textColor = Color.white();
  name.lineLimit = 1;
  // ✅ REMOVIDO minimumScaleFactor

  card.addSpacer(10);

  // LAYOUT HORIZONTAL (2 colunas)
  const content = card.addStack();
  content.topAlignContent();
  content.layoutHorizontally();
  
  // ===== COLUNA ESQUERDA: Timeline =====
  const left = content.addStack();
  left.layoutVertically();
  left.size = new Size(ui.leftColWidth, 0);

  const blocks = buildTimelineBlocks(group.items).slice(0, ui.maxTimelineBlocks);

  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) left.addSpacer(ui.timelineSpacing);

    const row = left.addStack();
    row.centerAlignContent();

    const isActive = isActiveBlock(blocks[i]);

    const dot = row.addText("●");
    dot.font = Font.boldSystemFont(ui.timelineFont + 2);
    dot.textColor = levelColor(blocks[i].level);

    row.addSpacer(6);

    const start = row.addText(blocks[i].startLabel);
    start.font = isActive 
      ? Font.boldSystemFont(ui.timelineFont)
      : Font.systemFont(ui.timelineFont);
    start.textColor = new Color("#A6B0C3");
    start.lineLimit = 1;

    if (blocks[i].endLabel) {
      left.addSpacer(ui.timelineEndSpacing);

      const endRow = left.addStack();
      endRow.addSpacer(ui.indent);

      const end = endRow.addText(blocks[i].endLabel);
      end.font = Font.systemFont(ui.timelineFontSmall);
      end.textColor = new Color("#7E8AA6");
      end.lineLimit = 1;
    }
  }

  content.addSpacer(ui.colGap);

  // ===== COLUNA DIREITA: Legendas COM MÚLTIPLOS addText() =====
  const right = content.addStack();
  right.layoutVertically();
  right.size = new Size(ui.rightColWidth, 0);
  
  const summaries = buildLevelSummaries(group.items)
    .sort((a, b) => priorityAsc(a.level) - priorityAsc(b.level));
  
  for (let i = 0; i < summaries.length; i++) {
    if (i > 0) right.addSpacer(10);
  
    const lvl = right.addText(levelLabel(summaries[i].level).toUpperCase());
    lvl.font = Font.boldSystemFont(ui.levelFont);
    lvl.textColor = levelColor(summaries[i].level);
  
    right.addSpacer(4);
  
    // ✅ LIMITAR A 2 LINHAS COM ELLIPSIS
    const fullText = summaries[i].text || "";
    const lines = wrapTextToWidth(fullText, ui.rightColWidth, ui.descFont);
    
    const maxLines = 2;
    const displayLines = lines.slice(0, maxLines);
    const hasMore = lines.length > maxLines;
    
    for (let j = 0; j < displayLines.length; j++) {
      if (j > 0) right.addSpacer(2);
      
      const isLastLine = j === displayLines.length - 1;
      const lineText = (isLastLine && hasMore) ? displayLines[j] + "…" : displayLines[j];
      
      const txt = right.addText(lineText);
      txt.font = Font.systemFont(ui.descFont);
      txt.textColor = new Color("#D5DBE7");
      txt.lineLimit = 1;
    }
  }
}

// ✅ NOVA FUNÇÃO: Card compacto com pills
function renderCompactCards(w, groups, ui) {
  const card = w.addStack();
  card.layoutVertically();
  card.setPadding(12, 12, 12, 12);
  card.cornerRadius = 16;
  card.backgroundColor = new Color("#111B2E");
  
  const pillsContainer = card.addStack();
  pillsContainer.layoutHorizontally();
  pillsContainer.centerAlignContent();
  
  for (let i = 0; i < groups.length; i++) {
    if (i > 0) pillsContainer.addSpacer(8);
    
    const pill = pillsContainer.addStack();
    pill.setPadding(6, 12, 6, 12);
    pill.cornerRadius = 12;
    pill.backgroundColor = new Color("#1A243A");
    pill.borderWidth = 1;
    pill.borderColor = levelColor(groups[i].maxLevel);
    
    const emoji = pill.addText(iconForType(groups[i].type));
    emoji.font = Font.systemFont(12);
    
    pill.addSpacer(4);
    
    const label = pill.addText(groups[i].type);
    label.font = Font.mediumSystemFont(11);
    label.textColor = new Color("#D5DBE7");
    label.lineLimit = 1;
  }
}

/* ================= DATA ================= */

function groupByType(ws) {
  const map = {};
  for (const w of ws) {
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

    if (priorityDesc(level) > priorityDesc(map[type].maxLevel)) {
      map[type].maxLevel = level;
    }
  }
  return Object.values(map);
}

function buildLevelSummaries(items) {
  const map = {};
  for (const w of items) {
    if (!map[w.level]) map[w.level] = w;
  }
  return Object.values(map);
}

function isActiveBlock(block) {
  const now = Date.now();
  const start = safeMs(block.startISO);
  const end = safeMs(block.endISO);
  
  if (start === null) return false;
  
  if (now >= start) {
    return end === null || now <= end;
  }
  
  return false;
}

function buildTimelineBlocks(items) {
  const sorted = [...items].sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));

  return sorted.map((cur, i) => {
    const next = sorted[i + 1];
    const endMs = safeMs(cur.end);
    const nextStartMs = next ? safeMs(next.start) : null;
    const showEnd = (endMs !== null) && (nextStartMs === null || endMs !== nextStartMs);

    return {
      level: cur.level,
      startLabel: fmtStart(cur.start),
      endLabel: showEnd ? ("até " + fmtEnd(cur.end)) : null,
      startISO: cur.start,
      endISO: cur.end
    };
  });
}

function safeMs(iso) {
  try {
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

/* ================= FORMATTING ================= */

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
    return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* ================= LEVELS ================= */

function priorityAsc(l) { return { yellow: 1, orange: 2, red: 3, green: 9 }[l] ?? 9; }
function priorityDesc(l) { return { green: 1, yellow: 2, orange: 3, red: 4 }[l] ?? 0; }

function getMaxLevel(ws) {
  let max = "green";
  for (const w of ws) {
    const lvl = String(w.level || "green").toLowerCase();
    if (priorityDesc(lvl) > priorityDesc(max)) max = lvl;
  }
  return max;
}

function levelLabel(l) {
  return { yellow: "Amarelo", orange: "Laranja", red: "Vermelho", green: "Verde" }[l] || "Aviso";
}

function levelColor(l) {
  return new Color({ yellow: "#FFE27A", orange: "#FFB86B", red: "#FF6B6B", green: "#8EF0B2" }[l] || "#CCCCCC");
}

function setTopPill(pill, text, count, maxLevel) {
  pill.backgroundColor = new Color("#1A243A");
  text.textColor = levelColor(maxLevel);
  text.text = count + " avisos";
}

function iconForType(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("agitação") || t.includes("mar")) return "🌊";
  if (t.includes("vento")) return "💨";
  if (t.includes("precip") || t.includes("chuva")) return "🌧️";
  if (t.includes("trovo")) return "⛈️";
  if (t.includes("neve")) return "❄️";  // ✅ ADICIONADO
  if (t.includes("nevo")) return "🌫️";
  if (t.includes("frio")) return "🥶";
  if (t.includes("calor") || t.includes("quente")) return "🥵";
  return "⚠️";
}

/* ================= END ================= */

function finish(w) {
  Script.setWidget(w);
  Script.complete();
}
