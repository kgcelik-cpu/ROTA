/* ============================================================
   ROTA · features.js — Feature scaffolding & helper renderers
   Bu dosya yeni modüller için hızlı placeholder ve helper'lar sağlar.
   Gerçek modüller app.js içinden çağrılıp entegre edilecektir.
   ============================================================ */
(function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function kpiCard(o) {
    return '<div class="feature-card kpi-small"><div class="fc-h"><h4>' + esc(o.title) + '</h4></div>' +
      '<div class="fc-b"><div class="big">' + (o.val || '-') + '</div>' + (o.hint ? '<div class="hint">' + esc(o.hint) + '</div>' : '') + '</div></div>';
  }

  function featurePlaceholder(name, desc) {
    return '<div class="feature-placeholder"><h3>' + esc(name) + '</h3><p class="muted-txt">' + esc(desc) + '</p>' +
      '<div class="placeholder-body">Modül geliştirmesi devam ediyor — bu alana ayrıntılı etkileşimler eklenecek.</div></div>';
  }

  var MODULES = {
    attrition: function (ctx) {
      return featurePlaceholder('Tahmine Dayalı Ayrılma (Attrition Risk)', 'Birey/segment bazlı risk skorları, neden tahmini ve önerilen müdahile paketleri gösterir.');
    },
    succession: function (ctx) {
      return featurePlaceholder('Yedekleme & Succession', '9‑kutu entegrasyonu, kritik rol heatmap ve hızlı yedek eşleştirme aracı.');
    },
    compSim: function (ctx) {
      return '<div class="feature-sim"><h3>Ücret Senaryo Simülatörü</h3><p class="muted-txt">Basit senaryo uygulayıcı — seçili segment için maliyet/etki hesabı yapar.</p>' +
        '<div class="sim-row"><label>Segment</label><select id="sim-seg"><option value="hilo">Yüksek Perf / Düşük Ücret</option><option value="all">Tüm Organizasyon</option></select>' +
        '<label>Artış (%)</label><input id="sim-pct" type="number" value="10"/></div>' +
        '<div class="sim-actions"><button class="btn primary" id="sim-run">Simüle Et</button><div id="sim-out" class="sim-out muted-txt"></div></div></div>';
    },
    cohort: function (ctx) { return featurePlaceholder('Cohort Analizi', 'Belirli risk, performans veya ücret profiline sahip çalışan gruplarını tanımlama ve karşılaştırma aracı.'); },
    alerts: function (ctx) { return featurePlaceholder('Uyarı Motoru', 'Eşik, trend ve anomaly tabanlı bildirimler gösterir.'); }
  };

  window.ROTA_FEATURES = {
    renderKpiCard: kpiCard,
    placeholder: featurePlaceholder,
    modules: MODULES,
    initCompSim: function () {
      var run = document.getElementById('sim-run');
      if (!run) return;
      run.addEventListener('click', function () {
        var seg = document.getElementById('sim-seg').value;
        var pct = parseFloat(document.getElementById('sim-pct').value || 0);
        var out = document.getElementById('sim-out');
        out.innerHTML = 'Simülasyon uygulandı: segment ' + esc(seg) + ', artış %' + esc(pct) + '. Yaklaşık bütçe etkisi önizlemesi burada çıkacak.';
      });
    }
  };

})();
