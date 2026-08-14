/* ============================================================
   ROTA · app.js — Uygulama mantığı
   Durum yönetimi, departman izolasyonlu filtreleme, ekran çizimi,
   kayıt işlemleri, Excel/CSV toplu içe-dışa aktarım, etkileşimler.
   + Standart Rapor motoru (11 bölüm · veri → içgörü → aksiyon)
   ============================================================ */
(function () {
  "use strict";

  var CH = window.ROTA_CHARTS, DATA = window.ROTA_DATA;
  var DB = DATA.load();
  var COL = { green: "#15A05A", amber: "#E5A100", red: "#DC2B3A", blue: "#2D6CDF", ai: "#00AFC6", muted: "#697485", ink: "#061B49", brand: "#1768E8" };
  var state = { view: "exec", dept: "all", persona: "lider", period: "q2", search: "", riskFilter: "all", dirFilter: "all", assistantHistory: [
    { sender: 'bot', text: 'Merhaba! ROTA Asistanım burada. İç verilerle ilgili sorularınızı sorabilirsiniz.', source: 'Başlangıç' }
  ] };

  /* ---------------- yardımcılar ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return CH.esc(s == null ? "" : s); }
  function deptName(id) { if (id === "all") return "Tüm Organizasyon"; var d = DB.departments.find(function (x) { return x.id === id; }); return d ? d.name : id; }
  function deptObj(id) { return DB.departments.find(function (x) { return x.id === id; }); }
  function round(x) { return Math.round(x); }

  function toast(msg, type) {
    var c = $("#toasts"); var t = document.createElement("div");
    t.className = "toast " + (type || "ok");
    t.innerHTML = (type === "warn" ? "⚠ " : type === "err" ? "✕ " : "✓ ") + esc(msg);
    c.appendChild(t); setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 2600);
  }
  function openDrawer(title, html) { $("#d-title").innerHTML = title; $("#d-body").innerHTML = html; $("#drawer").classList.add("on"); $("#scrim").classList.add("on"); }
  function closeDrawer() { $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); }
  function closeModal() { $("#modal-root").classList.remove("on"); $("#modal-root").innerHTML = ""; }

  function assistantRender() {
    var out = $("#assistant-messages"); if (!out) return;
    out.innerHTML = state.assistantHistory.map(function (msg) {
      return '<div class="assistant-message ' + msg.sender + '"><div class="assistant-bubble"><div class="assistant-bubble-text">' + esc(msg.text) + '</div>' +
        (msg.source ? '<div class="assistant-source"><strong>Kaynak:</strong> ' + esc(msg.source) + '</div>' : '') + '</div></div>';
    }).join('');
    out.scrollTop = out.scrollHeight;
  }

  function assistantAnswer(question) {
    var q = question.toLowerCase();
    var f = F();
    var m = metrics();
    var emps = DB.employees.slice();
    var parts = [];
    var source = [];
    if (q.indexOf("en düşük ücret") >= 0 || q.indexOf("düşük ücret") >= 0) {
      var sorted = emps.slice().sort(function (a, b) { return a.marketDelta - b.marketDelta; });
      var best = sorted[0];
      parts.push('En düşük ücret alan çalışan ' + best.name + ' (' + best.role + ', ' + deptName(best.dept) + ') olarak görünüyor. Ücret farkı ' + best.marketDelta + '%');
      source.push('Çalışan Dizini', 'Ücret – Performans Dengesi');
    }
    if (q.indexOf("yıldız") >= 0 && q.indexOf("9 kutu") >= 0 || q.indexOf("ninebox") >= 0 || q.indexOf("nine box") >= 0) {
      var stars = emps.filter(function (e) { return e.nineBox.toLowerCase().indexOf('yıldız') >= 0; });
      if (stars.length) {
        parts.push('9 kutuda Yıldız kategorisinde ' + stars.length + ' çalışan var: ' + stars.slice(0, 8).map(function (e) { return e.name; }).join(', ') + (stars.length > 8 ? ', ...' : '') + '.');
        source.push('Çalışan Dizini', 'Performans ve Organizasyon Sağlığı');
      }
    }
    if (q.indexOf("en düşük maaş") >= 0 || q.indexOf("en düşük ücret alan") >= 0) {
      var sorted2 = emps.slice().sort(function (a, b) { return a.marketDelta - b.marketDelta; });
      var low = sorted2[0];
      parts.push(low.name + ' en düşük ücret grubunda yer alıyor. ' + low.role + ' · ' + low.nineBox + ' · ' + deptName(low.dept));
      source.push('Çalışan Dizini');
    }
    if (q.indexOf("yıldız kategorideki") >= 0 || q.indexOf("yıldız kategorideki çalışanlar") >= 0) {
      var stars2 = emps.filter(function (e) { return e.nineBox === 'Yıldız'; });
      if (stars2.length) {
        parts.push('Yıldız kategorisinde olanlar: ' + stars2.map(function (e) { return e.name + ' (' + e.role + ')'; }).join(', ') + '.');
        source.push('Performans ve Organizasyon Sağlığı');
      }
    }
    if (q.indexOf("risk") >= 0 || q.indexOf("tehdit") >= 0) {
      var top = f.risks.slice().sort(function (a, b) { return b.sev - a.sev; }).slice(0, 3);
      parts.push('En kritik riskler şu şekilde: ' + top.map(function (r) { return r.risk + ' (' + r.sev + ')'; }).join(', ') + '.');
      parts.push('Bu riskler bölümünde iş etkisi ve aksiyon önerileri ile takip ediliyor.');
      source.push('Risk Haritası', 'Uyarı Merkezi');
    }
    if (q.indexOf("ücret") >= 0 || q.indexOf("maaş") >= 0 || q.indexOf("performans") >= 0) {
      parts.push('Ücret-performans dengesi için yüksek performans / düşük ücret segmenti önemli. Bu segment %' + round(m.pay.hilo) + ' ile öne çıkıyor.');
      parts.push('Ayrıca ücret adaleti algısı ve teklif kabul oranı da takip ediliyor.');
      source.push('Ücret – Performans Dengesi', 'Yönetici Özeti');
    }
    if (q.indexOf("yedek") >= 0 || q.indexOf("succession") >= 0 || q.indexOf("kritik rol") >= 0) {
      parts.push('Kritik rollerin yedeksizliği ' + m.openCrit + ' adımda önemli bir iş riski olarak öne çıkıyor.');
      parts.push('Hazır yedek aday oranı ve göreve hazırlık bu konuda öncelikli aksiyon alanıdır.');
      source.push('Succession & Yedekleme', 'GZFT Analizi');
    }
    if (q.indexOf("bağlılık") >= 0 || q.indexOf("pulse") >= 0) {
      parts.push('Bağlılık düzeyi ' + round(m.eng) + ' ile analiz ediliyor. En zayıf tema ücret adaleti algısı.');
      parts.push('Pulse sonuçları, bağlılığı ve ayrılma riskini yönlendiren en güncel içgörüdür.');
      source.push('Pulse Nabzı', 'Bağlılık ve Çalışan Deneyimi');
    }
    if (q.indexOf("çalışan") >= 0 || q.indexOf("departman") >= 0) {
      parts.push('Tüm organizasyonda toplam çalışan sayısı ' + m.hc + '. Departman bazında filtreleme yapabilirsiniz.');
      source.push('İş Gücü Görünümü', 'Çalışan Dizini');
    }
    if (!parts.length) {
      var general = 'ROTA Asistanım, güncel veritabanı, riskler, aksiyonlar, ücret dengesi, bağlılık ve yedekleme bilgilerinden yanıt üretir. Lütfen risk, ücret, yedekleme, bağlılık veya departman gibi bir konu sorun.';
      return { text: general, source: 'Genel Asistan Rehberi' };
    }
    return { text: parts.join(' '), source: source.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · ') };
  }

  function assistantSend() {
    var input = $("#assistant-input"); if (!input) return;
    var question = input.value.trim(); if (!question) return;
    state.assistantHistory.push({ sender: 'user', text: question });
    input.value = '';
    var answer = assistantAnswer(question);
    state.assistantHistory.push({ sender: 'bot', text: answer.text, source: answer.source });
    assistantRender();
  }

  function assistantToggle(open) {
    var panel = $("#assistant-panel");
    if (!panel) return;
    if (open === undefined) open = !panel.classList.contains('on');
    panel.classList.toggle('on', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      assistantRender();
      var input = $("#assistant-input"); if (input) input.focus();
    }
  }

  function modalForm(title, fields, onSubmit, opts) {
    opts = opts || {};
    var body = fields.map(function (f) {
      var id = "f_" + f.key, inp;
      if (f.type === "select") inp = '<select id="' + id + '">' + f.options.map(function (o) { var v = o.v !== undefined ? o.v : o, l = o.l !== undefined ? o.l : o; return '<option value="' + esc(v) + '"' + (String(f.value) === String(v) ? " selected" : "") + '>' + esc(l) + '</option>'; }).join("") + '</select>';
      else if (f.type === "textarea") inp = '<textarea id="' + id + '" rows="' + (f.rows || 3) + '">' + esc(f.value || "") + '</textarea>';
      else inp = '<input id="' + id + '" type="' + (f.type || "text") + '" value="' + esc(f.value == null ? "" : f.value) + '">';
      return '<label class="fld' + (f.full ? " full" : "") + '"><span>' + esc(f.label) + (f.hint ? ' <em>' + esc(f.hint) + '</em>' : '') + '</span>' + inp + '</label>';
    }).join("");
    $("#modal-root").innerHTML =
      '<div class="modal-scrim" data-act="modal-close"></div>' +
      '<div class="modal"><div class="modal-h"><b>' + esc(title) + '</b><button data-act="modal-close" class="x">×</button></div>' +
      '<div class="modal-b"><div class="form-grid">' + body + '</div>' + (opts.note ? '<p class="modal-note">' + opts.note + '</p>' : '') + '</div>' +
      '<div class="modal-f"><button class="btn" data-act="modal-close">Vazgeç</button><button class="btn primary" id="modal-save">' + (opts.saveLabel || "Kaydet") + '</button></div></div>';
    $("#modal-root").classList.add("on");
    $("#modal-save").onclick = function () {
      var vals = {}; fields.forEach(function (f) { var elx = $("#f_" + f.key); vals[f.key] = elx ? elx.value : ""; });
      var err = onSubmit(vals); if (!err) closeModal();
    };
  }

  /* ---------------- filtreleme (DEPARTMAN İZOLASYONU) ---------------- */
  function F() {
    var d = state.dept, q = state.search.trim().toLowerCase();
    var emps = d === "all" ? DB.employees.slice() : DB.employees.filter(function (e) { return e.dept === d; });
    if (q) emps = emps.filter(function (e) { return (e.name + " " + e.role + " " + deptName(e.dept)).toLowerCase().indexOf(q) >= 0; });
    return {
      emps: emps,
      exits: d === "all" ? DB.exits.slice() : DB.exits.filter(function (x) { return x.dept === d; }),
      positions: d === "all" ? DB.positions.slice() : DB.positions.filter(function (x) { return x.dept === d; }),
      risks: d === "all" ? DB.risks.slice() : DB.risks.filter(function (x) { return x.dept === d || x.dept === "all"; }),
      actions: d === "all" ? DB.actions.slice() : DB.actions.filter(function (x) { return x.dept === d || x.dept === "all"; }),
      notes: d === "all" ? DB.notes.slice() : DB.notes.filter(function (x) { return x.dept === d; })
    };
  }
  function orgMetric(key) { var tot = 0, sum = 0; DB.departments.forEach(function (d) { tot += d.hc; sum += d.m[key] * d.hc; }); return sum / tot; }
  function orgPay() {
    var tot = 0, a = 0, hl = 0, lh = 0, o = 0;
    DB.departments.forEach(function (d) { tot += d.hc; a += d.pay.aligned * d.hc; hl += d.pay.hilo * d.hc; lh += d.pay.lohi * d.hc; o += d.pay.other * d.hc; });
    return { aligned: a / tot, hilo: hl / tot, lohi: lh / tot, other: o / tot };
  }
  function metrics() {
    var d = state.dept;
    if (d === "all") {
      var hc = DB.departments.reduce(function (a, x) { return a + x.hc; }, 0);
      return { hc: hc, vol: orgMetric("vol"), invol: orgMetric("invol"), hipo: orgMetric("hipo"), top3: orgMetric("top3"),
        readyNow: orgMetric("readyNow"), eng: orgMetric("eng"), enps: orgMetric("enps"), ttf: orgMetric("ttf"), offer: orgMetric("offer"),
        pay: orgPay(), openCrit: DB.departments.reduce(function (a, x) { return a + x.m.openCrit; }, 0) };
    }
    var o = deptObj(d);
    return { hc: o.hc, vol: o.m.vol, invol: o.m.invol, hipo: o.m.hipo, top3: o.m.top3, readyNow: o.m.readyNow, eng: o.m.eng, enps: o.m.enps, ttf: o.m.ttf, offer: o.m.offer, pay: o.pay, openCrit: o.m.openCrit };
  }
  function healthScore(m) { return Math.max(0, Math.min(100, round(0.45 * m.eng + 0.30 * m.readyNow + 0.25 * (100 - (m.vol + m.invol) * 2.0)))); }

  function distros(emps) {
    var perf = [0, 0, 0, 0, 0], seg = { aligned: 0, hilo: 0, lohi: 0, other: 0 }, flight = 0, hipo = 0;
    var nb = {};
    emps.forEach(function (e) {
      perf[e.perf - 1]++; seg[e.paySeg]++;
      if (e.flight === "Yüksek") flight++;
      if (e.pot === "Yüksek" && e.perf >= 4) hipo++;
      nb[e.nineBox] = (nb[e.nineBox] || 0) + 1;
    });
    return { perf: perf, seg: seg, flight: flight, hipo: hipo, nb: nb, n: emps.length };
  }
  function scaleTo(part, n, hc) { return n ? round(part / n * hc) : 0; }

  /* ---------------- küçük arayüz parçaları ---------------- */
  function kpi(o) {
    return '<div class="card kpi">' + (o.tag ? '<span class="tag ' + o.tag.t + '">' + o.tag.l + '</span>' : '') +
      '<div class="label">' + esc(o.label) + (o.explain ? ' <button class="i-explain" data-act="explain" data-k="' + o.explain + '">açıkla</button>' : '') + '</div>' +
      '<div class="val">' + o.val + '</div>' +
      (o.delta ? '<div class="delta ' + o.delta.c + '">' + o.delta.t + '</div>' : '') +
      (o.spark ? o.spark : '') +
      (o.insight ? '<div class="insight-line"><span class="il-ic"></span><p>' + o.insight + '</p></div>' : '') +
      '</div>';
  }
  function card(title, inner, extra) {
    return '<div class="card"><div class="card-h"><h3>' + esc(title) + '</h3>' + (extra || '') + '</div>' + inner + '</div>';
  }
  function aiBox(o) {
    return '<div class="ai-box"><div class="ai-head"><span class="ai-chip">✦ Yapay Zekâ</span>' + (o.title ? '<b>' + esc(o.title) + '</b>' : '') +
      (o.conf ? '<span class="ai-conf">Güven %' + o.conf + '<span class="conf-bar"><i style="width:' + o.conf + '%"></i></span></span>' : '') + '</div>' +
      (o.chain ? '<div class="chain"><span class="d">VERİ</span>▶<span class="i">İÇGÖRÜ</span>▶<span class="a">AKSİYON</span></div>' : '') +
      o.body + (o.actions ? '<div class="ai-actions">' + o.actions + '</div>' : '') + '</div>';
  }
  function chip(label, cls) { return '<span class="pill ' + (cls || '') + '">' + esc(label) + '</span>'; }
  function deptScopeNote() { return state.dept === "all" ? "" : '<span class="scope-note">● Tek departman görünümü: ' + esc(deptName(state.dept)) + '</span>'; }

  /* --- veri → içgörü → aksiyon zinciri (rapor prensibi) --- */
  function chainRow(dataTxt, insightTxt, actionTxt, actionSeed) {
    return '<div class="chain-row">' +
      '<div class="cr-d"><span class="cr-lbl">Veri</span><p>' + dataTxt + '</p></div>' +
      '<div class="cr-i"><span class="cr-lbl">İçgörü</span><p>' + insightTxt + '</p></div>' +
      '<div class="cr-a"><span class="cr-lbl">Aksiyon</span><p>' + actionTxt + '</p>' +
      (actionSeed ? '<button class="act-btn" data-act="seed-action" data-title="' + esc(actionSeed.title) + '" data-source="' + esc(actionSeed.source) + '" data-impact="' + esc(actionSeed.impact || "Orta") + '">→ Aksiyon oluştur</button>' : '') +
      '</div></div>';
  }
  function oneMsg(text) { return '<div class="one-msg"><span class="om-lbl">Kritik içgörü · tek net mesaj</span><p>' + text + '</p></div>'; }

  /* ============================================================
     EKRANLAR
     ============================================================ */
  var META = {
    exec: ["Yönetici Özeti", "30 saniyede organizasyon sağlığı"],
    report: ["Standart Rapor", "11 bölümlük yönetim raporu · veri → içgörü → aksiyon"],
    ai: ["Yapay Zekâ İçgörü Merkezi", "Tüm modüllerden önceliklendirilmiş içgörüler"],
    assistant: ["ROTA Asistanım", "İç verilerle sorularınıza yanıt veren yardımcı"],
    alerts: ["Uyarı Merkezi", "Eşik aşan kritik sinyaller"],
    actions: ["Aksiyon Takip Merkezi", "Aksiyon sahibi / termin / durum"],
    workforce: ["İş Gücü Görünümü", "Yapısal profil ve büyüme dengesi"],
    org: ["Organizasyon ve Yapı", "Yapının strateji ile uyumu"],
    talent: ["Yetenek ve Yedekleme", "Liderlik hattı ve süreklilik"],
    turnover: ["İşe Alım ve Çalışan Devri", "Kayıp nedeni ve işe alım etkinliği"],
    perf: ["Performans ve Organizasyon Sağlığı", "Sistem sağlığı ve 9 kutu analizi"],
    pay: ["Ücret – Performans Dengesi", "Elde tutma ve ücret adaleti risk motoru"],
    engage: ["Bağlılık ve Çalışan Deneyimi", "Çalışan deneyiminin belirleyicileri"],
    attrition: ["Tahmine Dayalı Ayrılma", "Risk skorları ve ayrılma sinyalleri"],
    succession: ["Succession & Yedekleme", "Kritik rol sürekliliği ve 9 kutu"],
    compSim: ["Ücret Senaryosu", "Bütçe etkisi ve düzeltme modelleri"],
    pulse: ["Pulse Nabzı", "Çalışan deneyimi nabzı ve aksiyon planı"],
    assistant: ["ROTA Asistanım", "İç verilerle sorularınıza yanıt veren yardımcı"],
    cohort: ["Cohort Analizi", "Departman ve risk bazlı segment analizi"],
    risk: ["Risk Haritası", "Net risk görünürlüğü: veri → etki → aksiyon"],
    swot: ["GZFT Analizi", "Stratejik konum"],
    strat: ["Stratejik Öncelikler", "6–12 aylık öncelik planı"],
    directory: ["Çalışan Dizini", "Ara, filtrele, kişi kartına in"],
    onetoone: ["Birebir Görüşme Notları", "Saha gözlemi + yapay zekâ ile zenginleştirme"],
    reqs: ["İşe Alım Hattı", "Açık pozisyon yönetimi"],
    comp: ["Ücret Gözden Geçirme", "Kayıp riski + senaryo simülasyonu"],
    data: ["Veri Yönetimi", "Toplu Excel/CSV içe-dışa aktarım ve kayıt işlemleri"]
  };

  var VIEWS = {};

  /* ---- ortak içgörü üreticileri (her KPI bir içgörü üretir) ---- */
  function insTurnover(m) {
    var f = F(), rc = {};
    f.exits.forEach(function (x) { rc[x.reason] = (rc[x.reason] || 0) + 1; });
    var top = Object.keys(rc).sort(function (a, b) { return rc[b] - rc[a]; })[0] || "Ücret & yan haklar";
    var kok = top.indexOf("Ücret") === 0 ? "ücret konumlandırma" : (top.indexOf("Yönetici") === 0 ? "yönetici ilişkisi" : (top.indexOf("Kariyer") === 0 ? "kariyer görünürlüğü" : "çalışan deneyimi"));
    return "Devir oranı bir <b>sayı değil sinyal</b>: kök neden " + esc(kok) + ". Tek tip zam değil, segment bazlı müdahale gerekir.";
  }
  function insPay(m, hiloN) {
    return "Ücret farkı bir <b>bütçe kalemi değil kayıp riski</b>: " + hiloN + " yüksek performanslı çalışan piyasa altında; kayıp maliyeti düzeltme maliyetinden yüksek.";
  }
  function insEng(m, th) {
    var low = th.dev[0] ? th.dev[0][0] : "Ücret adaleti algısı";
    return "Bağlılık skoru tek başına yeterli değil: en zayıf tema <b>" + esc(low) + "</b> ve bu tema çıkış nedenleriyle örtüşüyor — algı davranışa dönüşüyor.";
  }
  function insSucc(m) {
    return "Yedeksizlik bir <b>İK metriği değil iş sürekliliği riski</b>: " + m.openCrit + " kritik rolde ayrılma olursa devralacak hazır aday yok.";
  }
  function insTTF(m) {
    return m.ttf > 40
      ? "Pozisyon kapatma süresi <b>proje takvimini geciktiriyor</b>; kritik rollerde her gecikme doğrudan iş çıktısına yansıyor."
      : "İşe alım hızı hedefte; kritik rollerde bu tempo korunmalı.";
  }

  VIEWS.exec = function () {
    var m = metrics(), f = F(), dis = distros(f.emps), hs = healthScore(m);
    var hiloN = scaleTo(dis.seg.hilo, dis.n, m.hc);
    var risks = f.risks.slice().sort(function (a, b) { return b.sev - a.sev; });
    var riskCards = risks.slice(0, 3).map(function (r, i) {
      return '<div class="exec-card risk"><div class="rank">' + (i + 1) + '</div><h4>' + esc(r.risk) + '</h4><p>' + esc(r.data) + '</p><div class="meta">' + chip("Etki: " + r.impact, "r") + chip(r.owner, "") + '</div></div>';
    }).join("") || '<div class="empty">Bu departmanda kayıtlı risk yok.</div>';

    var opps = [
      ["Güçlü iç terfi hattı", "Göreve hazır yedek aday oranı %" + round(m.readyNow) + "; açık liderlik rollerinin önemli kısmı içeriden karşılanabilir."],
      ["Yüksek ekip ve lider güveni", "Bağlılık endeksi " + round(m.eng) + "; işveren markası için güçlü kaldıraç."],
      ["Yetenek çekim merkezi potansiyeli", "Güçlü segmentler doğru çalışan değer önermesiyle cazibe merkezine dönüşebilir."]
    ];
    var oppCards = opps.map(function (o, i) { return '<div class="exec-card opp"><div class="rank">' + (i + 1) + '</div><h4>' + esc(o[0]) + '</h4><p>' + esc(o[1]) + '</p></div>'; }).join("");

    var acts = f.actions.filter(function (a) { return a.status !== "Tamamlandı"; }).slice(0, 3);
    var actCards = acts.map(function (a, i) { return '<div class="exec-card act"><div class="rank">' + (i + 1) + '</div><h4>' + esc(a.title) + '</h4><p>' + chip("Sahip: " + a.owner, "b") + chip("Termin: " + a.due, "") + '</p></div>'; }).join("") || '<div class="empty">Aksiyon yok.</div>';

    return '<div class="health-hero"><div class="eyebrow">Organizasyon Sağlığı · ' + esc(deptName(state.dept)) + ' · 2026 2. Çeyrek</div>' +
      '<h2>' + (hs >= 70 ? "Güçlü temel; kritik fonksiyonlarda ücret–performans uyumsuzluğu çalışanı elde tutma riskini yükseltiyor." : "Bu kapsamda elde tutma ve süreklilik riski yönetim dikkati gerektiriyor.") + '</h2>' +
      '<p class="hero-motto">ROTA · Veriden Karara, Karardan Etkiye</p>' +
      '<div class="hstats"><div><b>' + hs + '<span>/100</span></b><span>Sağlık Skoru</span></div>' +
      '<div><b>' + m.hc.toLocaleString("tr-TR") + '</b><span>Çalışan Sayısı</span></div>' +
      '<div><b>%' + round(m.vol + m.invol) + '</b><span>Çalışan Devir Oranı</span></div>' +
      '<div><b>' + hiloN.toLocaleString("tr-TR") + '</b><span>Yüksek performans / düşük ücret</span></div></div></div>' +
      '<div class="section-title">30 Saniyelik Yönetici Özeti ' + deptScopeNote() + '</div>' +
      '<div class="grid g-3">' +
      '<div><div class="col-h r">⚠ EN KRİTİK 3 RİSK</div>' + riskCards + '</div>' +
      '<div><div class="col-h g">✦ EN İYİ 3 FIRSAT</div>' + oppCards + '</div>' +
      '<div><div class="col-h b">→ EN ÖNEMLİ 3 AKSİYON</div>' + actCards + '</div></div>' +
      aiBox({ title: "Yapay Zekâ Yönetici Anlatımı", conf: 86, chain: true,
        body: '<p><b>Ne oluyor?</b> ' + esc(deptName(state.dept)) + ' genelinde sağlık skoru ' + hs + '/100; çalışan devir oranı %' + round(m.vol + m.invol) + ', yüksek performanslı ancak düşük ücretli grup yaklaşık ' + hiloN + ' kişi.</p>' +
          '<p><b>Ne yapılmalı?</b> Kritik grubu hedefli elde tutma paketine alın; modelleme önlenebilir kaybın yaklaşık %70 olduğunu gösteriyor.</p>',
        actions: '<button data-act="goto" data-v="report">▤ Standart Rapora git</button><button data-act="explain" data-k="exec">📊 Dayandığı veri</button><button data-act="goto" data-v="pay">→ Ücret – Performans Dengesi</button>' });
  };

  /* ============================================================
     STANDART RAPOR — 11 bölüm
     ============================================================ */
  VIEWS.report = function () {
    var m = metrics(), f = F(), dis = distros(f.emps), hs = healthScore(m);
    var hiloN = scaleTo(dis.seg.hilo, dis.n, m.hc), lohiN = scaleTo(dis.seg.lohi, dis.n, m.hc);
    var th = state.dept !== "all" && DB.deptThemes[state.dept] ? DB.deptThemes[state.dept] : DB.orgThemes;
    var risks = f.risks.slice().sort(function (a, b) { return b.sev - a.sev; });
    var n = f.emps.length || 1;
    var P = function (x) { return round(x / n * 100); };

    function sec(no, title, aim, inner, req) {
      return '<section class="rep-sec" id="rs-' + no + '"><div class="rep-sec-h"><span class="rep-no">' + no + '</span>' +
        '<h3>' + esc(title) + '</h3>' + (req ? '<span class="rep-req">ZORUNLU</span>' : '') +
        '<span class="rep-aim">· ' + esc(aim) + '</span></div>' + inner + '</section>';
    }

    /* ---- kapak ---- */
    var cover = '<div class="rep-cover"><div class="rc-top">' +
      '<div class="rc-logo"><img src="assets/rota-icon.png" alt="ROTA"></div>' +
      '<div><h2>Organizasyon Sağlığı Raporu</h2><div class="rc-sub">' + esc(deptName(state.dept)) + ' · 2026 2. Çeyrek · ROTA standart rapor formatı</div></div>' +
      '<div class="rc-meta">' +
      '<div><span>Sağlık Skoru</span><b>' + hs + '/100</b></div>' +
      '<div><span>Çalışan</span><b>' + m.hc.toLocaleString("tr-TR") + '</b></div>' +
      '<div><span>Devir Oranı</span><b>%' + round(m.vol + m.invol) + '</b></div>' +
      '<div><span>Açık Risk</span><b>' + risks.filter(function (r) { return r.status !== "Tamamlandı"; }).length + '</b></div>' +
      '</div></div>' +
      '<div class="rep-rules"><span>Her KPI bir içgörü üretir</span><span>Her içgörü aksiyona bağlanır</span><span>Veri → İçgörü → Aksiyon</span><span>Maksimum sadelik</span><span>Yönetim dili · iş etkisi</span></div></div>';

    /* ---- bölüm içi gezinme ---- */
    var navItems = [["1","Yönetici Özeti"],["2","İş Gücü"],["3","Organizasyon"],["4","Yetenek"],["5","Devir"],["6","Performans"],["7","Ücret"],["8","Bağlılık"],["9","Risk"],["10","GZFT"],["11","Öncelikler"]];
    var repNav = '<div class="rep-nav"><span class="rn-lbl">Bölümler:</span>' +
      navItems.map(function (i) { return '<a href="#rs-' + i[0] + '">' + i[0] + '. ' + i[1] + '</a>'; }).join("") + '</div>';

    /* ---- 1. Yönetici Özeti ---- */
    var s1 = '<div class="chain-card" style="margin-bottom:14px"><span class="cr-lbl" style="background:#EAF0FA;color:' + COL.blue + '">Organizasyon Sağlığı · tek cümle</span>' +
      '<p style="margin:8px 0 0;font-size:14.5px;line-height:1.6;font-weight:600">' +
      (hs >= 70
        ? esc(deptName(state.dept)) + " temel göstergelerde sağlıklı (skor " + hs + "/100) ve iç terfi kapasitesi güçlü; ancak yüksek performanslı çalışanlardaki ücret geriliği ve " + m.openCrit + " yedeksiz kritik rol, önümüzdeki iki çeyrekte iş sürekliliğini riske atıyor."
        : esc(deptName(state.dept)) + " sağlık skoru " + hs + "/100 ile eşiğin altında; çalışan devri %" + round(m.vol + m.invol) + " ve ücret–performans uyumsuzluğu birlikte okunduğunda kritik yetenek kaybı riski yönetim gündemine alınmalıdır.") +
      '</p></div>' +
      '<div class="grid g-3">' +
      '<div><div class="col-h r">⚠ EN KRİTİK 3 RİSK</div>' +
      (risks.slice(0, 3).map(function (r, i) { return '<div class="exec-card risk"><div class="rank">' + (i + 1) + '</div><h4>' + esc(r.risk) + '</h4><p>' + esc(r.data) + '</p><div class="meta">' + chip("Etki: " + r.impact, "r") + '</div></div>'; }).join("") || '<div class="empty">Risk yok.</div>') + '</div>' +
      '<div><div class="col-h g">✦ EN İYİ 3 FIRSAT</div>' +
      '<div class="exec-card opp"><div class="rank">1</div><h4>İç terfi kapasitesi</h4><p>Göreve hazır yedek aday %' + round(m.readyNow) + ' — dışarıdan alıma göre yaklaşık %40 daha ekonomik.</p></div>' +
      '<div class="exec-card opp"><div class="rank">2</div><h4>Güven ve marka gururu</h4><p>Bağlılık ' + round(m.eng) + '; çalışan referansı ve işveren markası için hazır kaldıraç.</p></div>' +
      '<div class="exec-card opp"><div class="rank">3</div><h4>Yüksek potansiyel havuzu</h4><p>Yüksek potansiyel oranı %' + round(m.hipo) + '; kritik rollere hızlı eşleştirme mümkün.</p></div></div>' +
      '<div><div class="col-h b">→ EN ÖNEMLİ 3 AKSİYON</div>' +
      (f.actions.filter(function (a) { return a.status !== "Tamamlandı"; }).slice(0, 3).map(function (a, i) { return '<div class="exec-card act"><div class="rank">' + (i + 1) + '</div><h4>' + esc(a.title) + '</h4><p>' + chip("Sahip: " + a.owner, "b") + chip("Termin: " + a.due, "") + '</p></div>'; }).join("") || '<div class="empty">Aksiyon yok.</div>') + '</div></div>';

    /* ---- 2. İş Gücü ---- */
    var ageB = [0, 0, 0, 0], tenB = [0, 0, 0, 0];
    f.emps.forEach(function (e) {
      e.age < 30 ? ageB[0]++ : e.age < 40 ? ageB[1]++ : e.age < 50 ? ageB[2]++ : ageB[3]++;
      e.tenure < 2 ? tenB[0]++ : e.tenure < 5 ? tenB[1]++ : e.tenure < 10 ? tenB[2]++ : tenB[3]++;
    });
    var avgTen = (f.emps.reduce(function (a, e) { return a + e.tenure; }, 0) / n).toFixed(1).replace(".", ",");
    var s2 = '<div class="grid g-4">' +
      kpi({ label: "Çalışan Sayısı", val: m.hc.toLocaleString("tr-TR"), delta: { c: "up", t: "▲ +%6,2" }, insight: "Büyüme sürüyor; <b>işe alım kalitesi ve ilk yıl bağlılığı</b> kritik hale geliyor." }) +
      kpi({ label: "Büyüme Eğilimi", val: "+%6,2", delta: { c: "up", t: "▲ 4 çeyrek üst üste" }, insight: "Büyüme yapısal; yönetim katmanı büyümeyle birlikte <b>sadeleştirilmezse karar hızı düşer</b>." }) +
      kpi({ label: "Ortalama Kıdem", val: avgTen + " yıl", delta: { c: "down", t: "▼ kıdem erozyonu" }, insight: "Kıdem düşüşü <b>kurumsal hafıza kaybı</b> anlamına gelir; bilgi transferi planlanmalı." }) +
      kpi({ label: "2 Yıldan Az Kıdemli", val: "%" + P(tenB[0]), delta: { c: "warn", t: "◆ erken dönem riski" }, insight: "Bu kütle <b>erken dönem ayrılmalara açık</b>; ilk yıl deneyimi doğrudan devir oranını belirler." }) +
      '</div><div class="grid g-2 mt">' +
      card("Yaş Dağılımı", CH.bars([{ label: "30 yaş altı", value: P(ageB[0]), color: COL.blue, suffix: "%" }, { label: "30–39 yaş", value: P(ageB[1]), color: COL.green, suffix: "%" }, { label: "40–49 yaş", value: P(ageB[2]), color: COL.amber, suffix: "%" }, { label: "50 yaş üstü", value: P(ageB[3]), color: COL.muted, suffix: "%" }], { max: 100 })) +
      card("Kıdem Dağılımı", CH.bars([{ label: "2 yıldan az", value: P(tenB[0]), color: COL.red, suffix: "%" }, { label: "2–5 yıl", value: P(tenB[1]), color: COL.amber, suffix: "%" }, { label: "5–10 yıl", value: P(tenB[2]), color: COL.green, suffix: "%" }, { label: "10 yıl üstü", value: P(tenB[3]), color: COL.blue, suffix: "%" }], { max: 100 })) +
      '</div><div class="mt">' +
      chainRow("Kıdem " + avgTen + " yıla geriledi; çalışanların %" + P(tenB[0]) + "'i 2 yıldan az kıdemli.",
        "Yapı çevik ama <b>deneyim tabanı inceliyor</b>; kurumsal hafıza ve müşteri ilişkileri aşınma riski taşıyor.",
        "İlk yıl bağlılık programı + kritik rollerde bilgi transferi ve mentorluk başlatılmalı.",
        { title: "İlk yıl bağlılık ve bilgi transferi programı", source: "İş Gücü", impact: "Orta" }) + '</div>';

    /* ---- 3. Organizasyon ---- */
    var deptsToShow = state.dept === "all" ? DB.departments : DB.departments.filter(function (d) { return d.id === state.dept; });
    var nodes = deptsToShow.map(function (d) {
      var cls = d.health === "red" ? "crit" : (d.health === "amber" ? "warn" : "");
      return '<div class="node ' + cls + '" data-act="setdept" data-d="' + d.id + '"><b>' + esc(d.name) + '</b><span>' + d.hc + ' · ' + (d.health === "red" ? "kritik" : d.health === "amber" ? "izlenmeli" : "iyi") + '</span></div>';
    }).join("");
    var s3 = '<div class="grid g-4">' +
      kpi({ label: "Yapı Sağlığı Skoru", val: "68/100", delta: { c: "warn", t: "◆ dengesiz" }, insight: "Yapı büyümeyi taşıyor ancak <b>karar hızını yavaşlatıyor</b>." }) +
      kpi({ label: "Ortalama Yönetim Alanı", val: "5,8", delta: { c: "warn", t: "◆ hedef 7–8" }, insight: "Dar yönetim alanı = <b>fazla katman, yavaş karar</b>; yönetici maliyeti artıyor." }) +
      kpi({ label: "Yönetim Katmanı", val: "7", delta: { c: "warn", t: "◆ hedef 6" }, insight: "4. ve 5. kademede rol örtüşmesi var; sadeleştirme <b>karar hızını ~%15 artırır</b>." }) +
      kpi({ label: "Açık Kritik Rol", val: m.openCrit, delta: { c: "down", t: "▼ yedeksiz" }, insight: insSucc(m) }) +
      '</div><div class="grid g-21 mt">' +
      card("Organizasyon Yapısı", '<div class="org-grid">' + nodes + '</div>', deptScopeNote()) +
      card("Katman Analizi", CH.bars([{ label: "1. Kademe İcra Kurulu", value: 9, color: COL.ink }, { label: "2. Kademe Direktör", value: 34, color: COL.brand }, { label: "3. Kademe Grup Müdürü", value: 96, color: COL.blue }, { label: "4. Kademe Müdür", value: 232, color: COL.green }, { label: "5. Kademe Yönetici", value: 410, color: COL.amber }, { label: "6.–7. Kademe Uzman", value: 3059, color: COL.muted }])) +
      '</div><div class="mt">' + card("Açık Roller ve Dönüşüm Planı", openPosTable(f.positions)) + '</div>' +
      '<div class="mt">' + chainRow("Yönetim alanı 5,8 (hedef 7–8); 7 katman; 4.–5. kademede rol örtüşmesi.",
        "Yapı stratejiyi taşıyor ancak <b>karar hızını düşürüyor</b>; fazla katman maliyeti operasyonel çevikliğe yansıyor.",
        "Yaklaşık 38 yönetici pozisyonu birleştirilerek 7 → 6 katmana inilmeli; yönetim alanı 7,1'e yükselir.",
        { title: "Yönetim katmanı sadeleştirme çalışması", source: "Organizasyon", impact: "Orta" }) + '</div>';

    /* ---- 4. Yetenek ve Yedekleme ---- */
    var crit = f.emps.filter(function (e) { return e.critical; });
    var s4 = '<div class="grid g-4">' +
      kpi({ label: "Yüksek Potansiyel Oranı", val: "%" + round(m.hipo), tag: { t: "g", l: "GÜÇLÜ" }, insight: "Havuz güçlü; asıl soru <b>bu potansiyelin kritik rollere yönlendirilip yönlendirilmediği</b>." }) +
      kpi({ label: "Üst 3 Kutu Oranı", val: "%" + round(m.top3), insight: "Liderlik hattı besleniyor; <b>terfi hızı bu oranı korumanın anahtarı</b>." }) +
      kpi({ label: "Göreve Hazır Yedek Aday", val: "%" + round(m.readyNow), insight: "Kritik boşlukta <b>kısa vadede rolü üstlenebilecek kapasite</b> mevcut; eşleştirme yapılmamış." }) +
      kpi({ label: "Yedeksiz Kritik Rol", val: m.openCrit, tag: { t: "r", l: "KRİTİK" }, insight: insSucc(m) }) +
      '</div><div class="grid g-2 mt">' +
      card("Yedekleme Gücü", CH.bars([{ label: "Göreve hazır", value: round(m.readyNow * 0.55), color: COL.green, suffix: "%" }, { label: "1–2 yılda hazır", value: 41, color: COL.blue, suffix: "%" }, { label: "Gelişim gerekli", value: 19, color: COL.amber, suffix: "%" }, { label: "Yedek aday yok", value: 6, color: COL.red, suffix: "%" }], { max: 100 })) +
      card("Kritik Rollerde Süreklilik", succTable()) +
      '</div><div class="mt">' + chainRow("Yüksek potansiyel %" + round(m.hipo) + " ve göreve hazır yedek %" + round(m.readyNow) + "; buna rağmen " + m.openCrit + " kritik rol yedeksiz.",
        "Sorun <b>yetenek yokluğu değil, eşleştirme eksikliği</b>; güçlü havuz kritik rollere bağlanmamış.",
        "Çapraz fonksiyon yedek aday eşleştirmesi + 9 aylık hızlandırılmış gelişim planı devreye alınmalı.",
        { title: "9 aylık yedekleme ve liderlik hattı programı", source: "Yetenek", impact: "Yüksek" }) + '</div>';

    /* ---- 5. İşe Alım ve Devir ---- */
    var rc = {}; f.exits.forEach(function (x) { rc[x.reason] = (rc[x.reason] || 0) + 1; });
    var palette = [COL.red, COL.amber, COL.blue, "#8FA0B8", "#C3CCD9", "#E0E5ED"];
    var segs = Object.keys(rc).sort(function (a, b) { return rc[b] - rc[a]; }).map(function (k, i) { return { label: k, value: rc[k], color: palette[i % palette.length] }; });
    var top3r = segs.slice(0, 3);
    var top2pct = segs.length ? round((segs.slice(0, 2).reduce(function (a, s) { return a + s.value; }, 0)) / f.exits.length * 100) : 0;
    var s5 = '<div class="grid g-4">' +
      kpi({ label: "Toplam Devir Oranı", val: "%" + round(m.vol + m.invol), tag: { t: m.vol > 15 ? "r" : "a", l: m.vol > 15 ? "RİSK" : "İZLE" }, insight: insTurnover(m) }) +
      kpi({ label: "Gönüllü / İşveren Kaynaklı", val: round(m.vol) + " / " + round(m.invol), insight: "Gönüllü ayrılma baskın → kayıp <b>performans yönetimi değil, elde tutma sorunu</b>." }) +
      kpi({ label: "Pozisyon Kapatma Süresi", val: round(m.ttf) + " gün", delta: { c: m.ttf > 40 ? "down" : "flat", t: m.ttf > 40 ? "▼ hedef 35" : "— hedefte" }, insight: insTTF(m) }) +
      kpi({ label: "Teklif Kabul Oranı", val: "%" + round(m.offer), insight: "Kabul oranı <b>işveren markası ve ücret konumunun aynası</b>; düşüş erken uyarıdır." }) +
      '</div><div class="grid g-2 mt">' +
      card("Çıkış Nedenleri — İlk 3", (top3r.length ? CH.bars(top3r.map(function (s, i) { return { label: s.label, value: s.value, color: palette[i] }; })) : '<div class="empty">Çıkış kaydı yok.</div>')) +
      card("Çıkış Nedeni Dağılımı", segs.length ? CH.donut(segs, "%" + top2pct, "ilk 2 neden") : '<div class="empty">Çıkış kaydı yok.</div>') +
      '</div><div class="mt">' + chainRow("Çıkışların %" + top2pct + "'i ilk iki nedenden; en yüksek neden: <b>" + esc(top3r[0] ? top3r[0].label : "—") + "</b>.",
        "Kayıp <b>fonksiyona göre farklı kök nedenden</b> besleniyor; genel zam kaynağı boşa harcar.",
        "Segment bazlı müdahale: ücret kaynaklı grupta konumlandırma, yönetici kaynaklı grupta koçluk.",
        { title: "Segment bazlı çalışan devri müdahale planı", source: "Çalışan Devri", impact: "Yüksek" }) + '</div>';

    /* ---- 6. Performans ---- */
    function nbCount(l) { return dis.nb[l] || 0; }
    var grid = [
      [{ label: "Bilmece", count: nbCount("Bilmece"), tone: "info" }, { label: "Gelecek Yıldız", count: nbCount("Gelecek Yıldız"), tone: "good" }, { label: "★ Yıldız", count: nbCount("Yıldız"), tone: "star" }],
      [{ label: "Çelişen", count: nbCount("Çelişen"), tone: "neutral" }, { label: "Çekirdek", count: nbCount("Çekirdek"), tone: "core" }, { label: "Yüksek Etki", count: nbCount("Yüksek Etki"), tone: "good" }],
      [{ label: "Riskli", count: nbCount("Riskli"), tone: "risk" }, { label: "Etkili Profesyonel", count: nbCount("Etkili Profesyonel"), tone: "neutral" }, { label: "Güvenilir Usta", count: nbCount("Güvenilir Usta"), tone: "core" }]
    ];
    var ustBlok = nbCount("Yıldız") + nbCount("Yüksek Etki");
    var s6 = '<div class="grid g-12">' +
      card("Performans Dağılımı (örneklem n=" + dis.n + ")", CH.bars([
        { label: "Olağanüstü", value: dis.perf[4], color: COL.green },
        { label: "Beklenti üstü", value: dis.perf[3], color: "#5DBE86" },
        { label: "Beklentiyi karşılıyor", value: dis.perf[2], color: COL.blue },
        { label: "Kısmen karşılıyor", value: dis.perf[1], color: COL.amber },
        { label: "Beklenti altı", value: dis.perf[0], color: COL.red }])) +
      card("9 Kutu Özeti", CH.nineBox(grid), '<span class="hint">Performans (→) × Potansiyel (↑)</span>') +
      '</div>' +
      oneMsg("Performans sistemi dengeli ve puan şişmesi yok — sorun <b>dağılımda değil, üst performans bloğunun (" + ustBlok + " kişi) ücret ve kariyer koşullarıyla korunamamasında</b>.") +
      '<div class="mt">' + chainRow("9 kutu üst-sağ bloğunda " + ustBlok + " kişi; bunların bir kısmı düşük ücret bandında.",
        "Performans ölçümü sağlıklı çalışıyor; <b>risk ödüllendirme tarafında</b> birikiyor.",
        "9 kutu üst bloğu ile ücret verisi kesiştirilip kritik elde tutma listesi üretilmeli.",
        { title: "Kritik elde tutma listesi oluşturma (9 kutu × ücret)", source: "Performans", impact: "Yüksek" }) + '</div>';

    /* ---- 7. Ücret – Performans ---- */
    var riskScore = Math.min(100, round(m.pay.hilo * 2.0 + m.pay.lohi * 1.0 + 20));
    var bubbles = [
      { x: 80, y: 22, r: 60, color: COL.red, label: "Kayıp", title: "Yüksek performans / düşük ücret" },
      { x: 70, y: 30, r: 44, color: "#E85d4a", label: "", title: "" },
      { x: 75, y: 74, r: 52, color: COL.green, label: "Hizalı", title: "dengeli" },
      { x: 28, y: 72, r: 40, color: "#C0392B", label: "Adalet", title: "Düşük performans / yüksek ücret" },
      { x: 34, y: 26, r: 28, color: "#9AA6B6", label: "İzle", title: "" }
    ];
    var s7 = '<div class="card pay-hero"><div class="card-h"><h3>Ücret – Performans Uyumu</h3><span class="pill r">ZORUNLU MODÜL</span>' + deptScopeNote() + '</div>' +
      '<div class="grid g-21" style="align-items:center"><div>' + CH.quadrant(bubbles) + '</div><div>' +
      CH.bars([{ label: "✓ Hizalı", value: round(m.pay.aligned), color: COL.green, suffix: "%" },
        { label: "Yüksek perf. / düşük ücret", value: round(m.pay.hilo), color: COL.red, suffix: "%" },
        { label: "Düşük perf. / yüksek ücret", value: round(m.pay.lohi), color: COL.amber, suffix: "%" },
        { label: "Diğer", value: round(m.pay.other), color: COL.muted, suffix: "%" }], { max: 100 }) +
      '<div class="grid g-2 mt">' +
      kpi({ label: "Risk Skoru", val: '<span style="color:' + COL.red + '">' + riskScore + '/100</span>', delta: { c: "down", t: "Yüksek" } }) +
      kpi({ label: "Kayıp Riski (kişi)", val: hiloN.toLocaleString("tr-TR"), delta: { c: "warn", t: crit.length + " kritik rol" } }) +
      '</div></div></div></div>' +
      '<div class="grid g-2 mt">' +
      aiBox({ title: "🔥 Kayıp riski · yüksek performans / düşük ücret", conf: 88, chain: true,
        body: '<p><b>Veri:</b> ' + hiloN + ' kişi düşük ücret bandında; kritik olanlar piyasa medyanının %18 altında.</p><p><b>İçgörü:</b> ' + insPay(m, hiloN) + '</p><p><b>Aksiyon:</b> 8 haftalık hedefli ücret düzeltmesi — önlenebilir kayıp %70, yatırım getirisi ~3,6 kat.</p>',
        actions: '<button data-act="seed-action" data-title="Hedefli elde tutma ve ücret düzeltme paketi" data-source="Ücret-Performans" data-impact="Yüksek">→ Aksiyon oluştur</button><button data-act="goto" data-v="comp">→ Ücret Gözden Geçirme</button>' }) +
      aiBox({ title: "⚠ Ücret adaleti riski · düşük performans / yüksek ücret", conf: 80, chain: true,
        body: '<p><b>Veri:</b> Yaklaşık ' + lohiN + ' çalışan performansının üzerinde ücret alıyor.</p><p><b>İçgörü:</b> Bu blok <b>yıldız çalışanların adalet algısını zedeliyor</b> ve motivasyon kaybı yaratıyor.</p><p><b>Aksiyon:</b> Performans planı + artış dondurma; bütçe üst performans grubuna kaydırılmalı.</p>',
        actions: '<button data-act="seed-action" data-title="Ücret adaleti gözden geçirme ve bütçe kaydırma" data-source="Ücret-Performans" data-impact="Orta">→ Aksiyon oluştur</button>' }) +
      '</div>';

    /* ---- 8. Bağlılık ---- */
    var s8 = '<div class="grid g-4">' +
      kpi({ label: "Bağlılık Endeksi", val: round(m.eng), tag: { t: m.eng >= 70 ? "g" : "a", l: m.eng >= 70 ? "İYİ" : "İZLE" }, insight: insEng(m, th) }) +
      kpi({ label: "Çalışan Tavsiye Skoru", val: "+" + round(m.enps), insight: "Pozitif skor <b>çalışan referansı ve işe alım maliyeti</b> için doğrudan kaldıraç." }) +
      kpi({ label: "Anket Katılım Oranı", val: "%84", insight: "Yüksek katılım <b>sonuçların güvenilir</b> olduğunu ve aksiyona temel oluşturduğunu gösterir." }) +
      kpi({ label: "En Düşük Tema", val: (th.dev[0] ? th.dev[0][1] : 54), delta: { c: "down", t: th.dev[0] ? th.dev[0][0] : "Ücret adaleti" }, insight: "Bu tema <b>birinci çıkış nedeniyle örtüşüyor</b> — algı davranışa dönüşmüş durumda." }) +
      '</div><div class="grid g-2 mt">' +
      card("Güçlü Alanlar", CH.bars(th.strong.map(function (t) { return { label: t[0], value: t[1], color: t[1] >= 75 ? COL.green : "#5DBE86" }; }), { max: 100 }), '<span class="pill g">koruyalım</span>') +
      card("Gelişim Alanları", CH.bars(th.dev.map(function (t) { return { label: t[0], value: t[1], color: t[1] < 56 ? COL.red : COL.amber }; }), { max: 100 }), '<span class="pill r">aksiyon</span>') +
      '</div>' +
      card("İK İş Ortağı Saha Gözlemi — verinin ötesindeki yorum",
        '<div class="note"><textarea id="rep-note" placeholder="Anketin yakalayamadığı saha gözleminizi yazın; yapay zekâ veriyle birleştirip yönetici diline çevirir..."></textarea><div id="rep-enriched"></div></div>',
        '<button class="mini-btn ai" data-act="enrich-rep">✨ Yapay zekâ ile zenginleştir</button>') ;

    /* ---- 9. Risk Haritası ---- */
    var riskTbl = risks.length ? '<table class="tbl"><thead><tr><th>Risk</th><th>Dayandığı Veri</th><th>İş Etkisi</th><th>Şiddet</th><th>Aksiyon</th><th>Sahip</th><th>Termin</th></tr></thead><tbody>' +
      risks.map(function (r) {
        var col = r.sev >= 7 ? COL.red : r.sev >= 5 ? COL.amber : COL.green;
        return '<tr><td><b>' + esc(r.risk) + '</b></td><td>' + esc(r.data) + '</td><td>' + esc(r.impact) + '</td>' +
          '<td><span class="sev"><span class="b" style="background:' + col + '"></span>' + r.sev + '</span></td>' +
          '<td>' + esc(r.action) + '</td><td>' + esc(r.owner) + '</td><td>' + esc(r.due) + '</td></tr>';
      }).join("") + '</tbody></table>' : '<div class="empty">Risk kaydı yok.</div>';
    var s9 = card("Risk Kaydı · her risk veriyle desteklenir, her risk bir aksiyona bağlanır", riskTbl,
      '<button class="mini-btn" data-act="risk-add">+ Risk Ekle</button>') +
      '<div class="mt">' + oneMsg("İlk iki risk toplam etkinin yaklaşık <b>%60'ını</b> taşıyor; kaynak ve yönetim dikkati bu ikisine yoğunlaştırılmalı.") + '</div>';

    /* ---- 10. GZFT ---- */
    var q = [
      ["s", "⊕ Güçlü Yönler", COL.green, [["İç liderlik hattı:", "Yüksek potansiyel %" + round(m.hipo) + ", göreve hazır yedek %" + round(m.readyNow) + " — açık rollerin yarısı içeriden karşılanabilir."], ["Kültürel zemin:", "Bağlılık " + round(m.eng) + "; değişim programları için sağlam taban."], ["Dengeli performans sistemi:", "Puan şişmesi yok; kararlar veriyle savunulabilir."]]],
      ["w", "⊖ Gelişim Alanları", COL.red, [["Ücret–performans uyumsuzluğu:", "Yüksek performanslıların %" + round(m.pay.hilo) + "'i düşük ücret bandında — doğrudan kayıp riski."], ["Kritik rol yedeksizliği:", m.openCrit + " yedeksiz kritik rol iş sürekliliğini tehdit ediyor."], ["İşe alım hızı:", "Pozisyon kapatma " + round(m.ttf) + " gün; kritik projelerde gecikme yaratıyor."]]],
      ["o", "⊙ Fırsatlar", COL.blue, [["Dijital yetenek merkezi:", "Büyüyen segmentler doğru çalışan değer önermesiyle cazibe merkezine dönüşebilir."], ["İç terfi motoru:", "Güçlü yedek havuzu dışarıdan alıma göre ~%40 daha ekonomik."], ["Çalışan referansı:", "Yüksek güven skoru referans yoluyla işe alımı besleyebilir."]]],
      ["t", "⊗ Tehditler", COL.amber, [["Rakip ücret baskısı:", "Piyasa teklifleri çıkışların birinci sebebi; gecikme kaybı büyütür."], ["Kıdem erozyonu:", "Ortalama kıdem geriliyor; kurumsal hafıza aşınıyor."], ["Adalet algısı sarmalı:", "Düşük performans / yüksek ücret bloğu yıldızların motivasyonunu zayıflatıyor."]]]
    ];
    var s10 = '<div class="flex mb"><span class="ai-chip">✦ Yapay Zekâ</span><span class="muted-txt">Veri listesi değil — veriyle beslenmiş, tek sayfalık yönetim yorumu.</span></div>' +
      '<div class="swot">' + q.map(function (x) {
        return '<div class="q ' + x[0] + '"><h4 style="color:' + x[2] + '">' + x[1] + '</h4><ul style="color:' + x[2] + '">' +
          x[3].map(function (i) { return '<li><b>' + esc(i[0]) + '</b> ' + esc(i[1]) + '</li>'; }).join("") + '</ul></div>';
      }).join("") + '</div>';

    /* ---- 11. Stratejik Öncelikler ---- */
    var pr = [
      [COL.brand, "1", "Kritik Yetenekleri Elde Tutma Programı", "0–3 ay", "En yüksek finansal ve süreklilik riski; rakip baskısı aktif.", hiloN + " kişi düşük ücret bandında; kritikler piyasa −%18.", "Kritik kaybın %70'i önlenir · yatırım getirisi ~3,6 kat.", "Ücret ve Yan Haklar + İK İş Ortağı"],
      [COL.blue, "2", "9 Aylık Yedekleme ve Liderlik Hattı Programı", "0–9 ay", m.openCrit + " yedeksiz kritik rol; iş sürekliliği riski.", "Yedeksizlik Ürün Yönetimi ve Finans'ta yoğunlaşıyor.", "Kritik rol kapsamı %100; iç terfi oranı yükselir.", "Yetenek Yönetimi"],
      [COL.amber, "3", "Çalışan Devri Kök Neden Programı", "0–6 ay", "Operasyon hızını etkileyen ayrılma artışı.", "En yüksek çıkış nedeni: " + (top3r[0] ? top3r[0].label : "—") + ".", "Devir oranında hedef 6 puan düşüş; bağlılık +6 puan.", "İK İş Ortağı"],
      [COL.green, "4", "İşe Alım Hızı ve İşveren Değeri", "3–9 ay", "Kritik açıkların proje etkisi ve büyüme fırsatı.", "Pozisyon kapatma " + round(m.ttf) + " gün; " + m.openCrit + " kritik açık.", "Kapatma süresi 35 güne; teklif kabulü artar.", "İşe Alım"],
      [COL.ai, "5", "Ücret Adaleti ve Yapı Sadeleştirme", "6–12 ay", "Algı davranışa dönüşüyor; adalet ve karar hızı.", "Adalet algısı " + (th.dev[0] ? th.dev[0][1] : 54) + "; 7. yönetim katmanı.", "Adalet algısı +11 puan; karar hızı +%15.", "Ücret ve Yan Haklar + Organizasyon Tasarımı"]
    ];
    var s11 = '<div class="flex mb"><span class="muted-txt">Tüm analizin sonucu — <b>"Ne anlama geliyor / Şimdi ne yapmalı"</b> · en fazla 5 aksiyon · her aksiyon iş etkisine bağlı</span></div>' +
      pr.map(function (p) {
        return '<div class="card strat-card" style="border-left:4px solid ' + p[0] + '"><div class="flex"><span class="rank" style="position:static;background:' + p[0] + ';color:#fff">' + p[1] + '</span><h3 style="margin:0 0 0 10px">' + esc(p[2]) + '</h3><span class="pill" style="margin-left:auto">' + p[3] + '</span></div>' +
          '<div class="grid g-4 mt"><div>' + chip("Neden öncelikli", "b") + '<p class="fn">' + esc(p[4]) + '</p></div>' +
          '<div>' + chip("Dayandığı veri", "b") + '<p class="fn">' + esc(p[5]) + '</p></div>' +
          '<div>' + chip("Beklenen iş etkisi", "b") + '<p class="fn">' + esc(p[6]) + '</p></div>' +
          '<div>' + chip("Sahip", "b") + '<p class="fn">' + esc(p[7]) + '</p>' +
          '<button class="act-btn" data-act="seed-action" data-title="' + esc(p[2]) + '" data-source="Stratejik Öncelik" data-impact="Yüksek">→ Aksiyon oluştur</button></div></div></div>';
      }).join("");

    /* ---- yazım prensipleri ---- */
    var rules = '<div class="section-title">Rapor Yazım Prensipleri</div><div class="rules-grid">' +
      '<div class="rule-card"><b>1 · Her KPI bir içgörü üretir</b><span class="rc-bad">"%15 devir oranı"</span><span class="rc-good">"Devir ücret değil deneyim kaynaklı"</span></div>' +
      '<div class="rule-card"><b>2 · Her içgörü aksiyona bağlanır</b><span class="rc-bad">"Ücret memnuniyeti düşük"</span><span class="rc-good">"Kritik elde tutma planı gerekli"</span></div>' +
      '<div class="rule-card"><b>3 · Veri → İçgörü → Aksiyon</b><span class="rc-good">Her bölüm bu zincirle ilerler; zincir kırılmaz.</span></div>' +
      '<div class="rule-card"><b>4 · Maksimum sadelik</b><span class="rc-good">Az metin, net mesaj; her bölümde tek ana fikir.</span></div>' +
      '<div class="rule-card"><b>5 · Yönetim dili</b><span class="rc-bad">Teknik İK terminolojisi</span><span class="rc-good">İş etkisi odaklı anlatım</span></div>' +
      '</div>';

    return cover + repNav +
      sec(1, "Yönetici Özeti", "Üst yönetimin 30 saniyede durumu anlaması", s1, true) +
      sec(2, "İş Gücü Görünümü", "Organizasyonun yapısal profilini göstermek", s2) +
      sec(3, "Organizasyon ve Yapı", "Yapının stratejiyi taşıyıp taşımadığını göstermek", s3) +
      sec(4, "Yetenek ve Yedekleme", "Gelecekteki liderlik kapasitesi ve süreklilik riski", s4) +
      sec(5, "İşe Alım ve Çalışan Devri", "İnsan kaybının nedenini anlamak", s5) +
      sec(6, "Performans ve Yetenek Sağlığı", "Performans sisteminin sağlığını değerlendirmek", s6) +
      sec(7, "Ücret – Performans Dengesi", "En kritik elde tutma ve motivasyon riskini görmek", s7, true) +
      sec(8, "Bağlılık ve Çalışan Deneyimi", "Çalışan deneyiminin ana belirleyicilerini anlamak", s8) +
      sec(9, "Risk Haritası", "Yönetim için net risk görünürlüğü sağlamak", s9, true) +
      sec(10, "GZFT Analizi", "Organizasyonun genel konumunu hızlı özetlemek", s10) +
      sec(11, "Stratejik Öncelikler (6–12 ay)", "Organizasyonun önceliklerini netleştirmek", s11) +
      rules;
  };

  VIEWS.workforce = function () {
    var m = metrics(), f = F(), emps = f.emps, n = emps.length || 1;
    var sp = CH.spark([3.1, 3.6, 4.4, 5.0, 5.5, 5.9, 6.2], COL.green);
    var ageB = [0, 0, 0, 0], tenB = [0, 0, 0, 0];
    emps.forEach(function (e) {
      e.age < 30 ? ageB[0]++ : e.age < 40 ? ageB[1]++ : e.age < 50 ? ageB[2]++ : ageB[3]++;
      e.tenure < 2 ? tenB[0]++ : e.tenure < 5 ? tenB[1]++ : e.tenure < 10 ? tenB[2]++ : tenB[3]++;
    });
    var P = function (x) { return round(x / n * 100); };
    var avgTen = (emps.reduce(function (a, e) { return a + e.tenure; }, 0) / n).toFixed(1).replace(".", ",");
    return '<div class="grid g-4">' +
      kpi({ label: "Toplam Çalışan Sayısı", val: m.hc.toLocaleString("tr-TR"), delta: { c: "up", t: "▲ +%6,2 geçen yıla göre" }, tag: { t: "g", l: "AKTİF" }, insight: "Büyüme sürüyor; <b>işe alım kalitesi ve ilk yıl deneyimi</b> kritik hale geliyor." }) +
      kpi({ label: "Net Büyüme", val: "+%6,2", delta: { c: "up", t: "▲ 4 çeyrek üst üste artış" }, spark: sp }) +
      kpi({ label: "Ortalama Kıdem (örneklem)", val: avgTen + " yıl", delta: { c: "down", t: "▼ kıdem erozyonu" }, insight: "Kıdem düşüşü <b>kurumsal hafıza kaybı</b> demektir; bilgi transferi planlanmalı." }) +
      kpi({ label: "Gönüllü Ayrılma Oranı", val: "%" + round(m.vol), delta: { c: m.vol > 15 ? "down" : "flat", t: m.vol > 15 ? "▲ izlenmeli" : "— dengeli" }, tag: m.vol > 15 ? { t: "r", l: "RİSK" } : null }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
      card("Yaş Dağılımı", CH.bars([{ label: "30 yaş altı", value: P(ageB[0]), color: COL.blue, suffix: "%" }, { label: "30–39 yaş", value: P(ageB[1]), color: COL.green, suffix: "%" }, { label: "40–49 yaş", value: P(ageB[2]), color: COL.amber, suffix: "%" }, { label: "50 yaş üstü", value: P(ageB[3]), color: COL.muted, suffix: "%" }], { max: 100 }), deptScopeNote()) +
      card("Kıdem Dağılımı", CH.bars([{ label: "2 yıldan az", value: P(tenB[0]), color: COL.red, suffix: "%" }, { label: "2–5 yıl", value: P(tenB[1]), color: COL.amber, suffix: "%" }, { label: "5–10 yıl", value: P(tenB[2]), color: COL.green, suffix: "%" }, { label: "10 yıl üstü", value: P(tenB[3]), color: COL.blue, suffix: "%" }], { max: 100 }), deptScopeNote()) +
      '</div>' +
      '<div class="mt">' + chainRow("Ortalama kıdem " + avgTen + " yıl; çalışanların %" + P(tenB[0]) + "'i 2 yıldan az kıdemli.",
        "Yapı çevik ama <b>deneyim tabanı inceliyor</b>; erken dönem ayrılma riski yüksek.",
        "İlk yıl bağlılık programı ve kritik rollerde bilgi transferi başlatılmalı.",
        { title: "İlk yıl bağlılık programı", source: "İş Gücü", impact: "Orta" }) + '</div>';
  };

  VIEWS.org = function () {
    var m = metrics();
    var deptsToShow = state.dept === "all" ? DB.departments : DB.departments.filter(function (d) { return d.id === state.dept; });
    var nodes = deptsToShow.map(function (d) {
      var cls = d.health === "red" ? "crit" : (d.health === "amber" ? "warn" : "");
      return '<div class="node ' + cls + '" data-act="setdept" data-d="' + d.id + '"><b>' + esc(d.name) + '</b><span>' + d.hc + ' · ' + (d.health === "red" ? "kritik" : d.health === "amber" ? "izlenmeli" : "iyi") + '</span></div>';
    }).join("");
    return '<div class="grid g-4">' +
      kpi({ label: "Yapı Sağlığı Skoru", val: "68/100", delta: { c: "warn", t: "◆ katman ve yönetim alanı dengesiz" } }) +
      kpi({ label: "Ortalama Yönetim Alanı", val: "5,8", delta: { c: "warn", t: "◆ hedef 7–8" }, insight: "Dar yönetim alanı <b>fazla katman ve yavaş karar</b> demektir." }) +
      kpi({ label: "Yönetici / Çalışan", val: "1 : 6,2", delta: { c: "flat", t: "— sektör ortalamasına yakın" } }) +
      kpi({ label: "Açık Kritik Rol", val: m.openCrit, delta: { c: "down", t: "▼ yedek adayı yok" }, tag: m.openCrit > 1 ? { t: "r", l: "RİSK" } : null, insight: insSucc(m) }) +
      '</div>' +
      '<div class="grid g-21 mt">' +
      card("Organizasyon Yapısı " + (state.dept === "all" ? "(Fonksiyon Bazlı)" : ""), '<div class="org-grid">' + nodes + '</div>', deptScopeNote()) +
      card("Katman Analizi", CH.bars([{ label: "1. Kademe İcra Kurulu", value: 9, color: COL.ink }, { label: "2. Kademe Direktör", value: 34, color: COL.brand }, { label: "3. Kademe Grup Müdürü", value: 96, color: COL.blue }, { label: "4. Kademe Müdür", value: 232, color: COL.green }, { label: "5. Kademe Yönetici", value: 410, color: COL.amber }, { label: "6.–7. Kademe Uzman", value: 3059, color: COL.muted }])) +
      '</div>' +
      card("Açık Roller ve Dönüşüm Planı", openPosTable(F().positions), '<button class="mini-btn" data-act="req-add">+ Pozisyon</button>');
  };

  VIEWS.attrition = function () {
    var f = F();
    var riskEmployees = f.emps.filter(function (e) { return e.flight === "Yüksek" || e.paySeg === "hilo"; });
    var topReasons = { "Ücret & yan haklar": 0, "Kariyer / terfi belirsizliği": 0, "Yönetici ilişkisi": 0, "İş yükü dengesi": 0 };
    DB.exits.filter(function (x) { return state.dept === "all" || x.dept === state.dept; }).forEach(function (x) { if (topReasons[x.reason] !== undefined) topReasons[x.reason]++; });
    var reasons = Object.keys(topReasons).map(function (r) { return { label: r, value: topReasons[r] }; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 3);
    return '<div class="grid g-4">' +
      kpi({ label: "Tahmini Ayrılma Riski", val: "%" + Math.min(100, round((riskEmployees.length / Math.max(1, f.emps.length)) * 100)), tag: { t: "r", l: "ÖNCELİK" }, insight: "Yüksek riskli çalışanların oranı, erken müdahaleyi zorunlu kılar." }) +
      kpi({ label: "Yüksek riskli kişi", val: riskEmployees.length, insight: "Düşük ücretli ve yüksek bağlılık kırılganlığı içeren grup." }) +
      kpi({ label: "Ayrılma nedeni eğilimi", val: reasons[0] ? esc(reasons[0].label) : "Veri yok", insight: "En yaygın neden, departmana göre farklı müdahale gerektiriyor." }) +
      kpi({ label: "Pulse uyarısı", val: "%" + Math.min(100, round(100 - metrics().eng)), delta: { c: "warn", t: "Düşük bağlılık sinyali" }, insight: "Bağlılık azaldıkça ayrılma riski yükselir." }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
      card("Riskli Çalışan Grubu", CH.bars([{
        label: "Yüksek riskli",
        value: round((riskEmployees.length / Math.max(1, f.emps.length)) * 100),
        color: COL.red,
        suffix: "%"
      }, { label: "Düşük riskli", value: round(((f.emps.length - riskEmployees.length) / Math.max(1, f.emps.length)) * 100), color: COL.green, suffix: "%" }], { max: 100 })) +
      card("Çıkış Nedenleri — Tahmini Öncelik", CH.donut(reasons, reasons.length ? "%" + round((reasons[0].value / Math.max(1, DB.exits.filter(function (x) { return state.dept === "all" || x.dept === state.dept; }).length)) * 100) : "", "ilk 3 neden")) +
      '</div>' +
      '<div class="mt">' + chainRow("Tahmini ayrılma riski yüksek çalışanlar " + riskEmployees.length + " kişi; düşük ücret + yüksek bağlılık kırılganlığı ön planda.",
        "Ayrılma sinyali ücret, bağlılık ve performans verisiyle birlikte okunmalı.",
        "Hızlı müdahale: kritik riskli gruba hedefli retention paketi ve yöneticilerle eşzamanlı görüşme.",
        { title: "Tahmine dayalı elde tutma planı", source: "Ayrılma Riski", impact: "Yüksek" }) + '</div>';
  };

  VIEWS.succession = function () {
    var m = metrics();
    var yedekOran = m.readyNow;
    var criticalOpen = m.openCrit;

    var heatCells = [
      { v: +(yedekOran * 9 / 1.2).toFixed(1), color: yedekOran > 60 ? COL.green : COL.amber },
      { v: +(criticalOpen * 2.2).toFixed(1), color: criticalOpen > 1 ? COL.red : COL.green },
      { v: 6.5, color: COL.amber },
      { v: 8, color: COL.green }
    ];

    var nineGrid = [
      [ { label: "Riskli", count: 12, tone: "risk" }, { label: "Etkili Profesyonel", count: 33, tone: "neutral" }, { label: "Güvenilir Usta", count: 40, tone: "core" } ],
      [ { label: "Çelişen", count: 18, tone: "neutral" }, { label: "Çekirdek", count: 62, tone: "core" }, { label: "Yüksek Etki", count: 38, tone: "good" } ],
      [ { label: "Bilmece", count: 7, tone: "info" }, { label: "Gelecek Yıldız", count: 22, tone: "good" }, { label: "Yıldız", count: 15, tone: "star" } ]
    ];

    return '<div class="grid g-4">' +
      kpi({ label: "Göreve Hazır Yedek", val: "%" + round(yedekOran), tag: { t: "g", l: "GÜÇLÜ" }, insight: "Kritik rollerde yedekleme gücü başarılı ama eşleştirme henüz yeterli." }) +
      kpi({ label: "Kritik yedeksiz rol", val: criticalOpen, tag: criticalOpen > 1 ? { t: "r", l: "KRİTİK" } : null, insight: "Her yedeksiz kritik rol süreklilik riskini artırır." }) +
      kpi({ label: "9 Kutu Üst Bloğu", val: "%" + round(m.top3), insight: "Üst performans bloğu ile yedekleme arasında uyum gerekiyor." }) +
      kpi({ label: "Yedekleme Açığı", val: "%" + round(100 - yedekOran), delta: { c: "warn", t: "Eşleştirme eksik" } }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
      card("Succession Heatmap", CH.heat(["Elde Tutma", "Yedekleme", "Yapı", "Bağlılık"], [{ label: deptName(state.dept), cells: heatCells }])) +
      card("9 Kutu Dağılımı", CH.nineBox(nineGrid), '<span class="hint">Performans × potansiyel matrisine göre kritik yedekleme segmenti.</span>') +
      '</div>' +
      '<div class="mt">' + chainRow("Yedekleme oranı %" + round(yedekOran) + ", açık kritik rol " + criticalOpen + ".",
        "Yedekleme var ancak kritik rolle eşleştirme ve hızlandırma planı eksik.",
        "Yedekleme planını kritik rollere bağlamak için 9 aylık hızlandırılmış eylem başlatılmalı.",
        { title: "Succession ve yedekleme eşleştirme programı", source: "Succession", impact: "Yüksek" }) + '</div>';
  };

  VIEWS.compSim = function () {
    return '<div class="grid g-3">' +
      '<div class="card"><h3>Ücret Senaryo Simülatörü</h3><p class="muted-txt">Seçilen segment için ücret düzeltme etkisini hızlıca modelleyin.</p>' +
      '<div class="feature-sim"><div class="sim-row"><label>Segment</label><select id="sim-seg"><option value="highPerf">Yüksek perf. / düşük ücret</option><option value="underpaid">Düşük ücretli genel</option><option value="all">Tüm organizasyon</option></select><label>Artış (%)</label><input id="sim-pct" type="number" value="10" min="1" max="25"></div>' +
      '<div class="sim-actions"><button class="btn primary" id="sim-run">Simüle Et</button><div id="sim-out" class="sim-out muted-txt">Senaryo sonucu burada görünecek.</div></div></div></div>' +
      '<div class="card"><h3>Senaryo Etkileri</h3><p class="muted-txt">Ücret artışı, ayrılma riski ve potansiyel bütçe kaydırma etkisini görmek için bir önizleme.</p><div id="sim-summary" class="feature-placeholder"><div class="placeholder-body">Model detayları hazırlanıyor...</div></div></div>' +
      '<div class="card"><h3>Önerilen Uygulama</h3><ul class="fn"><li>Hedefli artışı yüksek performans/düşük ücret segmentine uygulayın.</li><li>Ücret adaleti sağlayarak bağlılık ve risk skorlarını iyileştirin.</li><li>Şeffaf iletişim + 8 haftalık takip planı kurun.</li></ul></div></div>';
  };

  VIEWS.pulse = function () {
    var m = metrics();
    var th = state.dept !== "all" && DB.deptThemes[state.dept] ? DB.deptThemes[state.dept] : DB.orgThemes;
    return '<div class="grid g-4">' +
      kpi({ label: "Pulse Endeksi", val: round(m.eng), tag: { t: m.eng >= 70 ? "g" : "a", l: "ANLIK" }, insight: "Anlık bağlılık nabzı bu çeyreğe yönelik aksiyonlar için sinyal verir." }) +
      kpi({ label: "Katılım", val: "%84", insight: "Yüksek katılım, sonuçların güvenilir olduğunu gösterir." }) +
      kpi({ label: "Düşük Tema", val: th.dev[0] ? esc(th.dev[0][0]) : "—" , insight: "Pulse sonuçları ayrışmayı ve odağı belirler." }) +
      kpi({ label: "Yüksek Tema", val: th.strong[0] ? esc(th.strong[0][0]) : "—", insight: "Güçlü temalar sürdürülmeli." }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
      card("Pulse Temaları", CH.bars(th.dev.concat(th.strong).map(function (t) { return { label: t[0], value: t[1], color: t[1] >= 70 ? COL.green : COL.amber }; }), { max: 100 })) +
      card("Pulse Eylem Önerileri", '<ul class="fn"><li>Ücret adaleti algısı düşükse iletişim ve şeffaflık eylemi.</li><li>Kariyer gelişimi algısı düşükse net terfi yol haritası.</li><li>İş yükü denge problemlerinde yönetici kontrolü ve kaynak desteği.</li></ul>') +
      '</div>' +
      '<div class="mt">' + chainRow("Pulse anketi sonuçları yönlendirici; zayıf tema ücret adaleti algısı veya kariyer gelişimi.",
        "Pulse sinyali, ayrılma ve bağlılık riskini belirleyen ana değişkenleri ortaya çıkarır.",
        "Eylem: Pulse temalarına karşılık gelen 3 kısa dönem müdahale başlatılmalı.",
        { title: "Pulse aksiyon planı", source: "Pulse Survey", impact: "Orta" }) + '</div>';
  };

  VIEWS.cohort = function () {
    return '<div class="grid g-3">' +
      card("Cohort Analizi Nedir?", '<p class="muted-txt">Cohort, aynı kriterleri paylaşan çalışan gruplarını hızlıca tanımlamanızı sağlar. Bu sayfada departman, risk ve performans profilini temel alarak hedef segmentleri seçip karşılaştırabilir, kritik riskli çalışan gruplarını tespit edebilirsiniz.</p>' +
        '<ul class="fn"><li><b>Ne yapar:</b> ortak özelliklere göre segment oluşturur ve seçili grup için risk / yetenek / ücret dengesi raporu üretir.</li><li><b>Ne değer katar:</b> yüksek riskli, düşük ücretli veya kritik yetenek grubunu açıkça gösterir.</li><li><b>Nasıl kullanılır:</b> filtre seç, cohort oluştur, sonuçları CSV olarak indir.</li></ul>') +
      card("Hazır Cohortlar", '<div class="preset-grid"><button class="btn primary" data-act="cohort-preset" data-preset="highRiskTalent">Yüksek riskli yetenek cohortu</button><button class="btn" data-act="cohort-preset" data-preset="lowPayHighPerf">Düşük ücretli yüksek performans cohortu</button><button class="btn" data-act="cohort-preset" data-preset="criticalBackup">Kritik yedekleme gerektiren pozisyon cohortu</button></div>', '<span class="hint">Bir preset seçin; filtreler otomatik ayarlanır ve sonuçlar görüntülenir.</span>') +
      card("Filtreler", '<div class="grid g-2"><div><label>Departman</label><select id="cohort-dept"><option value="all">Tümü</option>' + DB.departments.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('') + '</select></div><div><label>Risk Seviyesi</label><select id="cohort-risk"><option value="all">Tümü</option><option value="high">Yüksek Risk</option><option value="medium">Orta Risk</option><option value="low">Düşük Risk</option></select></div></div>', '<button class="btn primary" id="cohort-run">Cohort Oluştur</button>') +
      card("Cohort Özeti", '<div id="cohort-output" class="feature-placeholder"><div class="placeholder-body">Filtreyi belirleyip "Cohort Oluştur" butonuna basarak seçili çalışan segmentini analiz edin.</div></div>') +
      card("Çıktılar", '<button class="btn" id="cohort-save">Cohortu Kaydet</button><button class="btn" id="cohort-export">CSV Olarak Dışa Aktar</button>') +
      '</div>';
  };

  function openPosTable(positions) {
    if (!positions.length) return '<div class="empty">Bu departmanda açık pozisyon yok.</div>';
    return '<table class="tbl"><thead><tr><th>Rol</th><th>Departman</th><th>Açık Süre (gün)</th><th>Yedek Aday</th><th>İş Etkisi</th><th>Plan</th><th></th></tr></thead><tbody>' +
      positions.map(function (p) {
        var sev = p.daysOpen > 60 ? "r" : p.daysOpen > 40 ? "a" : "g";
        return '<tr><td><b>' + esc(p.role) + '</b></td><td>' + esc(deptName(p.dept)) + '</td><td>' + chip(p.daysOpen + " gün", sev) + '</td><td>' + esc(p.backup) + '</td><td>' + esc(p.impact) + '</td><td>' + esc(p.plan) + '</td>' +
          '<td class="row-act"><button data-act="req-edit" data-id="' + p.id + '">✎</button><button data-act="req-del" data-id="' + p.id + '">🗑</button></td></tr>';
      }).join("") + '</tbody></table>';
  }

  VIEWS.talent = function () {
    var m = metrics(), f = F();
    var crit = f.emps.filter(function (e) { return e.critical; });
    return '<div class="grid g-4">' +
      kpi({ label: "Yüksek Potansiyel Oranı", val: "%" + round(m.hipo), delta: { c: "up", t: "▲ sağlıklı liderlik hattı" }, tag: { t: "g", l: "GÜÇLÜ" }, insight: "Havuz güçlü; asıl soru <b>kritik rollere eşleştirilip eşleştirilmediği</b>." }) +
      kpi({ label: "Üst 3 Kutu Oranı", val: "%" + round(m.top3), delta: { c: "up", t: "▲ liderlik hattı besleniyor" } }) +
      kpi({ label: "Göreve Hazır Yedek Aday", val: "%" + round(m.readyNow), delta: { c: "up", t: "▲ iç terfi kapasitesi" }, insight: "Kritik boşlukta <b>kısa vadede rolü üstlenecek kapasite</b> var." }) +
      kpi({ label: "Kritik Rol (örneklem)", val: crit.length, delta: { c: "warn", t: "◆ süreklilik izlenmeli" }, insight: insSucc(m) }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
      card("Yedekleme Gücü", CH.bars([{ label: "Göreve hazır", value: round(m.readyNow * 0.55), color: COL.green, suffix: "%" }, { label: "1–2 yılda hazır", value: 41, color: COL.blue, suffix: "%" }, { label: "Gelişim gerekli", value: 19, color: COL.amber, suffix: "%" }, { label: "Yedek aday yok", value: 6, color: COL.red, suffix: "%" }], { max: 100 })) +
      card("Kritik Rollerde Süreklilik", succTable()) +
      '</div>' +
      '<div class="mt">' + chainRow("Yüksek potansiyel %" + round(m.hipo) + " ve göreve hazır yedek %" + round(m.readyNow) + "; " + m.openCrit + " kritik rol hâlâ yedeksiz.",
        "Sorun <b>yetenek yokluğu değil eşleştirme eksikliği</b>.",
        "Çapraz fonksiyon yedek eşleştirmesi + 9 aylık hızlandırılmış gelişim planı.",
        { title: "9 aylık yedekleme ve liderlik hattı programı", source: "Yetenek", impact: "Yüksek" }) + '</div>';
  };

  function succTable() {
    var rows = state.dept === "all"
      ? [["Ürün Yönetimi", 8, 3, "r"], ["Finans", 6, 3, "r"], ["Bilgi Teknolojileri", 7, 2, "a"], ["Tedarik", 5, 2, "a"], ["E-Ticaret", 4, 1, "g"]]
      : [[deptName(state.dept), Math.max(3, deptObj(state.dept).m.openCrit + 2), deptObj(state.dept).m.openCrit, deptObj(state.dept).m.openCrit >= 2 ? "r" : "g"]];
    return '<table class="tbl"><thead><tr><th>Fonksiyon</th><th>Kritik Rol</th><th>Yedeksiz</th><th>Risk</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><span class="sev"><span class="b" style="background:' + (r[3] === "r" ? COL.red : r[3] === "a" ? COL.amber : COL.green) + '"></span>' + (r[3] === "r" ? "Yüksek" : r[3] === "a" ? "Orta" : "Düşük") + '</span></td></tr>'; }).join("") + '</tbody></table>';
  }

  VIEWS.turnover = function () {
    var m = metrics(), f = F();
    var deptsToShow = state.dept === "all" ? DB.departments.slice().sort(function (a, b) { return b.m.vol - a.m.vol; }) : DB.departments.filter(function (d) { return d.id === state.dept; });
    var bars = CH.bars(deptsToShow.map(function (d) { return { label: d.name.split(" ")[0], value: d.m.vol, color: d.m.vol >= 18 ? COL.red : d.m.vol >= 13 ? COL.amber : COL.green, suffix: "%" }; }), { max: 26 });
    var rc = {}; f.exits.forEach(function (x) { rc[x.reason] = (rc[x.reason] || 0) + 1; });
    var palette = [COL.red, COL.amber, COL.blue, "#8FA0B8", "#C3CCD9", "#E0E5ED"];
    var segs = Object.keys(rc).sort(function (a, b) { return rc[b] - rc[a]; }).map(function (k, i) { return { label: k, value: rc[k], color: palette[i % palette.length] }; });
    var top2 = segs.length ? round((segs.slice(0, 2).reduce(function (a, s) { return a + s.value; }, 0)) / f.exits.length * 100) : 0;
    return '<div class="grid g-4">' +
      kpi({ label: "Toplam Çalışan Devir Oranı", val: "%" + round(m.vol + m.invol), delta: { c: "down", t: "▲ +2,1 puan" }, tag: { t: m.vol > 15 ? "r" : "a", l: m.vol > 15 ? "RİSK" : "DİKKAT" }, explain: "to", insight: insTurnover(m) }) +
      kpi({ label: "Gönüllü / İşveren Kaynaklı", val: round(m.vol) + " / " + round(m.invol), delta: { c: "warn", t: "◆ gönüllü ayrılma baskın" }, insight: "Gönüllü baskın → kayıp <b>elde tutma sorunu</b>, performans yönetimi sorunu değil." }) +
      kpi({ label: "Pozisyon Kapatma Süresi", val: round(m.ttf) + " gün", delta: { c: m.ttf > 40 ? "down" : "flat", t: m.ttf > 40 ? "▼ hedef 35 gün" : "— hedefte" }, insight: insTTF(m) }) +
      kpi({ label: "Teklif Kabul Oranı", val: "%" + round(m.offer), delta: { c: "flat", t: "12 aylık tutunma %84" } }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
      card("Gönüllü Ayrılma — Fonksiyon Bazlı", bars, deptScopeNote()) +
      card("Çıkış Nedenleri", segs.length ? CH.donut(segs, "%" + top2, "ilk 2 neden") : '<div class="empty">Çıkış kaydı yok.</div>') +
      '</div>' +
      '<div class="mt">' + chainRow("Çıkışların %" + top2 + "'i ilk iki nedenden; en yüksek neden <b>" + esc(segs[0] ? segs[0].label : "—") + "</b>.",
        "Kök neden fonksiyona göre değişiyor; <b>tek tip zam kaynağı boşa harcar</b>.",
        "Segment bazlı müdahale: ücret kaynaklı grupta konumlandırma, yönetici kaynaklı grupta koçluk.",
        { title: "Segment bazlı çalışan devri müdahale planı", source: "Çalışan Devri", impact: "Yüksek" }) + '</div>';
  };

  VIEWS.perf = function () {
    var f = F(), dis = distros(f.emps);
    var perfBars = CH.bars([
      { label: "Olağanüstü", value: dis.perf[4], color: COL.green },
      { label: "Beklenti üstü", value: dis.perf[3], color: "#5DBE86" },
      { label: "Beklentiyi karşılıyor", value: dis.perf[2], color: COL.blue },
      { label: "Kısmen karşılıyor", value: dis.perf[1], color: COL.amber },
      { label: "Beklenti altı", value: dis.perf[0], color: COL.red }
    ]);
    function nbCount(label) { return dis.nb[label] || 0; }
    var grid = [
      [{ label: "Bilmece", count: nbCount("Bilmece"), tone: "info" }, { label: "Gelecek Yıldız", count: nbCount("Gelecek Yıldız"), tone: "good" }, { label: "★ Yıldız", count: nbCount("Yıldız"), tone: "star" }],
      [{ label: "Çelişen", count: nbCount("Çelişen"), tone: "neutral" }, { label: "Çekirdek", count: nbCount("Çekirdek"), tone: "core" }, { label: "Yüksek Etki", count: nbCount("Yüksek Etki"), tone: "good" }],
      [{ label: "Riskli", count: nbCount("Riskli"), tone: "risk" }, { label: "Etkili Profesyonel", count: nbCount("Etkili Profesyonel"), tone: "neutral" }, { label: "Güvenilir Usta", count: nbCount("Güvenilir Usta"), tone: "core" }]
    ];
    var ustBlok = nbCount("Yıldız") + nbCount("Yüksek Etki");
    var sample = f.emps.slice(0, 6);
    return '<div class="grid g-12">' +
      card("Performans Dağılımı (örneklem n=" + dis.n + ")", perfBars) +
      card("9 Kutu Özeti", CH.nineBox(grid), '<button class="mini-btn" data-act="goto" data-v="directory">Kişilere in →</button>') +
      '</div>' +
      oneMsg("Sorun performans dağılımında değil; <b>üst performans bloğunun (" + ustBlok + " kişi) ücret ve kariyer koşullarıyla korunamamasında</b>.") +
      '<div class="grid g-2 mt">' +
      card("Kişi Kartları (örneklem)", sample.map(personRow).join("")) +
      aiBox({ title: "Kritik içgörü", conf: 84, chain: true, body: '<p>9 kutu üst-sağ bloğu ile ücret verisi kesiştirildiğinde <b>kritik elde tutma listesi</b> ortaya çıkıyor.</p>', actions: '<button data-act="seed-action" data-title="Kritik elde tutma listesi oluşturma" data-source="Performans" data-impact="Yüksek">→ Aksiyon oluştur</button><button data-act="goto" data-v="comp">→ Ücret Gözden Geçirme</button>' }) +
      '</div>';
  };

  function personRow(e) {
    var seg = e.paySeg === "hilo" ? '<span class="pill r">Düşük ücret</span>' : e.paySeg === "lohi" ? '<span class="pill a">Yüksek ücret</span>' : '<span class="pill g">Hizalı</span>';
    return '<div class="pcard" data-act="person" data-id="' + e.id + '"><div class="av">' + esc(e.name.split(" ").map(function (s) { return s[0]; }).join("").slice(0, 2)) + '</div>' +
      '<div class="pn"><b>' + esc(e.name) + '</b><span>' + esc(e.role) + ' · ' + esc(deptName(e.dept)) + '</span>' +
      '<div class="ptags">' + chip(e.nineBox, e.nineBox === "Yıldız" ? "g" : "") + seg + chip("Ayrılma riski: " + e.flight, e.flight === "Yüksek" ? "r" : "") + '</div></div></div>';
  }

  VIEWS.pay = function () {
    var m = metrics(), f = F(), dis = distros(f.emps);
    var hiloN = scaleTo(dis.seg.hilo, dis.n, m.hc), lohiN = scaleTo(dis.seg.lohi, dis.n, m.hc);
    var crit = f.emps.filter(function (e) { return e.critical && e.paySeg === "hilo"; });
    var riskScore = Math.min(100, round(m.pay.hilo * 2.0 + m.pay.lohi * 1.0 + 20));
    var bubbles = [
      { x: 80, y: 22, r: 60, color: COL.red, label: "Kayıp", title: "Yüksek performans / düşük ücret" },
      { x: 70, y: 30, r: 44, color: "#E85d4a", label: "", title: "" },
      { x: 75, y: 74, r: 52, color: COL.green, label: "Hizalı", title: "dengeli" },
      { x: 28, y: 72, r: 40, color: "#C0392B", label: "Adalet", title: "Düşük performans / yüksek ücret" },
      { x: 34, y: 26, r: 28, color: "#9AA6B6", label: "İzle", title: "" }
    ];
    return '<div class="card pay-hero"><div class="card-h"><h3>Ücret – Performans Dengesi · Risk Motoru</h3><span class="pill r">ZORUNLU MODÜL</span>' + deptScopeNote() + '</div>' +
      '<div class="grid g-21" style="align-items:center">' +
      '<div>' + CH.quadrant(bubbles) + '</div>' +
      '<div>' + CH.bars([{ label: "✓ Hizalı", value: round(m.pay.aligned), color: COL.green, suffix: "%" }, { label: "Yüksek perf. / düşük ücret", value: round(m.pay.hilo), color: COL.red, suffix: "%" }, { label: "Düşük perf. / yüksek ücret", value: round(m.pay.lohi), color: COL.amber, suffix: "%" }, { label: "Diğer", value: round(m.pay.other), color: COL.muted, suffix: "%" }], { max: 100 }) +
      '<div class="grid g-2 mt">' +
      kpi({ label: "Risk Skoru", val: '<span style="color:' + COL.red + '">' + riskScore + '/100</span>', delta: { c: "down", t: "Yüksek" } }) +
      kpi({ label: "Kayıp Riski Taşıyan Kişi", val: hiloN.toLocaleString("tr-TR"), delta: { c: "warn", t: round(crit.length) + " kritik rol" } }) +
      '</div></div></div></div>' +
      '<div class="grid g-2 mt">' +
      aiBox({ title: "🔥 Kayıp riski", conf: 88, chain: true, body: '<p>Yaklaşık ' + hiloN + ' yüksek performanslı çalışan düşük ücret bandında. ' + insPay(m, hiloN) + '</p><p><b>Aksiyon:</b> 8 haftalık hedefli ücret düzeltmesi; önlenebilir kayıp %70, yatırım getirisi ~3,6 kat.</p>', actions: '<button data-act="seed-action" data-title="Hedefli elde tutma ve ücret düzeltme paketi" data-source="Ücret-Performans" data-impact="Yüksek">→ Aksiyon oluştur</button><button data-act="goto" data-v="comp">→ Ücret Gözden Geçirme</button>' }) +
      aiBox({ title: "⚠ Ücret adaleti riski", conf: 80, chain: true, body: '<p>Yaklaşık ' + lohiN + ' çalışan performansının üzerinde ücret alıyor; bu <b>yıldız çalışanların adalet algısını zedeliyor</b>.</p><p><b>Aksiyon:</b> Performans planı + artış dondurma; bütçeyi üst performans grubuna kaydırın.</p>', actions: '<button data-act="seed-action" data-title="Ücret adaleti gözden geçirme" data-source="Ücret-Performans" data-impact="Orta">→ Aksiyon oluştur</button>' }) +
      '</div>';
  };

  VIEWS.engage = function () {
    var m = metrics();
    var th = state.dept !== "all" && DB.deptThemes[state.dept] ? DB.deptThemes[state.dept] : DB.orgThemes;
    return '<div class="grid g-4">' +
      kpi({ label: "Bağlılık Endeksi", val: round(m.eng), delta: { c: "up", t: "▲ +2" }, tag: { t: m.eng >= 70 ? "g" : "a", l: m.eng >= 70 ? "İYİ" : "İZLE" }, insight: insEng(m, th) }) +
      kpi({ label: "Çalışan Tavsiye Skoru", val: "+" + round(m.enps), delta: { c: "up", t: "▲ +4" } }) +
      kpi({ label: "Anket Katılım Oranı", val: "%84", delta: { c: "up", t: "▲ güvenilir örneklem" } }) +
      kpi({ label: "En düşük tema: " + (th.dev[0] ? th.dev[0][0] : "Ücret adaleti"), val: (th.dev[0] ? th.dev[0][1] : 54), delta: { c: "down", t: "▼ gelişim önceliği" }, tag: { t: "a", l: "İZLE" } }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
      card("Güçlü Alanlar", CH.bars(th.strong.map(function (t) { return { label: t[0], value: t[1], color: t[1] >= 75 ? COL.green : "#5DBE86" }; }), { max: 100 }), '<span class="pill g">koruyalım</span>') +
      card("Gelişim Alanları", CH.bars(th.dev.map(function (t) { return { label: t[0], value: t[1], color: t[1] < 56 ? COL.red : COL.amber }; }), { max: 100 }), '<span class="pill r">aksiyon</span>') +
      '</div>' +
      card("İK İş Ortağı Saha Gözlemi → Yapay Zekâ", '<div class="note"><textarea id="eng-note" placeholder="Sahadan gözleminizi yazın; yapay zekâ veriyle birleştirip yönetici diline çevirir..."></textarea><div id="eng-enriched"></div></div>', '<button class="mini-btn ai" data-act="enrich">✨ Yapay zekâ ile zenginleştir</button>');
  };

  VIEWS.risk = function () {
    var f = F();
    var cols = ["Elde Tutma", "Yedekleme", "Yapı", "Bağlılık", "İşe Alım"];
    var hmIds = state.dept === "all" ? DB.departments.map(function (d) { return d.id; }) : [state.dept];
    var hm = hmIds.map(function (id) {
      var d = deptObj(id); var base = d.m;
      function c(v) { return v >= 7 ? COL.red : v >= 5 ? COL.amber : COL.green; }
      var vals = [Math.min(9.5, base.vol / 2.6), Math.min(9, base.openCrit * 1.8 + 2), 5, Math.min(9, (100 - base.eng) / 6), Math.min(9, base.ttf / 8)].map(function (x) { return +x.toFixed(1); });
      return { label: d.name.split(" ")[0], cells: vals.map(function (v) { return { v: v, color: c(v) }; }) };
    });
    var rows = f.risks.slice().sort(function (a, b) { return b.sev - a.sev; }).filter(function (r) {
      if (state.riskFilter === "all") return true;
      var t = r.sev >= 7 ? "r" : r.sev >= 5 ? "a" : "g"; return t === state.riskFilter;
    });
    var fbtns = ["all", "r", "a", "g"].map(function (k) { var lbl = { all: "Tümü", r: "Yüksek", a: "Orta", g: "Düşük" }[k]; return '<button class="fbtn ' + (state.riskFilter === k ? "on" : "") + '" data-act="riskfilter" data-k="' + k + '">' + lbl + '</button>'; }).join("");
    var tbl = rows.length ? '<table class="tbl"><thead><tr><th>Risk</th><th>Dayandığı Veri</th><th>İş Etkisi</th><th>Şiddet</th><th>Aksiyon</th><th>Sahip</th><th>Termin</th><th>Durum</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var col = r.sev >= 7 ? COL.red : r.sev >= 5 ? COL.amber : COL.green;
        return '<tr><td><b>' + esc(r.risk) + '</b></td><td>' + esc(r.data) + '</td><td>' + esc(r.impact) + '</td><td><span class="sev"><span class="b" style="background:' + col + '"></span>' + r.sev + '</span></td><td>' + esc(r.action) + '</td><td>' + esc(r.owner) + '</td><td>' + esc(r.due) + '</td>' +
          '<td><span class="status-chip ' + statusCls(r.status) + '" data-act="risk-status" data-id="' + r.id + '">' + esc(r.status) + '</span></td>' +
          '<td class="row-act"><button data-act="risk-edit" data-id="' + r.id + '">✎</button><button data-act="risk-del" data-id="' + r.id + '">🗑</button></td></tr>';
      }).join("") + '</tbody></table>' : '<div class="empty">Bu filtrede risk yok.</div>';
    return '<div class="toolbar"><span class="t-lbl">Şiddet filtresi:</span>' + fbtns + '<button class="btn ai" data-act="explain" data-k="riskai" style="margin-left:auto">⚡ Yapay zekâ önceliklendirmesi</button><button class="btn primary" data-act="risk-add">+ Risk Ekle</button></div>' +
      card("Risk Isı Haritası — Şiddet × Fonksiyon", CH.heat(cols, hm), deptScopeNote()) +
      '<div class="mt">' + card("Risk Kaydı · Veri → Etki → Aksiyon", tbl, '<span class="hint">her risk veriyle desteklenir ve bir aksiyona bağlanır</span>') + '</div>';
  };
  function statusCls(s) { return s === "Açık" ? "st-open" : (s === "Devam ediyor" ? "st-prog" : "st-done"); }

  VIEWS.swot = function () {
    var m = metrics();
    var strength = round(m.hipo);
    var readiness = round(m.readyNow);
    var payRisk = round(m.pay.hilo);
    var openCrit = m.openCrit;
    var timeToFill = round(m.ttf);
    var eng = round(m.eng);
    var bar = function (label, value, color) {
      return '<div class="swot-bar-row"><span>' + esc(label) + '</span><div class="swot-bar"><span class="swot-bar-fill" style="width:' + value + '%;background:' + color + '"></span></div><span>' + value + '%</span></div>';
    };
    var dot = function (color) {
      return '<span class="swot-icon" style="background:' + color + '"></span>';
    };
    var q = [
      ["s", "⊕ Güçlü Yönler", COL.green, [["İç liderlik hattı:", "Yüksek potansiyel oranı %" + strength + ", göreve hazır yedek aday %" + readiness + " — açık rollerin yarısı içeriden karşılanabilir."], ["Kültürel zemin:", "Bağlılık " + eng + ", güven güçlü; değişim için sağlam taban."], ["Performans sistemi:", "Puan şişmesi yok; veri destekli kararlar işin güvenilirliğini artırır."]], ["Hipo", strength, COL.green], ["Hazır Yedek", readiness, COL.brand], ["Bağlılık", eng, COL.blue] ],
      ["w", "⊖ Gelişim Alanları", COL.red, [["Ücret–performans uyumsuzluğu:", "Yüksek performanslıların %" + payRisk + "'i düşük ücret bandında; kayıp riski net."], ["Kritik rol yedeksizliği:", openCrit + " kritik rol hâlâ yedeksiz; süreklilik planı kritik."], ["İşe alım hızı:", "Pozisyon kapatma " + timeToFill + " gün; önemli yetenek fırsatları gecikiyor."]], ["Ücret Risk", payRisk, COL.red], ["Yedek Eksik", Math.min(100, openCrit * 16), COL.amber], ["İşe Alım Hızı", Math.min(100, 100 - timeToFill), COL.blue] ],
      ["o", "⊙ Fırsatlar", COL.blue, [["Yetenek merkezi:", "E-Ticaret ve BT segmentleri güçlü paylaşımla işveren markası haline gelebilir."], ["İç terfi motoru:", "Yedek havuzu dış alıma göre yaklaşık %40 daha ekonomik."], ["Referans etkisi:", "Yüksek güven skoru çalışan referans kanalını güçleştirebilir."]], ["İç Terfi", 78, COL.blue], ["Referans", 74, COL.ai], ["Marka Cazibesi", 70, COL.green] ],
      ["t", "⊗ Tehditler", COL.amber, [["Ücret baskısı:", "Piyasa teklifleri çıkışların baş nedeni; zaman kaybı maliyeti yükseliyor."], ["Kıdem erozyonu:", "Ortalama kıdem 4,3'ten 3,9'a geriledi; kurumsal hafıza aşınıyor."], ["Adalet algısı:", "Düşük perf./yüksek ücret bloğu yıldızların motivasyonunu zayıflatıyor."]], ["Ücret Baskısı", 82, COL.red], ["Kıdem Erozyonu", 64, COL.amber], ["Adalet Algısı", 58, COL.amber] ]
    ];
    return '<div class="swot-summary card">' +
      '<div class="flex" style="align-items:flex-start;gap:14px;flex-wrap:wrap"><div><span class="ai-chip">✦ Stratejik Bakış</span><h3 style="margin:12px 0 6px">GZFT Analizi — Şimdi yapılması gereken</h3><p class="muted-txt">Bu analiz, güçlü yetenek potansiyelini en kritik rol yedekleme ve ücret adaleti müdahalesiyle eşleştirme fırsatı olarak sunuyor.</p></div><div class="swot-metrics"><span class="metric-pill">Hipo %" + strength + "</span><span class="metric-pill">Hazır Yedek %" + readiness + "</span><span class="metric-pill">Bağlılık %" + eng + "</span><span class="metric-pill">Kritik Yedeksiz " + openCrit + "</span></div></div>' +
      '<div class="swot-summary-notes">Hızlı etki: hedefli ücret düzeltme + kritik rol yedekleme planı. Risk azaltma için referans ve iç terfi motorunu kullanın.</div>' +
      '</div>' +
      '<div class="swot">' + q.map(function (x) {
        return '<div class="q ' + x[0] + '"><div class="q-top"><span class="q-chip" style="background:' + x[2] + '22;color:' + x[2] + '">' + x[1] + '</span></div><ul>' +
          x[3].map(function (i) { return '<li class="swot-item">' + dot(x[2]) + '<div><b>' + esc(i[0]) + '</b> ' + esc(i[1]) + '</div></li>'; }).join("") + '</ul><div class="swot-bars">' +
          [x[4], x[5], x[6]].map(function (b) { return bar(b[0], b[1], b[2]); }).join("") + '</div></div>';
      }).join("") + '</div>' +
      '<div class="grid g-2 mt"><div class="card swot-action"><h4>Öncelikli eylem 1</h4><p><b>Hedefli Ücret + Bağlılık Programı</b> — Yüksek performanslı düşük ücret segmentini %12’ye çekmek; en az 40 çalışan için retansiyon planı.</p></div><div class="card swot-action"><h4>Öncelikli eylem 2</h4><p><b>Kritik Rol Yedekleme Hızı</b> — 12 yedeksiz kritik role hızlı iç eşleştirme; açık pozisyon kapatma süresini 35 güne indirin.</p></div></div>';
  };

  VIEWS.strat = function () {
    var pr = [
      [COL.brand, "1", "Kritik Yetenekleri Elde Tutma Programı", "0–3 ay", "En yüksek finansal ve süreklilik riski; rakip baskısı aktif.", "40 kişi piyasa medyanının %18 altında.", "Kritik kaybın %70'i önlenir · yatırım getirisi 3,6 kat.", "Ücret ve Yan Haklar + İK İş Ortağı"],
      [COL.blue, "2", "9 Aylık Yedekleme ve Liderlik Hattı Programı", "0–9 ay", "12 yedeksiz kritik rol; iş sürekliliği riski.", "Ürün Yönetimi ve Finans yedeksiz rollerin %50'si.", "Kritik rol kapsamı %100; iç terfi oranı yükselir.", "Yetenek Yönetimi"],
      [COL.amber, "3", "Tedarik ve Lojistik Stabilizasyonu", "0–6 ay", "Operasyon hızını etkileyen ayrılma artışı.", "Gönüllü ayrılma %19; yönetici ilişkisi ve iş yükü.", "Ayrılma %19'dan %13'e; bağlılık +6 puan.", "İK İş Ortağı"],
      [COL.green, "4", "İşe Alım Hızı ve Dijital İşveren Değeri", "3–9 ay", "Kritik açıkların proje etkisi.", "Pozisyon kapatma 47 gün; e-ticaret büyümesi.", "Kapatma süresi 47'den 35 güne; teklif kabulü artar.", "İşe Alım"],
      [COL.ai, "5", "Ücret Adaleti ve Yapı Sadeleştirme", "6–12 ay", "Algı davranışa dönüşüyor; adalet ve karar hızı.", "Adalet algısı 54; 7. yönetim katmanı.", "Adalet algısı 54'ten 65'e; karar hızı +%15.", "Ücret ve Yan Haklar + Organizasyon Tasarımı"]
    ];
    return '<div class="flex mb"><span class="muted-txt">Tüm analizin sonucu — <b>"Ne anlama geliyor / Şimdi ne yapmalı"</b> · en fazla 5 aksiyon · her aksiyon iş etkisine bağlı</span></div>' +
      pr.map(function (p) {
        return '<div class="card strat-card" style="border-left:4px solid ' + p[0] + '"><div class="flex"><span class="rank" style="position:static;background:' + p[0] + ';color:#fff">' + p[1] + '</span><h3 style="margin:0 0 0 10px">' + esc(p[2]) + '</h3><span class="pill" style="margin-left:auto">' + p[3] + '</span></div>' +
          '<div class="grid g-4 mt"><div>' + chip("Neden öncelikli", "b") + '<p class="fn">' + esc(p[4]) + '</p></div><div>' + chip("Dayandığı veri", "b") + '<p class="fn">' + esc(p[5]) + '</p></div><div>' + chip("Beklenen iş etkisi", "b") + '<p class="fn">' + esc(p[6]) + '</p></div><div>' + chip("Sahip", "b") + '<p class="fn">' + esc(p[7]) + '</p>' +
          '<button class="act-btn" data-act="seed-action" data-title="' + esc(p[2]) + '" data-source="Stratejik Öncelik" data-impact="Yüksek">→ Aksiyon oluştur</button></div></div></div>';
      }).join("");
  };

  VIEWS.ai = function () {
    var ins = [
      ["#1 · KRİTİK", COL.ai, 88, "Yüksek performanslı çalışan kaybı riski. 40 kritik kişi piyasa medyanının %18 altında → 8 haftada elde tutma paketi.", "pay", "Hedefli elde tutma paketi"],
      ["#2 · KRİTİK", COL.ai, 79, "Kritik rol yedeksizliği. 12 rol için göreve hazır yedek aday yok → 9 aylık yedekleme planı.", "talent", "9 aylık yedekleme planı"],
      ["#3 · YÜKSEK", COL.amber, 81, "Tedarik'te ayrılmaların kök nedeni ücret değil yönetici ilişkisi → yönetici koçluğu.", "turnover", "Yönetici koçluğu programı"],
      ["#4 · ANOMALİ", COL.amber, 73, "Ücret adaleti algısı (54) ile birinci çıkış nedeni (ücret) birebir örtüşüyor.", "engage", "Ücret bandı şeffaflığı pilotu"],
      ["#5 · FIRSAT", COL.green, 84, "İç terfi kapasitesi güçlü; göreve hazır oran %63 → açık liderliğin %48'i içeriden.", "talent", "İç terfi eşleştirme çalışması"],
      ["#6 · DÖNEMSEL", COL.blue, 80, "1. Çeyrek → 2. Çeyrek: devir oranı +2,1 puan arttı; sağlık skoru +3 ile dengeledi.", "exec", ""]
    ];
    return '<div class="flex mb"><span class="ai-chip">✦ YAPAY ZEKÂ İÇGÖRÜ MERKEZİ</span><span class="muted-txt">' + esc(deptName(state.dept)) + ' kapsamında · önceliklendirilmiş · veri → içgörü → aksiyon</span></div>' +
      '<div class="grid g-2">' + ins.map(function (i) {
        var acts = '<button data-act="goto" data-v="' + i[4] + '">→ Modüle git</button>' +
          (i[5] ? '<button data-act="seed-action" data-title="' + esc(i[5]) + '" data-source="Yapay Zekâ İçgörüsü" data-impact="Yüksek">→ Aksiyon oluştur</button>' : '');
        return aiBox({ body: '<div class="ai-head" style="margin-bottom:6px"><span class="ai-chip" style="background:' + i[1] + '">' + i[0] + '</span><span class="ai-conf">%' + i[2] + '<span class="conf-bar"><i style="width:' + i[2] + '%"></i></span></span></div><p>' + esc(i[3]) + '</p>', actions: acts });
      }).join("") + '</div>';
  };

  VIEWS.assistant = function () {
    return '<div class="assistant-hero card"><div class="flex" style="align-items:flex-start;gap:14px"><span class="ai-chip">✦</span><div><h3>ROTA Asistanım</h3><p class="muted-txt">İç verileriniz üzerinden sorularınızı yanıtlayan, kaynakları da gösteren yapay zeka destekli yardımcı.</p></div></div></div>' +
      '<div class="assistant-app card"><div class="assistant-chat" id="assistant-messages"></div>' +
      '<div class="assistant-input-row"><input id="assistant-input" type="text" placeholder="Soru yazın... Örneğin: \"Ücret-dengesi riski nedir?\"" /><button class="btn primary" data-act="assistant-send">Gönder</button></div></div>';
  };

  VIEWS.alerts = function () {
    var f = F(), m = metrics();
    var al = [];
    if (m.vol >= 18) al.push(["r", "Yüksek gönüllü ayrılma", "%" + round(m.vol) + " — eşik %18 aşıldı (" + deptName(state.dept) + ")", "turnover"]);
    if (m.pay.hilo >= 20) al.push(["r", "Ücret kaynaklı kayıp riski yoğun", "Yüksek performans / düşük ücret %" + round(m.pay.hilo), "pay"]);
    if (m.openCrit >= 2) al.push(["a", "Yedeksiz kritik rol", m.openCrit + " açık kritik rol", "talent"]);
    if (m.eng < 67) al.push(["a", "Bağlılık eşik altında", "Endeks " + round(m.eng), "engage"]);
    if (m.ttf > 45) al.push(["a", "İşe alım yavaş", "Pozisyon kapatma süresi " + round(m.ttf) + " gün", "turnover"]);
    f.emps.filter(function (e) { return e.flight === "Yüksek" && e.critical; }).slice(0, 4).forEach(function (e) { al.push(["r", "Ayrılma riski: " + e.name, e.role + " · " + e.nineBox + " · ücret farkı " + e.marketDelta + "%", "directory"]); });
    if (!al.length) al.push(["g", "Kritik eşik aşımı yok", deptName(state.dept) + " için aktif uyarı bulunmuyor.", "exec"]);
    return '<div class="flex mb"><span class="muted-txt">Eşik tabanlı ve kişi seviyesinde otomatik uyarılar · ' + esc(deptName(state.dept)) + '</span></div>' +
      al.map(function (a) {
        return '<div class="alert-row ' + a[0] + '" data-act="goto" data-v="' + a[3] + '"><span class="alert-dot"></span><div><b>' + esc(a[1]) + '</b><span>' + esc(a[2]) + '</span></div><span class="alert-go">→</span></div>';
      }).join("");
  };

  VIEWS.actions = function () {
    var f = F();
    var counts = { o: 0, p: 0, d: 0 };
    f.actions.forEach(function (a) { counts[a.status === "Açık" ? "o" : a.status === "Devam ediyor" ? "p" : "d"]++; });
    var tbl = f.actions.length ? '<table class="tbl"><thead><tr><th>Aksiyon</th><th>Kaynak Modül</th><th>Sahip</th><th>Termin</th><th>Etki</th><th>Durum</th><th></th></tr></thead><tbody>' +
      f.actions.map(function (a) {
        return '<tr><td><b>' + esc(a.title) + '</b></td><td>' + esc(a.source) + '</td><td>' + esc(a.owner) + '</td><td>' + esc(a.due) + '</td><td>' + chip(a.impact, a.impact === "Yüksek" ? "r" : a.impact === "Orta" ? "a" : "g") + '</td>' +
          '<td><span class="status-chip ' + statusCls(a.status) + '" data-act="action-status" data-id="' + a.id + '">' + esc(a.status) + '</span></td>' +
          '<td class="row-act"><button data-act="action-edit" data-id="' + a.id + '">✎</button><button data-act="action-del" data-id="' + a.id + '">🗑</button></td></tr>';
      }).join("") + '</tbody></table>' : '<div class="empty">Bu departmanda aksiyon yok.</div>';
    return '<div class="grid g-4">' +
      kpi({ label: "Toplam", val: f.actions.length }) +
      kpi({ label: "Açık", val: '<span style="color:' + COL.red + '">' + counts.o + '</span>' }) +
      kpi({ label: "Devam eden", val: '<span style="color:' + COL.amber + '">' + counts.p + '</span>' }) +
      kpi({ label: "Tamamlanan", val: '<span style="color:' + COL.green + '">' + counts.d + '</span>' }) +
      '</div><div class="toolbar mt"><span class="t-lbl">' + esc(deptName(state.dept)) + '</span><button class="btn primary" data-act="action-add" style="margin-left:auto">+ Aksiyon Ekle</button></div>' +
      '<div class="mt">' + card("Aksiyon Takibi", tbl, '<span class="hint">durum etiketine tıklayın → sırayla değişir</span>') + '</div>';
  };

  VIEWS.directory = function () {
    var f = F();
    var emps = f.emps.slice();
    if (state.dirFilter === "flight") emps = emps.filter(function (e) { return e.flight === "Yüksek"; });
    else if (state.dirFilter === "critical") emps = emps.filter(function (e) { return e.critical; });
    else if (state.dirFilter === "hilo") emps = emps.filter(function (e) { return e.paySeg === "hilo"; });
    else if (state.dirFilter === "star") emps = emps.filter(function (e) { return e.nineBox === "Yıldız"; });
    var fb = [["all", "Tümü"], ["star", "★ Yıldız"], ["hilo", "Düşük ücret"], ["flight", "Ayrılma riski"], ["critical", "Kritik rol"]].map(function (k) { return '<button class="fbtn ' + (state.dirFilter === k[0] ? "on" : "") + '" data-act="dirfilter" data-k="' + k[0] + '">' + k[1] + '</button>'; }).join("");
    var rows = emps.slice(0, 60).map(function (e) {
      return '<tr data-act="person" data-id="' + e.id + '"><td><b>' + esc(e.name) + '</b><span class="sub2">' + esc(e.id) + '</span></td><td>' + esc(e.role) + '</td><td>' + esc(deptName(e.dept)) + '</td><td>' + esc(e.level) + '</td><td>' + esc(e.nineBox) + '</td><td>' + paySegPill(e.paySeg) + '</td><td>' + flightPill(e.flight) + '</td>' +
        '<td class="row-act"><button data-act="emp-edit" data-id="' + e.id + '">✎</button><button data-act="emp-del" data-id="' + e.id + '">🗑</button></td></tr>';
    }).join("");
    return '<div class="toolbar"><span class="t-lbl">' + emps.length + ' kayıt · ' + esc(deptName(state.dept)) + '</span>' + fb +
      '<button class="btn" data-act="goto" data-v="data">⇪ Toplu içe aktar</button><button class="btn primary" data-act="emp-add">+ Çalışan Ekle</button></div>' +
      '<div class="mt card"><table class="tbl tbl-hover"><thead><tr><th>Çalışan</th><th>Rol</th><th>Departman</th><th>Kademe</th><th>9 Kutu</th><th>Ücret Konumu</th><th>Ayrılma Riski</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="8"><div class="empty">Kayıt yok.</div></td></tr>') + '</tbody></table>' +
      (emps.length > 60 ? '<p class="fn">İlk 60 kayıt gösteriliyor (toplam ' + emps.length + '). Daraltmak için arama veya filtre kullanın.</p>' : '') + '</div>';
  };
  function paySegPill(s) { return s === "hilo" ? '<span class="pill r">Düşük</span>' : s === "lohi" ? '<span class="pill a">Yüksek</span>' : s === "aligned" ? '<span class="pill g">Hizalı</span>' : '<span class="pill">Diğer</span>'; }
  function flightPill(f) { return f === "Yüksek" ? '<span class="pill r">Yüksek</span>' : f === "Orta" ? '<span class="pill a">Orta</span>' : '<span class="pill g">Düşük</span>'; }

  VIEWS.onetoone = function () {
    var f = F();
    var notes = f.notes.slice().reverse();
    var list = notes.length ? notes.map(function (n) {
      return '<div class="note-card"><div class="flex"><div class="av sm">' + esc((n.empName || "?").split(" ").map(function (s) { return s[0]; }).join("").slice(0, 2)) + '</div><div><b>' + esc(n.empName) + '</b><span class="sub2">' + esc(deptName(n.dept)) + ' · ' + esc(n.date) + '</span></div><button class="row-act" data-act="note-del" data-id="' + n.id + '" style="margin-left:auto">🗑</button></div><p>' + esc(n.text) + '</p></div>';
    }).join("") : '<div class="empty">Henüz görüşme notu yok. "+ Not Ekle" ile başlayın.</div>';
    return '<div class="toolbar"><span class="t-lbl">' + notes.length + ' görüşme notu · ' + esc(deptName(state.dept)) + '</span><button class="btn primary" data-act="note-add" style="margin-left:auto">+ Not Ekle</button></div>' +
      '<div class="mt notes-wrap">' + list + '</div>';
  };

  VIEWS.reqs = function () {
    var f = F();
    var stages = [["Talep açık", f.positions.length, COL.blue], ["Aday havuzu", Math.round(f.positions.length * 2.4), COL.ai], ["Görüşme", Math.round(f.positions.length * 1.3), COL.amber], ["Teklif", Math.round(f.positions.length * 0.6), COL.green]];
    return '<div class="toolbar"><span class="t-lbl">' + esc(deptName(state.dept)) + ' işe alım hattı</span><button class="btn primary" data-act="req-add" style="margin-left:auto">+ Açık Pozisyon</button></div>' +
      '<div class="funnel mt">' + stages.map(function (s, i) {
        return '<div class="fn-stage"><div class="fn-bar" style="background:' + s[2] + ';width:' + (100 - i * 18) + '%"><b>' + s[1] + '</b></div><span>' + s[0] + '</span></div>';
      }).join("") + '</div>' +
      '<div class="mt">' + card("Açık Pozisyonlar", openPosTable(f.positions)) + '</div>';
  };

  VIEWS.comp = function () {
    var f = F();
    var hilo = f.emps.filter(function (e) { return e.paySeg === "hilo"; }).sort(function (a, b) { return a.marketDelta - b.marketDelta; });
    var totalGap = hilo.reduce(function (a, e) { return a + Math.abs(e.marketDelta); }, 0);
    var rows = hilo.slice(0, 30).map(function (e) {
      return '<tr><td><b>' + esc(e.name) + '</b><span class="sub2">' + esc(e.role) + '</span></td><td>' + esc(deptName(e.dept)) + '</td><td>' + esc(e.nineBox) + '</td><td><span style="color:' + COL.red + ';font-weight:700">' + e.marketDelta + '%</span></td><td>' + flightPill(e.flight) + '</td>' +
        '<td class="row-act"><button class="mini-btn ai" data-act="comp-fix" data-id="' + e.id + '">Düzeltme öner</button></td></tr>';
    }).join("");
    return '<div class="grid g-4">' +
      kpi({ label: "Kayıp riski (kişi)", val: hilo.length, tag: { t: "r", l: "ÖNCELİK" } }) +
      kpi({ label: "Ortalama ücret açığı", val: round(totalGap / Math.max(1, hilo.length)) + "%" }) +
      kpi({ label: "Kritik roldekiler", val: hilo.filter(function (e) { return e.critical; }).length }) +
      kpi({ label: "Simülasyon", val: "Senaryo", delta: { c: "flat", t: "satırda 'düzeltme öner'" } }) +
      '</div>' +
      '<div class="mt">' + card("Yüksek Performans / Düşük Ücret Listesi — Ücret Düzeltme Tezgâhı",
        hilo.length ? '<table class="tbl"><thead><tr><th>Çalışan</th><th>Departman</th><th>9 Kutu</th><th>Piyasa Farkı</th><th>Ayrılma Riski</th><th>Senaryo</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '<div class="empty">Bu departmanda düşük ücret kaynaklı kayıp riski yok. 👍</div>',
        '<span class="hint">"Düzeltme öner" → simülasyonu uygular, segment ve risk güncellenir</span>') + '</div>' +
      aiBox({ title: "Elde tutma bütçesi", conf: 85, body: '<p>Hedefli ücret düzeltme bütçesi, adalet riski taşıyan (düşük performans / yüksek ücret) bloğundan kaydırılarak finanse edilebilir. Önlenebilir kaybın değeri, düzeltme maliyetinin yaklaşık 3,6 katıdır.</p>' });
  };

  VIEWS.data = function () {
    var f = F();
    return '<div class="grid g-3">' +
      '<div class="card data-card"><div class="dc-ic" style="background:#E7EEFB;color:' + COL.blue + '">⇪</div><h3>Excel/CSV Toplu İçe Aktarım</h3><p>Excel\'den kopyala-yapıştır yapın veya dosya yükleyin. Çalışan kayıtlarını toplu ekleyin/güncelleyin.</p>' +
      '<div class="dc-actions"><button class="btn primary" data-act="import-paste">📋 Excel\'den yapıştır</button><label class="btn">📁 Dosya yükle<input type="file" id="import-file" accept=".csv,.tsv,.txt" hidden></label></div></div>' +
      '<div class="card data-card"><div class="dc-ic" style="background:#E7F5ED;color:' + COL.green + '">⤓</div><h3>Şablon ve Dışa Aktarım</h3><p>Doğru sütun başlıklarıyla şablon indirin; mevcut veriyi CSV veya JSON olarak dışa aktarın.</p>' +
      '<div class="dc-actions"><button class="btn" data-act="tmpl">⤓ CSV şablonu</button><button class="btn" data-act="export-csv">⇩ CSV dışa aktar</button><button class="btn" data-act="export-json">⇩ JSON yedek</button></div></div>' +
      '<div class="card data-card"><div class="dc-ic" style="background:#E7F8FB;color:' + COL.brand + '">⟳</div><h3>Örnek Veri Yönetimi</h3><p>Tüm değişiklikler tarayıcınızda saklanır. Uygulamayı başlangıç durumuna döndürebilirsiniz.</p>' +
      '<div class="dc-actions"><button class="btn primary" data-act="emp-add">+ Tek çalışan ekle</button><button class="btn danger" data-act="reset">⟳ Örnek veriyi sıfırla</button></div></div>' +
      '</div>' +
      '<div class="toolbar mt"><span class="t-lbl">Çalışan Kayıtları · ' + f.emps.length + ' · ' + esc(deptName(state.dept)) + '</span><span class="hint" style="margin-left:auto">Sütunlar: ad, departman, rol, kademe, yaş, kıdem, performans (1-5), potansiyel, ücret farkı (%), bağlılık, kritik</span></div>' +
      '<div class="mt card"><table class="tbl tbl-hover"><thead><tr><th>Çalışan</th><th>Departman</th><th>Rol</th><th>Performans</th><th>Potansiyel</th><th>Ücret Farkı</th><th>Bağlılık</th><th></th></tr></thead><tbody>' +
      f.emps.slice(0, 40).map(function (e) {
        return '<tr><td><b>' + esc(e.name) + '</b></td><td>' + esc(deptName(e.dept)) + '</td><td>' + esc(e.role) + '</td><td>' + e.perf + ' · ' + esc(e.perfLabel) + '</td><td>' + esc(e.pot) + '</td><td>' + e.marketDelta + '%</td><td>' + e.engagement + '</td>' +
          '<td class="row-act"><button data-act="emp-edit" data-id="' + e.id + '">✎</button><button data-act="emp-del" data-id="' + e.id + '">🗑</button></td></tr>';
      }).join("") + '</tbody></table>' + (f.emps.length > 40 ? '<p class="fn">İlk 40 / ' + f.emps.length + ' kayıt.</p>' : '') + '</div>';
  };

  /* ============================================================
     ÇİZİM
     ============================================================ */
  function animateCharts() {
    $all('.bars .bar-fill').forEach(function (fill) {
      var target = fill.dataset.width;
      if (target) {
        fill.style.width = '0%';
        requestAnimationFrame(function () {
          fill.style.width = target;
        });
      }
    });
    $all('.spark polyline').forEach(function (path) {
      try {
        var len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.3,1)';
        requestAnimationFrame(function () {
          path.style.strokeDashoffset = '0';
        });
      } catch (e) { }
    });
    $all('.donut').forEach(function (d) {
      d.classList.add('animate');
    });
  }

  function bindFeatureEvents() {
    var simRun = document.getElementById('sim-run');
    if (simRun) {
      simRun.addEventListener('click', function () {
        var seg = document.getElementById('sim-seg').value;
        var pct = parseFloat(document.getElementById('sim-pct').value || 0);
        var out = document.getElementById('sim-out');
        var summary = document.getElementById('sim-summary');
        var name = seg === 'highPerf' ? 'Yüksek performans / düşük ücret segmenti' : seg === 'underpaid' ? 'Düşük ücretli genel segment' : 'Tüm organizasyon';
        var impact = pct * 1.8;
        var retention = Math.max(0, 12 - Math.round(pct / 2));
        if (out) out.innerHTML = '<strong>' + name + '</strong> için %' + pct + ' ücret artışı simüle edildi. Beklenen kısa vadeli bağlılık artışı yaklaşık %' + impact + ' ve ayrılma riskinde %' + retention + ' puan iyileşme.';
        if (summary) summary.innerHTML = '<div class="feature-placeholder"><div class="placeholder-body">Bu senaryoda hedefli yüzde artış, düşük ücretli yüksek performanslı grupta önlenebilir kaybı azaltır. Tahmini etki: <b>bağlılık +%' + impact + '</b>, <b>ayrılma riski -%' + retention + '</b>.</div></div>';
      });
    }
    function runCohortAnalysis(presetLabel) {
      var dept = document.getElementById('cohort-dept').value;
      var risk = document.getElementById('cohort-risk').value;
      var emps = DB.employees.filter(function (e) { return (dept === 'all' || e.dept === dept); });
      if (risk === 'high') emps = emps.filter(function (e) { return e.flight === 'Yüksek' || e.paySeg === 'hilo'; });
      else if (risk === 'medium') emps = emps.filter(function (e) { return e.flight === 'Orta' || e.paySeg === 'other'; });
      else if (risk === 'low') emps = emps.filter(function (e) { return e.flight === 'Düşük' && e.paySeg === 'aligned'; });
      var out = document.getElementById('cohort-output');
      var title = presetLabel ? '<strong>' + esc(presetLabel) + '</strong><br>' : '';
      var html = '<div class="feature-placeholder"><div class="placeholder-body">' + title + '<strong>' + emps.length + ' çalışan</strong> seçildi. ' + (dept === 'all' ? 'Tüm organizasyon' : deptName(dept)) + ' · ' + (risk === 'all' ? 'Tümü' : risk === 'high' ? 'Yüksek risk' : risk === 'medium' ? 'Orta risk' : 'Düşük risk') + '.</div>';
      if (emps.length) {
        html += '<table class="tbl"><thead><tr><th>Çalışan</th><th>Rol</th><th>9 Kutu</th><th>Ayrılma</th><th>Ücret farkı</th></tr></thead><tbody>' + emps.slice(0, 20).map(function (e) {
          return '<tr><td>' + esc(e.name) + '</td><td>' + esc(e.role) + '</td><td>' + esc(e.nineBox) + '</td><td>' + esc(e.flight) + '</td><td>' + esc(e.marketDelta) + '%</td></tr>';
        }).join('') + '</tbody></table>';
        if (emps.length > 20) html += '<p class="fn">İlk 20 kayıt gösteriliyor. Daha dar bir filtre seçerek daraltabilirsiniz.</p>';
      } else {
        html += '<div class="placeholder-body">Seçim kriterlerinde çalışan bulunamadı. Farklı filtreler deneyin.</div>';
      }
      var intervention = 'Bu cohort için hedef: uygun müdahaleleri hızla tanımlamak ve önceliklendirmek.';
      var impact = 'Bu cohortun kısa vadeli etki yatırımını tahmini olarak açığa çıkarır.';
      var keep = 'Bu grubu tutturmak için ücret, bağlılık ve yedekleme aksiyonlarını eşzamanlı yürütün.';
      if (presetLabel === 'Yüksek riskli yetenek cohortu') {
        intervention = 'Acil elde tutma paketleri, mentorluk ve kariyer yol haritası ile yüksek riskli yetenekleri destekleyin.';
        impact = 'Bu cohortta beklenen etki: ayrılma riskinde %6–9 düşüş, bağlılıkta %4–6 artış.';
        keep = 'Öneri: yüksek performanslı yetenekler için ücret düzeltmesi, net terfi görünürlüğü ve hızlandırılmış beceri geliştirme.';
      } else if (presetLabel === 'Düşük ücretli yüksek performans cohortu') {
        intervention = 'Ücret dengesi ve ödül paketlerini yenileyin; performansı kaybetmeden bağlılığı güçlendirin.';
        impact = 'Beklenen etki: bu grubun elde tutulması işten ayrılma maliyetini azaltır ve kariyer potansiyelini korur.';
        keep = 'Öneri: performans tanıma, ücret adaleti düzeltmesi ve görüşme döngüsü ile bağlılığı güvenceye alın.';
      } else if (presetLabel === 'Kritik yedekleme gerektiren pozisyon cohortu') {
        intervention = 'Kritik rollerde hızlı yedekleme havuzu oluşturun; hem iç hem dış kaynak planlayın.';
        impact = 'Bu cohortun dolması iş sürekliliğini güvenceye alır ve kritik boşluk maliyetini düşürür.';
        keep = 'Öneri: göreve hazır adayları hızlandırın, yetenek yolu netleştirin ve yedeklemeyi izleyin.';
      }
      html += '<div class="cohort-summary grid g-3 mt">' +
        card('Önerilen Müdahaleler', '<p class="fn">' + esc(intervention) + '</p>') +
        card('Tahmini Etki', '<p class="fn">' + esc(impact) + '</p>') +
        card('Grubu Tuttuğunuzda', '<p class="fn">' + esc(keep) + '</p>') +
        '</div>';
      html += '</div>';
      if (out) out.innerHTML = html;
    }
    var cohortRun = document.getElementById('cohort-run');
    if (cohortRun) {
      cohortRun.addEventListener('click', function () {
        runCohortAnalysis();
      });
    }
    var cohortPreset = document.querySelector('[data-act="cohort-preset"]');
    if (cohortPreset) {
      $all('[data-act="cohort-preset"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var preset = btn.dataset.preset;
          var dept = document.getElementById('cohort-dept');
          var risk = document.getElementById('cohort-risk');
          if (!dept || !risk) return;
          if (preset === 'highRiskTalent') {
            dept.value = 'all';
            risk.value = 'high';
            runCohortAnalysis('Yüksek riskli yetenek cohortu');
          } else if (preset === 'lowPayHighPerf') {
            dept.value = 'all';
            risk.value = 'high';
            runCohortAnalysis('Düşük ücretli yüksek performans cohortu');
          } else if (preset === 'criticalBackup') {
            dept.value = 'all';
            risk.value = 'medium';
            runCohortAnalysis('Kritik yedekleme gerektiren pozisyon cohortu');
          }
        });
      });
    }
    var cohortExport = document.getElementById('cohort-export');
    if (cohortExport) {
      cohortExport.addEventListener('click', function () {
        var dept = document.getElementById('cohort-dept').value;
        var risk = document.getElementById('cohort-risk').value;
        var emps = DB.employees.filter(function (e) { return (dept === 'all' || e.dept === dept); });
        if (risk === 'high') emps = emps.filter(function (e) { return e.flight === 'Yüksek' || e.paySeg === 'hilo'; });
        else if (risk === 'medium') emps = emps.filter(function (e) { return e.flight === 'Orta' || e.paySeg === 'other'; });
        else if (risk === 'low') emps = emps.filter(function (e) { return e.flight === 'Düşük' && e.paySeg === 'aligned'; });
        var csv = 'ad,departman,rol,9kutu,ayrilma,maas_farki\n' + emps.map(function (e) {
          return '"' + e.name + '","' + deptName(e.dept) + '","' + e.role + '","' + e.nineBox + '","' + e.flight + '","' + e.marketDelta + '%"';
        }).join('\n');
        download('cohort-' + dept + '-' + risk + '.csv', csv, 'text/csv;charset=utf-8');
        toast(emps.length + ' çalışan CSV olarak hazırlandı');
      });
    }
    var cohortSave = document.getElementById('cohort-save');
    if (cohortSave) {
      cohortSave.addEventListener('click', function () {
        toast('Cohort kaydetme özelliği demo modunda. Çıktıyı CSV olarak indirebilirsiniz.');
      });
    }
    var assistantSendBtn = document.querySelector('[data-act="assistant-send"]');
    if (assistantSendBtn) {
      assistantSendBtn.addEventListener('click', function () { assistantSend(); });
    }
    var assistantInput = document.getElementById('assistant-input');
    if (assistantInput) {
      assistantInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { assistantSend(); } });
      assistantRender();
    }
    var assistantBtn = document.getElementById('assistant-btn');
    if (assistantBtn) {
      assistantBtn.addEventListener('click', function () { assistantToggle(true); });
    }
    var assistantClose = document.querySelector('[data-act="assistant-close"]');
    if (assistantClose) {
      assistantClose.addEventListener('click', function () { assistantToggle(false); });
    }
  }

  function render() {
    var v = state.view;
    $("#ttl").textContent = META[v][0]; $("#crumb").textContent = META[v][0]; $("#sub").textContent = META[v][1];
    $("#view").innerHTML = (VIEWS[v] || function () { return '<div class="empty">Yakında</div>'; })();
    $all("#nav button").forEach(function (b) { b.classList.toggle("active", b.dataset.v === v); });
    window.scrollTo({ top: 0 });
    animateCharts();
    bindFeatureEvents();
  }
  function go(v) { state.view = v; render(); }

  /* ============================================================
     KİŞİ ÇEKMECESİ
     ============================================================ */
  function personDrawer(id) {
    var e = DB.employees.find(function (x) { return x.id === id; }); if (!e) return;
    var notes = DB.notes.filter(function (n) { return n.empId === id; });
    openDrawer('Kişi Kartı',
      '<div class="person-hd"><div class="av lg">' + esc(e.name.split(" ").map(function (s) { return s[0]; }).join("").slice(0, 2)) + '</div><div><b>' + esc(e.name) + '</b><span>' + esc(e.role) + ' · ' + esc(deptName(e.dept)) + '</span></div></div>' +
      '<div class="kv"><div><span>9 Kutu</span><b>' + esc(e.nineBox) + '</b></div><div><span>Performans</span><b>' + esc(e.perfLabel) + '</b></div><div><span>Potansiyel</span><b>' + esc(e.pot) + '</b></div>' +
      '<div><span>Ücret farkı</span><b style="color:' + (e.marketDelta < 0 ? COL.red : COL.green) + '">' + e.marketDelta + '%</b></div><div><span>Bağlılık</span><b>' + e.engagement + '</b></div><div><span>Ayrılma riski</span><b>' + esc(e.flight) + '</b></div>' +
      '<div><span>Kıdem</span><b>' + e.tenure + ' yıl</b></div><div><span>Kademe</span><b>' + esc(e.level) + '</b></div><div><span>Kritik rol</span><b>' + (e.critical ? "Evet" : "Hayır") + '</b></div></div>' +
      (e.paySeg === "hilo" ? '<div class="ai-box" style="margin:14px 0"><div class="ai-head"><span class="ai-chip">✦ Yapay Zekâ</span><b>Elde tutma sinyali</b></div><p>Yüksek performans, düşük ücret ve ' + esc(e.flight.toLowerCase()) + ' ayrılma riski bir arada. Hedefli ücret düzeltmesi önerilir.</p></div>' : '') +
      '<div class="drawer-act"><button class="btn primary" data-act="note-add" data-id="' + e.id + '">+ Görüşme notu</button><button class="btn" data-act="emp-edit" data-id="' + e.id + '">✎ Düzenle</button>' + (e.paySeg === "hilo" ? '<button class="btn ai" data-act="comp-fix" data-id="' + e.id + '">Ücret düzelt (senaryo)</button>' : '') + '</div>' +
      '<div class="drawer-notes">' + (notes.length ? '<h4>Görüşme notları</h4>' + notes.map(function (n) { return '<div class="note-card sm"><span class="sub2">' + esc(n.date) + '</span><p>' + esc(n.text) + '</p></div>'; }).join("") : '') + '</div>');
  }

  /* ============================================================
     KAYIT İŞLEMLERİ + İÇE/DIŞA AKTARIM
     ============================================================ */
  var DEPT_OPTS = function () { return DB.departments.map(function (d) { return { v: d.id, l: d.name }; }); };

  function empForm(e) {
    var isNew = !e;
    e = e || { name: "", dept: state.dept === "all" ? "hr" : state.dept, role: "", level: "6. Kademe Uzman", age: 30, tenure: 2, perf: 3, pot: "Orta", marketDelta: 0, engagement: 70, critical: false };
    modalForm(isNew ? "Yeni Çalışan" : "Çalışanı Düzenle", [
      { key: "name", label: "Ad Soyad", value: e.name, full: true },
      { key: "dept", label: "Departman", type: "select", options: DEPT_OPTS(), value: e.dept },
      { key: "role", label: "Rol", value: e.role },
      { key: "level", label: "Kademe", type: "select", options: ["4. Kademe Müdür", "5. Kademe Yönetici", "6. Kademe Uzman", "7. Kademe Uzman Yardımcısı"], value: e.level },
      { key: "age", label: "Yaş", type: "number", value: e.age },
      { key: "tenure", label: "Kıdem (yıl)", type: "number", value: e.tenure },
      { key: "perf", label: "Performans (1-5)", type: "select", options: [1, 2, 3, 4, 5], value: e.perf },
      { key: "pot", label: "Potansiyel", type: "select", options: ["Düşük", "Orta", "Yüksek"], value: e.pot },
      { key: "marketDelta", label: "Piyasa ücret farkı (%)", type: "number", value: e.marketDelta, hint: "negatif = piyasa altı" },
      { key: "engagement", label: "Bağlılık (0-100)", type: "number", value: e.engagement },
      { key: "critical", label: "Kritik rol", type: "select", options: [{ v: "false", l: "Hayır" }, { v: "true", l: "Evet" }], value: String(e.critical) }
    ], function (v) {
      if (!v.name.trim()) { toast("Ad Soyad zorunlu", "warn"); return true; }
      var perf = +v.perf, delta = +v.marketDelta;
      var obj = { name: v.name.trim(), dept: v.dept, role: v.role || "—", level: v.level, age: +v.age || 30, tenure: +v.tenure || 0,
        perf: perf, perfLabel: DATA.PERF_LABELS[perf - 1], pot: v.pot, nineBox: DATA.nineBoxOf(perf, v.pot),
        marketDelta: delta, paySeg: DATA.paySegOf(perf, delta), engagement: +v.engagement || 70,
        flight: (perf >= 4 && delta <= -12) || (+v.engagement < 55) ? "Yüksek" : (+v.engagement < 68 ? "Orta" : "Düşük"),
        critical: v.critical === "true", status: "Aktif" };
      if (isNew) { obj.id = "E" + Date.now(); DB.employees.push(obj); toast("Çalışan eklendi"); }
      else { Object.assign(e, obj); toast("Çalışan güncellendi"); }
      DATA.save(DB); render();
    });
  }

  function riskForm(r) {
    var isNew = !r;
    r = r || { risk: "", data: "", impact: "", sev: 5, action: "", owner: "İK İş Ortağı", due: "3. Çeyrek", status: "Açık", dept: state.dept === "all" ? "all" : state.dept };
    modalForm(isNew ? "Yeni Risk" : "Riski Düzenle", [
      { key: "risk", label: "Risk", value: r.risk, full: true },
      { key: "data", label: "Dayandığı veri", value: r.data, full: true, hint: "her risk veriyle desteklenmelidir" },
      { key: "impact", label: "İş etkisi", value: r.impact, full: true },
      { key: "sev", label: "Şiddet (1-10)", type: "number", value: r.sev },
      { key: "action", label: "Aksiyon", value: r.action, hint: "her risk bir aksiyona bağlanmalıdır" },
      { key: "owner", label: "Sahip", value: r.owner },
      { key: "due", label: "Termin", value: r.due },
      { key: "dept", label: "Departman", type: "select", options: [{ v: "all", l: "Organizasyon geneli" }].concat(DEPT_OPTS()), value: r.dept },
      { key: "status", label: "Durum", type: "select", options: ["Açık", "Devam ediyor", "Tamamlandı", "Planlandı"], value: r.status }
    ], function (v) {
      if (!v.risk.trim()) { toast("Risk başlığı zorunlu", "warn"); return true; }
      if (!v.data.trim()) { toast("Her risk veriyle desteklenmelidir", "warn"); return true; }
      if (!v.action.trim()) { toast("Her risk için aksiyon yazılmalıdır", "warn"); return true; }
      var obj = { risk: v.risk, data: v.data, impact: v.impact, sev: +v.sev || 5, action: v.action, owner: v.owner, due: v.due, status: v.status, dept: v.dept };
      if (isNew) { obj.id = "R" + Date.now(); DB.risks.push(obj); toast("Risk eklendi"); } else { Object.assign(r, obj); toast("Risk güncellendi"); }
      DATA.save(DB); render();
    });
  }

  function actionForm(a, seed) {
    var isNew = !a;
    a = a || { title: (seed && seed.title) || "", source: (seed && seed.source) || "İK İş Ortağı", owner: "İK İş Ortağı", due: "3. Çeyrek", impact: (seed && seed.impact) || "Orta", status: "Açık", dept: state.dept === "all" ? "all" : state.dept };
    modalForm(isNew ? "Yeni Aksiyon" : "Aksiyonu Düzenle", [
      { key: "title", label: "Aksiyon", value: a.title, full: true },
      { key: "source", label: "Kaynak modül", value: a.source },
      { key: "owner", label: "Sahip", value: a.owner },
      { key: "due", label: "Termin", value: a.due },
      { key: "impact", label: "İş etkisi", type: "select", options: ["Yüksek", "Orta", "Düşük"], value: a.impact },
      { key: "dept", label: "Departman", type: "select", options: [{ v: "all", l: "Organizasyon geneli" }].concat(DEPT_OPTS()), value: a.dept },
      { key: "status", label: "Durum", type: "select", options: ["Açık", "Devam ediyor", "Tamamlandı"], value: a.status }
    ], function (v) {
      if (!v.title.trim()) { toast("Aksiyon başlığı zorunlu", "warn"); return true; }
      var obj = { title: v.title, source: v.source, owner: v.owner, due: v.due, impact: v.impact, status: v.status, dept: v.dept };
      if (isNew) { obj.id = "A" + Date.now(); DB.actions.push(obj); toast("Aksiyon Takip Merkezi'ne eklendi"); } else { Object.assign(a, obj); toast("Aksiyon güncellendi"); }
      DATA.save(DB); render();
    });
  }

  function reqForm(p) {
    var isNew = !p;
    p = p || { role: "", dept: state.dept === "all" ? "it" : state.dept, daysOpen: 1, backup: "Yok", impact: "", plan: "" };
    modalForm(isNew ? "Yeni Açık Pozisyon" : "Pozisyonu Düzenle", [
      { key: "role", label: "Rol", value: p.role, full: true },
      { key: "dept", label: "Departman", type: "select", options: DEPT_OPTS(), value: p.dept },
      { key: "daysOpen", label: "Açık süre (gün)", type: "number", value: p.daysOpen },
      { key: "backup", label: "Yedek aday durumu", value: p.backup },
      { key: "impact", label: "İş etkisi", value: p.impact },
      { key: "plan", label: "Plan", value: p.plan }
    ], function (v) {
      if (!v.role.trim()) { toast("Rol zorunlu", "warn"); return true; }
      var obj = { role: v.role, dept: v.dept, daysOpen: +v.daysOpen || 1, backup: v.backup, impact: v.impact, plan: v.plan };
      if (isNew) { obj.id = "P" + Date.now(); DB.positions.push(obj); toast("Pozisyon eklendi"); } else { Object.assign(p, obj); toast("Pozisyon güncellendi"); }
      DATA.save(DB); render();
    });
  }

  function noteForm(empId) {
    var empOpts = DB.employees.filter(function (e) { return state.dept === "all" || e.dept === state.dept; }).slice(0, 200).map(function (e) { return { v: e.id, l: e.name + " — " + deptName(e.dept) }; });
    modalForm("Birebir Görüşme Notu", [
      { key: "empId", label: "Çalışan", type: "select", options: empOpts, value: empId || (empOpts[0] && empOpts[0].v) },
      { key: "text", label: "Gözlem / not", type: "textarea", rows: 4, value: "", full: true }
    ], function (v) {
      if (!v.text.trim()) { toast("Not metni zorunlu", "warn"); return true; }
      var e = DB.employees.find(function (x) { return x.id === v.empId; });
      DB.notes.push({ id: "N" + Date.now(), empId: v.empId, empName: e ? e.name : "?", dept: e ? e.dept : state.dept, date: new Date().toISOString().slice(0, 10), text: v.text.trim() });
      DATA.save(DB); toast("Not eklendi"); render();
    });
  }

  /* ---- toplu içe aktarım ---- */
  function detectDelim(line) { if (line.indexOf("\t") >= 0) return "\t"; if (line.indexOf(";") >= 0) return ";"; return ","; }
  function deptIdFromText(t) {
    t = (t || "").trim().toLowerCase();
    var d = DB.departments.find(function (x) { return x.id === t || x.name.toLowerCase() === t || x.name.toLowerCase().indexOf(t) === 0; });
    return d ? d.id : null;
  }
  function parseImport(text) {
    var lines = text.replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); });
    if (!lines.length) return { rows: [], errors: ["Boş içerik"] };
    var delim = detectDelim(lines[0]);
    var hdr = lines[0].toLowerCase();
    var hasHeader = hdr.indexOf("ad") >= 0 && hdr.indexOf("departman") >= 0;
    var start = hasHeader ? 1 : 0;
    var rows = [], errors = [];
    for (var i = start; i < lines.length; i++) {
      var c = lines[i].split(delim).map(function (s) { return s.replace(/^"|"$/g, "").trim(); });
      if (c.length < 2) continue;
      var did = deptIdFromText(c[1]);
      if (!did) { errors.push("Satır " + (i + 1) + ": departman tanınmadı (" + c[1] + ")"); continue; }
      var perf = Math.max(1, Math.min(5, parseInt(c[6], 10) || 3));
      var delta = parseInt(c[8], 10); if (isNaN(delta)) delta = 0;
      var potRaw = (c[7] || "orta").toLowerCase();
      var pot = potRaw.indexOf("yük") === 0 ? "Yüksek" : potRaw.indexOf("düş") === 0 ? "Düşük" : "Orta";
      var eng = parseInt(c[9], 10); if (isNaN(eng)) eng = 70;
      rows.push({ id: "E" + Date.now() + "_" + i, name: c[0] || "İsimsiz", dept: did, role: c[2] || "—", level: c[3] || "6. Kademe Uzman",
        age: parseInt(c[4], 10) || 30, tenure: parseFloat(c[5]) || 1, perf: perf, perfLabel: DATA.PERF_LABELS[perf - 1], pot: pot,
        nineBox: DATA.nineBoxOf(perf, pot), marketDelta: delta, paySeg: DATA.paySegOf(perf, delta), engagement: eng,
        flight: (perf >= 4 && delta <= -12) || eng < 55 ? "Yüksek" : (eng < 68 ? "Orta" : "Düşük"),
        critical: /evet|true|1/i.test(c[10] || ""), status: "Aktif" });
    }
    return { rows: rows, errors: errors };
  }
  function importDialog(prefill) {
    modalForm("Toplu İçe Aktarım — Excel/CSV", [
      { key: "mode", label: "Mod", type: "select", options: [{ v: "append", l: "Mevcut veriye ekle" }, { v: "replace", l: "Tümünü değiştir" }], value: "append" },
      { key: "text", label: "Veri (Excel'den kopyala-yapıştır veya CSV)", type: "textarea", rows: 8, value: prefill || "", full: true, hint: "sütunlar: ad,departman,rol,kademe,yas,kidem,performans,potansiyel,ucret_farki,baglilik,kritik" }
    ], function (v) {
      var res = parseImport(v.text);
      if (!res.rows.length) { toast(res.errors[0] || "Geçerli satır bulunamadı", "err"); return true; }
      if (v.mode === "replace") DB.employees = res.rows; else DB.employees = DB.employees.concat(res.rows);
      DATA.save(DB);
      toast(res.rows.length + " kayıt içe aktarıldı" + (res.errors.length ? " (" + res.errors.length + " satır atlandı)" : ""), res.errors.length ? "warn" : "ok");
      render();
    }, { saveLabel: "İçe Aktar", note: "Excel'de satırları kopyalayıp aşağıya yapıştırın. Başlık satırı isteğe bağlıdır." });
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 100);
  }
  var CSV_HEAD = "ad,departman,rol,kademe,yas,kidem,performans,potansiyel,ucret_farki,baglilik,kritik";
  function exportCSV() {
    var emps = F().emps;
    var rows = emps.map(function (e) { return [e.name, deptName(e.dept), e.role, e.level, e.age, e.tenure, e.perf, e.pot, e.marketDelta, e.engagement, e.critical ? "Evet" : "Hayır"].map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(","); });
    download("rota-calisanlar-" + state.dept + ".csv", "\ufeff" + CSV_HEAD + "\n" + rows.join("\n"), "text/csv;charset=utf-8");
    toast(emps.length + " kayıt CSV olarak indirildi");
  }
  function templateCSV() {
    var ex = ['"Örnek Kişi","Bilgi Teknolojileri","Yazılım Geliştirici","6. Kademe Uzman","31","3.5","4","Yüksek","-18","64","Evet"',
      '"Örnek İki","Finans & Muhasebe","Bütçe Analisti","6. Kademe Uzman","29","2","3","Orta","2","74","Hayır"'];
    download("rota-ice-aktarim-sablonu.csv", "\ufeff" + CSV_HEAD + "\n" + ex.join("\n"), "text/csv;charset=utf-8");
    toast("Şablon indirildi");
  }

  function enrich(noteId, boxId) {
    var el = $(noteId);
    var t = (el && el.value || "").trim();
    var box = $(boxId); if (!box) return;
    box.innerHTML = '<div class="ai-box" style="margin-top:10px"><div class="ai-head"><span class="ai-chip">✦ Yapay Zekâ</span><b>Zenginleştirilmiş yönetici notu</b></div>' +
      '<div class="chain"><span class="d">VERİ</span>▶<span class="i">İÇGÖRÜ</span>▶<span class="a">AKSİYON</span></div>' +
      '<p>' + (t ? '"' + esc(t) + '" → ' : '') + '<b>Veriyle örtüşme:</b> ' + esc(deptName(state.dept)) + ' bağlılık verisinde iş yükü ve yönetici teması düşük seyrediyor; aynı dönemde ayrılma oranı artmış. <b>Öneri:</b> yönetici koçluğu, birebir görüşme ritmi ve iş yükü dengeleme. <b>Beklenen iş etkisi:</b> ayrılma oranı düşer, bağlılık yaklaşık 6 puan artar.</p>' +
      '<div class="ai-actions"><button data-act="seed-action" data-title="Yönetici koçluğu ve iş yükü dengeleme" data-source="Bağlılık" data-impact="Orta">→ Aksiyon oluştur</button></div></div>';
    toast("Yapay zekâ gözlemi zenginleştirdi");
  }

  var EXPLAIN = {
    exec: ["Yönetici özetinin dayanağı", "<p>Sağlık skoru bağlılık, göreve hazır yedek aday oranı ve çalışan devri bileşenlerinden hesaplanır. En kritik 3 risk, risk kaydından şiddete göre sıralanır ve seçili departmana göre filtrelenir.</p>"],
    to: ["Çalışan devri analizi", "<p>Devir oranı departman metriğinden; çıkış nedenleri ise seçili departmanın çıkış kayıtlarından gerçek zamanlı hesaplanır.</p>"],
    riskai: ["Yapay Zekâ Risk Önceliklendirmesi", "<p>Riskler şiddet × olasılık × iş etkisi ile sıralanır. İlk iki risk toplam etkinin yaklaşık %60'ını taşır; kaynak ve yönetim dikkati bu ikisine yoğunlaşmalıdır.</p>"]
  };

  /* ============================================================
     OLAY YÖNETİMİ
     ============================================================ */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.dataset.act, id = t.dataset.id, k = t.dataset.k, d = t.dataset.d, v = t.dataset.v;
    switch (act) {
      case "goto": go(v); break;
      case "setdept": state.dept = d; syncDeptSelect(); render(); toast(deptName(d) + " görünümü"); break;
      case "present": document.body.classList.toggle("present"); break;
      case "modal-close": closeModal(); break;
      case "explain": var ex = EXPLAIN[k] || ["Detay", "<p>Örnek açıklama.</p>"]; openDrawer(ex[0], ex[1]); break;
      case "person": personDrawer(id); break;
      case "riskfilter": state.riskFilter = k; render(); break;
      case "dirfilter": state.dirFilter = k; render(); break;
      case "seed-action": actionForm(null, { title: t.dataset.title, source: t.dataset.source, impact: t.dataset.impact }); break;
      case "risk-add": riskForm(); break;
      case "risk-edit": riskForm(DB.risks.find(function (x) { return x.id === id; })); break;
      case "risk-del": if (confirm("Risk silinsin mi?")) { DB.risks = DB.risks.filter(function (x) { return x.id !== id; }); DATA.save(DB); toast("Risk silindi"); render(); } break;
      case "risk-status": cycleStatus(DB.risks.find(function (x) { return x.id === id; })); break;
      case "action-add": actionForm(); break;
      case "action-edit": actionForm(DB.actions.find(function (x) { return x.id === id; })); break;
      case "action-del": if (confirm("Aksiyon silinsin mi?")) { DB.actions = DB.actions.filter(function (x) { return x.id !== id; }); DATA.save(DB); toast("Aksiyon silindi"); render(); } break;
      case "action-status": cycleStatus(DB.actions.find(function (x) { return x.id === id; })); break;
      case "emp-add": empForm(); break;
      case "emp-edit": empForm(DB.employees.find(function (x) { return x.id === id; })); break;
      case "emp-del": if (confirm("Çalışan silinsin mi?")) { DB.employees = DB.employees.filter(function (x) { return x.id !== id; }); DATA.save(DB); toast("Çalışan silindi"); render(); } break;
      case "req-add": reqForm(); break;
      case "req-edit": reqForm(DB.positions.find(function (x) { return x.id === id; })); break;
      case "req-del": if (confirm("Pozisyon silinsin mi?")) { DB.positions = DB.positions.filter(function (x) { return x.id !== id; }); DATA.save(DB); toast("Pozisyon silindi"); render(); } break;
      case "note-add": noteForm(id); break;
      case "note-del": DB.notes = DB.notes.filter(function (x) { return x.id !== id; }); DATA.save(DB); toast("Not silindi"); render(); break;
      case "enrich": enrich("#eng-note", "#eng-enriched"); break;
      case "enrich-rep": enrich("#rep-note", "#rep-enriched"); break;
      case "comp-fix": compFix(id); break;
      case "import-paste": importDialog(""); break;
      case "tmpl": templateCSV(); break;
      case "export-csv": exportCSV(); break;
      case "export-json": download("rota-yedek.json", JSON.stringify(DB, null, 2), "application/json"); toast("JSON yedek indirildi"); break;
      case "reset": if (confirm("Tüm değişiklikler silinip başlangıç durumuna dönülecek. Devam edilsin mi?")) { DB = DATA.reset(); toast("Örnek veri sıfırlandı"); render(); } break;
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "import-file" && e.target.files && e.target.files[0]) {
      var rd = new FileReader(); rd.onload = function () { importDialog(rd.result); }; rd.readAsText(e.target.files[0], "UTF-8"); e.target.value = "";
    }
  });

  function cycleStatus(item) {
    if (!item) return;
    var order = ["Açık", "Devam ediyor", "Tamamlandı"];
    var i = order.indexOf(item.status); item.status = order[(i + 1) % order.length];
    DATA.save(DB); render();
  }

  function compFix(id) {
    var e = DB.employees.find(function (x) { return x.id === id; }); if (!e) return;
    var before = e.marketDelta;
    e.marketDelta = Math.min(4, e.marketDelta + 15);
    e.paySeg = DATA.paySegOf(e.perf, e.marketDelta);
    e.flight = e.engagement < 55 ? "Orta" : "Düşük";
    DATA.save(DB);
    toast("Senaryo: " + e.name + " ücret farkı " + before + "% → " + e.marketDelta + "% · segment güncellendi");
    closeDrawer(); render();
  }

  /* ---- üst bar kontrolleri ---- */
  function syncDeptSelect() { var s = $("#dept-select"); if (s) s.value = state.dept; }

  var PERSONA = {
    lider: ["İK Lideri", "30 saniyede sağlık skoru ve en kritik 3 risk / fırsat / aksiyon. Eğilim ve iş etkisi önceliklidir."],
    manager: ["İK İş Ortağı Grup Müdürü", "Fonksiyonları karşılaştırın, riski önceliklendirin, yönetim sunumuna hazırlanın."],
    uzman: ["İK İş Ortağı Uzmanı", "Detaya inin, kişi kartını açın, not ve aksiyon ekleyin; veri yönetimi yapın."],
    biz: ["İş Birimi Lideri", "Kendi ekibinizin kaybı, performansı ve bağlılığı; sebep-sonuç ilişkisi."],
    excom: ["İcra Kurulu / Yönetim Kurulu", "Stratejik değer; özet, eğilim ve öncelik. Standart Rapor + Sunum Modu önerilir."]
  };
  function setPersona(p) { state.persona = p; var d = PERSONA[p]; $("#persona-hint").innerHTML = "<b>" + esc(d[0]) + "</b> · " + esc(d[1]); }

  function init() {
    var ds = $("#dept-select");
    ds.innerHTML = '<option value="all">🏢 Tüm Organizasyon</option>' + DB.departments.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + ' (' + d.hc + ')</option>'; }).join("");
    ds.addEventListener("change", function () { state.dept = this.value; state.riskFilter = "all"; state.dirFilter = "all"; render(); toast(deptName(this.value) + " görünümü"); });
    $("#persona-select").addEventListener("change", function () { setPersona(this.value); });
    $("#search").addEventListener("input", function () { state.search = this.value; if (state.view === "directory" || state.view === "data") render(); });
    $("#search").addEventListener("keydown", function (e) { if (e.key === "Enter") { state.view = "directory"; render(); } });
    $all("#nav button").forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.v); }); });
    $("#btn-present").addEventListener("click", function () { document.body.classList.toggle("present"); });
    $("#btn-exit-present").addEventListener("click", function () { document.body.classList.remove("present"); });
    $("#btn-report").addEventListener("click", function () { go("report"); });
    $("#btn-export").addEventListener("click", function () {
      openDrawer("Dışa Aktar", '<p class="muted-txt" style="margin-bottom:14px">Mevcut görünümü dışa aktarın. Standart Rapor ekranında yazdırma, yönetim sunumuna hazır PDF üretir.</p>' +
        '<div class="drawer-act col"><button class="btn primary" data-act="goto" data-v="report">▤ Standart Rapor görünümü</button><button class="btn" data-act="export-csv">⇩ Çalışanları CSV indir</button><button class="btn" data-act="export-json">⇩ Tüm veriyi JSON yedekle</button><button class="btn" onclick="window.print()">🖨 Yazdır / PDF</button></div>');
    });
    $("#scrim").addEventListener("click", closeDrawer);
    $("#d-close").addEventListener("click", closeDrawer);
    setPersona("lider");
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
