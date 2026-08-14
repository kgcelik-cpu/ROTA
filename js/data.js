/* ============================================================
   ROTA · data.js  — Merkezi veri modeli (DEMO / ANONİM-DUMMY)
   Tüm veriler tamamen kurgusaldır; gerçek şirket verisi içermez.
   Departman bazlı metrikler + üretilmiş çalışan rosteri.
   localStorage ile kalıcı; "Örnek veriyi sıfırla" ile geri yüklenir.
   ============================================================ */
(function () {
  "use strict";

  /* ---- seeded PRNG (deterministik dummy üretim) ---- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20260624);
  function rint(min, max) { return Math.floor(rnd() * (max - min + 1)) + min; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function gauss(m, sd) { var u = 1 - rnd(), v = rnd(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function wpick(pairs) { var r = rnd(), c = 0; for (var i = 0; i < pairs.length; i++) { c += pairs[i][1]; if (r <= c) return pairs[i][0]; } return pairs[pairs.length - 1][0]; }

  /* ---- Departmanlar + departmana özgü metrikler ---- */
  var DEPARTMENTS = [
    { id: "retail", name: "Perakende ve Mağaza Operasyonları", hc: 1120, health: "green",
      m: { vol: 14, invol: 4, hipo: 12, top3: 16, readyNow: 58, eng: 71, enps: 14, ttf: 38, offer: 80, openCrit: 1 },
      pay: { aligned: 64, hilo: 12, lohi: 12, other: 12 } },
    { id: "merch", name: "Ürün Yönetimi ve Satın Alma", hc: 540, health: "amber",
      m: { vol: 9, invol: 4, hipo: 18, top3: 22, readyNow: 66, eng: 73, enps: 20, ttf: 35, offer: 84, openCrit: 3 },
      pay: { aligned: 66, hilo: 10, lohi: 12, other: 12 } },
    { id: "supply", name: "Tedarik & Lojistik", hc: 430, health: "red",
      m: { vol: 19, invol: 6, hipo: 10, top3: 13, readyNow: 52, eng: 61, enps: 6, ttf: 50, offer: 74, openCrit: 2 },
      pay: { aligned: 60, hilo: 18, lohi: 10, other: 12 } },
    { id: "it", name: "Bilgi Teknolojileri", hc: 320, health: "red",
      m: { vol: 24, invol: 5, hipo: 16, top3: 20, readyNow: 54, eng: 64, enps: 4, ttf: 64, offer: 72, openCrit: 2 },
      pay: { aligned: 45, hilo: 34, lohi: 9, other: 12 } },
    { id: "ecom", name: "E-Ticaret ve Dijital", hc: 260, health: "amber",
      m: { vol: 21, invol: 5, hipo: 15, top3: 19, readyNow: 60, eng: 66, enps: 8, ttf: 41, offer: 76, openCrit: 1 },
      pay: { aligned: 50, hilo: 30, lohi: 8, other: 12 } },
    { id: "mkt", name: "Pazarlama & Marka", hc: 210, health: "green",
      m: { vol: 11, invol: 4, hipo: 14, top3: 18, readyNow: 62, eng: 76, enps: 22, ttf: 33, offer: 86, openCrit: 0 },
      pay: { aligned: 67, hilo: 9, lohi: 12, other: 12 } },
    { id: "fin", name: "Finans & Muhasebe", hc: 240, health: "amber",
      m: { vol: 7, invol: 4, hipo: 12, top3: 15, readyNow: 55, eng: 74, enps: 18, ttf: 36, offer: 85, openCrit: 3 },
      pay: { aligned: 68, hilo: 8, lohi: 12, other: 12 } },
    { id: "hr", name: "İnsan Kaynakları", hc: 150, health: "green",
      m: { vol: 8, invol: 4, hipo: 13, top3: 17, readyNow: 64, eng: 75, enps: 20, ttf: 34, offer: 84, openCrit: 0 },
      pay: { aligned: 68, hilo: 8, lohi: 12, other: 12 } },
    { id: "intl", name: "Uluslararası Açılım", hc: 330, health: "amber",
      m: { vol: 13, invol: 5, hipo: 14, top3: 17, readyNow: 57, eng: 68, enps: 12, ttf: 47, offer: 78, openCrit: 1 },
      pay: { aligned: 63, hilo: 12, lohi: 13, other: 12 } },
    { id: "prod", name: "Ürün & Tasarım", hc: 240, health: "green",
      m: { vol: 12, invol: 4, hipo: 14, top3: 16, readyNow: 60, eng: 72, enps: 15, ttf: 39, offer: 82, openCrit: 1 },
      pay: { aligned: 65, hilo: 11, lohi: 12, other: 12 } }
  ];

  var ROLES = {
    retail: ["Mağaza Müdürü", "Bölge Sorumlusu", "Operasyon Uzmanı", "Satış Yöneticisi"],
    merch: ["Kategori Müdürü", "Satınalma Uzmanı", "Planlama Yöneticisi", "Satın Alma Uzmanı"],
    supply: ["Tedarik Planlama Müdürü", "Lojistik Uzmanı", "Depo Operasyon Yön.", "İthalat Uzmanı"],
    it: ["Kıdemli Veri Mühendisi", "Yazılım Geliştirici", "Veri Platform Lideri", "Sistem Otomasyon Mühendisi", "Sistem Uzmanı"],
    ecom: ["E-ticaret CRM Müdürü", "Dijital Pazarlama Uzmanı", "Deneyim Tasarımcısı", "Ürün Sahibi"],
    mkt: ["Marka Müdürü", "İletişim Uzmanı", "Performans Pazarlama", "Kampanya Yöneticisi"],
    fin: ["Finansal Planlama Müd.", "Muhasebe Uzmanı", "Bütçe Analisti", "Raporlama Uzmanı"],
    hr: ["İK İş Ortağı Uzmanı", "İşe Alım Uzmanı", "Yetenek Yönetimi Uzm.", "Bordro Uzmanı"],
    intl: ["Ülke Operasyon Müd.", "Açılım Uzmanı", "Bölge Koordinatörü", "Lokalizasyon Uzm."],
    prod: ["Ürün Tasarımcısı", "Tekstil Mühendisi", "Kalite Uzmanı", "Koleksiyon Yöneticisi"]
  };
  var FIRST = ["Elif", "Mert", "Zeynep", "Can", "Ada", "Deniz", "Ece", "Kaan", "Selin", "Burak", "Naz", "Emre",
    "Derya", "Onur", "Sıla", "Arda", "Yağmur", "Berk", "İrem", "Tolga", "Gizem", "Umut", "Pelin", "Cem",
    "Aslı", "Barış", "Melis", "Eren", "Sena", "Kerem", "Esra", "Murat", "Buse", "Okan", "Damla", "Serkan",
    "Ayşe", "Hakan", "Merve", "Tuna", "Bora", "Defne", "Çağla", "Sarp", "Nehir", "Kuzey", "Lale", "Efe"];
  var LAST = ["Yılmaz", "Demir", "Şahin", "Çelik", "Aydın", "Kaya", "Koç", "Aslan", "Doğan", "Kurt", "Öztürk",
    "Arslan", "Polat", "Korkmaz", "Erdoğan", "Yıldız", "Acar", "Bulut", "Güneş", "Taş", "Aksoy", "Çetin",
    "Kılıç", "Avcı", "Bozkurt", "Şen", "Karaca", "Toprak", "Ünal", "Tekin"];

  var PERF_LABELS = ["Beklenti altı", "Kısmen karşılıyor", "Beklenti karşılıyor", "Beklenti üstü", "Olağanüstü"];
  var POT_LABELS = ["Düşük", "Orta", "Yüksek"];
  var NINEBOX = [
    ["Riskli", "Etkili Profesyonel", "Güvenilir Usta"],        // pot Düşük (0) : perf low..high
    ["Çelişen", "Çekirdek", "Yüksek Etki"],            // pot Orta (1)
    ["Bilmece", "Gelecek Yıldız", "Yıldız"]            // pot Yüksek (2)
  ];

  function nineBoxOf(perf, pot) {
    var pc = perf >= 4 ? 2 : (perf >= 3 ? 1 : 0);   // 0 low,1 mid,2 high
    var pr = pot === "Yüksek" ? 2 : (pot === "Orta" ? 1 : 0);
    return NINEBOX[pr][pc];
  }
  function paySegOf(perf, delta) {
    var hi = perf >= 4, lo = perf <= 2;
    if (hi && delta <= -10) return "hilo";
    if (lo && delta >= 6) return "lohi";
    if (delta >= -8 && delta <= 8) return "aligned";
    return "other";
  }

  function genRoster() {
    var list = [], id = 1;
    DEPARTMENTS.forEach(function (d) {
      var n = 40;
      var lowPayRate = d.pay.hilo / 100 + 0.06;
      for (var i = 0; i < n; i++) {
        var perfIdx = wpick([[4, 0.11], [3, 0.23], [2, 0.49], [1, 0.12], [0, 0.05]]); // 0..4
        var perf = perfIdx + 1; // 1..5
        var isLowPay = rnd() < lowPayRate;
        var delta = isLowPay ? rint(-25, -10) : rint(-7, 9);
        var potRoll = rnd();
        var pot;
        if (perf >= 4 && potRoll < (d.m.hipo / 100) * 3.2) pot = "Yüksek";
        else if (perf === 3 && potRoll < 0.13) pot = "Yüksek";        // Gelecek Yıldız
        else if (perf <= 2 && potRoll < 0.05) pot = "Yüksek";          // Bilmece (nadir)
        else if (potRoll < 0.55) pot = "Orta";
        else pot = potRoll < 0.82 ? "Orta" : "Düşük";
        if (perf <= 2 && rnd() < 0.45) pot = "Düşük";
        var engBase = d.m.eng;
        var eng = Math.round(clamp(gauss(engBase, 12), 28, 96));
        var hiPerf = perf >= 4;
        var flight = (hiPerf && delta <= -12) ? "Yüksek" : (eng < 55 ? "Yüksek" : (eng < 68 ? "Orta" : "Düşük"));
        if (hiPerf && delta <= -12) eng = Math.round(clamp(eng - 6, 28, 96));
        var critical = (hiPerf && pot === "Yüksek") || rnd() < 0.10;
        var ageM = d.id === "fin" ? 43 : 34, tenM = d.id === "fin" ? 6.5 : 3.9;
        var age = Math.round(clamp(gauss(ageM, d.id === "fin" ? 8 : 7), 23, 58));
        var tenure = +clamp(gauss(tenM, 2.2), 0.3, 18).toFixed(1);
        var level = wpick([["4. Kademe Müdür", 0.10], ["5. Kademe Yönetici", 0.22], ["6. Kademe Uzman", 0.40], ["7. Kademe Uzman Yardımcısı", 0.28]]);
        list.push({
          id: "E" + (1000 + id++), name: pick(FIRST) + " " + pick(LAST),
          dept: d.id, role: pick(ROLES[d.id]), level: level,
          age: age, tenure: tenure,
          perf: perf, perfLabel: PERF_LABELS[perf - 1], pot: pot,
          nineBox: nineBoxOf(perf, pot),
          marketDelta: delta, paySeg: paySegOf(perf, delta),
          engagement: eng, flight: flight, critical: critical, status: "Aktif"
        });
      }
    });
    return list;
  }

  var EXIT_REASONS = ["Ücret & yan haklar", "Kariyer / terfi belirsizliği", "Yönetici ilişkisi", "İş yükü dengesi", "Lokasyon / çalışma modeli", "Diğer"];
  function genExits() {
    var ex = [], id = 1;
    DEPARTMENTS.forEach(function (d) {
      var cnt = Math.max(2, Math.round(d.m.vol / 4));
      var reasonW = (d.id === "it" || d.id === "ecom")
        ? [["Ücret & yan haklar", .42], ["Kariyer / terfi belirsizliği", .26], ["Yönetici ilişkisi", .12], ["İş yükü dengesi", .1], ["Lokasyon / çalışma modeli", .06], ["Diğer", .04]]
        : (d.id === "supply"
          ? [["Yönetici ilişkisi", .3], ["İş yükü dengesi", .26], ["Ücret & yan haklar", .2], ["Kariyer / terfi belirsizliği", .14], ["Lokasyon / çalışma modeli", .06], ["Diğer", .04]]
          : [["Ücret & yan haklar", .28], ["Kariyer / terfi belirsizliği", .24], ["Yönetici ilişkisi", .18], ["İş yükü dengesi", .14], ["Lokasyon / çalışma modeli", .1], ["Diğer", .06]]);
      for (var i = 0; i < cnt; i++) {
        ex.push({
          id: "X" + (id++), name: pick(FIRST) + " " + pick(LAST), dept: d.id,
          type: rnd() < 0.72 ? "Gönüllü" : "İstemsiz",
          reason: wpick(reasonW), month: pick(["Oca", "Şub", "Mar", "Nis", "May", "Haz"]) + " 2026"
        });
      }
    });
    return ex;
  }

  function genPositions() {
    var seed = [
      ["Tedarik Planlama Müdürü", "supply", 88, "Yok", "Stok devir hızı", "Dış + iç havuz"],
      ["Veri Platform Lideri", "it", 64, "1 (gelişmekte)", "Analitik yol haritası", "Hızlı dış alım"],
      ["E-ticaret CRM Müdürü", "ecom", 41, "2 hazır", "Dönüşüm oranı", "İç terfi"],
      ["Finansal Planlama Müdürü", "fin", 30, "Yok", "Bütçe döngüsü", "9 aylık yedekleme"],
      ["Kategori Müdürü", "merch", 36, "1 hazır", "Marj yönetimi", "İç terfi"],
      ["Sistem Otomasyon Mühendisi", "it", 52, "Yok", "Yayın hızı", "Dış alım"],
      ["Ülke Operasyon Müdürü", "intl", 58, "1 (gelişmekte)", "Açılım takvimi", "İç + dış"],
      ["Bölge Sorumlusu", "retail", 27, "3 hazır", "Mağaza performansı", "İç terfi"]
    ];
    return seed.map(function (s, i) {
      return { id: "P" + (i + 1), role: s[0], dept: s[1], daysOpen: s[2], backup: s[3], impact: s[4], plan: s[5] };
    });
  }

  function genRisks() {
    var seed = [
      ["Yüksek performanslı çalışan kaybı (BT / E-Ticaret)", "40 kişi piyasa −%18; gönüllü ayrılma %24", "~4,2M₺ + analitik yol haritası", 9.1, "Hedefli elde tutma paketi", "Ücret ve Yan Haklar + İK İş Ortağı", "8 hafta", "Devam ediyor", "it"],
      ["Kritik rol yedeksizliği", "12 yedeksiz kritik rol; Ürün Yönetimi + Finans %50", "İş sürekliliği · bütçe döngüsü", 7.8, "9 aylık yedekleme planı", "Yetenek Yönetimi", "3. Çeyrek", "Açık", "merch"],
      ["Tedarik ayrılma oranı ve moral", "Gönüllü ayrılma %19; bağlılık 61; yönetici teması", "Operasyon hızı · stok devri", 7.0, "Yönetici koçluğu + iş yükü", "İK İş Ortağı", "3. Çeyrek", "Devam ediyor", "supply"],
      ["İşe alım hızı (kritik rol)", "Pozisyon kapatma 64 gün (BT); 12 kritik açık", "Proje gecikmesi", 6.4, "Aday kaynağı + ön onaylı havuz", "İşe Alım", "3. Çeyrek", "Açık", "it"],
      ["Ücret adaleti algısı", "Bağlılık teması 54; çıkış nedeni #1 ücret", "Bağlılık · işveren markası", 5.9, "Ücret bandı şeffaflığı", "Ücret ve Yan Haklar", "4. Çeyrek", "Açık", "all"],
      ["7. yönetim katmanı", "Yönetim alanı 5,8; 4.-5. kademe rol örtüşmesi", "Karar hızı −%15", 5.0, "Katman sadeleştirme", "Organizasyon Tasarımı", "4. Çeyrek", "Açık", "all"],
      ["Finans kurumsal hafıza", "50+ yaş yoğun; emeklilik planlı", "Bilgi kaybı", 3.2, "Bilgi transferi + mentorluk", "İK İş Ortağı", "4. Çeyrek", "Planlandı", "fin"]
    ];
    return seed.map(function (s, i) {
      return { id: "R" + (i + 1), risk: s[0], data: s[1], impact: s[2], sev: s[3], action: s[4], owner: s[5], due: s[6], status: s[7], dept: s[8] };
    });
  }

  function genActions() {
    var seed = [
      ["40 yüksek performanslı çalışan için elde tutma paketi", "Ücret-Performans", "Ücret ve Yan Haklar + İK İş Ortağı", "8 hafta", "Yüksek", "Devam ediyor", "it"],
      ["9 aylık yedekleme planı (12 rol)", "Yetenek", "Yetenek Yönetimi", "3. Çeyrek", "Yüksek", "Açık", "merch"],
      ["Tedarik yönetici koçluğu", "Çalışan Devri", "İK İş Ortağı", "3. Çeyrek", "Orta", "Devam ediyor", "supply"],
      ["Aday kaynağı ve ön onaylı havuz", "Organizasyon", "İşe Alım", "3. Çeyrek", "Orta", "Açık", "it"],
      ["İlk yıl bağlılık programı", "İş Gücü", "İK İş Ortağı", "4. Çeyrek", "Orta", "Devam ediyor", "all"],
      ["Ücret bandı şeffaflığı pilotu", "Bağlılık", "Ücret ve Yan Haklar", "4. Çeyrek", "Orta", "Açık", "all"],
      ["Finans bilgi transferi", "Risk", "İK İş Ortağı", "4. Çeyrek", "Düşük", "Tamamlandı", "fin"],
      ["2. Çeyrek 9 kutu kalibrasyonu", "Performans", "İK İş Ortağı", "Tamam", "Düşük", "Tamamlandı", "all"]
    ];
    return seed.map(function (s, i) {
      return { id: "A" + (i + 1), title: s[0], source: s[1], owner: s[2], due: s[3], impact: s[4], status: s[5], dept: s[6] };
    });
  }

  /* ---- Engagement temaları (org + departman override) ---- */
  var ORG_THEMES = {
    strong: [["Ekip içi güven", 81], ["Marka gururu / amaç", 79], ["Lidere erişilebilirlik", 76], ["Öğrenme fırsatı", 71]],
    dev: [["Ücret adaleti algısı", 54], ["Kariyer gelişimi", 58], ["İş yükü dengesi", 61], ["Tanınma ve takdir", 63]]
  };
  var DEPT_THEMES = {
    it: { strong: [["Öğrenme fırsatı", 78], ["Ekip içi güven", 74], ["Özerklik", 72]], dev: [["Ücret adaleti algısı", 48], ["Kariyer gelişimi", 55], ["Tanınma", 60]] },
    supply: { strong: [["Marka gururu", 74], ["Ekip içi güven", 66]], dev: [["Yönetici ilişkisi", 52], ["İş yükü dengesi", 54], ["Tanınma", 58]] },
    fin: { strong: [["İş güvencesi", 82], ["Ekip içi güven", 79]], dev: [["Kariyer gelişimi", 57], ["Gelişim fırsatı", 60]] }
  };

  function freshDB() {
    return {
      version: 3,
      generatedAt: "2026 2. Çeyrek",
      departments: DEPARTMENTS,
      orgThemes: ORG_THEMES,
      deptThemes: DEPT_THEMES,
      employees: genRoster(),
      exits: genExits(),
      positions: genPositions(),
      risks: genRisks(),
      actions: genActions(),
      notes: [] // birebir görüşme notları {id, empId, empName, dept, date, text}
    };
  }

  /* ---- kalıcılık ---- */
  var KEY = "rota_db_v3";
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var db = JSON.parse(raw); if (db && db.version === 3) return db; }
    } catch (e) { }
    var d = freshDB(); save(d); return d;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { } }
  function reset() { var d = freshDB(); save(d); return d; }

  window.ROTA_DATA = { freshDB: freshDB, load: load, save: save, reset: reset, nineBoxOf: nineBoxOf, paySegOf: paySegOf, PERF_LABELS: PERF_LABELS, POT_LABELS: POT_LABELS, ROLES: ROLES };
})();
