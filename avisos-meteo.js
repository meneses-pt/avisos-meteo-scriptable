// Avisos Meteo – Widget iOS (Scriptable)
// Fonte: Cloudflare Worker + IPMA
// Endpoint esperado:
// https://avisos-meteo.andremeneses.workers.dev/?area=PTO

function runWidget() {
  var AREA = "PTO";
  var ENDPOINT =
    "https://avisos-meteo.andremeneses.workers.dev/?area=" + AREA;

  var w = new ListWidget();
  w.setPadding(12, 12, 12, 12);

  var title = w.addText("Avisos IPMA – Porto");
  title.font = Font.boldSystemFont(16);

  w.addSpacer(6);

  var req = new Request(ENDPOINT);
  req.timeoutInterval = 10;

  req.loadJSON()
    .then(function (data) {
      var warnings = data.warnings || [];

      if (warnings.length === 0) {
        var t = w.addText("Sem avisos ativos ou previstos.");
        t.font = Font.systemFont(14);
      } else {
        for (var i = 0; i < Math.min(warnings.length, 3); i++) {
          var warn = warnings[i];

          var header = w.addText(
            warn.type + " · " + warn.level.toUpperCase()
          );
          header.font = Font.boldSystemFont(13);

          var period = w.addText(
            formatDate(warn.start) + " → " + formatDate(warn.end)
          );
          period.font = Font.systemFont(11);
          period.textOpacity = 0.75;

          if (warn.text) {
            var desc = w.addText(warn.text);
            desc.font = Font.systemFont(11);
            desc.textOpacity = 0.75;
            desc.lineLimit = 2;
          }

          w.addSpacer(8);
        }
      }

      var updated = w.addText(
        "Atualizado: " +
          new Date().toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
          })
      );
      updated.font = Font.systemFont(10);
      updated.textOpacity = 0.6;

      w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

      Script.setWidget(w);
      Script.complete();
    })
    .catch(function (err) {
      var t = w.addText("Erro ao obter avisos.");
      t.font = Font.systemFont(13);

      var e = w.addText(String(err));
      e.font = Font.systemFont(10);
      e.textOpacity = 0.6;
      e.lineLimit = 4;

      Script.setWidget(w);
      Script.complete();
    });
}

function formatDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return iso;
  }
}

// Executar
runWidget();
