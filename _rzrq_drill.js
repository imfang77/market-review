/* _rzrq_drill.js — 「融资余额·涨跌家数」页 日期下钻（个股/ETF 融资榜 + 个股历史走势）
   挂接：#tbody-m 日期行点击 → 弹窗1 该期个股/ETF融资榜 → 点行 → 弹窗2 历史走势（方案A：跟随入口粒度）
   数据：_rzrq_stock[_w|_m]_<日期>.json · _rzrq_hist_d|w|m.json · _code_themes.json（懒加载+内存缓存）
   箭头约定与全站一致：默认 ⇅(灰)，升序 ↑(蓝)，降序 ↓(蓝)，不用 ▲/▼ */
/* 全局共享：金额单位（w=万 / q=千万 / y=亿；未手动选档时系统按个股市值自动匹配对应档）+ 个股标签页状态与刷新钩子
   数据底层单位恒为「亿元」。
   口径定稿（2026-11-06 用户拍板）：三档单位 = 万 / 千万 / 亿，
   换算 1亿 = 10,000万 = 10千万 = 1亿；融资余额与融资净买入共用同一单位（不分开选档）。
   自动档(a, 默认)：由「融资余额窗口最大值」决定用哪一档——
     最大值 < 1亿        → 万档   （例：0.4亿 = 4000万，净买入 0.02亿 = 200万）
     1亿 ≤ 最大值 < 10亿 → 千万档 （例：3.4亿 = 34千万）
     最大值 ≥ 10亿       → 亿档   （例：344亿 = 344亿）
   手动档 w/q/y 强制锁定该档，两列同单位。 */
window.RZQ = window.RZQ || { unit: 'a', code: '', name: '' };
(function () {
  'use strict';
  if (document.getElementById('drill-css')) return; // 幂等

  var RZQ = window.RZQ;
  if (RZQ.unit && ['a', 'w', 'q', 'y'].indexOf(RZQ.unit) < 0) RZQ.unit = 'a'; // 仅兜底未知档位归自动；w/q/y 为有效手动档
  var UNITS = {
    w: { key: 'w', label: '万',   mul: 1e4, dec: 2 },  // 1亿 = 10,000万
    q: { key: 'q', label: '千万', mul: 10,  dec: 2 },  // 1亿 = 10千万
    y: { key: 'y', label: '亿',   mul: 1,   dec: 2 }   // 1亿 = 1亿
  };
  // 无「自动」按钮：选项只有 万/千万/亿；未手动选档时(RZQ.unit==='a')由系统按个股市值自动匹配对应档并显示该档
  var BTN_LABEL = { w: '万', q: '千万', y: '亿' };
  function maxAbs(a) {
    var m = 0;
    (a || []).forEach(function (v) { if (v != null && !isNaN(v)) m = Math.max(m, Math.abs(v)); });
    return m;
  }
  /* 自动档：由融资余额窗口最大值（亿元）选档，余额与净买入共用同一单位 */
  function autoTier(bMax) {
    if (bMax == null || isNaN(bMax)) return 'w';
    if (bMax >= 10) return 'y';
    if (bMax >= 1) return 'q';
    return 'w';
  }
  /* 返回单一单位对象（余额与净买入共用）；balanceArr 为融资余额序列（亿元） */
  function effUnit(balanceArr) {
    if (RZQ.unit !== 'a' && UNITS[RZQ.unit]) return UNITS[RZQ.unit];
    return UNITS[autoTier(maxAbs(balanceArr))];
  }
  function fmtVal(v, u) {
    if (v == null || isNaN(v)) return '—';
    var uu = u || effUnit([]);
    return (v * uu.mul).toLocaleString('zh-CN', { minimumFractionDigits: uu.dec, maximumFractionDigits: uu.dec });
  }
  function fmtSigned(v, u) {
    if (v == null || isNaN(v)) return '—';
    return (v >= 0 ? '+' : '-') + fmtVal(Math.abs(v), u);
  }
  // 当前生效单位的中文标签：优先用传入单位对象，否则用最近一次渲染生效单位(RZQ._lastU)，再否则按空窗口自动档(万)
  function uLabel(u) { return (u && u.label) || (RZQ._lastU && RZQ._lastU.label) || (RZQ.effUnit && RZQ.effUnit([]).label) || '万'; }
  function uVal(v, u) { return fmtVal(v, u); }
  function uSigned(v, u) { return fmtSigned(v, u); }
  RZQ.uLabel = uLabel; RZQ.uVal = uVal; RZQ.uSigned = uSigned;
  RZQ.effUnit = effUnit; RZQ.UNITS = UNITS; RZQ.BTN_LABEL = BTN_LABEL;
  // 单位按钮：只渲染 万/千万/亿 三档，不出现「自动」。activeKey 决定高亮项——
  // 未手动选档时传「自动匹配出的档位」，手动选档时传 RZQ.unit，使高亮=当前实际生效档。
  function unitBtns(activeKey) {
    activeKey = activeKey || (RZQ.unit !== 'a' ? RZQ.unit : (RZQ._lastU && RZQ._lastU.key) || 'w');
    return ['w', 'q', 'y'].map(function (u) {
      return '<button data-u="' + u + '" class="' + (activeKey === u ? 'on' : '') + '">' + BTN_LABEL[u] + '</button>';
    }).join('');
  }
  // 同步单位按钮高亮（弹窗与个股标签页共用同一 RZQ.unit 状态）；U 为当前生效单位对象，root 限定作用域避免互相覆盖
  RZQ.syncUnitBtn = function (U, root) {
    var key = (U && U.key) || (RZQ.unit !== 'a' ? RZQ.unit : (RZQ._lastU && RZQ._lastU.key) || 'w');
    var scope = root || document;
    scope.querySelectorAll('.dseg.d-unit button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-u') === key);
    });
  };
  RZQ.unitBtns = unitBtns;

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
  RZQ.load = loadJSON; // 供「个股融资余额」标签页复用（同一缓存+重试策略）
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
    + '.dseg.d-unit button{padding:5px 8px;font-size:12px}'
    + '.drill-unithint{font-size:11.5px;color:#9aa3b5}'
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
    /* 自动档：按「当前榜单可见行」两列各自的最大绝对值选量级（列内统一、可跨列不同） */
    var U = RZQ.effUnit(rows.map(function (x) { return x.r; }));
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
      + mk(0, '#') + mk(1, '名称') + mk(2, '融资余额(' + U.label + ')') + mk(3, '融资净买入(' + U.label + ')·' + GRAN_TXT[st1.gran])
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
        + '<td>' + uVal(x.r, U) + '</td>'
        + '<td class="' + cls(x.j) + '">' + uSigned(x.j, U) + '</td>'
        + '<td>' + (x.z != null ? x.z.toFixed(2) : '—') + '</td>'
        + '<td>' + fire + '</td>'
        + lastVal + '</tr>';
    });
    html += '</tbody></table></div>';
    RZQ.syncUnitBtn && RZQ.syncUnitBtn(U, m1);
    return html;
  }
  function effUForView(data) {
    var rows = (data.rows || []).filter(function (x) { return st1.view === 'etf' ? isEtf(x.c) : !isEtf(x.c); });
    return RZQ.effUnit(rows.map(function (x) { return x.r; }));
  }
  function ctrls1(U) {
    var viewOn = function (v) { return st1.view === v ? 'on' : ''; };
    var rankOn = function (r) { return st1.rank === r ? 'on' : ''; };
    var topOn = function (n) { return st1.topn === n ? 'on' : ''; };
    return '<div class="drill-ctrls" style="margin-bottom:8px">'
      + '<div class="dseg d-view"><button data-v="etf" class="' + viewOn('etf') + '">ETF</button><button data-v="stock" class="' + viewOn('stock') + '">个股</button></div>'
      + '<input class="d-q" type="text" placeholder="输代码或名称筛选" value="' + (st1.q || '').replace(/"/g, '&quot;') + '" spellcheck="false" autocomplete="off">'
      + '<div class="dseg d-unit">' + unitBtns(U && U.key) + '</div>'
      + '<div class="dseg d-rank"><button data-r="j" class="' + rankOn('j') + '">净买入最高</button><button data-r="dc" class="' + rankOn('dc') + '">减少最多</button><button data-r="r" class="' + rankOn('r') + '">余额最高</button></div>'
      + '<div class="dseg d-topn"><button data-n="10" class="' + topOn(10) + '">Top10</button><button data-n="20" class="' + topOn(20) + '">Top20</button><button data-n="50" class="' + topOn(50) + '">Top50</button></div>'
      + '</div>';
  }
  function body1(data, allThemes) {
    autoView(data);
    return ctrls1(effUForView(data)) + tbl1(data, allThemes);
  }
  function openModal1(date, gran, q) {
    if (q !== undefined) st1.q = q; // 个股标签页点日期时预填该代码；主表点日期传 '' 清空
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
  // 供「个股融资余额」标签页：点日期直接下钻该期融资榜，并按该代码筛选
  RZQ.openStockDate = function (date, code) { openModal1(date, granNow(), code); };

  /* ---------- 弹窗2：个股/ETF 历史走势（方案A：跟随入口粒度） ---------- */
  function chartSVG(dates, r, j, z) {
    var U = RZQ.effUnit(r);
    /* 纵轴刻度改为跟随当前档位；左侧留白加宽以容纳千分位数字 */
    var W = 680, H = 240, padL = 82, padR = 10, padT = 8, padB = 22;
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
    var rl = function (v, yy) { return '<text x="' + (padL - 6) + '" y="' + (yy + 3) + '" font-size="9.5" fill="#9aa3b5" text-anchor="end">' + fmtVal(v, U) + '</text>'; };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">'
      + '<line x1="' + padL + '" y1="' + yZero + '" x2="' + (padL + iW) + '" y2="' + yZero + '" stroke="#d7dde8" stroke-dasharray="3 3"/>'
      + bars
      + '<polyline points="' + pts + '" fill="none" stroke="#2f6bff" stroke-width="2"/>'
      + '<line class="cursor" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + iH) + '"/>'
      + '<circle class="dot" r="4" cx="0" cy="0"/>'
      + '<text x="' + padL + '" y="' + (padT + 9) + '" font-size="10" fill="#2f6bff">融资余额(' + U.label + '·纵轴)</text>'
      + '<text x="' + (padL + iW) + '" y="' + (yZero + 13) + '" font-size="10" fill="#9aa3b5" text-anchor="end">融资净买入(' + U.label + '·柱) · 悬停看明细</text>'
      + rl(rmax, padT + 8) + rl(rmin, rBot)
      + lab(dates[0], padL, 'start') + lab(dates[Math.floor(N / 2)], padL + iW / 2, 'middle') + lab(dates[N - 1], padL + iW, 'end')
      + '<rect class="ovl" x="0" y="0" width="' + W + '" height="' + H + '"/>'
      + '</svg>';
    return { svg: svg, geo: { xs: xs, rys: rys, dates: dates, r: r, j: j, z: z, U: U } };
  }
  function tbl2HTML() {
    var h = st2.geo, ds = st2.sort || { col: 0, asc: false };
    var U = h.U || RZQ.effUnit(h.r);
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
    var tbl = '<div class="mini-tbl"><table><thead><tr>' + mk2(0, '日期') + mk2(1, '融资余额(' + U.label + ')') + mk2(2, '融资净买入(' + U.label + ')·' + GRAN_TXT[st2.gran]) + mk2(3, '占流通市值(%)') + '</tr></thead><tbody>';
    rows.forEach(function (x) {
      tbl += '<tr><td class="l">' + x.dt + '</td><td>' + uVal(x.r, U) + '</td>'
        + '<td class="' + cls(x.j) + '">' + uSigned(x.j, U) + '</td>'
        + '<td>' + (x.z == null ? '—' : x.z.toFixed(2)) + '</td></tr>';
    });
    tbl += '</tbody></table></div>';
    return tbl;
  }
  function attachTip(svg, geo) {
    var ovl = svg.querySelector('.ovl'), cursor = svg.querySelector('.cursor'), dot = svg.querySelector('.dot');
    var tip = svg.closest('.sd-chart').querySelector('.chart-tip');
    var U = geo.U || RZQ.effUnit(geo.r);
    ovl.addEventListener('mousemove', function (ev) {
      var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      var bi = 0, bd = 1e9;
      geo.xs.forEach(function (x, i) { var dd = Math.abs(x - p.x); if (dd < bd) { bd = dd; bi = i; } });
      var ux = geo.xs[bi], uy = geo.rys[bi] != null ? geo.rys[bi] : 0;
      cursor.setAttribute('x1', ux); cursor.setAttribute('x2', ux); cursor.style.opacity = 1;
      dot.setAttribute('cx', ux); dot.setAttribute('cy', uy); dot.style.opacity = 1;
      tip.innerHTML = '<b>' + geo.dates[bi] + '</b><br>融资余额 ' + uVal(geo.r[bi], U) + U.label
        + '<br>融资净买入 ' + uSigned(geo.j[bi], U) + U.label
        + '<br>占流通 ' + (geo.z[bi] == null ? '—' : geo.z[bi].toFixed(2)) + '%';
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
        + '<div class="drill-unithint drill-unitcap" style="margin:5px 2px 0"></div>'
        + tbl2HTML();
      var svg = box.querySelector('svg');
      if (svg) attachTip(svg, st2.geo);
      RZQ.syncUnitCaps && RZQ.syncUnitCaps();
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
      openModal1(d, granNow(), '');
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
      if (seg.classList.contains('d-unit')) {
        if (RZQ.applyUnit) RZQ.applyUnit(segB.dataset.u);
        else { RZQ.unit = segB.dataset.u; refresh1(); }
        return;
      }
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
    if (!st1.date) return; // 尚未打开过弹窗（如仅在个股标签页切换单位）时无需重绘
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
  // 单位切换后：重绘弹窗1表格 + 弹窗2明细表（走势图几何不变，仅提示/悬停单位跟着变）
  RZQ.refreshPopups = function () {
    refresh1();
    if (st2.geo) {
      /* 弹窗2 的纵轴刻度与标注都带单位，切换档位必须连走势图一起重绘（含新 U） */
      var g = chartSVG(st2.geo.dates, st2.geo.r, st2.geo.j, st2.geo.z);
      st2.geo = g.geo;
      var mini = m2.querySelector('.mini-tbl'); if (mini) mini.outerHTML = tbl2HTML();
      var sc = m2.querySelector('.sd-chart');
      if (sc) {
        sc.innerHTML = g.svg + '<div class="chart-tip"></div>';
        var svg = sc.querySelector('svg');
        if (svg) attachTip(svg, st2.geo);
      }
    }
    if (RZQ.syncUnitCaps) RZQ.syncUnitCaps();
  };
})();

/* ==========================================================================
   「个股融资余额」标签页 —— 插在「每日融资余额」与「每日涨跌家数」之间
   数据：_rzrq_hist_d|w|m.json（底层单位「亿元」，显示层按 RZQ.unit 换算）
   交互：代码/名称联想 → 选中标的 → 走势图 + 明细表（格式同每日融资余额，表头可排序）
        跟随页面「融资统计粒度」日/周/月 与「时间段」；本页日期不提供下钻
   注：整段自注入，不改动生成器的 HTML 骨架，重建页面时不会丢失
   ========================================================================== */
(function () {
  'use strict';
  if (document.getElementById('rzq-st-css')) return; // 幂等
  var RZQ = window.RZQ;
  if (!RZQ || !RZQ.load) return;
  var G = { d: '日', w: '周', m: '月' };
  var NOTE = '① 数据源为东方财富个股两融明细，底层单位「亿元」；融资余额/占流通市值为期末快照，融资净买入为当期（日/周/月）累计。<br>'
    + '② 跟随页面「融资统计粒度」与「时间段」：日/周/月分别读取对应历史序列。<br>'
    + '③ 本页日期仅作展示，不支持下钻；点表头可排序，默认按日期降序。<br>'
    + '④ 表格四列（日期 / <b>当日融资净买入</b> / 融资余额 / 占流通市值）常驻显示，当日净买入在前、余额（累计快照）在后，与「每日融资余额」表列序一致；点表头可排序，表格行不再弹出悬浮明细。<br>'
    + '⑤ <b>金额单位（万 / 千万 / 亿）</b>：融资余额与融资净买入共用同一单位，系统按该股票融资余额规模自动选档（如四千万显示「四千」、净买入两百万显示「两百」），小额个股不再被压成 0；切换标的、粒度或时间段时重算。也可手动点选「万 / 千万 / 亿」锁定该档。<br>'
    + '⑥ 走势图蓝线 = 融资余额、红绿柱 = <b>融资净买入</b>（红正绿负），图内 / 图例 / 悬停明细均按当前单位标注；鼠标悬停（手机点按/滑动）图上任意一期 → 浮出当期数字明细。';

  /* ---------- 样式 ---------- */
  var css = ''
    + '.rzq-st-wrap{padding:10px 16px 14px}'
    + '.rzq-st-ctrls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}'
    + '.rzq-st-search{position:relative;display:flex;align-items:center;gap:6px}'
    + '.rzq-st-q{border:1px solid #dbe3ef;border-radius:8px;padding:7px 10px;font-size:13px;width:220px;outline:none;color:#1f2937;background:#fff}'
    + '.rzq-st-q:focus{border-color:#2f6bff;box-shadow:0 0 0 2px rgba(47,107,255,.12)}'
    + '.rzq-st-q::placeholder{color:#aab4c5}'
    + '.rzq-st-clear{border:1px solid #dbe3ef;background:#fff;color:#64748b;border-radius:8px;padding:7px 10px;font-size:12.5px;cursor:pointer;white-space:nowrap}'
    + '.rzq-st-clear:hover{color:#2f6bff;border-color:#2f6bff}'
    + '.rzq-st-ac{display:none;position:absolute;left:0;top:38px;width:280px;max-height:290px;overflow:auto;background:#fff;border:1px solid #dbe3ef;border-radius:9px;box-shadow:0 10px 30px rgba(31,41,55,.16);z-index:30}'
    + '.rzq-st-ac.show{display:block}'
    + '.rzq-st-ac .it{display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12.5px;cursor:pointer;border-bottom:1px solid #f3f5f9}'
    + '.rzq-st-ac .it:hover{background:#f3f7ff}'
    + '.rzq-st-ac .it .c{font-family:ui-monospace,Consolas,monospace;color:#66708a;font-size:12px}'
    + '.rzq-st-ac .it .n{color:#1f2937;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.rzq-st-ac .it .tp{font-size:10.5px;color:#9aa3b5;border:1px solid #e8edf5;border-radius:5px;padding:1px 5px;flex:0 0 auto}'
    + '.rzq-st-ac .empty{padding:10px;font-size:12px;color:#9aa3b5}'
    + '.rzq-st-hint{font-size:12px;color:#9aa3b5}'
    + '.rzq-st-hint b{color:#2f6bff}'
    + '.rzq-st-chart{border:1px solid #eef1f6;border-radius:10px;padding:10px 10px 6px;margin-bottom:10px;background:#fff}'
    /* 铺满容器：去掉 900px 上限与自动居中，交给 svg viewBox 自适应（2026-11-27） */
    + '.rzq-st-chart svg{width:100%;display:block;margin:0}'
    + '.rzq-st-legend{display:flex;flex-wrap:wrap;gap:3px 12px;align-items:center;font-size:12px;color:#64748b;padding:2px 4px 0;line-height:1.5}'
    + '.rzq-st-legend .lg{display:inline-flex;align-items:center;gap:5px;white-space:normal}'
    + '.rzq-st-legend i{display:inline-block;width:13px;height:3px;border-radius:2px;flex:0 0 auto}'
    + '.rzq-st-legend i.ln{background:#2f6bff}'
    + '.rzq-st-legend i.bp{background:linear-gradient(90deg,#e23b3b 50%,#16a34a 50%)}'
    + '.rzq-st-legend .mut{color:#9aa3b5;white-space:normal}'
    + '.rzq-st-tbl{max-height:430px;overflow:auto;border:1px solid #eef1f6;border-radius:10px}'
    + '.rzq-st-tbl table{font-size:12.5px}'
    + '.rzq-st-tbl thead th{font-size:12px;padding:7px 8px;line-height:1.3}'
    + '.rzq-st-tbl td{font-size:12.5px;padding:5px 9px}'
    + '.rzq-st-tbl .num{font-variant-numeric:tabular-nums;white-space:nowrap}'
    + '.rzq-st-tbl td.st-dt{color:#1f2937;font-weight:500;text-align:left;white-space:nowrap}'
    + /* 表格行不弹悬浮明细（仅走势图提供悬停浮层）：无 help 光标、无强调 hover */
      '.rzq-st-tip{position:fixed;z-index:70;pointer-events:none;opacity:0;transition:opacity .08s;background:rgba(31,42,68,.96);color:#fff;font-size:12px;line-height:1.65;padding:8px 11px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.28);white-space:nowrap;max-width:calc(100vw - 20px)}'
    + '.rzq-st-tip.show{opacity:1}'
    + '.rzq-st-tip b{color:#ffd479;font-size:12.5px}'
    + '.rzq-st-tip .k{display:inline-block;min-width:76px;color:#b9c6de}'
    + '.rzq-st-tip .v{font-variant-numeric:tabular-nums;font-weight:700}'
    + '.rzq-st-tip .pos{color:#ff9b9b}.rzq-st-tip .neg{color:#7ee2a8}'
    + '.rzq-st-tip .u{color:#9fb0cc;font-size:10.5px;margin-top:4px;white-space:normal}'
    + '.rzq-st-msg{padding:26px 10px!important;text-align:center!important;color:#9aa3b5;font-size:13px;line-height:1.9}'
    + '.rzq-st-note{font-size:11.5px;color:#9aa3b5;line-height:1.8;margin-top:8px}'
    + '@media(max-width:620px){'
    + '.rzq-st-wrap{padding:8px 12px 12px}'
    + '.rzq-st-q{width:158px;font-size:12.5px}'
    + '.rzq-st-ac{width:246px}'
    + '.rzq-st-chart{padding:6px 4px 4px}'
    + '.rzq-st-legend{font-size:11px;gap:2px 8px}'
    /* 手机端四列全显且不截断：短表头 + 小字号 + 窄内边距，确保「融资净买入」在首屏可见 */
    + '.rzq-st-tbl thead th{font-size:10.5px;padding:5px 3px;white-space:normal;line-height:1.25}'
    + '.rzq-st-tbl td{padding:4px 3px;font-size:11px}'
    + '.rzq-st-tbl table{font-size:11px}'
    + '.rzq-st-tbl td.st-dt{font-size:10.5px}'
    + '.rzq-st-tip{font-size:11.5px;padding:7px 9px}'
    + '.dseg.d-unit button{padding:5px 6px;font-size:11.5px}}';
  var style = document.createElement('style'); style.id = 'rzq-st-css'; style.textContent = css;
  document.head.appendChild(style);

  /* ---------- 注入标签按钮 + 面板 ---------- */
  var tabs = document.querySelector('.tbltabs'), sec = document.querySelector('.tblsec');
  if (!tabs || !sec) return;
  var uBtn = tabs.querySelector('[data-t="u"]');
  var btn = document.createElement('button');
  btn.className = 'tbtn'; btn.dataset.t = 's'; btn.textContent = '个股融资余额';
  tabs.insertBefore(btn, uBtn || null);

  var U0 = RZQ.effUnit([]); // 空窗口初始量级（万档），render() 会按真实数据立即重算
  var panel = document.createElement('div');
  panel.className = 'tpanel'; panel.id = 'tpanel-s'; panel.style.display = 'none';
  panel.innerHTML = '<div class="rzq-st-wrap">'
    + '<div class="rzq-st-ctrls">'
    + '<div class="rzq-st-search"><input class="rzq-st-q" type="text" placeholder="输入股票/ETF 代码或名称" spellcheck="false" autocomplete="off">'
    + '<button class="rzq-st-clear" type="button">清除</button><div class="rzq-st-ac"></div></div>'
    + '<div class="dseg d-unit">' + RZQ.unitBtns(U0.key) + '</div>'
    + '<span class="rzq-st-hint">金额单位：<b class="rzq-unit-txt">' + U0.label + '</b>（余额与净买入同单位，系统按个股市值自动选 万/千万/亿 档；表格/走势/下钻表格同步）</span>'
    + '</div>'
    + '<div class="rzq-st-chart"></div>'
    + '<div class="rzq-st-tbl"><table><thead><tr>'
    + '<th data-col="0">日期</th><th data-col="2">融资净买入(' + U0.label + ')</th>'
    + '<th data-col="1">融资余额(' + U0.label + ')</th><th data-col="3">占流通市值(%)</th>'
    + '</tr></thead><tbody id="tbody-s"></tbody></table></div>'
    + '<div class="rzq-st-note">' + NOTE + '</div>'
    + '<div class="rzq-st-tip"></div>'
    + '</div>';
  sec.appendChild(panel);

  var q = panel.querySelector('.rzq-st-q');
  var ac = panel.querySelector('.rzq-st-ac');
  var S = { gran: 'd', range: 'm3', code: '', name: '', h: {}, idx: null, sort: { col: 0, asc: false }, busy: false };

  /* ---------- 走势图悬停明细浮层（表格行不再弹出浮层，2026-11-06 定稿） ---------- */
  var tip = panel.querySelector('.rzq-st-tip');
  document.body.appendChild(tip); // 移出 .tblsec(overflow:hidden)，fixed 浮层不被裁剪
  var tipRow = null, tipPinned = false;
  function detailHTML(x, U) {
    U = U || RZQ.effUnit([x.r]);
    var jc = (x.j == null || isNaN(x.j)) ? '' : (x.j >= 0 ? 'pos' : 'neg');
    return '<b>' + esc(x.dt || '') + '</b>'
      + '<div><span class="k">融资余额</span><span class="v">' + RZQ.uVal(x.r, U) + '</span> ' + U.label + '</div>'
      + '<div><span class="k">融资净买入</span><span class="v ' + jc + '">' + RZQ.uSigned(x.j, U) + '</span> ' + U.label + ' · ' + G[S.gran] + '</div>'
      + '<div><span class="k">占流通市值</span><span class="v">' + (x.z == null || isNaN(x.z) ? '—' : x.z.toFixed(2)) + '</span> %</div>';
  }
  function placeTip(x, y) {
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (left < 8) left = 8;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    if (top < 8) top = 8;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hideTip() { tip.classList.remove('show'); tipRow = null; tipPinned = false; }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && !e.target.closest('#tpanel-s')) hideTip();
  });
  var rsTimer = null;
  window.addEventListener('resize', function () {
    hideTip();
    if (rsTimer) clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { if (isActive()) render(); }, 160); // 手机/桌面切换时重算表头短标签
  });

  function isEtf(c) { return /^(15|16|51|52|53|56|58)/.test(c); }
  function isActive() { return panel.style.display !== 'none'; }
  function granNow() { var on = document.querySelector('#segG button.on'); return (on && on.dataset.g) || 'd'; }
  function buildIndex(h) {
    return Object.keys(h.stocks).map(function (c) { return { c: c, n: (h.stocks[c] && h.stocks[c].n) || '', etf: isEtf(c) }; });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------- 载入历史序列（懒加载，按粒度缓存） ---------- */
  function showMsg(txt) {
    hideTip();
    var tb = panel.querySelector('#tbody-s');
    if (tb) tb.innerHTML = '<tr><td colspan="4" class="rzq-st-msg">' + txt + '</td></tr>';
    var cb = panel.querySelector('.rzq-st-chart');
    if (cb) { cb.style.display = 'none'; cb.innerHTML = ''; }
  }
  function ensureLoad() {
    S.gran = granNow();
    if (S.h[S.gran]) { S.idx = buildIndex(S.h[S.gran]); render(); return; }
    if (S.busy) return;
    S.busy = true;
    showMsg('个股历史序列加载中…');
    RZQ.load('_rzrq_hist_' + S.gran + '.json').then(function (h) {
      S.busy = false; S.h[S.gran] = h; S.idx = buildIndex(h); S.gran = granNow();
      render();
      if (q.value.trim() && !S.code) showAc(q.value.trim());
    }).catch(function (e) {
      S.busy = false;
      showMsg('<span style="color:#e23b3b">数据加载失败：' + esc(e.message) + '</span>');
    });
  }
  function activate(t) {
    document.querySelectorAll('.tbtn').forEach(function (b) { b.classList.toggle('active', b.dataset.t === t); });
    document.querySelectorAll('.tpanel').forEach(function (p) { p.style.display = (p.id === 'tpanel-' + t) ? 'block' : 'none'; });
    if (t === 's') ensureLoad();
  }
  btn.addEventListener('click', function () { activate('s'); });

  /* ---------- 搜索联想 ---------- */
  function matches(qs) {
    if (!S.idx || !qs) return [];
    var s = qs.toLowerCase();
    var exact = [], pref = [], nm = [];
    S.idx.forEach(function (x) {
      if (x.c === s) exact.push(x);
      else if (x.c.indexOf(s) === 0) pref.push(x);
      else if (x.n.toLowerCase().indexOf(s) >= 0) nm.push(x);
    });
    return exact.concat(pref, nm).slice(0, 12);
  }
  function showAc(qs) {
    var list = matches(qs);
    if (!qs) { ac.classList.remove('show'); ac.innerHTML = ''; return; }
    ac.innerHTML = list.length
      ? list.map(function (x) { return '<div class="it" data-c="' + x.c + '"><span class="c">' + x.c + '</span><span class="n">' + esc(x.n) + '</span><span class="tp">' + (x.etf ? 'ETF' : '个股') + '</span></div>'; }).join('')
      : '<div class="empty">无匹配标的（可试试 6 位代码或简称）</div>';
    ac.classList.add('show');
  }
  function pick(code) {
    var it = S.idx && S.idx.filter(function (x) { return x.c === code; })[0];
    if (!it) return;
    S.code = it.c; S.name = it.n;
    RZQ.code = it.c; RZQ.name = it.n;
    /* 选中后输入框显示名称而非代码（2026-11-27 用户定稿）；代码保留在 data-code，供回归/外部读取 */
    q.value = it.n || it.c;
    q.dataset.code = it.c;
    q.title = it.c + (it.n ? ' · ' + it.n : '');
    ac.classList.remove('show'); ac.innerHTML = '';
    render();
  }
  var qTimer = null;
  q.addEventListener('input', function () {
    var v = q.value.trim();
    if (qTimer) clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      if (!S.idx) { ensureLoad(); return; }
      if (/^\d{6}$/.test(v) && S.idx.some(function (x) { return x.c === v; })) { pick(v); return; }
      /* 选中后框内是名称，须与 S.name 比对；否则每次 input 都会误把已选标的清掉 */
      if (S.code && v !== S.code && v !== S.name) {
        S.code = ''; S.name = ''; RZQ.code = ''; RZQ.name = '';
        q.removeAttribute('data-code'); q.removeAttribute('title');
      }
      showAc(v);
      render();
    }, 180);
  });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var it = ac.querySelector('.it'); if (it) pick(it.dataset.c); }
    else if (e.key === 'Escape') ac.classList.remove('show');
  });
  q.addEventListener('focus', function () { if (q.value.trim()) showAc(q.value.trim()); });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && !e.target.closest('.rzq-st-search')) ac.classList.remove('show');
  });

  /* ---------- 表格 / 走势 / 信息条 ---------- */
  function startIdx(h) {
    var ds = h.dates, n = ds.length, st = null;
    try { if (typeof CD !== 'undefined' && typeof cur !== 'undefined' && CD[cur]) st = CD[cur]; } catch (e) {}
    if (st) { for (var i = 0; i < n; i++) if (ds[i] >= st) return i; return 0; }
    return S.range === 'm1' ? Math.max(0, n - 22) : 0;
  }
  function jcls(v) { return v == null || isNaN(v) ? '' : (v >= 0 ? 'pos' : 'neg'); }
  function cmp(a, b) {
    var c = S.sort.col, va, vb;
    if (c === 0) { va = a.dt; vb = b.dt; }
    else if (c === 1) { va = a.r; vb = b.r; }
    else if (c === 2) { va = a.j; vb = b.j; }
    else { va = a.z; vb = b.z; }
    var an = (va == null || (typeof va === 'number' && isNaN(va))), bn = (vb == null || (typeof vb === 'number' && isNaN(vb)));
    if (an && bn) return 0;
    if (an) return 1;   // 空值恒定排末尾
    if (bn) return -1;
    var r = (typeof va === 'string') ? va.localeCompare(vb) : (va - vb);
    return S.sort.asc ? r : -r;
  }
  function syncHeadSort() {
    panel.querySelectorAll('.rzq-st-tbl thead th').forEach(function (th) {
      var on = (+th.dataset.col === S.sort.col);
      th.classList.toggle('sort-asc', on && S.sort.asc);
      th.classList.toggle('sort-desc', on && !S.sort.asc);
    });
  }
  /* 横轴刻度（2026-11-27）：日/周＝首末完整日期＋中间按可用宽度抽稀；
     月＝逐月「1月…11月」全部标出；带粗略包围盒防重叠，首末必经保留。 */
  function xTicks(rows, gran, x0, iw, y) {
    var n = rows.length, placed = [], out = '';
    var xf = function (i) { return x0 + iw * i / ((n - 1) || 1); };
    function wid(t) { return t.length * (t.indexOf('-') >= 0 ? 7.3 : 6.9) + 8; }
    function add(i, t, a) {
      var x = xf(i), w = wid(t);
      var l = a === 'start' ? x : (a === 'end' ? x - w : x - w / 2);
      var b = { l: l, r: l + w, x: x, t: t, a: a };
      for (var k = 0; k < placed.length; k++) {
        var o = placed[k];
        if (b.r > o.l - 6 && o.r > b.l - 6) return false;
      }
      placed.push(b); return true;
    }
    if (gran === 'm') {
      rows.forEach(function (r, i) { add(i, (+r.dt.slice(5, 7) || 0) + '月', 'middle'); });
    } else {
      add(0, rows[0].dt, 'start');
      add(n - 1, rows[n - 1].dt, 'end');
      var budget = Math.max(3, Math.floor(iw / 96));
      var step = Math.max(1, Math.ceil((n - 1) / (budget + 1)));
      for (var i = step; i < n - 1; i += step) add(i, rows[i].dt.slice(5), 'middle');
    }
    placed.forEach(function (b) {
      out += '<text x="' + b.x.toFixed(1) + '" y="' + y + '" font-size="12" fill="#9aa3b5" text-anchor="' + b.a + '">' + b.t + '</text>';
    });
    return out;
  }
  /* 走势图：蓝线=融资余额（上半部），红绿柱=融资净买入（下半部，红正绿负）；
     与二级弹窗走势图同一范式；悬停任意一期浮出当期数字明细。 */
  function spark(rows, U) {
    U = U || RZQ.effUnit(rows.map(function (x) { return x.r; }));
    var vals = rows.map(function (x) { return x.r; }).filter(function (v) { return v != null && !isNaN(v); });
    if (vals.length < 2) { S.geo = null; return ''; }
    /* 铺满版（2026-11-27）：viewBox 1000×300、左边距 66（原 120/560），外层已去掉 900px 上限 */
    var W = 1000, H = 300, pl = 66, pr = 22, pt = 30, pb = 42;
    var iw = W - pl - pr, ih = H - pt - pb, bottom = pt + ih;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var pad = (mx - mn) * 0.12 || Math.abs(mx || 1) * 0.02;
    var lo = mn - pad, hi = mx + pad;
    var lineBot = pt + ih * 0.60, zeroY = pt + ih * 0.80, barH = ih * 0.16;
    var dabs = 1e-9;
    rows.forEach(function (x) { if (x.j != null && !isNaN(x.j)) dabs = Math.max(dabs, Math.abs(x.j)); });
    var xx = function (i) { return pl + iw * i / (rows.length - 1); };
    var yy = function (v) { return lineBot - (lineBot - pt) * ((v - lo) / ((hi - lo) || 1)); };
    var pts = [];
    rows.forEach(function (x, i) { if (x.r != null && !isNaN(x.r)) pts.push([xx(i), yy(x.r)]); });
    var pstr = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var grid = '';
    for (var k = 0; k <= 2; k++) {
      var gv = lo + (hi - lo) * k / 2;
      grid += '<line x1="' + pl + '" y1="' + yy(gv).toFixed(1) + '" x2="' + (pl + iw) + '" y2="' + yy(gv).toFixed(1) + '" stroke="#eef1f6" stroke-width="1"/>'
        + '<text x="' + (pl - 8) + '" y="' + (yy(gv) + 4).toFixed(1) + '" font-size="12.5" fill="#9aa3b5" text-anchor="end">' + RZQ.uVal(gv, U) + '</text>';
    }
    var bars = '';
    rows.forEach(function (x, i) {
      if (x.j == null || isNaN(x.j)) return;
      var bw = Math.max(2.5, iw / rows.length * 0.56);
      var bh = Math.max(0.8, Math.abs(x.j) / dabs * barH);
      var by = x.j >= 0 ? zeroY - bh : zeroY;
      bars += '<rect x="' + (xx(i) - bw / 2).toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1)
        + '" height="' + bh.toFixed(1) + '" fill="' + (x.j >= 0 ? '#e23b3b' : '#16a34a') + '" opacity="0.85"/>';
    });
    var first = pts[0], last = pts[pts.length - 1];
    var area = pstr + ' ' + last[0].toFixed(1) + ',' + lineBot + ' ' + first[0].toFixed(1) + ',' + lineBot;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">'
      + grid
      + '<line x1="' + pl + '" y1="' + zeroY.toFixed(1) + '" x2="' + (pl + iw) + '" y2="' + zeroY.toFixed(1) + '" stroke="#d7dde8" stroke-dasharray="3 3"/>'
      + bars
      + '<polygon points="' + area + '" fill="rgba(47,107,255,.09)"/>'
      + '<polyline points="' + pstr + '" fill="none" stroke="#2f6bff" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'
      + '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4.5" fill="#2f6bff"/>'
      + '<text x="' + pl + '" y="' + (pt - 10) + '" font-size="12.5" fill="#2f6bff">'
      +   (S.name ? esc(S.name) + ' · ' : '') + '融资余额 · ' + U.label + ' · 共 ' + rows.length + ' 期</text>'
      + '<text x="' + (pl + iw) + '" y="' + (pt - 10) + '" font-size="12" fill="#9aa3b5" text-anchor="end">融资净买入 · ' + U.label + ' · 红正/绿负</text>'
      + xTicks(rows, S.gran, pl, iw, H - 12)
      + '<line class="st-cursor" x1="0" y1="' + pt + '" x2="0" y2="' + bottom + '" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3 3" style="opacity:0"/>'
      + '<circle class="st-dot" r="5" cx="0" cy="0" fill="#2f6bff" stroke="#fff" stroke-width="1.5" style="opacity:0"/>'
      + '<rect class="st-ovl" x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent" pointer-events="all"/>'
      + '</svg>';
    S.geo = {
      rows: rows, pt: pt, bottom: bottom, U: U,
      xs: rows.map(function (_, i) { return xx(i); }),
      ys: rows.map(function (x) { return x.r == null || isNaN(x.r) ? null : yy(x.r); })
    };
    return svg;
  }
  function attachStChart(box, geo) {
    var svg = box.querySelector('svg'), ovl = svg && svg.querySelector('.st-ovl');
    if (!ovl) return;
    var cursor = svg.querySelector('.st-cursor'), dot = svg.querySelector('.st-dot');
    function onMove(ev) {
      var src = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
      var ctm = svg.getScreenCTM && svg.getScreenCTM();
      if (!ctm || !svg.createSVGPoint) return;
      var p = svg.createSVGPoint(); p.x = src.clientX; p.y = src.clientY;
      var loc = p.matrixTransform(ctm.inverse());
      var bi = 0, bd = 1e9;
      geo.xs.forEach(function (x, i) { var d = Math.abs(x - loc.x); if (d < bd) { bd = d; bi = i; } });
      var ux = geo.xs[bi], uy = geo.ys[bi] != null ? geo.ys[bi] : geo.pt;
      cursor.setAttribute('x1', ux); cursor.setAttribute('x2', ux); cursor.style.opacity = 1;
      dot.setAttribute('cx', ux); dot.setAttribute('cy', uy); dot.style.opacity = 1;
      tipRow = null; tipPinned = false;   // 图表期次内容，禁用表格行缓存
      tip.innerHTML = detailHTML(geo.rows[bi], geo.U);
      tip.classList.add('show');
      placeTip(src.clientX, src.clientY);
    }
    function onLeave() { cursor.style.opacity = 0; dot.style.opacity = 0; hideTip(); }
    ovl.addEventListener('mousemove', onMove);
    ovl.addEventListener('mouseleave', onLeave);
    ovl.addEventListener('touchstart', onMove, { passive: true });
    ovl.addEventListener('touchmove', onMove, { passive: true });
  }
  function stLegend(U) {
    return '<div class="rzq-st-legend">'
      + '<span class="lg"><i class="ln"></i>蓝线：融资余额（' + U.label + '）</span>'
      + '<span class="lg"><i class="bp"></i>柱：融资净买入（' + U.label + ' · 红=正 / 绿=负）</span>'
      + '<span class="mut">悬停图上任意一期看当期数字明细（' + U.label + '）</span></div>';
  }
  function headLabels(U) {
    var mob = window.matchMedia && window.matchMedia('(max-width:620px)').matches;
    /* 手机端用短表头（单位在上方「金额单位」提示条中给出），四列全部常驻、不隐藏、不截断 */
    return mob
      ? ['日期', '融资净买入', '融资余额', '占流通']
      : ['日期', '融资净买入(' + U.label + ')·' + G[S.gran], '融资余额(' + U.label + ')', '占流通市值(%)'];
  }
  function render() {
    if (!panel) return;
    hideTip(); // 重绘后旧浮层内容失效（单位/粒度/排序可能已变）
    var chartBox = panel.querySelector('.rzq-st-chart');
    var tbody = panel.querySelector('#tbody-s');
    var h = S.h[S.gran], rows = [], noPick = !(h && S.code && h.stocks[S.code]);
    if (!noPick) {
      var rec = h.stocks[S.code], ds = h.dates, si = startIdx(h);
      for (var i = si; i < ds.length; i++) rows.push({ dt: ds[i], r: rec.r[i], j: rec.j[i], z: rec.z[i] });
    }
    /* 自动档：按「当前个股融资余额窗口最大值」选单一档位，余额与净买入共用同一单位 */
    var U = RZQ.effUnit(rows.map(function (x) { return x.r; }));
    RZQ._lastU = U;
    var HL = headLabels(U);
    panel.querySelectorAll('.rzq-st-tbl thead th').forEach(function (th, i) { if (HL[i] != null) th.textContent = HL[i]; });
    syncHeadSort();
    RZQ.syncUnitCaps && RZQ.syncUnitCaps();
    RZQ.syncUnitBtn && RZQ.syncUnitBtn(U, panel);

    if (noPick || !rows.length) {
      chartBox.style.display = 'none'; chartBox.innerHTML = '';
      tbody.innerHTML = '<tr><td colspan="4" class="rzq-st-msg">'
        + (noPick ? '输入 6 位代码或名称（支持个股与 ETF）<br>例如 601318 / 中国平安 / 511360 / 短融ETF，选中后展示' + G[S.gran] + '度融资余额明细' : '该时间段内暂无数据')
        + '</td></tr>';
      return;
    }
    var sv = spark(rows, U);
    chartBox.style.display = sv ? 'block' : 'none';
    chartBox.innerHTML = sv ? sv + stLegend(U) : '';
    if (sv && S.geo) attachStChart(chartBox, S.geo);
    var sorted = rows.slice().sort(cmp);
    tbody.innerHTML = sorted.length
      ? sorted.map(function (x) {
          return '<tr>'
            + '<td class="st-dt">' + x.dt + '</td>'
            /* 2026-11-27：当日净买入在前、融资余额（累计快照）在后，与主页「每日融资余额」列序一致 */
            + '<td class="num ' + jcls(x.j) + '">' + RZQ.uSigned(x.j, U) + '</td>'
            + '<td class="num">' + RZQ.uVal(x.r, U) + '</td>'
            + '<td class="num">' + (x.z == null || isNaN(x.z) ? '—' : x.z.toFixed(2)) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="4" class="rzq-st-msg">该时间段内暂无数据</td></tr>';
  }

  /* ---------- 事件：面板内点击 / 粒度 / 区间 ---------- */
  panel.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var hit = e.target.closest('.rzq-st-ac .it');
    if (hit) { pick(hit.dataset.c); return; }
    if (e.target.closest('.rzq-st-clear')) {
      q.value = ''; S.code = ''; S.name = ''; RZQ.code = ''; RZQ.name = '';
      q.removeAttribute('data-code'); q.removeAttribute('title');
      ac.classList.remove('show'); render(); return;
    }
    var th = e.target.closest('.rzq-st-tbl thead th');
    if (th) {
      var col = +th.dataset.col;
      if (S.sort.col === col) S.sort.asc = !S.sort.asc; else S.sort = { col: col, asc: false };
      render(); return;
    }
    if (e.target.closest('.rzq-st-chart')) return; // 走势图内点击/触屏由图表悬停逻辑接管，不关闭浮层
    hideTip(); // 表格行点击不再弹出明细浮层（2026-11-06 用户定稿）
  });
  document.querySelectorAll('#segG button').forEach(function (b) {
    b.addEventListener('click', function () { S.gran = b.dataset.g; if (isActive()) ensureLoad(); });
  });
  document.querySelectorAll('.rng-btn').forEach(function (b) {
    b.addEventListener('click', function () { S.range = b.dataset.range; if (isActive()) render(); });
  });

  /* ---------- 与下钻弹窗共享：单位切换 / 说明文案 ---------- */
  RZQ.rerender = render;
  RZQ.syncUnitCaps = function () {
    var U = RZQ._lastU || (RZQ.effUnit && RZQ.effUnit([])) || { label: '万' };
    var txt = U.label;
    document.querySelectorAll('.rzq-unit-txt').forEach(function (el) { el.textContent = txt; });
    document.querySelectorAll('.drill-unitcap').forEach(function (el) {
      el.innerHTML = '金额单位：<b>' + txt + '</b>（余额与净买入同单位，系统按个股市值自动选 万/千万/亿 档；切换标的/榜单/粒度会重算）；走势图柱高为相对比例，纵轴刻度随档位换算';
    });
  };
  RZQ.applyUnit = function (u) {
    if (!/^(w|q|y)$/.test(u) || RZQ.unit === u) return;
    RZQ.unit = u;
    document.querySelectorAll('.dseg.d-unit button').forEach(function (b) { b.classList.toggle('on', b.dataset.u === u); });
    if (RZQ.rerender) RZQ.rerender();
    if (RZQ.refreshPopups) RZQ.refreshPopups();
    RZQ.syncUnitCaps();
  };
  // 底部口径说明补一句，避免与新标签页的表述冲突
  try {
    var dnote = document.querySelector('.descfold .note');
    if (dnote && (dnote.innerHTML || '').indexOf('个股融资余额') < 0) {
      dnote.innerHTML = (dnote.innerHTML || '').replace('「融资余额 / 涨跌家数」', '「每日融资余额 / 个股融资余额 / 涨跌家数」')
        + '<br>⑤ <b>个股融资余额</b>标签页可查询个股/ETF 的日/周/月融资余额与融资净买入；金额单位（万/千万/亿）——系统按该股票的融资余额规模自动选档，且融资余额与融资净买入共用同一单位（如四千万显示「四千」、净买入两百万显示「两百」）；也可手动点选「万/千万/亿」锁定该档，下钻弹窗表格与走势图刻度同步。';
    }
  } catch (e) {}
  render();
  RZQ.syncUnitCaps();
})();


/* ===== 宽基ETF净资金流 标签页（表格部分；图表已移到主图下方由 _build_final_v2.py 生成） ===== */
(function(){
  if (typeof RZQ === 'undefined') return;
  var tabs = document.querySelector('.tbltabs');
  var sec = document.querySelector('.tblsec');
  if (!tabs || !sec) return;
  var uBtn = tabs.querySelector('[data-t="u"]');
  if (!uBtn) return;

  var IDX = ["沪深300","中证A500","上证50","中证500","中证1000","科创50","创业板指","中证2000","科创100","创业板50","上证指数","深证成指"];

  var css = ''
    + '.etf-top{padding:6px 2px 2px}'
    + '.etf-note2{font-size:12px;color:#66708a;line-height:1.6;margin:8px 2px 0}'
    + '.etf-note2 summary{cursor:pointer;font-weight:600;color:#475569;padding:6px 2px}'
    + '.etf-note2[open] summary{margin-bottom:4px}'
    + '.etf-tblwrap{max-height:520px;overflow:auto;border:1px solid #eef1f6;border-radius:10px}'
    + 'table.etf-table{border-collapse:collapse;width:100%;font-size:14px}'
    + 'table.etf-table.dim-etf{min-width:1160px}'
    + 'table.etf-table.dim-etf th,table.etf-table.dim-etf td{padding:9px 7px}'
    + 'table.etf-table.dim-etf td.chg{font-variant-numeric:tabular-nums}'
    + 'table.etf-table th,table.etf-table td{padding:9px 14px;border-bottom:1px solid #eef1f5;white-space:nowrap;text-align:right}'
    + 'table.etf-table th{background:#f8fafc;color:#64748b;font-weight:600;text-align:center;position:sticky;top:0;cursor:default}'
    + 'table.etf-table th:first-child,table.etf-table td:first-child{text-align:left}'
    /* 第一列冻结：横向滚动时名称/日期/指数列固定；表头左上角同时粘住 top+left */
    + 'table.etf-table th{z-index:3}'
    + 'table.etf-table th:first-child,table.etf-table td:first-child{position:sticky;left:0;z-index:2;background:#fff;box-shadow:1px 0 0 #eef1f5}'
    + 'table.etf-table th:first-child{z-index:4;background:#f8fafc}'
    + 'table.etf-table tbody tr:hover td:first-child{background:#f3f7ff}'
    + 'table.etf-table tbody tr.etf-sub td:first-child{position:static;box-shadow:none;background:#fafbfe}'
    /* ETF表头排序：⇅灰(可排)/↓蓝(降)/↑蓝(升)，禁▲▼ */
    + '#tpanel-e thead th[data-sk]{cursor:pointer;user-select:none}'
    + '#tpanel-e thead th[data-sk]::after{content:" ⇅";font-size:.72em;color:#aab4c5;margin-left:3px;font-weight:400}'
    + '#tpanel-e thead th[data-sk].sk-asc::after{content:" ↑";color:#2f6bff}'
    + '#tpanel-e thead th[data-sk].sk-desc::after{content:" ↓";color:#2f6bff}'
    + 'table.etf-table tbody tr.daterow{cursor:pointer}'
    + 'table.etf-table tbody tr.daterow:hover{background:#f3f7ff}'
    + 'table.etf-table tbody tr.daterow td:first-child{color:#2f6bff;font-weight:600}'
    + '.etf-pos{color:#e5484d}.etf-neg{color:#2f9e44}'
    + '.etf-sub{background:#fafbfe}'
    + '.etf-sub table{font-size:14px;border-collapse:collapse;width:100%}'
    + '.etf-sub table th,.etf-sub table td{padding:9px 14px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap}'
    + '.etf-sub table th{background:#f1f5fb;color:#66708a;font-weight:600}'
    + '.etf-sub table th:first-child,.etf-sub table td:first-child{text-align:left}'
    + '.etf-sub-in{max-width:100%;overflow-x:auto}'
    + '.etf-sub tr.idxrow{cursor:pointer}.etf-sub tr.idxrow:hover{background:#f3f7ff}.etf-sub tr.idxrow td:first-child{color:#2f6bff}'
    + '.etf-sub .etf-pos{color:#e5484d}.etf-sub .etf-neg{color:#2f9e44}'
    + '.etf-sub .code{font-family:ui-monospace,Menlo,Consolas,monospace;color:#66708a}'
    + 'table.etf-table tbody tr.etfdrill{cursor:pointer}.etf-sub tbody tr.etfdrill{cursor:pointer}'
    + 'table.etf-table tbody tr.etfdrill:hover{background:#f3f7ff}.etf-sub tbody tr.etfdrill:hover{background:#f3f7ff}'
    + 'tr.etfdrill td.nm .nmt{color:#2f6bff}'
    + '.etf-sub td.nm .nmt,table.etf-table td.nm .nmt{font-weight:600;color:#2f6bff}'
    + '.etf-sub td.nm .subcode,table.etf-table td.nm .subcode{display:block;font-family:"SF Mono",Consolas,Menlo,monospace;font-size:10.5px;color:#9aa3b5;margin-top:2px;font-weight:400;white-space:nowrap}'
    + '.etf-msg{padding:18px;color:#66708a;font-size:13px;text-align:center}'
    + '.eth-mini{display:none}'
    + '.etf-dim{display:flex;gap:6px;align-items:center;padding:8px 2px 0}'
    + '.etf-dim .lbl{font-size:12px;color:#64748b;margin-right:2px}'
    + '.etf-dim button{font-size:12px;padding:4px 12px;border:1px solid #cbd5e1;background:#fff;color:#64748b;border-radius:6px;cursor:pointer}'
    + '.etf-dim button.on{background:#2f6bff;color:#fff;border-color:#2f6bff}'
    + '.etf-subtabs{display:flex;gap:6px;margin:4px 2px 6px}'
    + '.etf-subtabs button{font-size:11.5px;padding:3px 10px;border:1px solid #cbd5e1;background:#fff;color:#64748b;border-radius:5px;cursor:pointer}'
    + '.etf-subtabs button.on{background:#0f766e;color:#fff;border-color:#0f766e}'
    + '@media(max-width:620px){table.etf-table{table-layout:auto}table.etf-table th:first-child,table.etf-table td:first-child{min-width:88px}table.etf-table.dim-etf th:first-child,table.etf-table.dim-etf td:first-child{min-width:clamp(112px,34vw,148px)}table.etf-table.dim-etf td.nm{white-space:normal;line-height:1.35}table.etf-table.dim-etf td.nm .nmt{display:block}table.etf-table th,table.etf-table td{padding:8px 4px;font-size:13.5px}.etf-sub table th,.etf-sub table td{padding:8px 4px;font-size:13.5px}.eth-full{display:inline}.eth-mini{display:none}.etf-tblwrap{max-height:440px}#tpanel-e .tblbox{padding:6px 8px 8px}}'
    + '@media(max-width:360px){table.etf-table th,table.etf-table td{padding:8px 1px}#tpanel-e .tblbox{padding:6px 0 8px}}'
    + '@media(max-width:620px){table.etf-table.dim-etf{min-width:1560px}table.etf-table.dim-etf td.chg{font-size:13px}.etfdays-in table{table-layout:fixed}.etfdays-in th,.etfdays-in td{padding:7px 3px;font-size:12.5px}.etf-sub .etfmini{table-layout:fixed}.etf-sub .etfmini th,.etf-sub .etfmini td{padding:6px 2px;font-size:11.5px}}';
  if (!document.getElementById('etf-tab-css')) {
    var st = document.createElement('style'); st.id='etf-tab-css'; st.textContent = css; document.head.appendChild(st);
  }

  var eBtn = document.createElement('button');
  eBtn.className='tbtn'; eBtn.dataset.t='e'; eBtn.textContent='宽基ETF净资金流';
  tabs.insertBefore(eBtn, uBtn);

  var panel = document.createElement('div');
  panel.className='tpanel'; panel.id='tpanel-e'; panel.style.display='none';
  panel.innerHTML =
    '<div class="etf-dim"><span class="lbl">整理维度：</span><button data-dim="d" class="on">按日期</button><button data-dim="e">按ETF</button><button data-dim="i">按宽基指数</button></div>'
    + '<div class="tblbox"><div class="etf-tblwrap"><table class="etf-table"><thead><tr id="etfHead">'
    +   '<th>日期</th><th><span class="eth-full">当日净申购(亿元)</span><span class="eth-mini">当日(亿元)</span></th><th><span class="eth-full">当日份额增减(亿份)</span><span class="eth-mini">份额(亿份)</span></th><th><span class="eth-full">份额存量(亿份)</span><span class="eth-mini">存量(亿份)</span></th><th><span class="eth-full">纳入指数</span><span class="eth-mini">指数</span></th>'
    + '</tr></thead><tbody id="etfTbody"></tbody></table></div></div>'
    + '<details class="etf-note2"><summary>表格口径与数据说明（默认折叠，点击展开）</summary><div>12 宽基指数 · 30 只头部 ETF 净申购明细（全市场净申购，非汇金独占）。列口径：<b>净申购(亿元)</b>＝iFinD 份额法净流入金额；<b>份额增减(亿份)</b>＝基金份额存量差分并<b>剔除份额拆分</b>（真实申赎，负=净赎回；拆分日显示「—」）；<b>份额存量(亿份)</b>＝该时点基金总份额（<b>未复权真实值</b>，与图表蓝线的「前复权」口径不同，图表蓝线末端与本列一致）。跟随图表下方「统计粒度」与 ETF 图时间段：日=当日、周=本周累计、月=本月累计（净申购与份额增减取周期累加，份额存量取周期末快照）。<b>整理维度</b>默认按日期（跟随统计粒度与ETF图时间段）；切「按宽基指数」同样<b>跟随统计粒度与ETF图时间段的最新周期</b>（日＝当日、周/月＝当周/当月累计；存量＝周期末基金总份额）。点指数后可选「按日期」（视窗内逐日明细，固定按日）或「按ETF」（成分 ETF 跟随统计粒度的周期累计/存量）。<b>点任一 ETF 名称</b>（按ETF维度／按日期下钻第2层／按宽基指数下钻的ETF子表）可展开<b>该 ETF 逐日明细</b>（视窗内、固定按日：当日净申购／当日份额增减／份额存量）。<b>「按ETF」维度</b>在份额存量后附 <b>当日／5日／10日／20日／60日／120日／250日涨幅</b>（前复权净值，截至数据最新交易日；当日＝相对上一交易日、N日＝相对 N 个交易日前，上市不足显示「—」），各列均可点表头排序、首次降序。<b>当日成交(亿)</b>与<b>ETF规模·市值(亿)</b>取自腾讯行情快照（规模＝总市值；盘中成交为截至查询时刻的累计额，收盘后为全日额）。份额数据源：iFinD 基金日频「基金份额」，全历史逐日拉取。</div></details>';
  sec.appendChild(panel);

  var DATA=null, tbody=panel.querySelector('#etfTbody'), dim='d';

  function fmtAxis(v){ if(v==null) return '—'; var a=Math.abs(v); if(a>=10000) return (v/10000).toFixed(2)+'万亿'; return v.toFixed(2); }
  function sign2(v){ if(v==null) return '—'; return (v>=0?'+':'')+v.toFixed(2); }
  function cls2(v){ return v==null?'':(v>=0?'etf-pos':'etf-neg'); }
  /* ===== ETF 份额数据：_etf_shares.json（iFinD 日频基金份额，亿份）=====
     sh=真实存量；dsh=当日增减（已剔除拆分）；拆分日增减为 null 显示「—」。
     异步加载，失败不阻断表格；加载完成后如无展开子表则重绘回填。 */
  var SHARE=null, SHARING=false;
  function ensureShares(){
    if(SHARE||SHARING) return;
    SHARING=true;
    RZQ.load('_etf_shares.json').then(function(d){ SHARE=d||{}; })
      .catch(function(){ SHARE={}; })
      .then(function(){
        if(!DATA) return;
        if(!panel.querySelector('tr.etf-sub')) renderTable();  /* 无展开子表才重绘，避免清掉用户下钻 */
      });
  }
  function fmtSh(v){ if(v==null) return '—'; return v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function shareArr(c){ return (SHARE&&SHARE.etf&&SHARE.etf[c])||null; }
  function shareIdx(name){ return (SHARE&&SHARE.idx&&SHARE.idx[name])||null; }
  function shareTotal(){ return (SHARE&&SHARE.total)||null; }
  /* ===== ETF 区间涨幅（前复权净值，截至数据最新交易日）=====
     两套数据源结构不同：HTML 注入 ETF_CLOSES={code:[净值...]}；
     按需拉取的 _etf_close_2012.json={dates:[...],close:{code:[...]}}。
     涨幅只取净值序列自身最后有值日往前 n 根，不要求与资金流日期轴等长。 */
  var CHG=null, CLOSING=false;
  function ensureCloses(){
    if(CHG) return;
    if(typeof ETF_CLOSES!=='undefined' && ETF_CLOSES && DATA){
      var c=DATA.etf&&DATA.etf[0]&&DATA.etf[0].code, a=c&&ETF_CLOSES[c];
      if(a && a.length && a.some(function(v){ return v!=null; })){ CHG=ETF_CLOSES; return; }
    }
    if(CLOSING) return;
    CLOSING=true;
    RZQ.load('_etf_close_2012.json').then(function(d){
      /* 兼容 {dates,close} 与直接的 {code:[...]} 两种结构，避免整包当 code 映射导致全列「—」 */
      CHG=(d && d.close && typeof d.close==='object' && !Array.isArray(d.close)) ? d.close : (d||{});
    })
      .catch(function(){ CHG={}; })
      .then(function(){ if(DATA && dim==='e') renderTable(); });
  }
  /* n=1 当日（最近交易日相对上一交易日）；n=5/10/… 相对 n 个交易日前。新ETF不足历史返回 null */
  function chgOf(code,n){
    if(!CHG) return null;
    var a=CHG[code]; if(!a||!a.length) return null;
    var e=-1;
    for(var i=a.length-1;i>=0;i--){ if(a[i]!=null){ e=i; break; } }
    if(e<0) return null;
    var j=e-n; if(j<0) return null;
    while(j>=0 && a[j]==null) j--;
    if(j<0 || !a[j] || !a[e]) return null;
    return (a[e]/a[j]-1)*100;
  }
  function pct2(v){ return v==null?'—':((v>=0?'+':'')+v.toFixed(2)+'%'); }
  /* ===== ETF 当日成交额 / 总市值(规模) 快照：_etf_stats.json（腾讯行情，几KB）=====
     异步加载，失败不阻断表格；加载完成后重绘当前维度。 */
  var STATS=null, STATSING=false;
  function ensureStats(){
    if(STATS || STATSING) return;
    STATSING=true;
    RZQ.load('_etf_stats.json').then(function(d){ STATS=(d&&d.data)||{}; })
      .catch(function(){ STATS={}; })
      .then(function(){
        /* 只回填已渲染单元格，绝不重绘整表：避免清掉用户已展开的下钻子表 */
        panel.querySelectorAll('td.st-amt,td.st-mcap').forEach(function(td){
          var k=td.classList.contains('st-amt')?'amt':'mcap';
          td.textContent=amt2(statOf(td.getAttribute('data-code'),k));
        });
      });
  }
  function statOf(code,k){
    var x=STATS&&STATS[code];
    return (x&&x[k]!=null)?x[k]:null;
  }
  function amt2(v){ return v==null?'—':v.toFixed(2); }
  function gran(){
    var on=document.querySelector('#segG button.on');
    return (on && on.dataset.g) || 'd';
  }
  function gtxt(g){ return g==='d'?'当日':(g==='w'?'本周':'本月'); }

  /* 周期切片：锚点直接取图表 window._etfView 的周期末索引，保证表格与图表粒度/时间段口径一致 */
  function slices(){
    if(!DATA) return [];
    var v=window._etfView;
    if(v && v.idx && v.idx.length && v.idx[0] < DATA.dates.length){
      var out=[], prev=(v.start!=null?v.start-1:-1);
      v.idx.forEach(function(gi){
        var days=[];
        for(var i=prev+1;i<=gi && i<DATA.dates.length;i++) days.push(i);
        out.push({gi:gi,days:days});
        prev=gi;
      });
      return out;
    }
    var all=[]; for(var i=0;i<DATA.dates.length;i++) all.push({gi:i,days:[i]}); return all;
  }
  /* sum=true 取周期内累加（净申购）；sum=false 取周期末快照（余额/累计） */
  function agg(arr, sl, sum){
    if(!arr) return sl.map(function(){return null;});
    return sl.map(function(s){
      if(!sum) return arr[s.gi];
      var t=0; s.days.forEach(function(i){t+=(arr[i]||0);});
      return Math.round(t*100)/100;
    });
  }

  /* 按宽基指数：跟随统计粒度/时间段的最新周期 —— 净申购/份额增减取周期累计，份额存量取周期末快照 */
  function renderIndexTable(){
    var sl=slices(), k=sl.length-1, g=gran(), gt=gtxt(g);
    var head=panel.querySelector('#etfHead');
    if(head) head.innerHTML='<th>宽基指数</th><th><span class="eth-full">'+gt+'净申购(亿元)</span><span class="eth-mini">'+gt+'(亿元)</span></th><th><span class="eth-full">'+gt+'份额增减(亿份)</span><span class="eth-mini">份额(亿份)</span></th><th><span class="eth-full">份额存量(亿份)</span><span class="eth-mini">存量(亿份)</span></th><th><span class="eth-full">ETF数</span><span class="eth-mini">只数</span></th>';
    var rows=[];
    IDX.forEach(function(name){
      var id=DATA.idx[name]; if(!id) return;
      var sd=shareIdx(name);
      rows.push({name:name, dn:agg(id.net,sl,true)[k], ds:sd?agg(sd.dsh,sl,true)[k]:null, ss:sd?agg(sd.sh,sl,false)[k]:null, nec:(id.etf&&id.etf.length)||0});
    });
    rows.sort(function(a,b){ return (b.dn==null?-Infinity:b.dn)-(a.dn==null?-Infinity:a.dn); });
    tbody.innerHTML=rows.map(function(r){
      return '<tr class="idxmain" data-name="'+r.name+'"><td>'+r.name+'</td><td class="'+cls2(r.dn)+'">'+sign2(r.dn)+'</td><td class="'+cls2(r.ds)+'">'+sign2(r.ds)+'</td><td>'+fmtSh(r.ss)+'</td><td>'+r.nec+'</td></tr>';
    }).join('');
    var et0=panel.querySelector('table.etf-table'); if(et0) et0._sk=null;
    markSortableHeaders();
  }
  /* 按 ETF：全部 30 只，跟随统计粒度/时间段的最新周期，按该周期净申购降序（净流入多在前） */
  function renderEtfTable(){
    ensureCloses(); ensureStats(); ensureShares();
    var sl=slices(), k=sl.length-1, g=gran(), gt=gtxt(g);
    var head=panel.querySelector('#etfHead');
    if(head) head.innerHTML='<th>ETF（名称 / 代码）</th><th><span class="eth-full">'+gt+'净申购(亿元)</span><span class="eth-mini">'+gt+'(亿元)</span></th><th><span class="eth-full">'+gt+'份额增减(亿份)</span><span class="eth-mini">份额(亿份)</span></th><th><span class="eth-full">份额存量(亿份)</span><span class="eth-mini">存量(亿份)</span></th>'
      + '<th>当日</th><th>5日</th><th>10日</th><th>20日</th><th>60日</th><th>120日</th><th>250日</th>'
      + '<th><span class="eth-full">当日成交(亿)</span><span class="eth-mini">成交(亿)</span></th><th><span class="eth-full">ETF规模·市值(亿)</span><span class="eth-mini">规模(亿)</span></th>'
      + '<th><span class="eth-full">所属宽基指数</span><span class="eth-mini">指数</span></th>';
    var CHGDAYS=[1,5,10,20,60,120,250];
    var rows=[];
    DATA.etf.forEach(function(x){
      var sa=shareArr(x.code);
      rows.push({x:x, net:agg(x.net,sl,true)[k],
                 ds:sa?agg(sa.dsh,sl,true)[k]:null, ss:sa?agg(sa.sh,sl,false)[k]:null,
                 chg:CHGDAYS.map(function(n){ return chgOf(x.code,n); })});
    });
    rows.sort(function(a,b){ return (b.net==null?-Infinity:b.net)-(a.net==null?-Infinity:a.net); });
    tbody.innerHTML=rows.map(function(r){
      return '<tr class="etfdrill" data-code="'+r.x.code+'"><td class="nm"><span class="nmt">'+r.x.name+'</span><span class="subcode">'+r.x.code+'</span></td><td class="'+cls2(r.net)+'">'+sign2(r.net)+'</td><td class="'+cls2(r.ds)+'">'+sign2(r.ds)+'</td><td>'+fmtSh(r.ss)+'</td>'
        + r.chg.map(function(v){ return '<td class="chg '+cls2(v)+'">'+pct2(v)+'</td>'; }).join('')
        + '<td class="chg st-amt" data-code="'+r.x.code+'">'+amt2(statOf(r.x.code,'amt'))+'</td><td class="st-mcap" data-code="'+r.x.code+'">'+amt2(statOf(r.x.code,'mcap'))+'</td>'
        + '<td>'+r.x.idx+'</td></tr>';
    }).join('');
    var et1=panel.querySelector('table.etf-table'); if(et1) et1._sk=null;
    markSortableHeaders();
  }
  /* 指数下钻：mode=d 视窗内逐日明细（固定按日），mode=e 成分 ETF 跟随统计粒度的周期累计/存量 */
  function renderIdxSub(subTr, name, mode){
    var sl=slices(), k=sl.length-1, gt=gtxt(gran()), body=subTr.querySelector('.etf-sub-body');
    var id=DATA.idx[name], sd=shareIdx(name);
    if(!id){ body.innerHTML='<div class="etf-msg">无数据</div>'; return; }
    var h='';
    if(mode==='d'){
      var days=[]; slices().forEach(function(s){ s.days.forEach(function(i){days.push(i);}); });
      h='<table><thead><tr><th>日期</th><th>当日净申购(亿元)</th><th>当日份额增减(亿份)</th><th>份额存量(亿份)</th></tr></thead><tbody>';
      for(var j=days.length-1;j>=0;j--){
        var d=days[j];
        h+='<tr><td>'+DATA.dates[d]+'</td><td class="'+cls2(id.net[d])+'">'+sign2(id.net[d])+'</td><td class="'+cls2((sd&&sd.dsh)?sd.dsh[d]:null)+'">'+sign2((sd&&sd.dsh)?sd.dsh[d]:null)+'</td><td>'+fmtSh((sd&&sd.sh)?sd.sh[d]:null)+'</td></tr>';
      }
    }else{
      ensureStats();
      var etfs=DATA.etf.filter(function(x){return x.idx===name;});
      var rows=etfs.map(function(x){
        var sa=shareArr(x.code);
        return {x:x, net:agg(x.net,sl,true)[k], ds:sa?agg(sa.dsh,sl,true)[k]:null, ss:sa?agg(sa.sh,sl,false)[k]:null};
      });
      rows.sort(function(a,b){ return (b.net==null?-Infinity:b.net)-(a.net==null?-Infinity:a.net); });
      h='<table class="etfmini"><thead><tr><th>ETF（名称 / 代码）</th><th>'+gt+'净申购(亿元)</th><th>'+gt+'份额增减(亿份)</th><th>份额存量(亿份)</th><th>当日成交(亿)</th><th>规模·市值(亿)</th></tr></thead><tbody>';
      rows.forEach(function(r){
        var x=r.x;
        h+='<tr class="etfdrill" data-code="'+x.code+'"><td class="nm"><span class="nmt">'+x.name+'</span><span class="subcode">'+x.code+'</span></td><td class="'+cls2(r.net)+'">'+sign2(r.net)+'</td><td class="'+cls2(r.ds)+'">'+sign2(r.ds)+'</td><td>'+fmtSh(r.ss)+'</td><td class="st-amt" data-code="'+x.code+'">'+amt2(statOf(x.code,'amt'))+'</td><td class="st-mcap" data-code="'+x.code+'">'+amt2(statOf(x.code,'mcap'))+'</td></tr>';
      });
    }
    body.innerHTML=h+'</tbody></table>';
    var subTbl=body.querySelector('table'); if(subTbl) subTbl._sk=null;
    markSortableHeaders();
  }

  function renderTable(){
    if(!DATA) return;
    ensureShares();
    var etbl=panel.querySelector('table.etf-table');
    if(etbl) etbl.classList.toggle('dim-etf', dim==='e');
    if(dim==='i'){ renderIndexTable(); return; }
    if(dim==='e'){ renderEtfTable(); return; }
    var sl=slices(), g=gran(), gt=gtxt(g);
    var tot=shareTotal();
    var net=agg(DATA.total.net,sl,true);
    var dsh=tot?agg(tot.dsh,sl,true):sl.map(function(){return null;});
    var shm=tot?agg(tot.sh,sl,false):sl.map(function(){return null;});
    var nidx=DATA.total.nidx;
    var head=panel.querySelector('#etfHead');
    if(head) head.innerHTML='<th>日期</th><th><span class="eth-full">'+gt+'净申购(亿元)</span><span class="eth-mini">'+gt+'(亿元)</span></th><th><span class="eth-full">'+gt+'份额增减(亿份)</span><span class="eth-mini">份额(亿份)</span></th><th><span class="eth-full">份额存量(亿份)</span><span class="eth-mini">存量(亿份)</span></th><th><span class="eth-full">纳入指数</span><span class="eth-mini">指数</span></th>';
    var rows=[];
    for(var k=sl.length-1;k>=0;k--){
      var s=sl[k];
      rows.push('<tr class="daterow" data-k="'+k+'"><td>'+DATA.dates[s.gi]+'</td>'
        +'<td class="'+cls2(net[k])+'">'+sign2(net[k])+'</td>'
        +'<td class="'+cls2(dsh[k])+'">'+sign2(dsh[k])+'</td>'
        +'<td>'+fmtSh(shm[k])+'</td>'
        +'<td>'+(nidx[s.gi]==null?'—':nidx[s.gi])+'</td></tr>');
    }
    tbody.innerHTML=rows.join('');
    var et2=panel.querySelector('table.etf-table'); if(et2) et2._sk=null;
    markSortableHeaders();
  }

  function ensure(){
    if(DATA){ renderTable(); return; }
    tbody.innerHTML='<tr><td colspan="5" class="etf-msg">宽基 ETF 资金流数据加载中…</td></tr>';
    RZQ.load('_etf_flow.json').then(function(d){ DATA=d; renderTable(); }).catch(function(e){
      tbody.innerHTML='<tr><td colspan="5" class="etf-msg">数据暂未就绪。'+(e&&e.message?('<br>'+e.message):'')+'</td></tr>';
    });
  }

  /* 维度切换：按日期 / 按宽基指数 */
  panel.querySelectorAll('.etf-dim button').forEach(function(b){
    b.addEventListener('click',function(){
      dim=b.dataset.dim;
      panel.querySelectorAll('.etf-dim button').forEach(function(x){x.classList.toggle('on',x===b);});
      renderTable();
    });
  });

  /* ===== ETF 所有表格表头点击排序（主表3维度 + 各下钻子表通用）=====
     委托在 panel：任何 thead th 点击即按其列排序所在表；首次降序、再点升序；null/— 末尾。
     展开的下钻子表行(etf-sub)跟随其父数据行一起移动。 */
  function skNum(txt){
    var s=String(txt==null?'':txt).trim();
    if(s===''||s==='—'||s==='-') return null;
    var mul=1;
    if(/万亿/.test(s)){ mul=10000; s=s.replace(/万亿/g,''); }
    else if(/亿/.test(s)){ s=s.replace(/亿/g,''); }
    s=s.replace(/%/g,'').replace(/[+,]/g,'').replace(/\s/g,'');
    if(!/^-?\d+(\.\d+)?$/.test(s)) return null;
    var v=parseFloat(s);
    return isNaN(v)?null:v*mul;
  }
  function skSort(th){
    var table=th.closest('table'); if(!table) return;
    var tb=table.tBodies[0]; if(!tb) return;
    var ths=Array.prototype.slice.call(table.tHead?table.tHead.rows[0].cells:[]);
    var col=Array.prototype.indexOf.call(ths,th); if(col<0) return;
    var st=table._sk||(table._sk={col:-1,asc:false});
    if(st.col===col) st.asc=!st.asc; else { st.col=col; st.asc=false; }

    /* 顶层单元：数据行 + 其后紧跟的 etf-sub 子表行作为一组 */
    var units=[], kids=Array.prototype.slice.call(tb.children);
    for(var i=0;i<kids.length;i++){
      var r=kids[i];
      if(r.classList&&r.classList.contains('etf-sub')) continue;
      var u={rows:[r], val:null, isNum:true, hasNum:false, hasTxt:false};
      var j=i+1;
      while(j<kids.length && kids[j].classList && kids[j].classList.contains('etf-sub')){ u.rows.push(kids[j]); j++; }
      var txt=r.cells&&r.cells[col]?r.cells[col].textContent:'';
      var n=skNum(txt);
      if(n==null){ if(String(txt).trim()!==''&&String(txt).trim()!=='—') u.hasTxt=true; }
      else { u.val=n; u.hasNum=true; }
      u.val=n; u.txt=String(txt==null?'':txt).trim();
      units.push(u);
      i=j-1;
    }
    /* 该列是否数值列：有数值且无纯文本 → 数值排序，否则文本排序（日期字典序即时间序） */
    var numeric=units.some(function(u){return u.hasNum;}) && !units.some(function(u){return u.hasTxt;});
    units.sort(function(a,b){
      var av=numeric?a.val:a.txt, bv=numeric?b.val:b.txt;
      if(av==null&&bv==null) return 0;
      if(av==null) return 1;   /* null 末尾（与升降序无关） */
      if(bv==null) return -1;
      var c = numeric ? (av-bv) : String(av).localeCompare(String(bv),'zh-CN');
      return st.asc?c:-c;
    });
    units.forEach(function(u){ u.rows.forEach(function(r){ tb.appendChild(r); }); });
    ths.forEach(function(x,xi){ x.classList.toggle('sk-asc', xi===col&&st.asc); x.classList.toggle('sk-desc', xi===col&&!st.asc); });
  }
  /* 渲染后给 panel 内所有表头打 data-sk 标记（含动态下钻子表） */
  function markSortableHeaders(){
    panel.querySelectorAll('thead th').forEach(function(th){ th.setAttribute('data-sk','1'); });
  }
  panel.addEventListener('click',function(e){
    var th=e.target.closest('thead th'); if(!th||!panel.contains(th)) return;
    th.setAttribute('data-sk','1');
    Array.prototype.forEach.call(th.parentNode.cells,function(x){ if(x!==th) x.setAttribute('data-sk','1'); });
    skSort(th);
  });

  /* 下钻：日期行 → 12 指数表；指数行 → 逐只 ETF 表（k=周期切片索引，gi=周期末全局索引，均按统一粒度聚合） */
  tbody.addEventListener('click', function(e){
    if(dim!=='d') return;
    var tr=e.target.closest('tr.daterow'); if(!tr) return;
    var k=+tr.dataset.k, sl=slices(), s=sl[k]; if(!s) return;
    var next=tr.nextElementSibling;
    if(next && next.classList.contains('etf-sub') && next.dataset.level==='idx'){ next.remove(); return; }
    if(next && next.classList.contains('etf-sub')) next.remove();
    var gt=gtxt(gran());
    var html='<tr class="etf-sub" data-level="idx"><td colspan="5"><div class="etf-sub-in" style="padding:2px 4px">';
    html+='<div style="font-size:12px;color:#66708a;margin:4px 2px">截至 '+DATA.dates[s.gi]+' · 12 宽基指数净申购与份额（'+gt+' / 存量）</div>';
    html+='<table><thead><tr><th>宽基指数</th><th>'+gt+'净申购(亿元)</th><th>'+gt+'份额增减(亿份)</th><th>份额存量(亿份)</th><th>ETF数</th></tr></thead><tbody>';
    var idxs=[];
    IDX.forEach(function(name){
      var id=DATA.idx[name]; if(!id) return;
      var sd=shareIdx(name);
      idxs.push({name:name, net:agg(id.net,sl,true)[k],
                 ds:sd?agg(sd.dsh,sl,true)[k]:null, ss:sd?agg(sd.sh,sl,false)[k]:null,
                 nec:(id.etf&&id.etf.length)||0});
    });
    idxs.sort(function(a,b){ return (b.net==null?-Infinity:b.net)-(a.net==null?-Infinity:a.net); });
    idxs.forEach(function(r){
      html+='<tr class="idxrow" data-name="'+r.name+'" data-k="'+k+'"><td>'+r.name+'</td><td class="'+cls2(r.net)+'">'+sign2(r.net)+'</td><td class="'+cls2(r.ds)+'">'+sign2(r.ds)+'</td><td>'+fmtSh(r.ss)+'</td><td>'+r.nec+'</td></tr>';
    });
    html+='</tbody></table></div></td></tr>';
    tr.insertAdjacentHTML('afterend', html);
    markSortableHeaders();
  });

  tbody.addEventListener('click', function(e){
    var ir=e.target.closest('tr.idxrow'); if(!ir) return;
    var name=ir.dataset.name, k=+ir.dataset.k, sl=slices();
    var next=ir.nextElementSibling;
    if(next && next.classList.contains('etf-sub') && next.dataset.level==='etf'){ next.remove(); return; }
    if(next && next.classList.contains('etf-sub')) next.remove();
    var gt=gtxt(gran());
    var etfs=DATA.etf.filter(function(x){return x.idx===name;});
    etfs.sort(function(a,b){ var an=agg(a.net,sl,true)[k], bn=agg(b.net,sl,true)[k]; return (bn==null?-Infinity:bn)-(an==null?-Infinity:an); });
    ensureStats();
    var html='<tr class="etf-sub" data-level="etf"><td colspan="5"><div class="etf-sub-in" style="padding:2px 16px"><table class="etfmini"><thead><tr><th>ETF（名称 / 代码）</th><th>'+gt+'净申购(亿元)</th><th>'+gt+'份额增减(亿份)</th><th>份额存量(亿份)</th><th>当日成交(亿)</th><th>规模·市值(亿)</th></tr></thead><tbody>';
    etfs.forEach(function(x){
      var net=agg(x.net,sl,true)[k], sa=shareArr(x.code);
      var ds=sa?agg(sa.dsh,sl,true)[k]:null, ss=sa?agg(sa.sh,sl,false)[k]:null;
      html+='<tr class="etfdrill" data-code="'+x.code+'"><td class="nm"><span class="nmt">'+x.name+'</span><span class="subcode">'+x.code+'</span></td><td class="'+cls2(net)+'">'+sign2(net)+'</td><td class="'+cls2(ds)+'">'+sign2(ds)+'</td><td>'+fmtSh(ss)+'</td><td class="st-amt" data-code="'+x.code+'">'+amt2(statOf(x.code,'amt'))+'</td><td class="st-mcap" data-code="'+x.code+'">'+amt2(statOf(x.code,'mcap'))+'</td></tr>';
    });
    html+='</tbody></table></div></td></tr>';
    ir.insertAdjacentHTML('afterend', html);
    markSortableHeaders();
  });

  /* 指数维度：点指数行 → 下钻切换「按日期 / 按ETF」 */
  tbody.addEventListener('click', function(e){
    if(dim!=='i') return;
    var ir=e.target.closest('tr.idxmain'); if(!ir) return;
    var next=ir.nextElementSibling;
    if(next && next.classList.contains('etf-sub')){ next.remove(); return; }
    var name=ir.dataset.name;
    var html='<tr class="etf-sub" data-level="idxmain"><td colspan="5"><div class="etf-sub-in" style="padding:2px 4px">'
      +'<div class="etf-subtabs"><button data-sub="d" class="on">按日期</button><button data-sub="e">按ETF</button></div>'
      +'<div class="etf-sub-body"></div></div></td></tr>';
    ir.insertAdjacentHTML('afterend', html);
    renderIdxSub(ir.nextElementSibling, name, 'd');
  });
  tbody.addEventListener('click', function(e){
    var b=e.target.closest('.etf-subtabs button'); if(!b) return;
    var subTr=b.closest('tr.etf-sub'), mainTr=subTr.previousElementSibling;
    if(!mainTr || !mainTr.dataset.name) return;
    subTr.querySelectorAll('.etf-subtabs button').forEach(function(x){x.classList.toggle('on',x===b);});
    renderIdxSub(subTr, mainTr.dataset.name, b.dataset.sub);
  });

  /* ETF 名称点击 → 展开该 ETF 逐日明细（视窗内逐日、固定按日：当日 / 累计）。
     覆盖三处入口：按ETF主表 / 按日期下钻第2层 / 按宽基指数下钻的ETF子表。 */
  tbody.addEventListener('click', function(e){
    var er=e.target.closest('tr.etfdrill'); if(!er) return;
    var code=er.dataset.code;
    var x=null; for(var q=0;q<DATA.etf.length;q++){ if(DATA.etf[q].code===code){ x=DATA.etf[q]; break; } }
    if(!x) return;
    var next=er.nextElementSibling;
    if(next && next.classList.contains('etf-sub') && next.dataset.level==='etfdays'){ next.remove(); return; }
    /* 收起同层其它已展开的逐日块 */
    var par=er.parentNode;
    Array.prototype.slice.call(par.children).forEach(function(r){
      if(r.classList.contains('etf-sub') && r.dataset.level==='etfdays') r.remove();
    });
    var days=[]; slices().forEach(function(s){ s.days.forEach(function(i){days.push(i);}); });
    var span=Math.max(1, er.cells.length);
    /* 逐日子表宽度按滚动容器可视宽计算，不能继承 900px 表格宽（否则手机只见日期一列） */
    var wrapEl=tbody.closest('.etf-tblwrap'), avail=wrapEl?wrapEl.clientWidth:0;
    if(avail>60) avail-=26; /* 子表所在td左右padding 6 + 容器左右padding 20 */
    var wStyle=avail>160?('width:'+avail+'px;max-width:none;'):'';
    var html='<tr class="etf-sub" data-level="etfdays"><td colspan="'+span+'"><div class="etf-sub-in etfdays-in" style="padding:2px 10px;'+wStyle+'">'
      +'<div style="font-size:12px;color:#66708a;margin:4px 2px">'+x.name+'（'+code+'） · '+x.idx+' · 逐日明细（视窗内，固定按日）</div>'
      +'<table><thead><tr><th>日期</th><th><span class="eth-full">当日净申购(亿元)</span><span class="eth-mini">当日(亿元)</span></th><th><span class="eth-full">当日份额增减(亿份)</span><span class="eth-mini">份额(亿份)</span></th><th><span class="eth-full">份额存量(亿份)</span><span class="eth-mini">存量(亿份)</span></th></tr></thead><tbody>';
    var xs=shareArr(code);
    for(var j=days.length-1;j>=0;j--){
      var d=days[j];
      html+='<tr><td>'+DATA.dates[d]+'</td><td class="'+cls2(x.net[d])+'">'+sign2(x.net[d])+'</td><td class="'+cls2(xs?(xs.dsh?xs.dsh[d]:null):null)+'">'+sign2(xs?(xs.dsh?xs.dsh[d]:null):null)+'</td><td>'+fmtSh(xs?(xs.sh?xs.sh[d]:null):null)+'</td></tr>';
    }
    html+='</tbody></table></div></td></tr>';
    er.insertAdjacentHTML('afterend', html);
    markSortableHeaders();
  });

  /* 跟随统一统计粒度 #segG 与 ETF 图时间段 #eRng 重绘。
     事件注册晚于图表脚本，故触发时 window._etfView 已是新周期的切片。 */
  function refresh(){ if(DATA) setTimeout(renderTable, 0); }
  document.querySelectorAll('#segG button').forEach(function(b){ b.addEventListener('click', refresh); });
  document.querySelectorAll('#eRng button').forEach(function(b){ b.addEventListener('click', refresh); });

  /* 关键：本 IIFE 在 HTML 内联脚本(只绑静态 m/u)与个股 IIFE(activate 私有)之后才运行，
     eBtn 不会被它们绑定。必须在此显式完成「全量切 active + 全量切 tpanel」。 */
  eBtn.addEventListener('click', function(){
    document.querySelectorAll('.tbtn').forEach(function(b){ b.classList.toggle('active', b.dataset.t === 'e'); });
    document.querySelectorAll('.tpanel').forEach(function(p){ p.style.display = (p.id === 'tpanel-e') ? 'block' : 'none'; });
    ensure();
  });
})();

/* ===== 各指数涨跌汇总 标签页（区间净申购 + 涨跌 + 年化夏普） =====
   口径（11-26 定稿）：
     · 涨跌 = 末收盘 ÷ 期初收盘 − 1，周期一律按【交易日】不按自然日（5日 = 相对5个交易日前）。
     · 夏普 = 日均收益 ÷ 日收益标准差 × √252（年化，无风险利率取 0，与「按指标选股」页同一口径）。
     · 至少 3 个日收益才给夏普（5/10 日样本短，仅作参考）。
     · 今年以来 = 末收盘 ÷ 上年最后一个交易日收盘 − 1。
     · 三列（净申购/涨跌/夏普）由表格上方复选框控制显隐，默认按 20 日净申购降序。
   数据：优先用 HTML 内联 IDXR_D/IDXR_C/IDXR_CSI（独立指数日期轴，到最新交易日；
        图表那份 ETF_IDX_CLOSE 是按资金流日期轴对齐的，会少几天，不能用于本表）。
        自定义区间早于内联起点时按需 fetch _idx_close_2012.json 全历史。 */
(function(){
  if (typeof RZQ === 'undefined') return;
  /* 本表挂在「宽基ETF净资金流」面板内部，作为该面板的二级标签，
     不再占用顶层标签栏（顶层 m/s/e/u 在手机端换行后会被误读成融资余额/涨跌家数那一组）。 */
  var panelE = document.getElementById('tpanel-e');
  if (!panelE) return;                  /* 依赖宽基ETF标签页先注入 */
  if (document.getElementById('irPane')) return;

  var IDXCOLOR = {'沪深300':'#0d9488','中证A500':'#be123c','上证50':'#7c3aed','中证500':'#c2410c',
    '中证1000':'#059669','科创50':'#db2777','创业板指':'#4f46e5','中证2000':'#b45309',
    '科创100':'#0284c7','创业板50':'#9333ea','上证指数':'#a16207','深证成指':'#334155'};

  /* ---------- 数据 ---------- */
  var D   = (typeof IDXR_D  !== 'undefined' && IDXR_D)  ? IDXR_D.slice() : [];
  var C   = (typeof IDXR_C  !== 'undefined' && IDXR_C)  ? IDXR_C : {};
  var CSR = (typeof IDXR_CSI!== 'undefined' && IDXR_CSI)? IDXR_CSI.slice() : [];
  var IDX = Object.keys(C);
  var FULL = null, FULLP = null;        /* fetch 到的全历史 */

  function asof(){ return D.length ? D[D.length - 1] : ''; }

  function loadFull(){
    if (FULL) return Promise.resolve(FULL);
    if (FULLP) return FULLP;
    FULLP = fetch('_idx_close_2012.json', { cache: 'no-store' })
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(j){
        if (!j || !j.dates || !j.close) throw new Error('bad json');
        FULL = { dates: j.dates, close: j.close };
        D = j.dates.slice(); C = j.close; CSR = [];
        IDX = Object.keys(C);
        return FULL;
      })
      .catch(function(e){ FULLP = null; throw e; });
    return FULLP;
  }

  /* ---------- CSS ---------- */
  var css = ''
    + '.ir-subtabs{display:flex;gap:6px;margin:2px 2px 6px}'
    + '.ir-subtabs button{font-size:12px;padding:4px 13px;border:1px solid #cbd5e1;background:#fff;color:#64748b;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.ir-subtabs button.on{background:#eef4ff;border-color:#2f6bff;color:#2f6bff;font-weight:600}'
    + '#irPane{display:none;padding:0 2px 4px}'
    + '#tpanel-e.ir-mode > #irPane{display:block}'
    + '#tpanel-e.ir-mode > .etf-flow-view{display:none}'
    + '.ir-top{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:0;font-size:12px;color:#64748b}'
    + '.ir-top .lbl{color:#64748b;margin-right:1px}'
    + '.ir-cus{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;margin:0 2px 8px}'
    + '.ir-cus[hidden]{display:none}'                       /* 自定义区间默认折叠 */
    + '.ir-cusbtn{display:inline-flex;align-items:center;gap:3px;font-size:12px;padding:3px 9px;border:1px solid #cbd5e1;background:#fff;color:#64748b;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.ir-cusbtn[aria-expanded="true"]{background:#eef4ff;border-color:#2f6bff;color:#2f6bff;font-weight:600}'
    + '.ir-carc{font-size:9px;line-height:1;transition:transform .12s}'
    + '.ir-cusbtn[aria-expanded="true"] .ir-carc{transform:rotate(90deg)}'
    + '.ir-cur{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:0 2px 8px;font-size:12px;color:#64748b}'
    + '.ir-cur label{display:inline-flex;align-items:center;gap:4px;cursor:pointer;user-select:none;white-space:nowrap}'
    + '.ir-cur input[type=checkbox]{width:13px;height:13px;margin:0;accent-color:#2f6bff;cursor:pointer}'
    + '.ir-nmh{display:block;text-align:center}'
    + '.ir-rknote{font-size:11.5px;color:#8592a6;line-height:1.55;margin:6px 2px 2px}'
    + '.ir-rknote b{color:#64748b;font-weight:600}'
    + '.ir-cus .lbl{white-space:nowrap}'
    + '.ir-cus input[type=date]{font-size:12px;padding:2px 6px;border:1px solid #cbd5e1;border-radius:6px;color:#475569;background:#fff;font-family:inherit}'
    + '.ir-add{font-size:12px;padding:3px 10px;border:1px solid #2f6bff;background:#2f6bff;color:#fff;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.ir-clr{font-size:12px;padding:3px 9px;border:1px solid #cbd5e1;background:#fff;color:#64748b;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.ir-asof{margin-left:auto;font-size:12px;color:#94a3b8;white-space:nowrap}'
    + '.ir-tblwrap{overflow:auto;max-height:560px;border:1px solid #eef1f6;border-radius:10px}'
    + 'table.ir-table{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px}'
    + 'table.ir-table th,table.ir-table td{padding:7px 5px;border-bottom:1px solid #eef1f5;white-space:nowrap;text-align:right}'
    + 'table.ir-table thead th{background:#f8fafc;color:#64748b;font-weight:600;text-align:center;position:sticky;z-index:3;height:30px;box-sizing:border-box}'
    /* 隔离：主页面有一条全局 thead th::after{content:" ⇅"}（融资余额主表用），会污染本表所有表头；
       下面用更高特异性把默认箭头清掉，只有带 data-sk 的可排列表头才显示箭头 */
    + 'table.ir-table thead th::after{content:none;margin-left:0}'
    + 'table.ir-table thead tr:nth-child(1) th{top:0;border-bottom:1px solid #e6ecf3}'
    + 'table.ir-table thead tr:nth-child(2) th{top:30px;font-weight:400;color:#94a3b8;font-size:12px;background:#f8fafc}'
    + 'table.ir-table th.ir-nm,table.ir-table td.ir-nm{text-align:left;position:sticky;left:0;background:#fff;z-index:2;box-shadow:1px 0 0 #eef1f5;white-space:normal;max-width:190px}'
    + 'table.ir-table thead th.ir-nm{z-index:6;background:#f8fafc;text-align:center}'
    + '.ir-nmwrap{display:inline-flex;flex-wrap:wrap;align-items:center;gap:3px 4px;vertical-align:middle}'
    + '.ir-nmt{display:inline-flex;align-items:center;white-space:nowrap}'
    + '.ir-bdg{font-size:9.5px;line-height:1.5;padding:0 4px;border-radius:4px;background:#f1f5f9;color:#64748b;white-space:nowrap;font-weight:400}'
    + '.ir-bdg.r1{background:#fef3c7;color:#b45309}'
    + '.ir-bdg.r2{background:#eef2f7;color:#526079}'
    + 'table.ir-table tbody tr:hover td{background:#f7faff}'
    + 'table.ir-table tbody tr:hover td.ir-nm{background:#f3f7ff}'
    + 'table.ir-table tbody tr:last-child td{border-bottom:none}'
    + 'table.ir-table td.ir-nm{color:#334155;font-weight:500}'
    + '.ir-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;vertical-align:middle}'
    + '.ir-up{color:#e24b4a}.ir-dn{color:#16a34a}.ir-na{color:#b6bfcc}'
    + '.ir-sub{font-size:11.5px;font-weight:400}'
    + '.ir-u{font-size:10px;font-weight:400;color:#a3adbd;margin-left:1px}'
    + '#irPane thead th[data-sk]{cursor:pointer;user-select:none}'
    + '#irPane thead th[data-sk]::after{content:" ⇅";font-size:.75em;color:#aab4c5;margin-left:2px;font-weight:400}'
    + '#irPane thead th[data-sk].sk-asc::after{content:" ↑";color:#2f6bff}'
    + '#irPane thead th[data-sk].sk-desc::after{content:" ↓";color:#2f6bff}'
    + '.ir-note2{font-size:12px;color:#66708a;line-height:1.6;margin:8px 2px 0}'
    + '.ir-note2 summary{cursor:pointer;font-weight:600;color:#475569;padding:6px 2px}'
    + '.ir-note2[open] summary{margin-bottom:4px}'
    + '.ir-note2 b{color:#334155}'
    + '.ir-msg{padding:16px;color:#66708a;font-size:13px;text-align:center}'
    + '@media(max-width:620px){table.ir-table{font-size:13px}table.ir-table th,table.ir-table td{padding:6px 7px}table.ir-table th.ir-nm,table.ir-table td.ir-nm{width:110px;min-width:110px;max-width:110px}.ir-bdg{font-size:8.5px;padding:0 2px;line-height:1.4}.ir-nmwrap{gap:2px 3px}.ir-top{gap:4px;font-size:11.5px}.ir-cus{flex-basis:100%;margin-left:0;margin-top:0;gap:3px;flex-wrap:nowrap;width:100%}.ir-cusbtn{flex:0 0 auto;padding:3px 8px;font-size:11px}.ir-cus input[type=date]{font-size:11px;padding:2px 3px;flex:1 1 0;min-width:0}.ir-add,.ir-clr{flex:0 0 auto;padding:3px 7px;font-size:11px}.ir-cur{gap:9px;font-size:11.5px;padding:0 0 6px}.ir-asof{width:100%;margin-left:0;text-align:right;font-size:11px}}';
  if (!document.getElementById('ir-tab-css')) {
    var st = document.createElement('style'); st.id = 'ir-tab-css'; st.textContent = css; document.head.appendChild(st);
  }

  /* ---------- 二级标签（宽基ETF 面板内部：资金流明细 / 宽基指数涨跌汇总） ---------- */
  var subnav = document.createElement('div');
  subnav.className = 'ir-subtabs'; subnav.id = 'irSubtabs';
  subnav.innerHTML = '<button type="button" data-v="flow" class="on">资金流明细</button>'
                   + '<button type="button" data-v="ret">宽基指数涨跌汇总</button>';
  panelE.insertBefore(subnav, panelE.firstChild);
  /* 既有内容（整理维度/表体/说明）打标记，切到涨跌汇总时整组隐藏 */
  Array.prototype.slice.call(panelE.children).forEach(function (el) {
    if (el !== subnav) el.classList.add('etf-flow-view');
  });

  /* ---------- 面板 ---------- */
  /* 列固定：5/10/20/60/120日 + 今年以来（不再有「区间」筛选 chips）。
     每列族一律三列：净申购(亿元) + 涨跌(%) + 夏普；三列可用复选框单独关掉。 */
  var RANGES = [
    { k: 'r5',   n: 5,   label: '5日',     sh: true, rank: true },
    { k: 'r10',  n: 10,  label: '10日',    sh: true, rank: true },
    { k: 'r20',  n: 20,  label: '20日',    sh: true, rank: true },
    { k: 'r60',  n: 60,  label: '60日',    sh: true, rank: true },
    { k: 'r120', n: 120, label: '120日',   sh: true, rank: true },
    { k: 'ytd',  n: 0,   label: '今年以来', sh: true, rank: false }
  ];
  var custom = null;                     /* {label, s, e}：s/e 为 D 中的索引 */
  var showCol = { n: true, r: true, s: false };  /* 列开关：净申购 / 涨跌 / 夏普（夏普默认不勾选） */
  var METRICS = [
    { m: 'n', label: '净申购', title: '净申购金额（亿元）', w: 56 },
    { m: 'r', label: '涨跌',   title: '区间涨跌幅（%）',   w: 50 },
    { m: 's', label: '夏普',   title: '年化夏普',         w: 40 }
  ];
  var sortKey = 'r20', sortMetric = 'n'; /* 默认按 20 日净申购降序 */

  var panel = document.createElement('div');
  panel.id = 'irPane';
  panel.innerHTML =
      '<div class="ir-cur" id="irCur">'
    +   '<label><input type="checkbox" data-m="n" checked>净申购</label>'
    +   '<label><input type="checkbox" data-m="r" checked>涨跌</label>'
    +   '<label><input type="checkbox" data-m="s">夏普</label>'
    +   '<button class="ir-cusbtn" type="button" id="irCusBtn" aria-expanded="false" title="点击展开/收起自定义区间">自定义<span class="ir-carc">▸</span></button>'
    +   '<span class="ir-asof" id="irAsof">净申购单位 亿元</span>'
    + '</div>'
    + '<div class="ir-top" id="irTop">'
    +   '<span class="ir-cus" id="irCusRow" hidden>'
    +     '<input type="date" id="irFrom"><span style="color:#b6bfcc">—</span><input type="date" id="irTo">'
    +     '<button class="ir-add" type="button" id="irAdd">添加</button>'
    +     '<button class="ir-clr" type="button" id="irClr">清除</button>'
    +   '</span>'
    + '</div>'
    + '<div class="ir-tblwrap"><table class="ir-table"><thead id="irHead"></thead><tbody id="irBody"></tbody></table></div>'
    + '<details class="ir-note2"><summary>口径与算法说明（默认折叠，点击展开）</summary><div>'
    +   '<b>净申购(亿元)</b>＝该区间内该指数全部成分 ETF 的<b>一级市场申赎净额累加</b>（与上方 ETF 图的指数累计净申购同源，末值差分为区间值），'
    +   '非二级市场买卖、非份额存量；数据截至资金流最新交易日（见上方图表）。'
    +   '<b>区间涨跌</b>＝末收盘 ÷ 期初收盘 − 1。周期一律按<b>交易日</b>回溯（5 日＝相对 5 个交易日前，非自然日）。'
    +   '<b>夏普</b>＝区间内日均收益 ÷ 日收益标准差 × √252（年化，<b>无风险利率取 0</b>），与「按指标选股」页同一口径；'
    +   '注意它不等于区间涨跌幅的年化值。5 日 / 10 日区间的夏普样本仅 5 / 10 个交易日，波动极大，<b>只作横向参考</b>。'
    +   '<b>排名徽章</b>：5 日 / 10 日 / 20 日 / 60 日 / 120 日 / 今年以来 的净申购金额各自降序取前 3 名，'
    +   '在指数名后挂「5日①」这类标签：①＝该区间净申购额第 1 名、②＝第 2 名、③＝第 3 名，鼠标悬浮可看具体金额。'
    +   '<b>精度</b>：净申购取整数（元→亿元四舍五入到个位，带千分位）、涨跌保留 1 位小数、夏普保留 2 位小数。'
    +   '<b>列开关</b>：表格上方的「净申购 / 涨跌 / 夏普」复选框控制对应列是否显示（<b>夏普默认不勾选</b>）；默认按 20 日净申购降序排列，点表头可改排序。'
    +   '<b>今年以来</b>＝末收盘 ÷ 上年最后一个交易日收盘 − 1，净申购同步取上年末以来累计。'
    +   '<b>自定义</b>区间按输入的起止日期取「首个 ≥ 起始日」与「最后 ≤ 截止日」两个交易日，追加一组三列。'
    +   '三个表头（净申购/涨跌/夏普）均可点排序，首次降序、再点升序，空值恒排末尾。指数名前的色点与上方图表同色。'
    +   '<b>数据</b>：指数日线取自腾讯 fqkline（中证2000 走通达信），最新交易日见上方图表；'
    +   '自定义区间超出内联范围（近 300 个交易日）时自动拉取完整历史。指数涨跌未扣费、不含分红再投资差异。'
    + '</div></details>'
    + '<div class="ir-rknote" id="irRkNote">'
    +   '指数名后的徽章为<b>净申购排名</b>：①＝该区间净申购金额第 1 名、②＝第 2 名、③＝第 3 名'
    +   '（5日 / 10日 / 20日 / 60日 / 120日 / 今年以来 各自独立排名，只取前 3；鼠标悬浮可看具体金额）。'
    + '</div>';
  panelE.appendChild(panel);

  var head = panel.querySelector('#irHead'), body = panel.querySelector('#irBody');
  var asofEl = panel.querySelector('#irAsof');
  var ASOF_TXT = '净申购单位 亿元';   /* 表格上方只留单位，不再显示截止日与指数个数 */
  var fromEl = panel.querySelector('#irFrom'), toEl = panel.querySelector('#irTo');

  /* ---------- 计算 ---------- */
  function lastIdx(){ return D.length - 1; }
  function ytdBaseIdx(){
    if (!D.length) return -1;
    var y = D[lastIdx()]; if (!y) return -1;
    var jan1 = y.slice(0, 4) + '-01-01';
    for (var i = lastIdx(); i >= 0; i--) if (D[i] < jan1) return i;
    return -1;
  }
  function retAt(arr, s, e){
    if (s < 0 || e < 0 || s >= arr.length || e >= arr.length || s >= e) return null;
    var a = arr[s], b = arr[e];
    if (a == null || b == null || !a) return null;
    return (b / a - 1) * 100;
  }
  function sharpeAt(arr, s, e){
    if (s < 0 || e < 0 || s >= arr.length || e >= arr.length || s >= e) return null;
    var rs = [], sum = 0, i, p, q, r;
    for (i = s + 1; i <= e; i++) {
      p = arr[i - 1]; q = arr[i];
      if (p == null || q == null || !p) continue;
      r = q / p - 1; rs.push(r); sum += r;
    }
    if (rs.length < 3) return null;              /* 至少 3 个交易日收益才有标准差；5/10 日区间照算（样本短，仅供参考） */
    var mean = sum / rs.length, v = 0, d;
    for (i = 0; i < rs.length; i++) { d = rs[i] - mean; v += d * d; }
    v = v / (rs.length - 1);
    var sd = Math.sqrt(v);
    if (!sd || !isFinite(sd)) return null;
    return mean / sd * Math.sqrt(252);
  }
  /* ---------- 净申购（亿元）：指数累计净申购曲线做区间差分 ----------
     ETF_IDX_ACC 与 ETF_D 同轴（资金流日期轴）；区间起止从本表日期轴映射过去，
     取「最后一个 ≤ 该日的交易日」，保证与涨跌列同一时间窗。 */
  var ETFD = (typeof ETF_D !== 'undefined' && ETF_D) ? ETF_D : [];
  var ACC  = (typeof ETF_IDX_ACC !== 'undefined' && ETF_IDX_ACC) ? ETF_IDX_ACC : {};
  function etfPos(d){
    var lo = 0, hi = ETFD.length - 1, best = -1, m;
    while (lo <= hi) { m = (lo + hi) >> 1; if (ETFD[m] <= d) { best = m; lo = m + 1; } else { hi = m - 1; } }
    return best;
  }
  function netAt(nm, d0, d1){
    var a = ACC[nm];
    if (!a || !a.length || !ETFD.length || !d0 || !d1) return null;
    var i1 = etfPos(d1), i0 = etfPos(d0);
    if (i1 < 0 || i0 < 0 || i0 >= i1) return null;
    var v1 = a[i1], v0 = a[i0];
    if (v1 == null || v0 == null) return null;
    return v1 - v0;
  }

  /* 返回当前要显示的列：[{key,label,s,e,sh,isCustom}]，s/e 为 D 索引 */
  function cols(){
    var out = [], e = lastIdx();
    RANGES.forEach(function (r) {
      var s = (r.n === 0) ? ytdBaseIdx() : (e - r.n);
      out.push({ key: r.k, label: r.label, s: s, e: e, sh: !!r.sh });
    });
    if (custom) out.push({ key: 'cus', label: custom.label, s: custom.s, e: custom.e, sh: true, isCustom: true });
    return out;
  }
  /* 数值精度（用户口径）：净申购取【整数】、涨跌保留 1 位小数、夏普保留 2 位 */
  function fmtPct(v){ if (v == null) return '<span class="ir-na">—</span>';
    return '<span class="' + (v >= 0 ? 'ir-up' : 'ir-dn') + '">' + (v >= 0 ? '+' : '') + v.toFixed(1) + '%</span>'; }
  function fmtSh(v){ if (v == null) return '<span class="ir-na">—</span>';
    return '<span class="' + (v >= 0 ? 'ir-up' : 'ir-dn') + '">' + v.toFixed(2) + '</span>'; }
  function fmtNet(v){ if (v == null) return '<span class="ir-na">—</span>';
    var r = Math.round(v), s = Math.abs(r).toLocaleString('zh-CN');
    return '<span class="' + (r >= 0 ? 'ir-up' : 'ir-dn') + '">' + (r >= 0 ? '+' : '-') + s + '</span>'; }

  /* ---------- 「N日净申购一/二/三」排名徽章 ----------
     只对 5/10/20/60/120 日做排名（今年以来不参与），每周期按净申购额降序取前 3，
     结果按指数归集：同一指数可能同时挂多枚徽章（如沪深300 五行全中）。 */
  var RANKS = ['r5', 'r10', 'r20', 'r60', 'r120', 'ytd'], CN_NUM = ['①', '②', '③'];
  function buildBadges(cs, rows){
    var map = {};
    RANKS.forEach(function (k) {
      var ci = -1, i;
      for (i = 0; i < cs.length; i++) if (cs[i].key === k) ci = i;
      if (ci < 0) return;
      var pool = rows.filter(function (r) { return r.cells[ci] && r.cells[ci].n != null; })
                     .map(function (r) { return { nm: r.nm, v: r.cells[ci].n }; })
                     .sort(function (a, b) { return b.v - a.v; });
      pool.slice(0, 3).forEach(function (o, j) {
        (map[o.nm] = map[o.nm] || []).push({ txt: cs[ci].label + CN_NUM[j], rk: j + 1, v: o.v,
          tip: cs[ci].label + '净申购第 ' + (j + 1) + ' 名' });
      });
    });
    return map;
  }

  function render(){
    var cs = cols();
    asofEl.textContent = IDX.length ? ASOF_TXT : '';
    if (!D.length || !IDX.length) {
      head.innerHTML = ''; body.innerHTML = '<tr><td class="ir-msg">指数数据未加载</td></tr>'; return;
    }
    /* 表头：第一行区间名（跨度＝当前勾选的指标列数）；第二行 净申购 / 涨跌 / 夏普 */
    var vm = METRICS.filter(function (x) { return showCol[x.m]; });
    if (!vm.length) vm = [{ m: 'r', label: '涨跌', title: '区间涨跌幅（%）', w: 50 }];
    var h1 = '<tr><th class="ir-nm" rowspan="2"><span class="ir-nmh">指数</span></th>';
    cs.forEach(function (c) { h1 += '<th colspan="' + vm.length + '">' + c.label + '</th>'; });
    h1 += '</tr>';
    var h2 = '<tr>';
    cs.forEach(function (c, ci) {
      vm.forEach(function (mt) {
        h2 += '<th data-sk data-c="' + ci + '" data-m="' + mt.m + '" title="' + mt.title + '">' + mt.label + '</th>';
      });
    });
    h2 += '</tr>';
    head.innerHTML = h1 + h2;

    /* 数值矩阵 */
    var rows = IDX.map(function (nm) {
      var arr = C[nm] || [], cells = [];
      cs.forEach(function (c) {
        var d0 = (c.s >= 0) ? D[c.s] : null, d1 = (c.e >= 0) ? D[c.e] : null;
        cells.push({
          n: netAt(nm, d0, d1),
          r: retAt(arr, c.s, c.e),
          s: c.sh ? sharpeAt(arr, c.s, c.e) : null
        });
      });
      return { nm: nm, cells: cells };
    });
    /* 排名徽章：在行序确定前按原始数值算（与排序无关） */
    var bmap = showCol.n ? buildBadges(cs, rows) : {};
    /* 排序 */
    var sci = -1;
    for (var i = 0; i < cs.length; i++) if (cs[i].key === sortKey) sci = i;
    if (sci >= 0) {
      var asc = !!sortAsc;
      rows.sort(function (a, b) {
        var x = a.cells[sci] ? a.cells[sci][sortMetric] : null;
        var y = b.cells[sci] ? b.cells[sci][sortMetric] : null;
        if (x == null && y == null) return 0;
        if (x == null) return 1;            /* 空值恒末尾 */
        if (y == null) return -1;
        return asc ? (x - y) : (y - x);
      });
    }
    /* 表体 */
    var html = '';
    rows.forEach(function (row) {
      var bd = bmap[row.nm] || [];
      html += '<tr><td class="ir-nm"><span class="ir-nmwrap">'
            + '<span class="ir-nmt"><span class="ir-dot" style="background:' + (IDXCOLOR[row.nm] || '#94a3b8') + '"></span>' + row.nm + '</span>'
            + bd.map(function (b) {
                return '<span class="ir-bdg r' + b.rk + '" title="' + b.tip + ' · ' + b.v.toFixed(0) + ' 亿元">' + b.txt + '</span>';
              }).join('')
            + '</span></td>';
      row.cells.forEach(function (cell) {
        vm.forEach(function (mt) {
          if (mt.m === 'n')      html += '<td class="ir-net">' + fmtNet(cell.n) + '</td>';
          else if (mt.m === 'r') html += '<td>' + fmtPct(cell.r) + '</td>';
          else                   html += '<td class="ir-sub">' + fmtSh(cell.s) + '</td>';
        });
      });
      html += '</tr>';
    });
    body.innerHTML = html;
    /* 表头排序状态标记 */
    head.querySelectorAll('th[data-sk]').forEach(function (th) {
      var c = +th.dataset.c, m = th.dataset.m;
      th.classList.remove('sk-asc', 'sk-desc');
      if (sci >= 0 && c === sci && m === sortMetric) th.classList.add(sortAsc ? 'sk-asc' : 'sk-desc');
    });
    /* 表格最小宽度：首列 + 已勾选指标列 */
    var w = 132;
    cs.forEach(function () { vm.forEach(function (mt) { w += mt.w; }); });
    panel.querySelector('table.ir-table').style.minWidth = Math.max(320, w) + 'px';
  }
  var sortAsc = false;

  /* ---------- 列开关（净申购 / 涨跌 / 夏普） ---------- */
  var curEl = panel.querySelector('#irCur');
  curEl.addEventListener('change', function (ev) {
    var cb = ev.target;
    if (!cb || cb.type !== 'checkbox' || !cb.dataset.m) return;
    var m = cb.dataset.m, yes = cb.checked;
    /* 至少保留一列，避免整表空掉 */
    var left = METRICS.filter(function (x) { return x.m !== m && showCol[x.m]; });
    if (!yes && !left.length) { cb.checked = true; return; }
    showCol[m] = yes;
    if (!showCol[sortMetric] && left.length) {           /* 当前排序列被隐藏 → 顺延到仍可见的指标 */
      sortMetric = left[0].m;
    }
    render();
  });

  /* ---------- 交互 ---------- */
  head.addEventListener('click', function (ev) {
    var th = ev.target.closest ? ev.target.closest('th[data-sk]') : null;
    if (!th) return;
    var cs = cols(), ci = +th.dataset.c;
    if (!cs[ci]) return;
    var m = th.dataset.m, k = cs[ci].key;
    if (sortKey === k && sortMetric === m) sortAsc = !sortAsc; else { sortKey = k; sortMetric = m; sortAsc = false; }
    render();
  });

  function shortDate(d){ return d ? (d.slice(5)) : ''; }
  function idxOnOrAfter(ds, d){ for (var i = 0; i < ds.length; i++) if (ds[i] >= d) return i; return -1; }
  function idxOnOrBefore(ds, d){ for (var i = ds.length - 1; i >= 0; i--) if (ds[i] <= d) return i; return -1; }

  function applyCustom(){
    var f = fromEl.value, t = toEl.value;
    if (!f || !t) { alert('请先选择起始与截止日期'); return; }
    if (f > t) { alert('起始日期不能晚于截止日期'); return; }
    function doApply(){
      var s = idxOnOrAfter(D, f), e = idxOnOrBefore(D, t);
      if (s < 0 || e < 0 || s > e) { alert('所选区间内没有交易日数据'); return; }
      custom = { label: shortDate(D[s]) + '→' + shortDate(D[e]), s: s, e: e };
      sortKey = 'cus'; sortMetric = 'r'; sortAsc = false;
      render();
    }
    if (f < D[0]) {                       /* 早于内联起点 → 拉全历史 */
      asofEl.textContent = '正在加载更早历史…';
      loadFull().then(function () { initDates(); doApply(); })
        .catch(function () { alert('自定义区间早于 ' + D[0] + '，需要联网加载完整历史；当前环境无法加载。'); render(); });
      return;
    }
    doApply();
  }
  /* 自定义区间：默认折叠，点「自定义」展开/收起日期行 */
  var cusBtn = panel.querySelector('#irCusBtn'), cusRow = panel.querySelector('#irCusRow');
  function setCusOpen(open){
    cusBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    cusRow.hidden = !open;
  }
  cusBtn.addEventListener('click', function () {
    setCusOpen(cusBtn.getAttribute('aria-expanded') !== 'true');
  });
  window._irSetCusOpen = setCusOpen;      /* 供回归脚本/外部调用 */

  panel.querySelector('#irAdd').addEventListener('click', applyCustom);
  panel.querySelector('#irClr').addEventListener('click', function () {
    custom = null; fromEl.value = ''; toEl.value = '';
    if (sortKey === 'cus') { sortKey = 'r20'; sortMetric = 'n'; sortAsc = false; }
    render();
  });

  function initDates(){
    var lo = D.length ? D[0] : '', hi = D.length ? D[D.length - 1] : '';
    if (lo) fromEl.min = lo;
    if (hi) { toEl.max = hi; if (!toEl.value) toEl.value = hi; }
    if (lo && !fromEl.value) {
      var e = D.length - 1;
      var s = Math.max(0, e - 60);        /* 默认给近 60 个交易日，用户可改 */
      fromEl.value = D[s];
    }
  }
  initDates();

  /* 二级标签切换：资金流明细 ↔ 各指数涨跌汇总（首次切入才渲染） */
  var subBtns = Array.prototype.slice.call(subnav.querySelectorAll('button'));
  var rendered = false;
  function setView(v){
    var isRet = (v === 'ret');
    panelE.classList.toggle('ir-mode', isRet);
    subBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    if (isRet && !rendered) { rendered = true; render(); }
  }
  subBtns.forEach(function (b) {
    b.addEventListener('click', function () { setView(b.dataset.v); });
  });
  /* 从其它顶层标签切回「宽基ETF净资金流」时回到资金流明细，避免误以为进了别的表 */
  var eTop = document.querySelector('.tbltabs [data-t="e"]');
  if (eTop) eTop.addEventListener('click', function () { setView('flow'); });

  /* 无内联数据（如派生页未带 IDXR_*）时，自动拉一次全历史 */
  if (!D.length || !IDX.length) {
    loadFull().then(function () { initDates(); render(); }).catch(function () { render(); });
  } else {
    render();
  }
})();
