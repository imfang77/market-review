/* _rzrq_drill.js — 「融资余额·涨跌家数」页 日期下钻（个股/ETF 融资榜 + 个股历史走势）
   挂接：#tbody-m 日期行点击 → 弹窗1 该期个股/ETF融资榜 → 点行 → 弹窗2 历史走势（方案A：跟随入口粒度）
   数据：_rzrq_stock[_w|_m]_<日期>.json · _rzrq_hist_d|w|m.json · _code_themes.json（懒加载+内存缓存）
   箭头约定与全站一致：默认 ⇅(灰)，升序 ↑(蓝)，降序 ↓(蓝)，不用 ▲/▼ */
(function () {
  'use strict';
  if (document.getElementById('drill-css')) return; // 幂等

  /* ---------- 工具 ---------- */
  var GRAN_TXT = { d: '日', w: '周', m: '月' };
  var cache = {};
  var themesPromise = null;
  function loadJSON(url, retry) {
    retry = retry || 0;
    if (cache[url] === undefined) {
      cache[url] = fetch(url, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
        return r.json();
      }).catch(function (e) {
        delete cache[url]; // 失败不缓存，允许后续请求重试（避免偶发网络失败被永久缓存）
        if (retry < 2) return loadJSON(url, retry + 1); // 弱网/大文件偶发失败时自动重试
        throw new Error(url + ' 加载失败：' + (e && e.message ? e.message : '未知错误'));
      });
    }
    return cache[url];
  }
  function themes() {
    if (!themesPromise) themesPromise = loadJSON('_code_themes.json').catch(function () { return {}; });
    return themesPromise;
  }
  function stockFile(gran, date) { return '_rzrq_stock' + (gran === 'd' ? '_' : '_' + gran + '_') + date + '.json'; }
  function fmt2(v) { return (v == null) ? '—' : ((v >= 0 ? '+' : '') + v.toFixed(2)); }
  function cls(v) { return v == null ? '' : (v >= 0 ? 'pos' : 'neg'); }
  function isEtf(c) { return /^(15|16|51|52|53|56|58)/.test(c); }

  /* ---------- CSS（作用域限定在弹窗内，不污染页面） ---------- */
  var css = ''
    + '.drill-mask{position:fixed;inset:0;background:rgba(20,28,48,.45);display:none;align-items:flex-start;justify-content:center;z-index:80;padding:40px 16px;overflow:auto}'
    + '.drill-mask.show{display:flex}'
    + '#drill-m2{background:rgba(20,28,48,.55);z-index:90}'
    + '.drill-box{background:#fff;border-radius:12px;width:min(960px,95vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 14px 44px rgba(0,0,0,.26);overflow:hidden;margin:auto 0}'
    + '.drill-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #e3e8f0;flex:0 0 auto}'
    + '.drill-title{font-weight:700;font-size:15px;min-width:0}'
    + '.drill-title .dt{color:#2f6bff;margin-right:6px}'
    + '.drill-title .c{color:#66708a;font-family:ui-monospace,monospace;margin-right:6px}'
    + '.drill-title .aux-note{font-weight:400;font-size:12px;color:#9aa3b5;margin-left:8px}'
    + '.drill-x{border:0;background:#f1f5fb;color:#66708a;width:28px;height:28px;border-radius:7px;font-size:18px;line-height:1;cursor:pointer;flex:0 0 auto}'
    + '.drill-x:hover{background:#e3e8f0}'
    + '.drill-body{padding:12px 16px 18px;overflow:auto}'
    + '.drill-ctrls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}'
    + '.dseg{display:inline-flex;border:1px solid #e3e8f0;border-radius:7px;overflow:hidden}'
    + '.dseg button{border:0;background:#fff;padding:5px 11px;font-size:12.5px;color:#66708a;cursor:pointer}'
    + '.dseg button.on{background:#2f6bff;color:#fff;font-weight:600}'
    + '.dseg button:hover:not(.on){color:#2f6bff}'
    + '.d-q{border:1px solid #e3e8f0;border-radius:7px;padding:5px 9px;font-size:12.5px;width:160px;outline:none;color:#1f2a44;background:#fff}'
    + '.d-q:focus{border-color:#2f6bff;box-shadow:0 0 0 2px rgba(47,107,255,.12)}'
    + '.d-q::placeholder{color:#aab4c5}'
    + '.drill-qnote{font-size:12px;color:#66708a;margin:0 2px 6px}'
    + '.drill-qnote b{color:#2f6bff}'
    + '.drill-tblwrap{overflow-x:auto;margin-top:8px}'
    + '.drill-tblwrap table{border-collapse:collapse;width:100%;font-size:12px}'
    + '.drill-tblwrap th,.drill-tblwrap td{border-bottom:1px solid #eef1f6;padding:4px 7px;text-align:right;white-space:nowrap}'
    + '.drill-tblwrap th{background:#f1f5fb;color:#66708a;font-weight:600;position:sticky;top:0;cursor:pointer;user-select:none}'
    + '.drill-tblwrap th:hover{color:#2f6bff}'
    + '.drill-tblwrap th.l,.drill-tblwrap td.l{text-align:left}'
    + '.drill-tblwrap .pos{color:#e23b3b}.drill-tblwrap .neg{color:#16a34a}'
    + '.drill-tblwrap .rk{color:#9aa3b5;font-variant-numeric:tabular-nums}'
    + '.drill-tblwrap .code{font-family:ui-monospace,Menlo,Consolas,monospace;color:#66708a}'
    + '.drill-tblwrap .subcode{display:block;font-family:"SF Mono",Consolas,monospace;font-size:11px;color:#868e96;margin-top:2px;white-space:nowrap;font-weight:400}'
    + '.drill-tblwrap .fire{color:#ff7a18;font-weight:700}'
    + '.drill-tblwrap td.themes{text-align:left;max-width:240px;white-space:normal;line-height:1.45;font-size:12px;color:#66708a}'
    + '.drill-tblwrap th[data-col="1"],.drill-tblwrap td.nm{text-align:center}'
    + '.drill-tblwrap td.nm .nmz{color:#2f6bff}'
    + /* 手机端：紧凑列距，保证融资余额与融资净买入两列数字完整可见（题材列隐藏，可在桌面端查看） */
      '@media (max-width:620px){'
    + '.drill-tblwrap th,.drill-tblwrap td{padding:5px 4px;font-size:12px}'
    + '.drill-tblwrap table{font-size:12px}'
    + '.drill-tblwrap td.themes,.drill-tblwrap th[data-col="6"]{display:none}'
    + '.drill-tblwrap td.nm{max-width:96px;overflow:hidden;text-overflow:ellipsis}'
    + '.drill-tblwrap .subcode{font-size:9.5px;margin-top:1px}'
    + '.drill-tblwrap .rk{padding-right:2px}'
    + '.d-q{width:126px;padding:5px 7px}'
    + '.drill-body{padding:10px 10px 16px}}'
    + '.drill-tblwrap tbody tr.srow{cursor:pointer}'
    + '.drill-tblwrap tbody tr.srow:hover{background:#f3f7ff}'
    + '.drill-tblwrap tbody tr.srow .name{color:#2f6bff}'
    + '.drill-load{color:#66708a;font-size:13px;padding:22px 0;text-align:center}'
    + '.drill-err{color:#e23b3b;font-size:13px;padding:22px 0;text-align:center}'
    + /* 箭头：仅弹窗表头（页面表头箭头由页面自身 CSS 定义） */
    '#drill-m1 thead th::after,#drill-m2 thead th::after{content:" ⇅";font-size:.72em;color:#aab4c5;margin-left:3px}'
    + '#drill-m1 thead th.sort-asc::after,#drill-m2 thead th.sort-asc::after{content:" ↑";font-size:.72em;color:#2f6bff;margin-left:3px}'
    + '#drill-m1 thead th.sort-desc::after,#drill-m2 thead th.sort-desc::after{content:" ↓";font-size:.72em;color:#2f6bff;margin-left:3px}'
    + /* 二级：走势图 + 明细 */
    '.sd-title{font-weight:700;font-size:13.5px;margin-bottom:6px;color:#1f2a44}'
    + '.sd-chart{position:relative;border:1px solid #e3e8f0;border-radius:8px;background:#fff;padding:4px 6px}'
    + '.sd-chart .cursor{stroke:#94a3c4;stroke-width:1;stroke-dasharray:3 3;opacity:0}'
    + '.sd-chart .dot{fill:#2f6bff;stroke:#fff;stroke-width:2;opacity:0}'
    + '.sd-chart .ovl{fill:transparent;cursor:crosshair}'
    + '.chart-tip{position:absolute;pointer-events:none;background:rgba(31,42,68,.95);color:#fff;font-size:12px;line-height:1.55;padding:6px 9px;border-radius:7px;opacity:0;transition:opacity .08s;z-index:5;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.28)}'
    + '.chart-tip b{color:#ffd479}'
    + '.mini-tbl{margin-top:8px;max-height:240px;overflow:auto;border:1px solid #e3e8f0;border-radius:8px;background:#fff}'
    + '.mini-tbl table{font-size:11.5px}'
    + '.mini-tbl th,.mini-tbl td{padding:3px 6px;text-align:right;border-bottom:1px solid #eef1f6;white-space:nowrap}'
    + '.mini-tbl th{background:#f1f5fb;color:#66708a;position:sticky;top:0;cursor:pointer;user-select:none}'
    + '.mini-tbl th:hover{color:#2f6bff}'
    + '.mini-tbl th.l,.mini-tbl td.l{text-align:left}'
    + '.mini-tbl .pos{color:#e23b3b}.mini-tbl .neg{color:#16a34a}';
  var style = document.createElement('style');
  style.id = 'drill-css';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- 弹窗骨架 ---------- */
  function mkModal(id) {
    var m = document.createElement('div');
    m.className = 'drill-mask'; m.id = id;
    m.innerHTML = '<div class="drill-box"><div class="drill-head"><span class="drill-title"></span><button class="drill-x">×</button></div><div class="drill-body"></div></div>';
    document.body.appendChild(m);
    return m;
  }
  var m1 = mkModal('drill-m1');
  var m2 = mkModal('drill-m2');

  /* ---------- 状态 ---------- */
  var st1 = { view: 'etf', rank: 'j', topn: 20, sort: null, date: null, gran: 'd', q: '' };
  var st2 = { code: '', name: '', isEtf: false, gran: 'd', sort: null, geo: null };

  /* ---------- 弹窗1：某期个股/ETF 融资榜 ---------- */
  function granNow() {
    var on = document.querySelector('#segG button.on');
    return (on && on.getAttribute('data-g')) || 'd';
  }
  function periodNote(gran) {
    return gran === 'd' ? '口径：当日融资净买入' : '口径：' + GRAN_TXT[gran] + '内净买入累计 · 余额/占流通为' + GRAN_TXT[gran] + '末快照';
  }
  function title1(date) {
    var rn = { r: '余额最高', j: '净买入最高', dc: '减少最多' }[st1.rank];
    var vn = st1.view === 'stock' ? '个股融资榜' : 'ETF融资榜';
    return '<span class="dt">' + date + '</span>' + vn + ' · ' + rn + ' · Top' + st1.topn
      + '<span class="aux-note">' + periodNote(st1.gran) + '</span>';
  }
  function themeCell(code, all) {
    var t = all[code];
    if (!t || !t.length) return '—';
    return t[0] + (t.length > 1 ? '<span style="color:#9aa3b5"> 等' + t.length + '个</span>' : '');
  }
  function qMatch(x, q) {
    return x.c.indexOf(q) >= 0 || (x.n || '').toLowerCase().indexOf(q) >= 0;
  }
  function autoView(data) {
    var q = (st1.q || '').toLowerCase(); if (!q) return;
    var cnt = function (etf) {
      return (data.rows || []).filter(function (x) { return etf ? isEtf(x.c) : !isEtf(x.c); })
        .filter(function (x) { return qMatch(x, q); }).length;
    };
    var curEtf = st1.view === 'etf';
    if (cnt(curEtf) === 0 && cnt(!curEtf) > 0) {
      st1.view = curEtf ? 'stock' : 'etf';
      var segView = m1.querySelector('.d-view');
      if (segView) segView.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === st1.view); });
    }
  }
  function tbl1(data, allThemes) {
    var rows = (data.rows || []).filter(function (x) { return st1.view === 'etf' ? isEtf(x.c) : !isEtf(x.c); });
    rows.forEach(function (x) { x._etf = isEtf(x.c); });
    if (st1.rank === 'r') rows.sort(function (a, b) { return b.r - a.r; });
    else if (st1.rank === 'j') rows.sort(function (a, b) { return (b.j == null ? -1e9 : b.j) - (a.j == null ? -1e9 : a.j); });
    else rows.sort(function (a, b) { return (a.j == null ? 1e9 : a.j) - (b.j == null ? 1e9 : b.j); });
    rows.forEach(function (x, i) { x._ord = i; });
    /* 关键词筛选在全量排序后、TopN 截断前 —— 保证任意代码/名称都能被搜到 */
    var q = (st1.q || '').toLowerCase(), matched = rows.length, qnote = '';
    if (q) {
      rows = rows.filter(function (x) { return qMatch(x, q); });
      matched = rows.length;
      qnote = '<div class="drill-qnote">筛选 “<b>' + st1.q.replace(/</g, '&lt;') + '</b>”：' + matched + ' 只匹配' + (matched ? '' : '，试试切换 ETF/个股 或 清空关键词') + '</div>';
    }
    rows = rows.slice(0, st1.topn);
    if (st1.sort) {
      var idx = st1.sort.idx, asc = st1.sort.asc;
      var getv = function (x) {
        if (idx === 0) return x._ord;
        if (idx === 1) return parseFloat(x.c) || 0;
        if (idx === 2) return x.r == null ? -1e18 : x.r;
        if (idx === 3) return x.j == null ? -1e18 : x.j;
        if (idx === 4) return x.z == null ? -1e18 : x.z;
        if (idx === 5) return x.s == null ? -1e18 : x.s;
        return (x.n || x.tp || '').toString();
      };
      rows.sort(function (a, b) {
        var va = getv(a), vb = getv(b);
        if (typeof va === 'string') { var c = ('' + va).localeCompare('' + vb, 'zh'); return asc ? c : -c; }
        if (isNaN(va)) va = -1e18; if (isNaN(vb)) vb = -1e18;
        return asc ? (va - vb) : (vb - va);
      });
    }
    var lastHead = st1.view === 'stock' ? '401题材' : '类型';
    var mk = function (i, txt, c) {
      var cl = (c || '') + (i === 6 ? ' l' : '');
      if (st1.sort && st1.sort.idx === i) cl += ' ' + (st1.sort.asc ? 'sort-asc' : 'sort-desc');
      return '<th class="' + cl.trim() + '" data-col="' + i + '">' + txt + '</th>';
    };
    var html = '<div class="drill-tblwrap">' + qnote + '<table><thead><tr>'
      + mk(0, '#') + mk(1, '名称') + mk(2, '融资余额(亿)') + mk(3, '融资净买入(亿)·' + GRAN_TXT[st1.gran])
      + mk(4, '占流通市值(%)') + mk(5, '连续上榜') + mk(6, lastHead)
      + '</tr></thead><tbody>';
    rows.forEach(function (x, i) {
      var fire = (x.s >= 3) ? '<span class="fire">🔥' + x.s + '</span>' : (x.s ? x.s : '—');
      var lastVal = st1.view === 'stock'
        ? '<td class="themes" title="' + (((allThemes[x.c] || []).join('、') || '—')).replace(/"/g, '&quot;') + '">' + themeCell(x.c, allThemes) + '</td>'
        : '<td class="l">' + (x.tp || '—') + '</td>';
      html += '<tr class="srow" data-code="' + x.c + '" data-name="' + x.n + '" data-etf="' + (x._etf ? '1' : '0') + '" data-r="' + (x.r != null ? x.r : '0') + '">'
        + '<td class="l rk">' + (i + 1) + '</td>'
        + '<td class="nm"><span class="nmz">' + x.n + '</span><span class="subcode">' + x.c + '</span></td>'
        + '<td>' + (x.r != null ? x.r.toFixed(2) : '—') + '</td>'
        + '<td class="' + cls(x.j) + '">' + fmt2(x.j) + '</td>'
        + '<td>' + (x.z != null ? x.z.toFixed(2) : '—') + '</td>'
        + '<td>' + fire + '</td>'
        + lastVal + '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }
  function ctrls1() {
    var viewOn = function (v) { return st1.view === v ? 'on' : ''; };
    var rankOn = function (r) { return st1.rank === r ? 'on' : ''; };
    var topOn = function (n) { return st1.topn === n ? 'on' : ''; };
    return '<div class="drill-ctrls" style="margin-bottom:8px">'
      + '<div class="dseg d-view"><button data-v="etf" class="' + viewOn('etf') + '">ETF</button><button data-v="stock" class="' + viewOn('stock') + '">个股</button></div>'
      + '<input class="d-q" type="text" placeholder="输代码或名称筛选" value="' + (st1.q || '').replace(/"/g, '&quot;') + '" spellcheck="false" autocomplete="off">'
      + '<div class="dseg d-rank"><button data-r="j" class="' + rankOn('j') + '">净买入最高</button><button data-r="dc" class="' + rankOn('dc') + '">减少最多</button><button data-r="r" class="' + rankOn('r') + '">余额最高</button></div>'
      + '<div class="dseg d-topn"><button data-n="10" class="' + topOn(10) + '">Top10</button><button data-n="20" class="' + topOn(20) + '">Top20</button><button data-n="50" class="' + topOn(50) + '">Top50</button></div>'
      + '</div>';
  }
  function body1(data, allThemes) {
    autoView(data);
    return ctrls1() + tbl1(data, allThemes);
  }
  function openModal1(date, gran) {
    st1.date = date; st1.gran = gran; st1.sort = null;
    var box = m1.querySelector('.drill-body');
    m1.querySelector('.drill-title').innerHTML = '<span class="dt">' + date + '</span>' + GRAN_TXT[gran] + ' · 融资榜加载中…';
    box.innerHTML = '<div class="drill-load">加载中…</div>';
    m1.classList.add('show');
    Promise.all([loadJSON(stockFile(gran, date)), themes()]).then(function (rs) {
      if (st1.date !== date) return; // 已切到别的日期
      box.innerHTML = body1(rs[0], rs[1]);
      m1.querySelector('.drill-title').innerHTML = title1(date);
    }).catch(function (e) {
      if (st1.date !== date) return;
      box.innerHTML = '<div class="drill-err">该日期暂无个股明细数据（' + e.message + '）</div>';
    });
  }

  /* ---------- 弹窗2：个股/ETF 历史走势（方案A：跟随入口粒度） ---------- */
  function chartSVG(dates, r, j, z) {
    var W = 620, H = 240, padL = 46, padR = 10, padT = 8, padB = 22;
    var iW = W - padL - padR, iH = H - padT - padB, N = dates.length;
    var rmin = Math.min.apply(null, r.filter(function (x) { return x != null; }));
    var rmax = Math.max.apply(null, r.filter(function (x) { return x != null; }));
    var dv = j.map(function (x) { return x == null ? 0 : x; });
    var dmax = Math.max.apply(null, dv), dmin = Math.min.apply(null, dv);
    var dabs = Math.max(Math.abs(dmax), Math.abs(dmin), 1e-9);
    var xs = dates.map(function (_, i) { return padL + (N === 1 ? iW / 2 : iW * i / (N - 1)); });
    var rBot = padT + iH * 0.60;
    var yR = function (v) { return rBot - (rBot - padT) * ((v - rmin) / ((rmax - rmin) || 1)); };
    var rys = r.map(function (v) { return v == null ? null : yR(v); });
    var yZero = padT + iH * 0.80, yS = (iH * 0.16) / dabs;
    var pts = rys.map(function (y, i) { return y == null ? null : xs[i].toFixed(1) + ',' + y.toFixed(1); })
      .filter(Boolean).join(' ');
    var bars = '';
    for (var i = 0; i < N; i++) {
      if (j[i] == null) continue;
      var v = j[i], bw = Math.max(2, iW / N * 0.5), bx = xs[i] - bw / 2;
      var by = v >= 0 ? yZero - v * yS : yZero, bh = Math.max(0.5, Math.abs(v * yS));
      bars += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + (v >= 0 ? '#e23b3b' : '#16a34a') + '" opacity="0.82"/>';
    }
    var lab = function (t, xx, a) { return '<text x="' + xx + '" y="' + (H - 6) + '" font-size="10" fill="#9aa3b5" text-anchor="' + a + '">' + t + '</text>'; };
    var rl = function (v, yy) { return '<text x="' + (padL - 6) + '" y="' + (yy + 3) + '" font-size="10" fill="#9aa3b5" text-anchor="end">' + v.toFixed(0) + '</text>'; };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">'
      + '<line x1="' + padL + '" y1="' + yZero + '" x2="' + (padL + iW) + '" y2="' + yZero + '" stroke="#d7dde8" stroke-dasharray="3 3"/>'
      + bars
      + '<polyline points="' + pts + '" fill="none" stroke="#2f6bff" stroke-width="2"/>'
      + '<line class="cursor" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + iH) + '"/>'
      + '<circle class="dot" r="4" cx="0" cy="0"/>'
      + '<text x="' + padL + '" y="' + (padT + 9) + '" font-size="10" fill="#2f6bff">融资余额(亿)</text>'
      + '<text x="' + (padL + iW) + '" y="' + (yZero + 13) + '" font-size="10" fill="#9aa3b5" text-anchor="end">融资净买入(亿) · 悬停看明细</text>'
      + rl(rmax, padT + 8) + rl(rmin, rBot)
      + lab(dates[0], padL, 'start') + lab(dates[Math.floor(N / 2)], padL + iW / 2, 'middle') + lab(dates[N - 1], padL + iW, 'end')
      + '<rect class="ovl" x="0" y="0" width="' + W + '" height="' + H + '"/>'
      + '</svg>';
    return { svg: svg, geo: { xs: xs, rys: rys, dates: dates, r: r, j: j, z: z } };
  }
  function tbl2HTML() {
    var h = st2.geo, ds = st2.sort || { col: 0, asc: false };
    var rows = [];
    for (var i = 0; i < h.dates.length; i++) rows.push({ i: i, dt: h.dates[i], r: h.r[i], j: h.j[i], z: h.z[i] });
    rows.sort(function (a, b) {
      var va, vb;
      if (ds.col === 0) { va = a.i; vb = b.i; }
      else if (ds.col === 1) { va = a.r == null ? -1e18 : a.r; vb = b.r == null ? -1e18 : b.r; }
      else if (ds.col === 2) { va = a.j == null ? -1e18 : a.j; vb = b.j == null ? -1e18 : b.j; }
      else { va = a.z == null ? -1e18 : a.z; vb = b.z == null ? -1e18 : b.z; }
      return ds.asc ? (va - vb) : (vb - va);
    });
    var mk2 = function (i, txt) {
      var c = (i === 0 ? ' l' : '');
      if (st2.sort && st2.sort.col === i) c += ' ' + (st2.sort.asc ? 'sort-asc' : 'sort-desc');
      return '<th class="' + c.trim() + '" data-col="' + i + '">' + txt + '</th>';
    };
    var tbl = '<div class="mini-tbl"><table><thead><tr>' + mk2(0, '日期') + mk2(1, '融资余额(亿)') + mk2(2, '融资净买入(亿)·' + GRAN_TXT[st2.gran]) + mk2(3, '占流通市值(%)') + '</tr></thead><tbody>';
    rows.forEach(function (x) {
      tbl += '<tr><td class="l">' + x.dt + '</td><td>' + (x.r == null ? '—' : x.r.toFixed(2)) + '</td>'
        + '<td class="' + cls(x.j) + '">' + fmt2(x.j) + '</td>'
        + '<td>' + (x.z == null ? '—' : x.z.toFixed(2)) + '</td></tr>';
    });
    tbl += '</tbody></table></div>';
    return tbl;
  }
  function attachTip(svg, geo) {
    var ovl = svg.querySelector('.ovl'), cursor = svg.querySelector('.cursor'), dot = svg.querySelector('.dot');
    var tip = svg.closest('.sd-chart').querySelector('.chart-tip');
    ovl.addEventListener('mousemove', function (ev) {
      var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      var bi = 0, bd = 1e9;
      geo.xs.forEach(function (x, i) { var dd = Math.abs(x - p.x); if (dd < bd) { bd = dd; bi = i; } });
      var ux = geo.xs[bi], uy = geo.rys[bi] != null ? geo.rys[bi] : 0;
      cursor.setAttribute('x1', ux); cursor.setAttribute('x2', ux); cursor.style.opacity = 1;
      dot.setAttribute('cx', ux); dot.setAttribute('cy', uy); dot.style.opacity = 1;
      tip.innerHTML = '<b>' + geo.dates[bi] + '</b><br>融资余额 ' + (geo.r[bi] == null ? '—' : geo.r[bi].toFixed(2)) + '亿<br>融资净买入 ' + fmt2(geo.j[bi]) + '亿<br>占流通 ' + (geo.z[bi] == null ? '—' : geo.z[bi].toFixed(2)) + '%';
      var box = svg.closest('.sd-chart').getBoundingClientRect();
      var tx = ev.clientX - box.left + 14, ty = ev.clientY - box.top + 12;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      if (tx + tw > box.width) tx = ev.clientX - box.left - tw - 14;
      if (ty + th > box.height) ty = box.height - th - 4;
      tip.style.left = tx + 'px'; tip.style.top = ty + 'px'; tip.style.opacity = 1;
    });
    ovl.addEventListener('mouseleave', function () { cursor.style.opacity = 0; dot.style.opacity = 0; tip.style.opacity = 0; });
  }
  function openModal2(code, name, isEtfFlag, rEnd) {
    st2.code = code; st2.name = name; st2.isEtf = isEtfFlag; st2.gran = st1.gran; st2.sort = null; st2.geo = null;
    var box = m2.querySelector('.drill-body');
    m2.querySelector('.drill-title').innerHTML = '<span class="c">' + code + '</span>' + name + ' · 历史走势加载中…';
    box.innerHTML = '<div class="drill-load">加载中…</div>';
    m2.classList.add('show');
    loadJSON('_rzrq_hist_' + st2.gran + '.json').then(function (h) {
      if (st2.code !== code) return;
      var rec = h.stocks && h.stocks[code];
      if (!rec) { box.innerHTML = '<div class="drill-err">该标的无历史序列数据</div>'; return; }
      var g = chartSVG(h.dates, rec.r, rec.j, rec.z);
      st2.geo = g.geo;
      var N = h.dates.length;
      m2.querySelector('.drill-title').innerHTML = '<span class="c">' + code + '</span>' + name + ' · 近' + N + GRAN_TXT[st2.gran]
        + '融资余额 &amp; 融资净买入' + (isEtfFlag ? '（ETF）' : '')
        + '<span class="aux-note">' + periodNote(st2.gran) + '</span>';
      box.innerHTML = '<div class="sd-title"></div>'
        + '<div class="sd-chart">' + g.svg + '<div class="chart-tip"></div></div>'
        + tbl2HTML();
      var svg = box.querySelector('svg');
      if (svg) attachTip(svg, st2.geo);
    }).catch(function (e) {
      if (st2.code !== code) return;
      box.innerHTML = '<div class="drill-err">历史数据加载失败（' + e.message + '）</div>';
    });
  }

  /* ---------- 事件 ---------- */
  // ① 底层表：日期行点击（tbody 元素在页面重渲染时持久，用委托）
  var tbm = document.getElementById('tbody-m');
  if (tbm) {
    tbm.addEventListener('click', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return;
      var d = (tr.children[0] && tr.children[0].textContent || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      openModal1(d, granNow());
    });
    // 折叠说明：插在融资表下方（默认收起）
    var tblbox = tbm.closest('.tblbox') || tbm.closest('table').parentElement;
    if (tblbox && !document.getElementById('drill-hintfold')) {
      tblbox.insertAdjacentHTML('afterend',
        '<details class="descfold" id="drill-hintfold"><summary>下钻使用说明（点击展开）</summary>'
        + '<div style="font-size:12.5px;color:#66708a;padding:8px 12px 12px;line-height:1.8">'
        + '① 点击上表任意 <b>日期行</b> → 弹出该期「个股/ETF 融资榜」（默认 ETF、净买入最高，可切榜单类型/TopN/表头排序）。'
        + '粒度跟随当前标签：日/周/月分别在弹窗内展示当日/周内累计/月内累计口径。<br>'
        + '② 在弹窗内<b>点任意个股/ETF 行</b> → 弹出第二层「近 N ' + '期融资余额 &amp; 融资净买入」走势（蓝线=余额，红绿柱=净买入），粒度与入口一致。'
        + '<br>③ 走势图上<b>鼠标悬停</b>任意一期 → 浮出当期明细。两层弹窗可分别关闭。</div></details>');
    }
  }
  // ② 弹窗内：控制条 / 表头排序 / 个股行 / 关闭（统一委托）
  document.addEventListener('click', function (e) {
    var segB = e.target.closest('.dseg button');
    if (segB) {
      var seg = segB.closest('.dseg');
      if (seg.classList.contains('d-view')) st1.view = segB.dataset.v;
      else if (seg.classList.contains('d-rank')) st1.rank = segB.dataset.r;
      else if (seg.classList.contains('d-topn')) st1.topn = parseInt(segB.dataset.n, 10);
      st1.sort = null;
      seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      segB.classList.add('on');
      refresh1();
      return;
    }
    var th1 = e.target.closest('#drill-m1 thead th');
    if (th1) {
      var idx = parseInt(th1.dataset.col, 10);
      if (st1.sort && st1.sort.idx === idx) st1.sort.asc = !st1.sort.asc;
      else st1.sort = { idx: idx, asc: false }; // 首次=降序
      refresh1();
      return;
    }
    var th2 = e.target.closest('#drill-m2 thead th');
    if (th2) {
      var col = parseInt(th2.dataset.col, 10);
      if (st2.sort && st2.sort.col === col) st2.sort.asc = !st2.sort.asc;
      else st2.sort = { col: col, asc: false };
      var mini = m2.querySelector('.mini-tbl');
      if (mini && st2.geo) { mini.outerHTML = tbl2HTML(); }
      return;
    }
    var sr = e.target.closest('#drill-m1 tr.srow');
    if (sr) { openModal2(sr.dataset.code, sr.dataset.name, sr.dataset.etf === '1', parseFloat(sr.dataset.r)); return; }
    if (e.target.closest('#drill-m2 .drill-x') || e.target.id === 'drill-m2') { m2.classList.remove('show'); return; }
    if (e.target.closest('#drill-m1 .drill-x') || e.target.id === 'drill-m1') { m1.classList.remove('show'); m2.classList.remove('show'); }
  });
  var qTimer = null;
  document.addEventListener('input', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('d-q')) {
      st1.q = e.target.value.trim();
      if (qTimer) clearTimeout(qTimer);
      qTimer = setTimeout(function () { refresh1(true); }, 250); // 防抖：停顿 250ms 才刷新
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (m2.classList.contains('show')) m2.classList.remove('show');
    else if (m1.classList.contains('show')) m1.classList.remove('show');
  });
  function refresh1(keepInput) {
    var box = m1.querySelector('.drill-body');
    var cur = box.querySelector('.drill-tblwrap');
    if (!cur) return; // 还在加载中
    var inp = keepInput ? box.querySelector('.d-q') : null;
    var pos = (inp && inp.selectionStart != null) ? [inp.selectionStart, inp.selectionEnd] : null;
    Promise.all([loadJSON(stockFile(st1.gran, st1.date)), themes()]).then(function (rs) {
      if (!document.body.contains(cur)) return; // 已被更新的重绘替换
      autoView(rs[0]);
      var wrap = box.querySelector('.drill-tblwrap');
      if (wrap) wrap.outerHTML = tbl1(rs[0], rs[1]);
      m1.querySelector('.drill-title').innerHTML = title1(st1.date);
      if (inp) {
        var inp2 = box.querySelector('.d-q');
        if (inp2) { inp2.focus(); if (pos) { try { inp2.setSelectionRange(pos[0], pos[1]); } catch (_) {} } }
      }
    });
  }
})();
