  // ===== 升级：RPS趋势 ↔ K线 切换（共用周期）=====
  var viewMode = "rps";      // rps | kline
  var klinePeriod = "day";   // day | week | month
  var KLINE_PERIODS = [["day", "日K"], ["week", "周K"], ["month", "月K"]];
  var RANGE_OPTS = [[20, "1个月"], [60, "3个月"], [120, "6个月"], [250, "12个月"]];
  var g_dateCap = "";

  function skinOf() {
    var m = document.getElementById("rpsModal");
    var c = m ? (m.className || "") : "";
    var mm = c.match(/skin-([ABC])/);
    return mm ? mm[1] : "A";
  }
  function chartTheme(skin) {
    if (skin === "B") return {
      bg: "#131722", axis: "#7d8694", split: "#232838",
      up: "#ff4d4f", down: "#00e676", upBorder: "#ff4d4f", downBorder: "#00e676",
      text: "#c5cad3",
      ma: ["#ffa94d", "#4dabf7", "#69db7c", "#da77f2", "#3bc9db", "#ff6b6b", "#adb5bd"]
    };
    if (skin === "C") return {
      bg: "#ffffff", axis: "#adb5bd", split: "#f1f3f5",
      up: "#e03131", down: "#2f9e44", upBorder: "#e03131", downBorder: "#2f9e44",
      text: "#868e96",
      ma: ["#f08c00", "#1971c2", "#2f9e44", "#9c36b5", "#0c8599", "#e03131", "#adb5bd"]
    };
    return {
      bg: "#ffffff", axis: "#868e96", split: "#e9ecef",
      up: "#d63031", down: "#00b894", upBorder: "#d63031", downBorder: "#00b894",
      text: "#495057",
      ma: ["#f08c00", "#1971c2", "#2f9e44", "#9c36b5", "#0c8599", "#e03131", "#adb5bd"]
    };
  }

  function openBoardRps(code, name) {
    boardCode = code;
    var b = BOARDS[code];
    if (!b) { alert("该板块暂无数据"); return; }
    if (!b.hist || !b.hist.length) {
      if (!histTried) {
        var box0 = document.getElementById("rpsChart");
        if (box0) box0.innerHTML = '<div style="padding:70px;text-align:center;color:#868e96;font-size:14px">历史曲线加载中…</div>';
        document.getElementById("rpsTitle").textContent = code + " " + (name || "");
        document.getElementById("rpsModal").style.display = "flex";
        loadHist(function () { openBoardRps(code, name); });
        return;
      }
      alert("该板块暂无 RPS 历史数据（历史曲线文件未加载成功）");
      return;
    }
    rpsVis = Object.assign({}, RPS_DEFAULT_ON);
    document.getElementById("rpsTitle").textContent = code + " " + (name || "");
    document.getElementById("rpsModal").style.display = "flex";
    buildRange();
    buildKlinePeriod();
    buildRpsCtl();
    viewMode = "rps"; klinePeriod = "day"; boardRpsDays = 20;
    updateRangeUI();
    syncToggleUI();
    drawActive();
  }

  function buildRange() {
    var rg = document.getElementById("rpsRange");
    if (!rg) return;
    rg.innerHTML = "";
    RANGE_OPTS.forEach(function (o) {
      var btn = document.createElement("button");
      btn.setAttribute("data-d", o[0]);
      btn.textContent = o[1];
      btn.className = "rps-range-btn" + (o[0] === 20 ? " on" : "");
      btn.onclick = function () {
        boardRpsDays = o[0];
        Array.prototype.forEach.call(rg.children, function (x) { x.classList.toggle("on", x === btn); });
        drawActive();
      };
      rg.appendChild(btn);
    });
  }
  function buildKlinePeriod() {
    var sel = document.getElementById("klinePeriodSel");
    if (!sel) return;
    sel.innerHTML = "";
    KLINE_PERIODS.forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0];
      opt.textContent = o[1];
      sel.appendChild(opt);
    });
    sel.value = "day";
    sel.onchange = function () { klinePeriod = sel.value; drawActive(); };
  }
  function buildRpsCtl() {
    var ctl = document.getElementById("rpsCtl");
    if (!ctl) return;
    ctl.innerHTML = "";
    RPSDEFS.forEach(function (d) {
      var lab = document.createElement("label");
      lab.className = "rps-ctl-lab";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-name", d.name);
      cb.checked = !!RPS_DEFAULT_ON[d.name];
      cb.onchange = function () { rpsVis[d.name] = this.checked; if (viewMode === "rps") drawBoardChart(); };
      var sp = document.createElement("span");
      sp.textContent = (RPSDEFS.indexOf(d) === 0) ? d.name : d.short;
      sp.style.color = d.color;
      lab.appendChild(cb); lab.appendChild(sp);
      ctl.appendChild(lab);
    });
  }
  function syncToggleUI() {
    var tg = document.getElementById("rpsToggle");
    if (tg) Array.prototype.forEach.call(tg.querySelectorAll("button"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-mode") === viewMode);
    });
    document.getElementById("rpsCtl").classList.toggle("rps-hidden", viewMode !== "rps");
    document.getElementById("rpsKlinePeriod").classList.toggle("rps-hidden", viewMode !== "kline");
    document.getElementById("rpsMaBar").classList.toggle("rps-hidden", viewMode !== "kline");
    document.getElementById("rpsNow").classList.toggle("rps-hidden", viewMode !== "rps");
    renderNote();
  }
  function updateRangeUI() {
    var rg = document.getElementById("rpsRange");
    if (!rg) return;
    Array.prototype.forEach.call(rg.children, function (b) {
      b.classList.toggle("on", parseInt(b.getAttribute("data-d"), 10) === boardRpsDays);
    });
  }
  function renderNote() {
    var note = document.getElementById("rpsNote");
    if (!note) return;
    var body = viewMode === "rps"
      ? "相邻两日板块RPS均 ≥ 90 时两点间显示红色线段；仅单日 ≥ 90 才凸显为红色点。历史曲线由每日横截面排名回溯计算。勾选上方复选框可显隐对应曲线。"
      : 'K线含 MA5/10/20/40/60/120/240 均线（数值见上方色条）；灰色横线条标示<span class="rps-up">向上跳空</span> / <span class="rps-down">向下跳空</span> 缺口（通达信风格，横线条厚度随缺口价差大小变化）。';
    note.innerHTML = '<span class="rps-date-blue">' + (g_dateCap || "") + "</span> " + body;
  }
  function drawActive() { if (viewMode === "rps") drawBoardChart(); else drawKline(); }

  // ----- RPS 趋势图（原逻辑，按皮肤着色）-----
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
    g_dateCap = "数据日期（最新）：" + (dates[dates.length - 1] || "—");
    renderNote();
    var th = chartTheme(skinOf());
    var mk = function (idx, name, color) {
      var arr = win.map(function (h) { return h[idx]; });
      var hotSegments = arr.map(function (v, i) {
        var ph = i > 0 && arr[i - 1] != null && arr[i - 1] >= 90;
        var nh = i < arr.length - 1 && arr[i + 1] != null && arr[i + 1] >= 90;
        return (v != null && v >= 90 && (ph || nh)) ? v : null;
      });
      var singleHot = arr.map(function (v, i) {
        var ph = i > 0 && arr[i - 1] != null && arr[i - 1] >= 90;
        var nh = i < arr.length - 1 && arr[i + 1] != null && arr[i + 1] >= 90;
        return (v != null && v >= 90 && !ph && !nh) ? v : null;
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
    boardChart.clear();
    boardChart.setOption({
      backgroundColor: th.bg,
      tooltip: { trigger: "axis", axisPointer: { type: "cross" }, formatter: function (ps) { var h = ps[0].axisValue + "<br/>"; ps.forEach(function (o) { if (o.seriesName.indexOf("-hot") < 0 && o.value != null) h += o.marker + o.seriesName + "：" + o.value + "<br/>"; }); return h; } },
      legend: { show: false },
      grid: { left: 46, right: 40, top: 40, bottom: 38 },
      xAxis: { type: "category", data: dates, boundaryGap: false, axisLabel: { fontSize: 10, color: th.axis, showMinLabel: true, showMaxLabel: true, hideOverlap: true, formatter: function (v) { return String(v).slice(5); } }, axisLine: { lineStyle: { color: th.split } } },
      yAxis: { type: "value", min: 0, max: 100, axisLabel: { fontSize: 11, color: th.axis }, splitLine: { lineStyle: { color: th.split } } },
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

  // ----- K线图（真实日K + MA + 缺口）-----
  function aggregate(daily, period) {
    if (period === "day") return daily.slice();
    var groups = {}, order = [];
    daily.forEach(function (bar) {
      var d = String(bar[0]);
      var key;
      if (period === "week") {
        var dt = new Date(d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8));
        var onejan = new Date(dt.getFullYear(), 0, 1);
        var wk = Math.ceil((((dt - onejan) / 86400000) + onejan.getDay() + 1) / 7);
        key = dt.getFullYear() + "-" + wk;
      } else { key = d.slice(0, 6); }
      if (!groups[key]) { groups[key] = { d: bar[0], o: bar[1], h: bar[2], l: bar[3], c: bar[4] }; order.push(key); }
      var g = groups[key];
      if (bar[2] > g.h) g.h = bar[2];
      if (bar[3] < g.l) g.l = bar[3];
      g.c = bar[4];
      g.d = bar[0]; // 用组内最后一根日期作为标签（=最新更新日期）
    });
    return order.map(function (k) { var g = groups[k]; return [g.d, g.o, g.h, g.l, g.c]; });
  }
  function maArr(closes, p) {
    var out = [], sum = 0;
    for (var i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= p) sum -= closes[i - p];
      out.push(i >= p - 1 ? +(sum / p).toFixed(2) : null);
    }
    return out;
  }
  function drawKline() {
    var box = document.getElementById("rpsChart");
    if (typeof echarts === "undefined") {
      box.innerHTML = '<div style="padding:70px;text-align:center;color:#868e96;font-size:14px">ECharts 未加载（无网络），无法绘制。</div>';
      return;
    }
    var kl = (window.BOARD_KLINE && boardCode) ? window.BOARD_KLINE[boardCode] : null;
    if (!kl || !kl.length) {
      box.innerHTML = '<div style="padding:70px;text-align:center;color:#868e96;font-size:14px">暂无 K 线数据</div>';
      document.getElementById("rpsMaBar").innerHTML = "";
      return;
    }
    var periodBars = aggregate(kl, klinePeriod);
    var n = klinePeriod === "day" ? boardRpsDays : (klinePeriod === "week" ? Math.max(8, Math.round(boardRpsDays / 5)) : Math.max(4, Math.round(boardRpsDays / 20)));
    var win = periodBars.slice(-n);
    var dates = win.map(function (b) { return b[0]; });
    var candle = win.map(function (b) { return [b[1], b[4], b[3], b[2]]; }); // open,close,low,high
    var closes = win.map(function (b) { return b[4]; });
    var th = chartTheme(skinOf());
    var ups = [], downs = [];
    for (var i = 1; i < win.length; i++) {
      if (win[i][3] > win[i - 1][2]) ups.push([i, win[i][3]]);
      else if (win[i][2] < win[i - 1][3]) downs.push([i, win[i][2]]);
    }
    var maDefs = [5, 10, 20, 40, 60, 120, 240];
    var series = [{ name: "K线", type: "candlestick", data: candle,
      itemStyle: { color: th.up, color0: th.down, borderColor: th.upBorder, borderColor0: th.downBorder }, z: 2 }];
    var maHtml = '<span class="rps-ma-lbl">MA</span>';
    maDefs.forEach(function (p, idx) {
      var m = maArr(closes, p);
      var col = th.ma[idx % th.ma.length];
      var dashed = (idx >= 4);
      series.push({ name: "MA" + p, type: "line", data: m, symbol: "none", smooth: false,
        lineStyle: { width: (p <= 20 ? 1.4 : 1.1), color: col, opacity: 0.95, type: dashed ? "dashed" : "solid" },
        itemStyle: { color: col }, z: 3 });
      var lastV = m[m.length - 1];
      maHtml += '<span class="rps-ma-val" style="color:' + col + '">MA' + p + '</span>' +
                '<span class="rps-ma-num">' + (lastV == null ? "—" : lastV) + "</span>";
    });
    // 通达信风格：跳空用灰色横线条（矩形带）表示
    //   水平跨度 = 相邻两根 K 线之间的空隙（上一根 → 当前根）
    //   横线条厚度 = 缺口的价差大小（即缺口区域本身：上一根 high/low 到当前根 low/high）
    var gapAreas = [];
    ups.forEach(function (u) {
      var i = u[0];
      var y0 = win[i - 1][2]; // 上一根 high = 向上跳空缺口下沿
      var y1 = win[i][3];     // 当前根 low  = 向上跳空缺口上沿
      gapAreas.push([{ xAxis: String(win[i - 1][0]), yAxis: y0 }, { xAxis: String(win[i][0]), yAxis: y1 }]);
    });
    downs.forEach(function (d) {
      var i = d[0];
      var y0 = win[i - 1][3]; // 上一根 low  = 向下跳空缺口上沿
      var y1 = win[i][2];     // 当前根 high = 向下跳空缺口下沿
      gapAreas.push([{ xAxis: String(win[i - 1][0]), yAxis: y0 }, { xAxis: String(win[i][0]), yAxis: y1 }]);
    });
    series[0].markArea = { silent: true, itemStyle: { color: "rgba(140,140,140,0.45)" }, data: gapAreas, z: 1 };
    if (!boardChart) boardChart = echarts.init(box);
    boardChart.clear();
    boardChart.setOption({
      backgroundColor: th.bg,
      tooltip: { trigger: "axis", axisPointer: { type: "cross" },
        formatter: function (ps) {
          if (!ps.length) return "";
          var h = ps[0].axisValue + "<br/>";
          var c = null;
          ps.forEach(function (o) {
            if (o.seriesName === "K线") c = o.value;
            else if (o.seriesName && o.seriesName.indexOf("MA") === 0 && o.value != null) h += o.marker + o.seriesName + "：" + o.value + "<br/>";
          });
          if (c) h += "开 " + c[0] + "　收 " + c[1] + "　低 " + c[2] + "　高 " + c[3] + "<br/>";
          return h;
        } },
      legend: { show: false },
      grid: { left: 58, right: 24, top: 40, bottom: 38 },
      xAxis: { type: "category", data: dates, boundaryGap: true, axisLabel: { fontSize: 10, color: th.axis, hideOverlap: true, showMaxLabel: true, formatter: function (v) { return klinePeriod === "day" ? String(v).slice(4) : v; } }, axisLine: { lineStyle: { color: th.split } } },
      yAxis: { scale: true, axisLabel: { fontSize: 11, color: th.axis }, splitLine: { lineStyle: { color: th.split } } },
      series: series
    }, true);
    boardChart.resize();
    document.getElementById("rpsMaBar").innerHTML = maHtml;
    g_dateCap = "数据日期（最新）：" + (dates[dates.length - 1] || "—");
    renderNote();
  }

  var _tg = document.getElementById("rpsToggle");
  if (_tg) _tg.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("button[data-mode]") : null;
    if (!btn) return;
    viewMode = btn.getAttribute("data-mode");
    boardRpsDays = (viewMode === "kline") ? 250 : 20; // K线默认12个月，RPS默认1个月
    updateRangeUI();
    syncToggleUI();
    drawActive();
  });

  function closeBoardRps() { document.getElementById("rpsModal").style.display = "none"; }
  window.closeBoardRps = closeBoardRps;
