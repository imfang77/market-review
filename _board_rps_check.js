
(function () {
  var D = window.BOARD_RPS || { anchor: "—", boards: {} };
  var ANCHOR = D.anchor;
  var BOARDS = D.boards;
  document.getElementById("data-date").textContent = ANCHOR;
  document.getElementById("anchor-text").textContent = ANCHOR;

  var list = [];
  for (var code in BOARDS) {
    var b = BOARDS[code];
    b.code = code;
    list.push(b);
  }

  // 交易日历（所有板块 hist 日期并集，升序），用于两线红"按日期"与新鲜度计算
  var ALLDATES = [];
  (function () {
    var set = {};
    list.forEach(function (b) { if (b.hist) b.hist.forEach(function (h) { set[h[0]] = 1; }); });
    ALLDATES = Object.keys(set).sort();
  })();
  var MIN_DATE = ALLDATES.length ? ALLDATES[0] : ANCHOR;

  // 列定义
  var COLS = [
    { k: "code", t: "板块", num: false, sticky: true, merged: true },
    { k: "amount", t: "成交额(亿)", num: true },
    { k: "chg", t: "当日涨幅(%)", num: true, sign: true, black: true },
    { k: "rps5", t: "板块RPS5", num: true, rps: true },
    { k: "rps10", t: "板块RPS10", num: true, rps: true },
    { k: "rps20", t: "板块RPS20", num: true, rps: true },
    { k: "rps60", t: "板块RPS60", num: true, rps: true },
    { k: "rps120", t: "板块RPS120", num: true, rps: true },
    { k: "rps240", t: "板块RPS240", num: true, rps: true },
    { k: "ret5", t: "涨跌幅5日%", num: true, sign: true, black: true },
    { k: "ret10", t: "涨跌幅10日%", num: true, sign: true, black: true },
    { k: "ret20", t: "涨跌幅20日%", num: true, sign: true, black: true },
    { k: "ret60", t: "涨跌幅60日%", num: true, sign: true, black: true },
    { k: "ret120", t: "涨跌幅120日%", num: true, sign: true, black: true },
    { k: "ret240", t: "涨跌幅240日%", num: true, sign: true, black: true },
    { k: "three", t: "是否两<br>线红", num: false, bool: true, cls: "c-three" },
    { k: "red_date", t: "两线转红日", num: false },
    { k: "lead", t: "领先周期<br>数", num: true, cls: "c-lead" },
    { k: "lg", t: "龙头个股", num: false, drill: "lead", cls: "c-drill", nosort: true },
    { k: "etfTop", t: "相关ETF", num: false, drill: "etf", cls: "c-drill", nosort: true }
  ];

  // 状态
  var state = {
    mode: "tri_red",
    triFresh: true, triFreshWin: 5,
    c5: 85, c10: 85, c20: 85, c60: 60, c120: 60, c240: 60,
    c5op: "ge", c10op: "ge", c20op: "ge", c60op: "ge", c120op: "ge", c240op: "ge",
    q: "",
    sortKey: "rps5", sortDir: "desc"
  };

  var $ = function (id) { return document.getElementById(id); };
  var PAGE_SIZE = 20, page = 1;

  // 渲染表头
  function renderHead() {
    var tr = $("thead");
    tr.innerHTML = "";
    COLS.forEach(function (c) {
      var th = document.createElement("th");
      var s = document.createElement("span");
      s.className = "th-clamp" + (c.t.indexOf("<br>") >= 0 ? " th-multi" : "");
      s.innerHTML = c.t;
      th.appendChild(s);
      th.className = (c.nosort ? "" : "sortable") + (c.num ? " num" : "") + (c.sticky ? " col-stock" : "") + (c.hdrBlack ? " rps-hdr" : "") + (c.cls ? " " + c.cls : "");
      if (state.sortKey === c.k) th.classList.add(state.sortDir);
      if (!c.nosort) th.onclick = function () { onSort(c.k); };
      tr.appendChild(th);
    });
  }

  function onSort(k) {
    if (state.sortKey === k) {
      state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
    } else {
      state.sortKey = k;
      state.sortDir = "desc";
    }
    renderHead();
    page = 1;
    renderBody();
  }
  function threeAsOf(b, d) {
    if (!b.hist || !b.hist.length) return false;
    var chosen = null;
    for (var i = 0; i < b.hist.length; i++) {
      if (b.hist[i][0] <= d) chosen = b.hist[i]; else break;
    }
    return chosen ? chosen[chosen.length - 1] === 1 : false;
  }
  // 新鲜度：三线转红日 距 选定结束日 的交易日数 <= 窗口
  function isFreshAsOf(b, d) {
    if (!b.red_date) return false;
    var di = ALLDATES.indexOf(d);
    var ri = ALLDATES.indexOf(b.red_date);
    if (ri < 0) return false;            // 早于历史窗口，视为不新鲜
    if (di < 0) di = ALLDATES.length - 1;
    return (di - ri) <= state.triFreshWin;
  }
  // 新鲜度区间提示：N日内首次三线转红 对应的交易日区间（替代原日期选项）
  function updateFreshRange() {
    var el = document.getElementById("fresh-range");
    if (!el) return;
    if (!state.triFresh) { el.textContent = ""; return; }
    var n = state.triFreshWin || 5;
    var di = ALLDATES.indexOf(ANCHOR);
    if (di < 0) di = ALLDATES.length - 1;
    var si = Math.max(0, di - n + 1);
    function fmt(d) { var p = d.split('-'); return p[0] + '/' + (+p[1]) + '/' + (+p[2]); }
    el.textContent = fmt(ALLDATES[si]) + "~" + fmt(ALLDATES[di]);
  }
  // 自定义模式：>= / <= 比较
  function cmpOp(v, op, thr) {
    if (v == null) return false;
    return op === "le" ? (v <= thr) : (v >= thr);
  }

  function filtered() {
    var base = list.filter(function (b) { return b.ok; });
    var out;
    if (state.mode === "tri_red") {
      out = base.filter(function (b) { return threeAsOf(b, ANCHOR); });     // 截至最新数据日两线红
      if (state.triFresh) {
        out = out.filter(function (b) { return isFreshAsOf(b, ANCHOR); }); // N日内首次三线转红（替代日期选项）
      }
    } else { // custom：有查询文本时优先按名称/代码匹配，否则才应用六个RPS条件
      var q = state.q.trim().toLowerCase();
      if (q) {
        out = base.filter(function (b) {
          return (b.code || "").toLowerCase().indexOf(q) >= 0
            || (b.name || "").toLowerCase().indexOf(q) >= 0;
        });
      } else {
        out = base.filter(function (b) {
          return cmpOp(b.rps5, state.c5op, state.c5)
              && cmpOp(b.rps10, state.c10op, state.c10)
              && cmpOp(b.rps20, state.c20op, state.c20)
              && cmpOp(b.rps60, state.c60op, state.c60)
              && cmpOp(b.rps120, state.c120op, state.c120)
              && cmpOp(b.rps240, state.c240op, state.c240);
        });
      }
    }
    return out;
  }

  function cmp(a, b) {
    var k = state.sortKey, dir = state.sortDir === "desc" ? -1 : 1;
    var va = a[k], vb = b[k];
    if (va == null) va = -1e9;
    if (vb == null) vb = -1e9;
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  }

  function cellHTML(c, b) {
    var v = b[c.k];
    if (c.bool) {
      return '<td class="' + (c.cls || "") + '">' + (v === 1 ? '<span class="badge-yes">是</span>' : '<span class="badge-no">—</span>') + '</td>';
    }
    if (c.drill === "lead") {
      var lg = b.lg || [];
      if (!lg.length) return '<td class="' + (c.cls || "") + '"><span class="no" style="color:#adb5bd">—</span></td>';
      var lh = '<div class="lead-txt">';
      lg.forEach(function (x) {
        var nmv = (x.v == null) ? "" : (x.t === "涨幅" ? (" " + x.v + "%") : (" " + x.v + "亿"));
        lh += '<div class="seg drill-link" data-drill="lead" data-code="' + (b.code || "") + '">'
          + '<span class="tag">' + x.t + '</span>' + (x.n || "") + '<span style="color:#adb5bd">' + nmv + '</span>'
          + '</div>';
      });
      return '<td class="' + (c.cls || "") + '">' + lh + '</div></td>';
    }
    if (c.drill === "etf") {
      var et = b.etfTop;
      if (!et) return '<td class="' + (c.cls || "") + '"><span class="no" style="color:#adb5bd">—</span></td>';
      var cv = (et.chg == null) ? "" : ' <span class="' + (et.chg > 0 ? "up" : (et.chg < 0 ? "down" : "flat")) + '">'
        + (et.chg > 0 ? "+" : "") + et.chg + '%</span>';
      return '<td class="' + (c.cls || "") + '"><div class="lead-txt"><div class="seg drill-link" data-drill="etf" data-code="'
        + (b.code || "") + '"><span class="tag">涨幅</span>' + (et.n || "") + cv + '</div></div></td>';
    }
    if (c.merged) {
      return '<td class="col-stock merged"><span class="b-code">' + (b.code || "") + '</span><span class="b-name board-link" data-code="' + (b.code || "") + '" data-nm="' + (b.name || "") + '">' + (b.name || "") + '</span></td>';
    }
    if (v == null) return '<td class="' + (c.num ? "num" : "") + (c.cls ? " " + c.cls : "") + '">—</td>';
    if (c.rps) {
      var cls = "num" + (v >= 90 ? " rps-hot" : "") + (c.cls ? " " + c.cls : "");
      return '<td class="' + cls + '">' + v + '</td>';
    }
    if (c.sign) {
      var cls2 = "num " + (c.black ? "" : (v > 0 ? "up" : (v < 0 ? "down" : "flat"))) + (c.cls ? " " + c.cls : "");
      var txt = (v > 0 ? "+" : "") + v.toFixed(2);
      return '<td class="' + cls2 + '">' + txt + '</td>';
    }
    if (c.k === "amount") return '<td class="num' + (c.cls ? " " + c.cls : "") + '">' + v.toFixed(2) + '</td>';
    if (c.num) return '<td class="num' + (c.cls ? " " + c.cls : "") + '">' + v + '</td>';
    return '<td class="' + (c.cls || "") + '">' + v + '</td>';
  }

  function renderBody() {
    var rows = filtered().sort(cmp);
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    var start = (page - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, total);
    var tb = $("tbody");
    tb.innerHTML = "";
    for (var i = start; i < end; i++) {
      var b = rows[i];
      var tr = document.createElement("tr");
      var isThree = (state.mode === "tri_red") ? threeAsOf(b, ANCHOR) : (b.three === 1);
      if (isThree) tr.className = "three-yes";
      COLS.forEach(function (c) {
        tr.insertAdjacentHTML("beforeend", cellHTML(c, b));
      });
      tb.appendChild(tr);
    }
    $("count-inline").textContent = total + " 个板块";
    $("empty").classList.toggle("fp-hidden", total > 0);
    var info = $("sr-pg-info");
    if (info) info.textContent = "第 " + page + " / " + pages + " 页 · 共 " + total + " 条";
    var prev = $("sr-prev"), next = $("sr-next");
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= pages;
  }

  // 模式显隐
  function applyMode() {
    $("tri-row").classList.toggle("fp-hidden", state.mode !== "tri_red");
    $("custom-row").classList.toggle("fp-hidden", state.mode !== "custom");
  }

  // 保持手机端第二行与第一行三列严格对齐；桌面端也保留自然紧凑宽度
  function syncCustomWidths() {
    var top = document.querySelectorAll("#custom-line-top .fp-seg");
    var bottom = document.querySelectorAll("#custom-line-bottom .fp-seg");
    if (!top.length || !bottom.length) return;
    for (var i = 0; i < 3; i++) {
      bottom[i].style.width = top[i].getBoundingClientRect().width + "px";
    }
  }

  // 事件绑定
  $("fp-plan").onchange = function () { state.mode = this.value; applyMode(); syncCustomWidths(); page = 1; renderBody(); };
  window.addEventListener("resize", syncCustomWidths);
  $("tri-fresh").onchange = function () { state.triFresh = this.checked; updateFreshRange(); page = 1; renderBody(); };
  $("tri-fresh-win").oninput = function () { state.triFreshWin = parseInt(this.value, 10) || 5; updateFreshRange(); page = 1; renderBody(); };
  $("c5").oninput = function () { state.c5 = parseFloat(this.value) || 0; page = 1; renderBody(); };
  $("c10").oninput = function () { state.c10 = parseFloat(this.value) || 0; page = 1; renderBody(); };
  $("c20").oninput = function () { state.c20 = parseFloat(this.value) || 0; page = 1; renderBody(); };
  $("c60").oninput = function () { state.c60 = parseFloat(this.value) || 0; page = 1; renderBody(); };
  $("c120").oninput = function () { state.c120 = parseFloat(this.value) || 0; page = 1; renderBody(); };
  $("c240").oninput = function () { state.c240 = parseFloat(this.value) || 0; page = 1; renderBody(); };
  $("c5op").onchange = function () { state.c5op = this.value; page = 1; renderBody(); };
  $("c10op").onchange = function () { state.c10op = this.value; page = 1; renderBody(); };
  $("c20op").onchange = function () { state.c20op = this.value; page = 1; renderBody(); };
  $("c60op").onchange = function () { state.c60op = this.value; page = 1; renderBody(); };
  $("c120op").onchange = function () { state.c120op = this.value; page = 1; renderBody(); };
  $("c240op").onchange = function () { state.c240op = this.value; page = 1; renderBody(); };
  $("q").oninput = function () { state.q = this.value; page = 1; renderBody(); };
  var prev = $("sr-prev"), next = $("sr-next");
  if (prev) prev.onclick = function () { page--; renderBody(); };
  if (next) next.onclick = function () { page++; renderBody(); };

  $("fp-reset").onclick = function () {
    state.mode = "tri_red";
    state.triFresh = true; state.triFreshWin = 5;
    state.c5 = 85; state.c10 = 85; state.c20 = 85; state.c60 = 60; state.c120 = 60; state.c240 = 60;
    state.c5op = "ge"; state.c10op = "ge"; state.c20op = "ge"; state.c60op = "ge"; state.c120op = "ge"; state.c240op = "ge";
    state.q = "";
    state.sortKey = "rps5"; state.sortDir = "desc";
    $("fp-plan").value = "tri_red";
    $("tri-fresh").checked = true; $("tri-fresh-win").value = 5; updateFreshRange();
    $("c5").value = 85; $("c10").value = 85; $("c20").value = 85; $("c60").value = 60; $("c120").value = 60; $("c240").value = 60;
    $("c5op").value = "ge"; $("c10op").value = "ge"; $("c20op").value = "ge"; $("c60op").value = "ge"; $("c120op").value = "ge"; $("c240op").value = "ge";
    $("q").value = "";
    page = 1; applyMode(); syncCustomWidths(); renderHead(); renderBody();
  };

  $("fp-export").onclick = function () {
    var rows = filtered().sort(cmp);
    var head = COLS.map(function (c) { return c.t; }).join(",");
    var lines = [head];
    rows.forEach(function (b) {
      var line = COLS.map(function (c) {
        if (c.merged) return (b.code || "") + " " + (b.name || "");
        var v = b[c.k];
        if (c.bool) return v === 1 ? "是" : "—";
        if (v == null) return "";
        if (c.sign || c.k === "amount") return v.toFixed(2);
        return v;
      });
      lines.push(line.join(","));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "板块RPS分析_" + ANCHOR + ".csv";
    a.click();
  };

  // 板块 RPS 下钻弹窗
  var boardCode = null, boardRpsDays = 20, boardChart = null;
  var RPSDEFS = [
    { idx: 1, name: "板块RPS5",   short: "5",   color: "#4263eb" },
    { idx: 2, name: "板块RPS10",  short: "10",  color: "#0ca678" },
    { idx: 3, name: "板块RPS20",  short: "20",  color: "#f59f00" },
    { idx: 4, name: "板块RPS60",  short: "60",  color: "#e8590c" },
    { idx: 5, name: "板块RPS120", short: "120", color: "#9c36b5" },
    { idx: 6, name: "板块RPS240", short: "240", color: "#1098ad" }
  ];
  var RPS_DEFAULT_ON = { "板块RPS5": true, "板块RPS10": true, "板块RPS20": true, "板块RPS60": false, "板块RPS120": false, "板块RPS240": false };
  var rpsVis = Object.assign({}, RPS_DEFAULT_ON);
  function openBoardRps(code, name) {
    boardCode = code;
    var b = BOARDS[code];
    if (!b || !b.hist || !b.hist.length) { alert("该板块暂无 RPS 历史数据"); return; }
    rpsVis = Object.assign({}, RPS_DEFAULT_ON);
    document.getElementById("rpsTitle").textContent = code + " " + (name || "");
    document.getElementById("rpsModal").style.display = "flex";
    var rg = document.getElementById("rpsRange");
    if (rg && !rg.getAttribute("data-init")) {
      [[20, "1个月"], [60, "3个月"], [120, "6个月"], [250, "12个月"]].forEach(function (o) {
        var btn = document.createElement("button");
        btn.setAttribute("data-d", o[0]); btn.textContent = o[1];
        btn.style.cssText = "padding:5px 12px;border:1px solid #ced4da;border-radius:6px;background:#fff;color:#1a1a2e;font-size:13px;cursor:pointer";
        if (o[0] === 20) { btn.style.background = "#4263eb"; btn.style.color = "#fff"; btn.style.borderColor = "#4263eb"; }
        rg.appendChild(btn);
      });
      rg.setAttribute("data-init", "1");
    }
    var ctl = document.getElementById("rpsCtl");
    if (ctl) {
      if (!ctl.getAttribute("data-init")) {
        RPSDEFS.forEach(function (d) {
          var lab = document.createElement("label");
          lab.style.cssText = "display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:13px";
          var cb = document.createElement("input");
          cb.type = "checkbox"; cb.setAttribute("data-name", d.name); cb.checked = !!RPS_DEFAULT_ON[d.name];
          cb.style.cssText = "width:14px;height:14px;accent-color:" + d.color;
          cb.onchange = function () { rpsVis[d.name] = this.checked; drawBoardChart(); };
          var sp = document.createElement("span");
          sp.textContent = (RPSDEFS.indexOf(d) === 0) ? d.name : d.short;
          sp.style.color = d.color;
          lab.appendChild(cb); lab.appendChild(sp);
          ctl.appendChild(lab);
        });
        ctl.setAttribute("data-init", "1");
      } else {
        Array.prototype.forEach.call(ctl.querySelectorAll("input[type=checkbox]"), function (cb) {
          cb.checked = !!RPS_DEFAULT_ON[cb.getAttribute("data-name")];
        });
      }
    }
    drawBoardChart();
  }
  function closeBoardRps() { document.getElementById("rpsModal").style.display = "none"; }
  window.closeBoardRps = closeBoardRps;
  function drawBoardChart() {
    var box = document.getElementById("rpsChart");
    if (typeof echarts === "undefined") {
      box.innerHTML = '<div style="padding:70px;text-align:center;color:#868e96;font-size:14px">ECharts 未加载（无网络），无法绘制曲线。</div>';
      return;
    }
    var b = BOARDS[boardCode];
    if (!b || !b.hist || !b.hist.length) { box.innerHTML = '<div style="padding:70px;text-align:center;color:#868e96;font-size:14px">暂无历史数据</div>'; return; }
    var win = b.hist.slice(-boardRpsDays);
    var dates = win.map(function (h) { return h[0]; });
    var mk = function (idx, name, color) {
      var arr = win.map(function (h) { return h[idx]; });
      /*
       * 红线：仅连接相邻两个均 >=90 的日期。
       * 红点：仅标记孤立的 >=90 日期（左右相邻日期均 <90 或不存在）。
       * 因此连续红区间只显示红色线段；孤立红值只显示红色点，前后连线仍保持该周期原色。
       */
      var hotSegments = arr.map(function (v, i) {
        var prevHot = i > 0 && arr[i - 1] != null && arr[i - 1] >= 90;
        var nextHot = i < arr.length - 1 && arr[i + 1] != null && arr[i + 1] >= 90;
        return (v != null && v >= 90 && (prevHot || nextHot)) ? v : null;
      });
      var singleHot = arr.map(function (v, i) {
        var prevHot = i > 0 && arr[i - 1] != null && arr[i - 1] >= 90;
        var nextHot = i < arr.length - 1 && arr[i + 1] != null && arr[i + 1] >= 90;
        return (v != null && v >= 90 && !prevHot && !nextHot) ? v : null;
      });
      return [
        { name: name, type: "line", data: arr, symbol: "none", connectNulls: true, lineStyle: { width: 1.6, color: color }, itemStyle: { color: color }, z: 2 },
        { name: name + "-hot", type: "line", data: hotSegments, symbol: "none", connectNulls: false, lineStyle: { width: 2.8, color: "#d63031" }, z: 3, tooltip: { show: false } },
        { name: name + "-single", type: "line", data: singleHot, symbol: "circle", symbolSize: 7, showSymbol: true, connectNulls: false, lineStyle: { width: 0, color: "transparent" }, itemStyle: { color: "#d63031" }, z: 4, tooltip: { show: false } }
      ];
    };
    var series = [];
    RPSDEFS.forEach(function (d) { if (rpsVis[d.name]) series = series.concat(mk(d.idx, d.name, d.color)); });
    if (!boardChart) boardChart = echarts.init(box);
    boardChart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "cross" }, formatter: function (ps) { var h = ps[0].axisValue + "<br/>"; ps.forEach(function (o) { if (o.seriesName.indexOf("-hot") < 0 && o.value != null) h += o.marker + o.seriesName + "：" + o.value + "<br/>"; }); return h; } },
      legend: { show: false },
      grid: { left: 46, right: 18, top: 40, bottom: 38 },
      xAxis: { type: "category", data: dates, boundaryGap: false, axisLabel: { fontSize: 10, color: "#868e96", formatter: function (v) { return String(v).slice(5); } } },
      yAxis: { type: "value", min: 0, max: 100, axisLabel: { fontSize: 11, color: "#868e96" }, splitLine: { lineStyle: { color: "#e9ecef" } } },
      series: series
    }, true);
    boardChart.resize();
    var last = b.hist[b.hist.length - 1];
    var html = '<div class="rps-now-row">';
    RPSDEFS.forEach(function (d, i) {
      var v = last[d.idx];
      var col = (v != null && v >= 90) ? "#d63031" : "#1a1a2e";
      var label = (i === 0) ? d.name : d.short;
      html += "<span>" + label + "：" + (v == null ? "—" : '<b style="color:' + col + '">' + v + "</b>") + "</span> ";
    });
    html += "</div>";
    document.getElementById("rpsNow").innerHTML = html;
  }
  /* ===== 龙头个股 / 相关ETF 下钻弹窗（格式与每日主线分析一致） ===== */
  function pct2(v) { return v == null ? "-" : ((v > 0 ? "+" : "") + v.toFixed(2) + "%"); }
  function pctn(v) { return v == null ? "-" : ((v > 0 ? "+" : "") + v.toFixed(2)); } /* 同 pct2 但无 %（% 已上提至表头） */
  function cls2(v) { return v == null ? "" : (v > 0 ? "up" : (v < 0 ? "down" : "flat")); }

  // 核心个股明细（5日口径）：与主线 stockTable 一致 —— 市值Top5 ∪ 成交额Top5 ∪ 涨幅Top5，按市值降序
  // 弹窗表格排序状态与可排序表头（格式同主表 th.sortable：⇅/↑/↓）
  var drillState = { kind: null, code: null, sortKey: null, sortDir: "desc" };
  function drillTh(label, skey, isNum) {
    if (!skey) return '<th>' + label + '</th>';
    var active = drillState.sortKey === skey;
    var cls = "sortable" + (isNum ? " num" : "");
    if (active) cls += " " + drillState.sortDir;
    return '<th class="' + cls + '" data-skey="' + skey + '">' + label + '</th>';
  }
  function drillCmp(a, b, key, dir) {
    var va = a[key], vb = b[key];
    if (va == null) va = -1e9;
    if (vb == null) vb = -1e9;
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  }
  function renderDrill() {
    var b = BOARDS[drillState.code];
    if (!b) return "";
    return drillState.kind === "lead" ? stockDrillHTML(b) : etfDrillHTML(b);
  }

  function stockDrillHTML(b) {
    var rows = b.sd || [];
    if (!rows.length) return '<div class="dt-empty">（暂无核心个股明细）</div>';
    if (drillState.sortKey) {
      rows = rows.slice().sort(function (a, b) {
        return drillCmp(a, b, drillState.sortKey, drillState.sortDir === "desc" ? -1 : 1);
      });
    }
    var h = '<div class="table-wrap"><table class="dt-table">'
      + '<colgroup><col style="width:21%"><col style="width:13%"><col style="width:13%"><col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:35%"></colgroup>'
      + '<thead><tr>'
      + drillTh('个股', 'n', false)
      + drillTh('当日市值(亿)', 'cap', true)
      + drillTh('当日成交额(亿)', 'amt', true)
      + drillTh('涨幅5日%', 'chg', true)
      + drillTh('涨幅10日%', 'c10', true)
      + drillTh('涨幅20日%', 'c20', true)
      + '<th>备注</th>'
      + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var tags = [];
      if (r.cr && r.cr <= 5) tags.push('<span class="rt rt-cap">市值Top' + r.cr + '</span>');
      if (r.ar && r.ar <= 5) tags.push('<span class="rt rt-amt">成交额Top' + r.ar + '</span>');
      if (r.gr && r.gr <= 5) tags.push('<span class="rt rt-gain">涨幅Top' + r.gr + '</span>');
      if (r.s) tags.push('<span class="rt rt-susp">停牌</span>');
      var note = tags.length ? '<div class="rank-tags">' + tags.join("") + '</div>' : "-";
      var amtCell = r.s ? '<span style="color:#adb5bd">停牌</span>'
        : ((r.amt == null || r.amt === 0) ? "-" : r.amt);
      h += '<tr>'
        + '<td class="stock-name">' + r.n + '<span class="stock-code">' + r.c + '</span></td>'
        + '<td class="' + ((r.cr && r.cr <= 5) ? "cell-cap" : "") + '">' + (r.cap == null ? "-" : r.cap) + '</td>'
        + '<td class="' + ((r.ar && r.ar <= 5) ? "cell-amt" : "") + '">' + amtCell + '</td>'
        /* 涨幅(5/10/20日)数值一律保持黑色；10/20 日仅展示，不参与排名与着色 */
        + '<td class="' + ((r.gr && r.gr <= 5) ? "cell-gain" : "") + '">' + pctn(r.chg) + '</td>'
        + '<td>' + pctn(r.c10) + '</td>'
        + '<td>' + pctn(r.c20) + '</td>'
        + '<td class="note-cell">' + note + '</td></tr>';
    });
    h += '</tbody></table></div>'
      + '<div class="dt-note">口径与每日主线分析「5日主线 · 核心个股明细」一致：'
      + '<b>市值Top5 ∪ 5日累计成交额Top5 ∪ 5日涨幅Top5</b> 的并集，默认按当日市值降序。'
      + '单元格底色与「备注」标签<b>与主线一致</b>：'
      + '<span style="background:#c62828;color:#fff;padding:0 4px;border-radius:2px">市值Top5</span> '
      + '<span style="background:#bbdefb;color:#1565c0;padding:0 4px;border-radius:2px">成交额Top5</span> '
      + '<span style="background:#f8bbd0;color:#e91e63;padding:0 4px;border-radius:2px">涨幅Top5</span>。'
      + '<b>涨幅(10日) / 涨幅(20日) 仅为展示</b>，不参与入表筛选与 Top5 着色；入表与排名一律按 5 日口径。'
      + '成交额按「成交量 × 均价」估算（与主线 approxAmt 同口径）。</div>';
    return h;
  }

  // 相关ETF：与主线 etfSection 一致 —— 十大持仓含本板块个股≥3 或 名称命中；成交额>0.5亿；按当日涨幅降序
  function etfDrillHTML(b) {
    var list = b.etf || [];
    if (!list.length) {
      return '<div class="dt-empty">（暂无匹配的相关 ETF：本板块个股未被任何 ETF 十大持仓命中 ≥3 只，且名称/关键词亦无对应 ETF，或匹配 ETF 当日成交额均 ≤ 0.5亿）</div>';
    }
    if (drillState.sortKey) {
      list = list.slice().sort(function (a, b) {
        return drillCmp(a, b, drillState.sortKey, drillState.sortDir === "desc" ? -1 : 1);
      });
    }
    var h = '<div class="table-wrap"><table class="dt-table">'
      + '<colgroup><col style="width:18%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:20%"></colgroup>'
      + '<thead><tr>'
      + drillTh('ETF（代码）', 'n', false)
      + drillTh('当日成交金额(亿)', 'amt', true)
      + drillTh('总规模(亿)', 'size', true)
      + drillTh('当日涨跌幅%', 'chg', true)
      + drillTh('5日涨跌幅%', 'c5', true)
      + drillTh('10日涨跌幅%', 'c10', true)
      + drillTh('20日涨跌幅%', 'c20', true)
      + '<th>十大持仓 / 说明</th>'
      + '</tr></thead><tbody>';
    list.forEach(function (e) {
      var holdsCell;
      if (e.ns || !(e.h || []).length) {
        holdsCell = '<td class="holds-cell" style="color:#adb5bd">跟踪商品价格 · 无个股持仓</td>';
      } else {
        var hs = e.h.map(function (x) {
          return '<div class="hold-row' + (x.core ? " core" : "") + '"><span class="hn">' + x.n
            + (x.core ? '<i class="core-tag">核心</i>' : '') + '</span><span class="hr">'
            + (x.r == null ? "-" : x.r) + '%</span></div>';
        }).join("");
        holdsCell = '<td class="holds-cell"><details class="holds-detail"><summary>持仓明细(' + e.h.length
          + ')</summary><div>' + hs + '</div></details></td>';
      }
      h += '<tr>'
        + '<td class="stock-name">' + e.n + '<span class="stock-code">' + e.c + '</span></td>'
        + '<td>' + (e.amt == null ? "-" : e.amt) + '</td>'
        + '<td>' + (e.size == null ? "-" : e.size) + '</td>'
        + '<td class="chg-cell ' + cls2(e.chg) + '">' + pctn(e.chg) + '</td>'
        + '<td class="chg-cell ' + cls2(e.c5) + '">' + pctn(e.c5) + '</td>'
        + '<td class="chg-cell ' + cls2(e.c10) + '">' + pctn(e.c10) + '</td>'
        + '<td class="chg-cell ' + cls2(e.c20) + '">' + pctn(e.c20) + '</td>'
        + holdsCell + '</tr>';
    });
    h += '</tbody></table></div>'
      + '<div class="dt-note">口径与每日主线分析「相关ETF」一致：十大持仓含本板块个股 <b>≥3 只</b>，'
      + '或<b>名称/关键词命中</b>（如 半导体 → 半导体ETF / 芯片ETF）；当日成交额 <b>&gt; 0.5亿</b>；'
      + '持仓重合命中按「重合数 → 总规模」取前 20 后再按当日涨幅降序。'
      + '持仓明细中带 <i class="core-tag">核心</i> 标记者为「核心个股明细」成分。</div>';
    return h;
  }

  function openDrill(kind, code) {
    var b = BOARDS[code];
    if (!b) return;
    drillState.kind = kind; drillState.code = code; drillState.sortKey = null; drillState.sortDir = "desc";
    var title = (kind === "lead") ? "龙头个股 · 核心个股明细（5日口径）" : "相关ETF";
    $("drillTitle").innerHTML = title
      + '<span style="font-size:13px;color:#868e96;font-weight:400">　' + (b.name || "") + " " + code + "</span>";
    $("drillBody").innerHTML = renderDrill();
    $("drillModal").style.display = "flex";
  }
  window.closeDrill = function () { $("drillModal").style.display = "none"; };
  $("drillModal").addEventListener("click", function (e) { if (e.target === this) this.style.display = "none"; });
  // 弹窗表头升降序（点击 th.sortable 重排，格式同主表）
  $("drillBody").addEventListener("click", function (e) {
    var th = e.target.closest ? e.target.closest("th.sortable") : null;
    if (!th) return;
    var k = th.getAttribute("data-skey");
    if (drillState.sortKey === k) drillState.sortDir = (drillState.sortDir === "desc") ? "asc" : "desc";
    else { drillState.sortKey = k; drillState.sortDir = "desc"; }
    $("drillBody").innerHTML = renderDrill();
  });

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("board-link")) {
      openBoardRps(t.getAttribute("data-code"), t.getAttribute("data-nm")); return;
    }
    if (t && t.classList && t.classList.contains("drill-link")) {
      openDrill(t.getAttribute("data-drill"), t.getAttribute("data-code")); return;
    }
    if (t && t.getAttribute && t.getAttribute("data-d")) {
      boardRpsDays = parseInt(t.getAttribute("data-d"), 10);
      var bs = document.querySelectorAll("#rpsRange button");
      for (var i = 0; i < bs.length; i++) {
        var on = (bs[i] === t);
        bs[i].style.background = on ? "#4263eb" : "#fff";
        bs[i].style.color = on ? "#fff" : "#1a1a2e";
        bs[i].style.borderColor = on ? "#4263eb" : "#ced4da";
      }
      drawBoardChart();
    }
  });
  document.getElementById("rpsModal").addEventListener("click", function (e) { if (e.target === this) this.style.display = "none"; });

  // 初始化
  $("c5op").value = state.c5op;
  $("c10op").value = state.c10op;
  $("c20op").value = state.c20op;
  updateFreshRange();
  applyMode();
  syncCustomWidths();
  renderHead();
  renderBody();
})();
