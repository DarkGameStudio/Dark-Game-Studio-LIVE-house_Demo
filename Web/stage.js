/* ==================================================================
   LIVE HOUSE · 24H 元宇宙游戏情报站
   排期：每 30 分钟一段，一天 48 段，全天条目零重复
   ================================================================== */
(function () {
  "use strict";

  var DATA = window.LIVE_DATA;
  if (!DATA) { console.error("[LIVE HOUSE] data.js 未加载"); return; }

  var PLAT = DATA.platforms;
  var ORDER = DATA.order;
  var SEG = DATA.meta.segmentMinutes || 30;
  var SLOTS = Math.round((24 * 60) / SEG);          // 48
  var TZ = DATA.meta.timeZone || "Asia/Shanghai";
  var MONO = '"Cascadia Mono",Consolas,monospace';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var stage = $("#stage");
  var nowCard = $("#nowCard");
  var cardInner = $("#cardInner");

  /* ---------------- 工具 ---------------- */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, seed) {
    var r = mulberry32(seed), a = arr.slice(), i, j, tmp;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1));
      tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function rgba(hex, a) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function hm(min) {
    if (min === 1440) return "24:00";
    var m = ((min % 1440) + 1440) % 1440;
    return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return pad2(Math.floor(sec / 60)) + ":" + pad2(sec % 60);
  }

  /* ---------------- 时区时间 ---------------- */
  var partsFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  var wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });

  function getNow() {
    var d = new Date(), o = {}, parts = partsFmt.formatToParts(d), i;
    for (i = 0; i < parts.length; i++) if (parts[i].type !== "literal") o[parts[i].type] = parts[i].value;
    return {
      y: +o.year, m: +o.month, d: +o.day,
      h: +o.hour, mi: +o.minute, s: +o.second,
      weekday: wdFmt.format(d).toUpperCase()
    };
  }
  function dayKeyOf(n) { return n.y + "-" + pad2(n.m) + "-" + pad2(n.d); }

  /* ---------------- 状态 ---------------- */
  var state = {
    dayKey: "",
    slots: [],
    poolSize: 0,
    duplicates: 0,
    currentIndex: -1,
    previewIndex: null,
    paused: false,
    archiveKey: null,
    currentPlatform: ORDER[0]
  };

  var archiveIdx = 0;
  var urlq = new URLSearchParams(location.search);

  /* ---------------- B站直播间标识 ---------------- */
  var BILI = DATA.meta.bilibili || {};
  function biliRoom() {
    var q = (urlq.get("room") || "").trim();
    if (/^\d{1,12}$/.test(q)) return q;
    return String(BILI.roomId || "").replace(/[^\w-]/g, "").slice(0, 20);
  }
  function paintBiliLine() {
    var room = biliRoom();
    var ch = (DATA.meta.channel || "DARK GAME STUDIO").toUpperCase();
    var line = room ? "BILIBILI ROOM " + room : "BILIBILI LIVE";
    line += " · " + ch + " · STEAM / NINTENDO / PLAYSTATION";
    $("#biliLine").textContent = line;
    document.title = (room ? "BILIBILI " + room + " · " : "") + ch + " · 24H";
  }

  /* ---------------- 排期生成（全天不重复） ---------------- */
  function buildDay(dayKey) {
    var quota = Math.ceil(SLOTS / ORDER.length);
    var pools = {}, counts = {}, owner = {}, i, k;

    ORDER.forEach(function (key) {
      pools[key] = shuffle(DATA.entries[key] || [], hash(dayKey + "|" + key));
      counts[key] = Math.min(quota, pools[key].length);
      pools[key].forEach(function (e) { owner[e.id] = key; });
    });

    /* 某平台条目不足时，把缺口让给仍有余量的平台，优先保证 48 段零重复 */
    var total = ORDER.reduce(function (n, key) { return n + counts[key]; }, 0);
    var deficit = SLOTS - total, guard = 0, ci = 0;
    while (deficit > 0 && guard++ < SLOTS * ORDER.length) {
      k = ORDER[ci++ % ORDER.length];
      if (counts[k] < pools[k].length) { counts[k]++; deficit--; }
    }

    var queues = {}, seen = {}, slots = [], dup = 0;
    ORDER.forEach(function (key) { queues[key] = pools[key].slice(0, counts[key]); });

    /* 按平台轮转取条目，队列耗尽则跳过该平台 */
    var seq = 0;
    for (i = 0; i < SLOTS; i++) {
      var pk = null;
      for (var attempt = 0; attempt <= ORDER.length; attempt++) {
        var cand = ORDER[seq % ORDER.length];
        seq++;
        if (queues[cand].length) { pk = cand; break; }
      }
      if (!pk) break;
      var entry = queues[pk].shift();
      if (seen[entry.id]) dup++; else seen[entry.id] = 1;
      slots.push({ index: i, platform: pk, entry: entry, start: i * SEG });
    }

    /* 全站条目池不足 48 条时循环补位，保证时间轴完整，重复数在界面显式提示 */
    var flat = ORDER.reduce(function (arr, key) { return arr.concat(pools[key]); }, []);
    var fi = 0;
    while (slots.length < SLOTS && flat.length) {
      var ent = flat[fi++ % flat.length];
      if (seen[ent.id]) dup++; else seen[ent.id] = 1;
      var idx = slots.length;
      slots.push({ index: idx, platform: owner[ent.id] || ORDER[0], entry: ent, start: idx * SEG });
    }

    state.slots = slots;
    state.dayKey = dayKey;
    state.duplicates = dup;
    state.poolSize = ORDER.reduce(function (n, key) { return n + (DATA.entries[key] || []).length; }, 0);

    renderRows();

    if (dup) console.warn("[LIVE HOUSE] 今日排期重复 " + dup + " 条，请把 data.js 条目池扩充到至少 " + SLOTS + " 条");
    ORDER.forEach(function (key) {
      if ((DATA.entries[key] || []).length < quota) {
        console.warn("[LIVE HOUSE] " + key + " 条目不足 " + quota + " 条，缺口已由其他平台补位");
      }
    });
    if (opEl.classList.contains("on")) renderOperator();
  }

  /* ---------------- 顶栏 / 节目单骨架 ---------------- */
  var chipsEl = $("#chips");
  ORDER.forEach(function (key) {
    var p = PLAT[key];
    var el = document.createElement("div");
    el.className = "chip";
    el.dataset.p = key;
    el.style.setProperty("--c", p.color);
    el.innerHTML = "<i></i><div><b>" + esc(p.name) + "</b><span>" + esc(p.code) + " · NODE</span></div>";
    chipsEl.appendChild(el);
  });

  var rowsEl = $("#rows");
  var tickEls = [];

  /* 节目单按当日实际排期绘制，跨天/平台补位后仍然与主卡片一致 */
  function renderRows() {
    rowsEl.innerHTML = "";
    tickEls = [];
    ORDER.forEach(function (key) {
      var p = PLAT[key];
      var hits = state.slots.filter(function (s) { return s.platform === key; });
      if (!hits.length) return;
      var row = document.createElement("div");
      row.className = "row";
      row.style.setProperty("--c", p.color);
      var label = document.createElement("div");
      label.className = "rl";
      label.textContent = p.code;
      var ticks = document.createElement("div");
      ticks.className = "ticks";
      hits.forEach(function (s) {
        var t = document.createElement("div");
        t.className = "tick";
        t.dataset.i = s.index;
        t.title = hm(s.start) + " · " + p.name + " · " + s.entry.title;
        ticks.appendChild(t);
        tickEls[s.index] = t;
      });
      row.appendChild(label);
      row.appendChild(ticks);
      rowsEl.appendChild(row);
    });
  }

  /* ---------------- 主卡片渲染 ---------------- */
  var titleEl = $("#title");
  var metaEl = $("#meta");
  var tagsEl = $("#tags");

  function fitTitle() {
    var sizes = [88, 80, 72, 64, 58, 52], i;
    for (i = 0; i < sizes.length; i++) {
      titleEl.style.fontSize = sizes[i] + "px";
      if (titleEl.scrollHeight <= sizes[i] * 1.06 * 2 + 8) break;
    }
  }

  function paintArchive(pk) {
    var list = PLAT[pk].archive || [];
    state.archiveKey = pk;
    archiveIdx = 0;
    var wrap = $("#archive");
    wrap.innerHTML = "";
    var ph = document.createElement("div");
    ph.className = "ph";
    var slides = document.createElement("div");
    slides.className = "slides";
    list.forEach(function (a, i) {
      var img = document.createElement("img");
      img.src = encodeURI(a.src);
      img.alt = a.cap;
      if (/\.png$/i.test(a.src)) img.classList.add("contain");
      if (i === 0) img.classList.add("on");
      slides.appendChild(img);
    });
    var cap = document.createElement("div");
    cap.className = "cap";
    var b = document.createElement("b");
    b.textContent = list[0] ? list[0].cap : "";
    var s = document.createElement("span");
    s.textContent = list[0] ? list[0].year : "";
    cap.appendChild(b);
    cap.appendChild(s);
    ph.appendChild(slides);
    ph.appendChild(cap);
    wrap.appendChild(ph);
    wrap.style.setProperty("--rot", pk === "nintendo" ? "-3.5deg" : pk === "ps" ? "2.4deg" : "3.2deg");
  }

  function paintSlot(index) {
    var slot = state.slots[index];
    if (!slot) return;
    var p = PLAT[slot.platform];
    var e = slot.entry;

    state.currentIndex = index;
    state.currentPlatform = slot.platform;

    nowCard.style.setProperty("--ac", p.color);
    nowCard.style.setProperty("--ac2", p.soft);

    $("#pName").textContent = p.name;
    $("#pCn").textContent = p.cn;
    $("#segNo").textContent = pad2(index + 1);
    $("#statusTxt").textContent = e.status;

    titleEl.textContent = e.title;
    fitTitle();
    $("#sub").textContent = e.sub;
    $("#note").textContent = e.note;

    var cells = [
      ["类型", e.genre, false],
      ["发售", e.date, false],
      ["定价", e.price, false],
      [p.metricLabel, e.metric, true]
    ];
    metaEl.innerHTML = "";
    cells.forEach(function (c) {
      var d = document.createElement("div");
      d.className = "cell";
      var k = document.createElement("div");
      k.className = "k";
      k.textContent = c[0];
      var v = document.createElement("div");
      v.className = "v" + (c[2] ? " hl" : "");
      v.textContent = c[1];
      d.appendChild(k);
      d.appendChild(v);
      metaEl.appendChild(d);
    });

    tagsEl.innerHTML = "";
    (e.tags || []).forEach(function (t) {
      var s = document.createElement("div");
      s.className = "tag";
      s.textContent = t;
      tagsEl.appendChild(s);
    });

    $("#minis").innerHTML =
      '<div class="mini"><span>今日节目</span><b>' + SLOTS + " 段</b></div>" +
      '<div class="mini"><span>已播段落</span><b>' + pad2(index + 1) + " / " + SLOTS + "</b></div>" +
      '<div class="mini"><span>重复条目</span><b class="ok">' + state.duplicates + " 条</b></div>";

    $("#sparkPeak").textContent = "PEAK " + e.metric;
    buildSpark(e, p);

    paintArchive(slot.platform);
    updateChips(slot.platform);
    paintTicks(index);
    updateNext(index);

    nowCard.classList.remove("enter");
    void nowCard.offsetWidth;
    nowCard.classList.add("enter");
    window.setTimeout(function () { nowCard.classList.remove("enter"); }, 900);

    if (opEl.classList.contains("on")) renderOperator();
  }

  function updateChips(pk) {
    Array.prototype.forEach.call(chipsEl.children, function (c) {
      c.classList.toggle("on", c.dataset.p === pk);
    });
  }

  function paintTicks(index) {
    for (var i = 0; i < tickEls.length; i++) {
      var el = tickEls[i];
      if (!el) continue;
      el.classList.toggle("past", i < index);
      el.classList.toggle("on", i === index);
    }
    var stat = $("#schedStat");
    if (stat) stat.textContent = "已播 " + pad2(index + 1) + " / " + SLOTS;
  }

  function updateNext(index) {
    var nxt = state.slots[(index + 1) % SLOTS];
    if (!nxt) return;
    var p = PLAT[nxt.platform];
    var el = $("#nextPlat");
    el.textContent = p.name;
    el.style.color = p.color;
    $("#nextTime").textContent = hm(nxt.start) + " — " + hm(nxt.start + SEG);
  }

  /* ---------------- 实时信息 ---------------- */
  var liveLine = $("#liveLine");
  var remainEl = $("#remain");
  var fillEl = $("#slotFill");

  function updateLive(index, into, frozen) {
    var slot = state.slots[index];
    if (!slot) return;
    var p = PLAT[slot.platform];
    var nxt = state.slots[(index + 1) % SLOTS];
    var remain = Math.max(0, SEG * 60 - into);

    if (!frozen) {
      remainEl.textContent = mmss(remain);
      $("#nextCount").textContent = mmss(remain);
      fillEl.style.width = clamp((into / (SEG * 60)) * 100, 0, 100) + "%";
    }

    var nodes = 11840 + (hash(state.dayKey) % 2600) + index * 137 + (Math.floor(into) % 60) * 11;
    var signal = (97.6 + Math.sin(into / 5 + index) * 0.8 + (index % 3) * 0.2).toFixed(1);
    var lat = 13 + (Math.floor(into) % 6) + (index % 4);

    liveLine.textContent =
      "信号 " + signal + "% · 在线节点 " + nodes.toLocaleString("en-US") +
      " · 延迟 " + lat + "ms · 本日 " + SLOTS + " 段不重复 · 第 " + pad2(index + 1) + " 段";

    $("#f1").textContent = p.code + "-" + pad2(index + 1) + " · " + p.name + " 频道";
    $("#f2").textContent = frozen ? "已冻结" : mmss(remain) + " / " + mmss(SEG * 60) + " · 无重复";
    $("#f3").textContent = hm(nxt.start) + " · " + PLAT[nxt.platform].name;
  }

  /* ---------------- 时钟主循环 ---------------- */
  function tick() {
    var n = getNow();
    var key = dayKeyOf(n);

    $("#clockTime").textContent = pad2(n.h) + ":" + pad2(n.mi) + ":" + pad2(n.s);
    $("#clockDate").textContent = n.y + "." + pad2(n.m) + "." + pad2(n.d) + " " + n.weekday + " · UTC+8";

    if (key !== state.dayKey) {
      buildDay(key);
      state.currentIndex = -1;
      state.paused = false;
      state.previewIndex = null;
    }

    var minutes = n.h * 60 + n.mi;
    var realIdx = Math.floor(minutes / SEG) % SLOTS;
    var into = (minutes % SEG) * 60 + n.s;

    if (state.previewIndex == null && state.currentIndex !== realIdx &&
        (!state.paused || state.currentIndex < 0)) {
      paintSlot(realIdx);
    }

    var shown = state.previewIndex != null ? state.previewIndex : state.currentIndex;

    if (state.previewIndex != null) {
      remainEl.textContent = "PREVIEW";
      $("#nextCount").textContent = "--:--";
      fillEl.style.width = "0%";
      updateLive(shown, 0, true);
    } else if (state.paused) {
      remainEl.textContent = "PAUSED";
      $("#nextCount").textContent = "--:--";
      updateLive(shown, 0, true);
    } else {
      updateLive(shown, into, false);
    }
  }

  /* ---------------- 画布 ---------------- */
  function setupCanvas(id, w, h) {
    var cv = document.getElementById(id);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  var bg = setupCanvas("bg", 1920, 1080);
  var orb = setupCanvas("orb", 524, 436);
  var spark = setupCanvas("spark", 660, 132);

  /* 星空 */
  var stars = [], sr = mulberry32(20261122);
  for (var si = 0; si < 170; si++) {
    stars.push({
      x: sr() * 1920, y: sr() * 1080, r: sr() * 1.5 + 0.3,
      a: sr() * 0.45 + 0.1, s: sr() * 0.9 + 0.2, p: sr() * 6.28
    });
  }

  function drawBg(t) {
    var c = bg.ctx, W = bg.w, H = bg.h;
    c.clearRect(0, 0, W, H);

    var neb = c.createRadialGradient(W * 0.78, H * 0.14, 0, W * 0.78, H * 0.14, W * 0.56);
    neb.addColorStop(0, "rgba(58,118,255,.10)");
    neb.addColorStop(0.55, "rgba(96,60,220,.045)");
    neb.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = neb;
    c.fillRect(0, 0, W, H);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var x = (s.x + t * 3.2 * s.s) % W;
      var a = s.a * (0.6 + 0.4 * Math.sin(t * s.s + s.p));
      c.beginPath();
      c.arc(x, s.y, s.r, 0, 6.2832);
      c.fillStyle = "rgba(196,232,255," + a.toFixed(3) + ")";
      c.fill();
    }

    /* 巨型轨道环 */
    c.save();
    c.translate(1500, 300);
    for (var r = 0; r < 3; r++) {
      c.beginPath();
      c.ellipse(0, 0, 360 + r * 150, 128 + r * 52, -0.42, 0, 6.2832);
      c.strokeStyle = "rgba(130,180,255," + (0.045 - r * 0.01) + ")";
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();

    /* 透视地格 */
    var horizon = 706;
    for (var g = -14; g <= 14; g++) {
      c.beginPath();
      c.moveTo(960 + g * 11, horizon);
      c.lineTo(960 + g * 152 + Math.sin(t * 0.12 + g) * 5, H);
      c.strokeStyle = "rgba(96,190,255," + (0.028 + Math.abs(g % 3) * 0.008) + ")";
      c.lineWidth = 1;
      c.stroke();
    }
    for (var k = 1; k <= 11; k++) {
      var p = k / 11;
      var y = horizon + Math.pow(p, 2.1) * (H - horizon);
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.strokeStyle = "rgba(96,190,255," + (0.012 + p * 0.038) + ")";
      c.lineWidth = 1;
      c.stroke();
    }
    c.fillStyle = "rgba(120,220,255,.055)";
    c.fillRect(0, horizon - 1, W, 2);

    /* 缓慢上升的数据尘埃 */
    for (var d = 0; d < 36; d++) {
      var dx = ((d * 137.5 + t * 6) % 1920);
      var dy = 1080 - ((t * 14 + d * 61) % 1080);
      c.beginPath();
      c.arc(dx, dy, 1.1, 0, 6.2832);
      c.fillStyle = "rgba(140,205,255,.16)";
      c.fill();
    }
  }

  /* 地球仪 / 平台星节点 */
  var globeDots = (function () {
    var r = mulberry32(4477), out = [];
    for (var i = 0; i < 26; i++) {
      var u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      out.push({ x: s * Math.cos(th), y: u, z: s * Math.sin(th) });
    }
    return out;
  })();

  var ORB_NODES = [
    { key: "steam", letter: "S", base: 0 },
    { key: "nintendo", letter: "N", base: Math.PI * 2 / 3 },
    { key: "ps", letter: "P", base: Math.PI * 4 / 3 }
  ];

  function drawOrb(t) {
    var c = orb.ctx, W = orb.w, H = orb.h;
    c.clearRect(0, 0, W, H);

    var cx = W / 2, cy = 202, R = 112, A = t * 0.26;

    var glow = c.createRadialGradient(cx, cy, 8, cx, cy, R * 2.3);
    glow.addColorStop(0, "rgba(70,190,255,.20)");
    glow.addColorStop(0.42, "rgba(80,130,255,.075)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(cx, cy, R * 2.3, 0, 6.2832);
    c.fill();

    /* 球体底色 */
    var core = c.createRadialGradient(cx - R * 0.35, cy - R * 0.42, R * 0.08, cx, cy, R * 1.04);
    core.addColorStop(0, "rgba(96,198,255,.17)");
    core.addColorStop(0.6, "rgba(28,78,150,.10)");
    core.addColorStop(1, "rgba(6,12,24,.02)");
    c.fillStyle = core;
    c.beginPath();
    c.arc(cx, cy, R * 1.04, 0, 6.2832);
    c.fill();

    /* 轨道环 */
    c.save();
    c.strokeStyle = "rgba(140,200,255,.16)";
    c.lineWidth = 1;
    c.setLineDash([2, 9]);
    c.lineDashOffset = -t * 16;
    c.beginPath();
    c.ellipse(cx, cy + 6, R * 1.52, R * 0.58, 0, 0, 6.2832);
    c.stroke();
    c.restore();

    /* 球体线框 */
    c.save();
    c.lineWidth = 1;
    c.shadowColor = "rgba(75,227,255,.5)";
    c.shadowBlur = 10;
    c.strokeStyle = "rgba(118,210,255,.24)";
    var segs = 34, i, a, b, th0, th1, p0, p1, lat, phi, yy, rr;
    for (var li = -2; li <= 2; li++) {
      lat = li * 30;
      phi = lat * Math.PI / 180;
      yy = Math.sin(phi);
      rr = Math.cos(phi);
      c.beginPath();
      for (i = 0; i <= segs; i++) {
        a = (i / segs) * Math.PI * 2;
        p0 = rotateY(Math.cos(a) * rr, yy, Math.sin(a) * rr, A);
        var sx = cx + p0.x * R * persp(p0.z), sy = cy + p0.y * R * persp(p0.z);
        if (i === 0) c.moveTo(sx, sy); else c.lineTo(sx, sy);
      }
      c.stroke();
    }
    for (var lo = 0; lo < 6; lo++) {
      th0 = (lo / 6) * Math.PI;
      c.beginPath();
      for (i = 0; i <= segs; i++) {
        phi = -Math.PI / 2 + (i / segs) * Math.PI;
        p0 = rotateY(Math.cos(phi) * Math.cos(th0), Math.sin(phi), Math.cos(phi) * Math.sin(th0), A);
        var sx2 = cx + p0.x * R * persp(p0.z), sy2 = cy + p0.y * R * persp(p0.z);
        if (i === 0) c.moveTo(sx2, sy2); else c.lineTo(sx2, sy2);
      }
      c.stroke();
    }
    c.restore();

    /* 球面光点 */
    for (i = 0; i < globeDots.length; i++) {
      var d = globeDots[i];
      p1 = rotateY(d.x, d.y, d.z, A);
      if (p1.z < -0.15) continue;
      var gx = cx + p1.x * R * persp(p1.z);
      var gy = cy + p1.y * R * persp(p1.z);
      c.beginPath();
      c.arc(gx, gy, 1.5, 0, 6.2832);
      c.fillStyle = "rgba(170,235,255," + (0.25 + p1.z * 0.35) + ")";
      c.fill();
    }

    /* 扫描带 */
    c.save();
    c.beginPath();
    c.arc(cx, cy, R * 1.02, 0, 6.2832);
    c.clip();
    var sy0 = cy + Math.sin(t * 0.55) * R;
    var band = c.createLinearGradient(0, sy0 - 26, 0, sy0 + 26);
    band.addColorStop(0, "rgba(75,227,255,0)");
    band.addColorStop(0.5, "rgba(75,227,255,.16)");
    band.addColorStop(1, "rgba(75,227,255,0)");
    c.fillStyle = band;
    c.fillRect(cx - 130, sy0 - 26, 260, 52);
    c.restore();

    /* 平台节点 */
    var list = ORB_NODES.map(function (nd, idx) {
      var ang = t * 0.22 + nd.base;
      var nx = cx + Math.cos(ang) * R * 1.52;
      var ny = cy + Math.sin(ang) * R * 0.58 + Math.sin(t * 0.8 + idx * 2.1) * 9;
      return { nd: nd, x: nx, y: ny, z: Math.sin(ang), ang: ang };
    }).sort(function (m, n) { return m.z - n.z; });

    list.forEach(function (o) {
      var p = PLAT[o.nd.key];
      var active = state.currentPlatform === o.nd.key;
      var sc = (0.84 + (o.z + 1) * 0.13) * (active ? 1.15 : 1);
      var rad = 21 * sc;

      /* 连线 */
      var dx = o.x - cx, dy = o.y - cy, dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var ex = cx + (dx / dist) * R * 0.98, ey = cy + (dy / dist) * R * 0.98;
      var lg = c.createLinearGradient(ex, ey, o.x, o.y);
      lg.addColorStop(0, rgba(p.color, 0.03));
      lg.addColorStop(1, rgba(p.color, active ? 0.75 : 0.4));
      c.save();
      c.setLineDash([3, 6]);
      c.lineDashOffset = -t * 22;
      c.strokeStyle = lg;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(ex, ey);
      c.lineTo(o.x, o.y);
      c.stroke();
      c.restore();

      /* 数据包 */
      var tau = (t * 0.32 + o.nd.base) % 1;
      var px = ex + (o.x - ex) * tau, py = ey + (o.y - ey) * tau;
      c.beginPath();
      c.arc(px, py, 1.8, 0, 6.2832);
      c.fillStyle = rgba(p.color, 0.9);
      c.shadowColor = p.color;
      c.shadowBlur = 8;
      c.fill();
      c.shadowBlur = 0;

      /* 节点球 */
      c.save();
      c.shadowColor = p.color;
      c.shadowBlur = active ? 26 : 14;
      var grd = c.createRadialGradient(o.x - rad * 0.3, o.y - rad * 0.35, 1, o.x, o.y, rad * 1.35);
      grd.addColorStop(0, rgba(p.color, 0.5));
      grd.addColorStop(0.62, "rgba(8,15,28,.96)");
      grd.addColorStop(1, "rgba(6,12,24,.98)");
      c.fillStyle = grd;
      c.beginPath();
      c.arc(o.x, o.y, rad, 0, 6.2832);
      c.fill();
      c.lineWidth = active ? 1.8 : 1.2;
      c.strokeStyle = rgba(p.color, active ? 1 : 0.6);
      c.stroke();
      c.restore();

      if (active) {
        c.save();
        c.strokeStyle = rgba(p.color, 0.45);
        c.lineWidth = 1;
        c.setLineDash([2, 5]);
        c.lineDashOffset = -t * 26;
        c.beginPath();
        c.arc(o.x, o.y, rad + 7, 0, 6.2832);
        c.stroke();
        c.restore();
      }

      c.fillStyle = active ? "#ffffff" : "rgba(228,244,255,.8)";
      c.font = "700 " + Math.round(13 * sc) + "px " + MONO;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(o.nd.letter, o.x, o.y + 0.5);

      c.fillStyle = rgba(p.color, active ? 0.95 : 0.55);
      c.font = "500 8.5px " + MONO;
      c.fillText(p.name, o.x, o.y + rad + 13);
    });

    /* 中心准星 */
    c.strokeStyle = "rgba(140,215,255,.18)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - 9, cy); c.lineTo(cx - 3, cy);
    c.moveTo(cx + 3, cy); c.lineTo(cx + 9, cy);
    c.moveTo(cx, cy - 9); c.lineTo(cx, cy - 3);
    c.moveTo(cx, cy + 3); c.lineTo(cx, cy + 9);
    c.stroke();

    /* 底部信号刻度 */
    var hy = H - 34;
    c.strokeStyle = "rgba(122,190,255,.12)";
    c.beginPath();
    c.moveTo(30, hy);
    c.lineTo(W - 30, hy);
    c.stroke();
    for (var hx = 30; hx <= W - 30; hx += 22) {
      var hh = (Math.round(hx / 22) % 4 === 0) ? 6 : 3;
      c.beginPath();
      c.moveTo(hx, hy);
      c.lineTo(hx, hy - hh);
      c.stroke();
    }
    c.fillStyle = "rgba(140,205,255,.34)";
    c.font = "500 8px " + MONO;
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.fillText("SIGNAL MESH · 03 NODES", 30, H - 12);
    c.textAlign = "right";
    c.fillText("24H LOOP", W - 30, H - 12);
  }

  function rotateY(x, y, z, a) {
    var ca = Math.cos(a), sa = Math.sin(a);
    return { x: x * ca - z * sa, y: y, z: x * sa + z * ca };
  }
  function persp(z) { return 1.9 / (1.9 - z * 0.55); }

  /* 曲线数据 */
  var sparkData = { pts: [], color: "#66c0f4", peak: 0 };

  function buildSpark(entry, plat) {
    var rnd = mulberry32(hash(entry.id + "|" + state.dayKey));
    var n = 88, pts = [], v = 0.24, i;
    for (i = 0; i < n; i++) {
      v = clamp(v + (rnd() - 0.5) * 0.09, 0.06, 0.46);
      var hump = Math.pow(Math.sin((i / n) * Math.PI), 1.45) * 0.46;
      pts.push(clamp(v + hump + (rnd() - 0.5) * 0.035, 0.05, 1));
    }
    /* 制造一个明显的峰值 */
    var peakAt = Math.floor(n * (0.35 + rnd() * 0.4));
    pts[peakAt] = Math.min(1, pts[peakAt] + 0.26);
    sparkData.pts = pts;
    sparkData.color = plat.color;
    sparkData.peak = peakAt;
  }

  function drawSpark(t) {
    var c = spark.ctx, W = spark.w, H = spark.h;
    c.clearRect(0, 0, W, H);
    var pts = sparkData.pts, n = pts.length;
    if (!n) return;
    var color = sparkData.color;
    var px = function (i) { return 4 + (i / (n - 1)) * (W - 8); };
    var py = function (v) { return H - 9 - v * (H - 22); };

    c.save();
    c.setLineDash([2, 6]);
    c.strokeStyle = "rgba(255,255,255,.055)";
    c.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(function (g) {
      var y = py(g);
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    });
    c.restore();

    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgba(color, 0.3));
    grad.addColorStop(1, rgba(color, 0));
    c.beginPath();
    c.moveTo(px(0), py(pts[0]));
    for (var i = 1; i < n; i++) c.lineTo(px(i), py(pts[i]));
    c.lineTo(px(n - 1), H);
    c.lineTo(px(0), H);
    c.closePath();
    c.fillStyle = grad;
    c.fill();

    var lg = c.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, rgba(color, 0.45));
    lg.addColorStop(0.62, color);
    lg.addColorStop(1, "#a98bff");
    c.beginPath();
    c.moveTo(px(0), py(pts[0]));
    for (var j = 1; j < n; j++) c.lineTo(px(j), py(pts[j]));
    c.strokeStyle = lg;
    c.lineWidth = 2;
    c.shadowColor = rgba(color, 0.8);
    c.shadowBlur = 10;
    c.stroke();
    c.shadowBlur = 0;

    var pk = sparkData.peak;
    c.beginPath();
    c.arc(px(pk), py(pts[pk]), 2.6, 0, 6.2832);
    c.fillStyle = "#ffffff";
    c.fill();

    var prog = (t * 0.075) % 1;
    var x = px(prog * (n - 1));
    var fi = prog * (n - 1), i0 = Math.floor(fi), i1 = Math.min(n - 1, i0 + 1);
    var vv = pts[i0] + (pts[i1] - pts[i0]) * (fi - i0);
    c.beginPath();
    c.moveTo(x, 4);
    c.lineTo(x, H - 4);
    c.strokeStyle = "rgba(190,235,255,.14)";
    c.lineWidth = 1;
    c.stroke();

    c.beginPath();
    c.arc(x, py(vv), 3, 0, 6.2832);
    c.fillStyle = "#e8fbff";
    c.shadowColor = color;
    c.shadowBlur = 14;
    c.fill();
    c.shadowBlur = 0;
  }

  /* ---------------- 动画主循环 ---------------- */
  var t0 = performance.now();
  var lastBg = -1;

  function frame(now) {
    var t = (now - t0) / 1000;
    if (t - lastBg >= 1 / 30) {
      drawBg(t);
      drawOrb(t);
      lastBg = t;
    }
    drawSpark(t);
    requestAnimationFrame(frame);
  }

  /* ---------------- 拍立得轮换 ---------------- */
  window.setInterval(function () {
    var key = state.archiveKey;
    if (!key) return;
    var list = PLAT[key].archive || [];
    if (list.length < 2) return;
    var imgs = document.querySelectorAll("#archive .ph img");
    if (imgs.length < 2) return;
    archiveIdx = (archiveIdx + 1) % list.length;
    for (var i = 0; i < imgs.length; i++) imgs[i].classList.toggle("on", i === archiveIdx);
    var b = document.querySelector("#archive .cap b");
    var s = document.querySelector("#archive .cap span");
    if (b) b.textContent = list[archiveIdx].cap;
    if (s) s.textContent = list[archiveIdx].year;
  }, 14000);

  /* ---------------- 播控面板 ---------------- */
  var opEl = $("#op");

  function renderOperator() {
    if (!state.slots.length) return;
    var cur = state.previewIndex != null ? state.previewIndex : state.currentIndex;
    var rows = state.slots.map(function (s) {
      var p = PLAT[s.platform];
      return '<div class="orow' + (s.index === cur ? " on" : "") + '">' +
        "<b>" + hm(s.start) + "</b>" +
        '<span style="width:24px;color:' + p.color + '">' + p.code + "</span>" +
        "<em>" + esc(s.entry.title) + "</em></div>";
    }).join("");
    var mode = state.previewIndex != null ? "PREVIEW 预览" : state.paused ? "PAUSED 暂停" : "LIVE 自动轮播";
    var room = biliRoom();
    var biliTxt = room
      ? "ROOM " + esc(room) + (BILI.anchor ? " · " + esc(BILI.anchor) : "")
      : "未配置 · meta.bilibili / ?room=";
    opEl.innerHTML =
      "<h3>播控面板 · OPERATOR</h3>" +
      '<div class="hint">仅本地可见，OBS 采集前按 H 关闭</div>' +
      '<div class="kv"><span>模式</span><b>' + mode + "</b></div>" +
      '<div class="kv"><span>日期 / 时区</span><b>' + state.dayKey + " · UTC+8</b></div>" +
      '<div class="kv"><span>当前段落</span><b>' + (cur >= 0 ? pad2(cur + 1) : "--") + " / " + SLOTS + " · 每段 " + SEG + " 分钟</b></div>" +
      '<div class="kv"><span>B站直播间</span><b class="' + (room ? "ok" : "warn") + '">' + biliTxt + "</b></div>" +
      '<div class="kv"><span>今日去重</span><b class="' + (state.duplicates === 0 ? "ok" : "warn") + '">重复 ' + state.duplicates + " 条 · 节目池 " + state.poolSize + " 条</b></div>" +
      '<div class="kv"><span>数据状态</span><b class="warn">DEMO 占位 · 修改 data.js 即可替换</b></div>' +
      '<div class="oplist">' + rows + "</div>" +
      '<div class="keys"><kbd>H</kbd> 面板 · <kbd>P</kbd> 暂停 · <kbd>S</kbd> 预览下一段 · <kbd>Esc</kbd> 返回直播 · <kbd>F</kbd> 全屏</div>';
  }

  var toastEl = $("#toast"), toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 2200);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }

  document.addEventListener("keydown", function (ev) {
    var k = ev.key.toLowerCase();
    if (k === "h") {
      opEl.classList.toggle("on");
      if (opEl.classList.contains("on")) renderOperator();
    } else if (k === "p") {
      state.paused = !state.paused;
      if (!state.paused) state.currentIndex = -1;
      toast(state.paused ? "已暂停轮播" : "已恢复直播");
      renderOperator();
    } else if (k === "s") {
      var base = state.previewIndex != null ? state.previewIndex : state.currentIndex;
      state.previewIndex = (base + 1) % SLOTS;
      paintSlot(state.previewIndex);
      toast("预览 · 第 " + pad2(state.previewIndex + 1) + " 段");
    } else if (ev.key === "Escape") {
      if (state.previewIndex != null) {
        state.previewIndex = null;
        state.currentIndex = -1;
        toast("已返回直播");
        renderOperator();
      }
    } else if (k === "f") {
      toggleFullscreen();
    }
  });

  /* ---------------- 缩放适配 ---------------- */
  var fit = urlq.get("fit") !== "0";
  function fitStage() {
    if (!fit) { stage.style.transform = "translate(-50%,-50%)"; return; }
    var k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "translate(-50%,-50%) scale(" + k + ")";
  }
  window.addEventListener("resize", fitStage);
  document.addEventListener("fullscreenchange", fitStage);

  /* ---------------- 启动 ---------------- */
  if (DATA.meta.demoBadge === false) $("#demo").style.display = "none";
  paintBiliLine();

  var n0 = getNow();
  buildDay(dayKeyOf(n0));

  var qSlot = parseInt(urlq.get("slot"), 10);
  if (qSlot >= 1 && qSlot <= SLOTS) state.previewIndex = qSlot - 1;
  if (urlq.get("pause") === "1") state.paused = true;
  if (urlq.get("panel") === "1") opEl.classList.add("on");

  fitStage();
  tick();
  if (state.previewIndex != null) paintSlot(state.previewIndex);
  if (opEl.classList.contains("on")) renderOperator();

  window.setInterval(tick, 1000);
  requestAnimationFrame(frame);
})();
