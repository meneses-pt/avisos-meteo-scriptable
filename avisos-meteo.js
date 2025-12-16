// Avisos Meteo – Widget iOS (Scriptable)
// Consome o Cloudflare Worker
// Exemplo endpoint:
// https://avisos-meteo.andremeneses.workers.dev/?area=PTO

const AREA = "PTO";
const ENDPOINT = `https://avisos-meteo.andremeneses.workers.dev/?area=${AREA}`;

const w = new ListWidget();
w.setPadding(12, 12, 12, 12);

// Título
const title = w.addText("Avisos IPMA – Porto");
title.font = Font.boldSystemFont(16);

w.addSpacer(6);

// Fetch
let data;
try {
  const req = new Request(ENDPOINT);
  req.timeoutInterval = 10;
  data = await req.loadJSON();
} catch (e) {
  const t = w.addText("Erro a obter avisos.");
  t.font = Font.systemFont(13);
  Script.setWidget(w);
  Script.complete();
  return;
}

const warnings = data.warnings || [];

if (warnings.length === 0) {
  const t = w.addText("Sem avisos ativos ou previstos.");
  t.font = Font.systemFont(14);
} else {
  for (const warn of warnings.slice(0, 3)) {
    const header = w.addText(
      `${warn.type} · ${warn.level.toUpperCase()}`
    );
    header.font = Font.boldSystemFont(13);

    const period = w.addText(
      `${formatDate(warn.start)} → ${formatDate(warn.end)}`
    );
    period.font = Font.systemFont(11);
    period.textOpacity = 0.75;

    if (warn.text) {
      const desc = w.addText(warn.text);
      desc.font = Font.systemFont(11);
      desc.textOpacity = 0.75;
      desc.lineLimit = 2;
    }

    w.addSpacer(8);
  }
}

// Rodapé
const updated = w.addText(
  `Atualizado: ${new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`
);
updated.font = Font.systemFont(10);
updated.textOpacity = 0.6;

// Refresh
w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

Script.setWidget(w);
Script.complete();

// Helpers
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
