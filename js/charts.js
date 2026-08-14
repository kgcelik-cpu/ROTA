/* ============================================================
   ROTA · charts.js — Hafif, bağımlılıksız SVG/CSS grafik yardımcıları
   Hepsi HTML string döndürür; app.js bunları ekranlara basar.
   ============================================================ */
(function () {
  "use strict";
  var C = {};

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  C.esc = esc;

  // yatay bar listesi: rows = [{label, value, max?, color, suffix?}]
  C.bars = function (rows, opt) {
    opt = opt || {};
    var max = opt.max || Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    return '<div class="bars">' + rows.map(function (r) {
      var pct = Math.max(2, Math.round((r.value / (r.max || max)) * 100));
      return '<div class="bar-row"><span class="lab">' + esc(r.label) + '</span>' +
        '<span class="bar-track"><i class="bar-fill" data-width="' + pct + '%" style="width:0%;background:' + (r.color || "#2D6CDF") + '"></i></span>' +
        '<span class="num">' + esc(r.value + (r.suffix || "")) + '</span></div>';
    }).join("") + '</div>';
  };

  // conic donut: segs = [{label,value,color}]
  C.donut = function (segs, centerTop, centerSub) {
    var total = segs.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var acc = 0, stops = [];
    segs.forEach(function (s) {
      var from = (acc / total) * 100, to = ((acc + s.value) / total) * 100; acc += s.value;
      stops.push(s.color + " " + from.toFixed(1) + "% " + to.toFixed(1) + "%");
    });
    var legend = segs.map(function (s) {
      return '<div class="li"><span class="sw" style="background:' + s.color + '"></span>' + esc(s.label) +
        '<b>' + (s.suffix !== undefined ? s.value + s.suffix : Math.round(s.value / total * 100) + "%") + '</b></div>';
    }).join("");
    return '<div class="donut-wrap"><div class="donut" style="background:conic-gradient(' + stops.join(",") + ')">' +
      '<div class="center"><b>' + esc(centerTop || "") + '</b><span>' + esc(centerSub || "") + '</span></div></div>' +
      '<div class="legend">' + legend + '</div></div>';
  };

  // sparkline
  C.spark = function (pts, color, w, h) {
    w = w || 84; h = h || 28; color = color || "#15A05A";
    var mx = Math.max.apply(null, pts), mn = Math.min.apply(null, pts);
    var p = pts.map(function (v, i) { return (i / (pts.length - 1) * w).toFixed(1) + "," + (h - (v - mn) / (mx - mn || 1) * (h - 4) - 2).toFixed(1); }).join(" ");
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + p + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };

  // 9 kutu: cells = 3x3 counts [pot row high->low? we pass as rows top=Yüksek]
  C.nineBox = function (grid) {
    // grid: array of 3 rows (top=Yüksek pot), each 3 cols (low..high perf) -> {label,count,tone}
    var tones = { star: "var(--green-soft)", good: "#DFF1E6", core: "#EAF0FA", neutral: "#F1F4F9", risk: "var(--red-soft)", info: "var(--blue-soft)" };
    var html = '<div class="ninebox">';
    grid.forEach(function (row) {
      row.forEach(function (c) {
        var border = c.tone === "star" ? "border-color:var(--green)" : (c.tone === "risk" ? "border-color:var(--red)" : "");
        html += '<div class="nb" style="background:' + (tones[c.tone] || "#F1F4F9") + ';' + border + '">' +
          '<span>' + esc(c.label) + '</span><b>' + c.count + '</b></div>';
      });
    });
    return html + '</div>';
  };

  // quadrant scatter: bubbles=[{x,y,r,color,label,title}] x,y in 0..100
  C.quadrant = function (bubbles, labels) {
    labels = labels || {};
    var b = bubbles.map(function (q) {
      return '<div class="bub" style="left:' + q.x + '%;top:' + (100 - q.y) + '%;width:' + q.r + 'px;height:' + q.r + 'px;background:' + q.color + '" title="' + esc(q.title || "") + '">' + esc(q.label || "") + '</div>';
    }).join("");
    return '<div class="quad">' +
      '<span class="axis-x">Performans →</span><span class="axis-y">Ücret →</span>' +
      '<span class="qlab" style="left:8px;top:8px;background:var(--red-soft);color:var(--red)">⚠ Ücret adaleti riski</span>' +
      '<span class="qlab" style="right:8px;top:8px;background:var(--green-soft);color:var(--green)">✓ İdeal</span>' +
      '<span class="qlab" style="left:8px;bottom:8px;background:#F1F4F9;color:var(--muted)">İzle</span>' +
      '<span class="qlab" style="right:8px;bottom:8px;background:var(--red-soft);color:var(--red)">🔥 Çalışan kaybı riski</span>' +
      b + '</div>';
  };

  // heatmap: cols (header), rows=[{label, cells:[{v,color}]}]
  C.heat = function (cols, rows) {
    var head = '<div class="hr"><span></span>' + cols.map(function (c) { return '<span class="colh">' + esc(c) + '</span>'; }).join("") + '</div>';
    var body = rows.map(function (r) {
      return '<div class="hr"><span class="rl">' + esc(r.label) + '</span>' +
        r.cells.map(function (c) { return '<div class="hc" style="background:' + c.color + '">' + c.v + '</div>'; }).join("") + '</div>';
    }).join("");
    return '<div class="heat">' + head + body + '</div>';
  };

  window.ROTA_CHARTS = C;
})();
