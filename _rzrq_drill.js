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
    + '④ 表格四列（日期 / 融资余额 / <b>融资净买入</b> / 占流通市值）常驻显示，点表头可排序；表格行不再弹出悬浮明细。<br>'
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
    + '.rzq-st-chart svg{max-width:900px;margin:0 auto}'
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
    + '<th data-col="0">日期</th><th data-col="1">融资余额(' + U0.label + ')</th>'
    + '<th data-col="2">融资净买入(' + U0.label + ')</th><th data-col="3">占流通市值(%)</th>'
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
    q.value = it.c;
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
      if (S.code && v !== S.code) { S.code = ''; S.name = ''; RZQ.code = ''; RZQ.name = ''; }
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
  /* 走势图：蓝线=融资余额（上半部），红绿柱=融资净买入（下半部，红正绿负）；
     与二级弹窗走势图同一范式；悬停任意一期浮出当期数字明细。 */
  function spark(rows, U) {
    U = U || RZQ.effUnit(rows.map(function (x) { return x.r; }));
    var vals = rows.map(function (x) { return x.r; }).filter(function (v) { return v != null && !isNaN(v); });
    if (vals.length < 2) { S.geo = null; return ''; }
    /* 放大版：viewBox 560×320（原 520×232），桌面最大宽 900px；字号/线宽随比例同步放大 */
    var W = 560, H = 320, pl = 120, pr = 18, pt = 28, pb = 34;
    var iw = W - pl - pr, ih = H - pt - pb, bottom = pt + ih;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var pad = (mx - mn) * 0.12 || Math.abs(mx || 1) * 0.02;
    var lo = mn - pad, hi = mx + pad;
    var lineBot = pt + ih * 0.62, zeroY = pt + ih * 0.80, barH = ih * 0.16;
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
      + '<text x="' + pl + '" y="' + (pt - 9) + '" font-size="12.5" fill="#2f6bff">融资余额 · ' + U.label + ' · 共 ' + rows.length + ' 期</text>'
      + '<text x="' + (pl + iw) + '" y="' + (pt - 9) + '" font-size="12" fill="#9aa3b5" text-anchor="end">融资净买入 · ' + U.label + ' · 红正/绿负</text>'
      + '<text x="' + pl + '" y="' + (H - 10) + '" font-size="12.5" fill="#9aa3b5">' + rows[0].dt + '</text>'
      + '<text x="' + (pl + iw) + '" y="' + (H - 10) + '" font-size="12.5" fill="#9aa3b5" text-anchor="end">' + rows[rows.length - 1].dt + '</text>'
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
      ? ['日期', '融资余额', '融资净买入', '占流通']
      : ['日期', '融资余额(' + U.label + ')', '融资净买入(' + U.label + ')·' + G[S.gran], '占流通市值(%)'];
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
            + '<td class="num">' + RZQ.uVal(x.r, U) + '</td>'
            + '<td class="num ' + jcls(x.j) + '">' + RZQ.uSigned(x.j, U) + '</td>'
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


/* ===== 宽基ETF净资金流 标签页（注入 m 之后、s 之前；口径 A：每日净流入额累加为累计净申购余额） ===== */
(function(){
  if (typeof RZQ === 'undefined') return;
  var tabs = document.querySelector('.tbltabs');
  var sec = document.querySelector('.tblsec');
  if (!tabs || !sec) return;
  var uBtn = tabs.querySelector('[data-t="u"]');
  if (!uBtn) return;

  var IDX = ["沪深300","中证A500","上证50","中证500","中证1000","科创50","创业板指","中证2000","科创100","创业板50","上证指数","深证成指"];

  /* CSS（作用域限定在面板内） */
  var css = ''
    + '.etf-top{padding:4px 2px 2px}'
    + '.etf-title{font-size:15px;font-weight:700;color:#1f2a44}'
    + '.etf-note{font-size:12px;color:#66708a;line-height:1.6;margin:4px 0 8px}'
    + '.etf-ctrls{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;margin-bottom:8px}'
    + '.etf-lbl{font-size:13px;color:#66708a;margin-right:4px}'
    + '.etf-rng button,.etf-gran button{border:1px solid #e3e8f0;background:#fff;color:#66708a;padding:5px 12px;font-size:12.5px;cursor:pointer;border-radius:7px;margin-right:-1px}'
    + '.etf-rng button.on,.etf-gran button.on{background:#2f6bff;color:#fff;border-color:#2f6bff;font-weight:600}'
    + '.etf-legend{font-size:12px;color:#66708a;margin:2px 0 6px;display:flex;gap:16px;flex-wrap:wrap}'
    + '.etf-legend .lg.blue{color:#2f6bff}.etf-legend .lg.red{color:#c0392b}'
    + '.etf-chartbox{border:1px solid #eef1f6;border-radius:10px;background:#fff;padding:4px}'
    + '.etf-tblwrap{max-height:480px;overflow:auto;border:1px solid #eef1f6;border-radius:10px;margin-top:10px}'
    + 'table.etf-table{border-collapse:collapse;width:100%;font-size:13px}'
    + 'table.etf-table th,table.etf-table td{padding:8px 9px;border-bottom:1px solid #eef1f5;white-space:nowrap;text-align:right}'
    + 'table.etf-table th{background:#f6f8fc;color:#465267;font-weight:600;font-size:12px;position:sticky;top:0}'
    + 'table.etf-table th:first-child,table.etf-table td:first-child{text-align:left}'
    + 'table.etf-table tbody tr.daterow{cursor:pointer}'
    + 'table.etf-table tbody tr.daterow:hover{background:#f3f7ff}'
    + 'table.etf-table tbody tr.daterow td:first-child{color:#2f6bff;font-weight:600}'
    + '.etf-pos{color:#e23b3b}.etf-neg{color:#16a34a}'
    + '.etf-sub{background:#fafbfe}'
    + '.etf-sub table{font-size:12px;border-collapse:collapse;width:100%}'
    + '.etf-sub th,.etf-sub td{padding:5px 8px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap}'
    + '.etf-sub th{background:#f1f5fb;color:#66708a;font-weight:600}'
    + '.etf-sub th:first-child,.etf-sub td:first-child{text-align:left}'
    + '.etf-sub tr.idxrow{cursor:pointer}.etf-sub tr.idxrow:hover{background:#f3f7ff}.etf-sub tr.idxrow td:first-child{color:#2f6bff}'
    + '.etf-sub .etf-pos{color:#e23b3b}.etf-sub .etf-neg{color:#16a34a}'
    + '.etf-sub .code{font-family:ui-monospace,Menlo,Consolas,monospace;color:#66708a}'
    + '.etf-msg{padding:18px;color:#66708a;font-size:13px;text-align:center}'
    + '.etf-cov{margin:6px 0 2px;padding:7px 10px;background:#fff4e5;border:1px solid #ffd8a8;border-radius:8px;font-size:12px;color:#9a5b00;line-height:1.55}'
    + '@media(max-width:620px){table.etf-table th,table.etf-table td{padding:7px 6px;font-size:12px}.etf-legend{font-size:11px;gap:10px}.etf-rng button,.etf-gran button{padding:4px 9px;font-size:12px}}';
  var st = document.createElement('style'); st.id='etf-tab-css'; st.textContent = css; document.head.appendChild(st);

  /* 按钮（插在 m 之后、s 之前）+ 面板 */
  var eBtn = document.createElement('button');
  eBtn.className='tbtn'; eBtn.dataset.t='e'; eBtn.textContent='宽基ETF净资金流';
  tabs.insertBefore(eBtn, uBtn);

  var panel = document.createElement('div');
  panel.className='tpanel'; panel.id='tpanel-e'; panel.style.display='none';
  panel.innerHTML =
    '<div class="etf-top">'
    + '<div class="etf-title">宽基 ETF 资金流（全市场净申购）</div>'
    + '<div class="etf-note">口径 A：每只 ETF 自上市日起「每日净流入额（份额法净申购）」逐日累加为累计净申购（余额）；含全体一级市场申购者，2024+ 为护盘资金日频代理，非汇金独占。</div>'
    + '<div class="etf-cov" id="etfCov"></div>'
    + '</div>'
    + '<div class="etf-ctrls">'
    +   '<div class="etf-rng"><span class="etf-lbl">时间段</span>'
    +     '<button class="erng" data-r="m1">1个月</button>'
    +     '<button class="erng on" data-r="m3">3个月</button>'
    +     '<button class="erng" data-r="m6">半年</button>'
    +     '<button class="erng" data-r="ytd">今年以来</button>'
    +     '<button class="erng" data-r="all">全部</button>'
    +   '</div>'
    +   '<div class="etf-gran"><span class="etf-lbl">粒度</span>'
    +     '<button class="eg on" data-g="d">日</button>'
    +     '<button class="eg" data-g="w">周</button>'
    +     '<button class="eg" data-g="m">月</button>'
    +   '</div>'
    + '</div>'
    + '<div class="etf-legend"><span class="lg blue">■ 累计净申购金额（余额·左轴·亿）</span><span class="lg red">■ 当日净申购/赎回（右轴·亿·正红负绿）</span></div>'
    + '<div class="etf-chartbox"><svg id="etfSvg" viewBox="0 0 1000 430" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg></div>'
    + '<div class="etf-tblsec"><div class="etf-tblwrap"><table class="etf-table"><thead><tr>'
    +   '<th>日期</th><th>累计净申购(亿)</th><th>当日净申购(亿)</th><th>总份额(亿份)</th><th>纳入指数</th>'
    + '</tr></thead><tbody id="etfTbody"></tbody></table></div></div>';
  sec.appendChild(panel);

  var DATA=null, STATE={range:'m3',gran:'d'}, svg=panel.querySelector('#etfSvg'), tbody=panel.querySelector('#etfTbody');

  function fmtAxis(v){ if(v==null) return ''; var a=Math.abs(v); if(a>=10000) return (v/10000).toFixed(1)+'万亿'; return Math.round(v)+'亿'; }
  function sign2(v){ if(v==null) return '—'; return (v>=0?'+':'')+v.toFixed(2); }
  function cls2(v){ return v==null?'':(v>=0?'etf-pos':'etf-neg'); }

  function rangeCount(){
    if(!DATA) return 0;
    var n=DATA.dates.length;
    switch(STATE.range){
      case 'm1': return Math.min(n,21);
      case 'm3': return Math.min(n,63);
      case 'm6': return Math.min(n,125);
      case 'ytd': { var y=new Date().getFullYear(); for(var i=0;i<n;i++){ if(parseInt(DATA.dates[i].slice(0,4),10)>=y) return n-i; } return n; }
      default: return n;
    }
  }

  function aggregate(dates,acc,net,sh,nidx,gran){
    if(gran==='d') return {dates:dates,acc:acc,net:net,sh:sh,nidx:nidx};
    var map={}, order=[];
    for(var i=0;i<dates.length;i++){
      var key;
      if(gran==='w'){ var dt=new Date(dates[i]); var jan=new Date(dt.getFullYear(),0,1); var wk=Math.ceil((((dt-jan)/86400000)+jan.getDay()+1)/7); key=dt.getFullYear()+'-W'+wk; }
      else { key=dates[i].slice(0,7); }
      if(!map[key]){ map[key]={dates:[],acc:[],net:[],sh:[],nidx:[]}; order.push(key); }
      var b=map[key]; b.dates.push(dates[i]); b.acc.push(acc[i]); b.net.push(net[i]); b.sh.push(sh[i]); b.nidx.push(nidx[i]);
    }
    var o={dates:[],acc:[],net:[],sh:[],nidx:[]};
    order.forEach(function(k){
      var b=map[k];
      o.dates.push(b.dates[b.dates.length-1]);
      o.acc.push(b.acc[b.acc.length-1]);
      o.net.push(b.net.reduce(function(a,c){return (a==null?0:a)+(c==null?0:c);},0));
      o.sh.push(b.sh[b.sh.length-1]);
      o.nidx.push(b.nidx[b.nidx.length-1]);
    });
    return o;
  }

  function view(){
    var cnt=rangeCount(); var start=DATA.dates.length-cnt;
    var dates=DATA.dates.slice(start);
    var acc=DATA.total.acc.slice(start), net=DATA.total.net.slice(start), sh=DATA.total.sh.slice(start), nidx=DATA.total.nidx.slice(start);
    return aggregate(dates,acc,net,sh,nidx,STATE.gran);
  }

  function renderChart(v){
    var W=1000,H=430,ML=72,MR=72,MT=28,PB=398;
    var n=v.dates.length;
    var xf=function(i){return ML+(n<=1?0:i*(W-ML-MR)/(n-1));};
    var accArr=v.acc.filter(function(x){return x!=null;}); if(accArr.length===0) accArr=[0];
    var accMax=Math.max.apply(null,accArr); accMax=Math.max(1000,Math.ceil(accMax/1000)*1000*1.05);
    var netArr=v.net.filter(function(x){return x!=null;}).map(Math.abs); if(netArr.length===0) netArr=[1];
    var nMax=Math.max.apply(null,netArr); nMax=Math.max(100,Math.ceil(nMax/100)*100*1.1);
    var yA=function(val){return PB-val/accMax*(PB-MT);};
    var yB=function(val){return PB-(val+nMax)/(2*nMax)*(PB-MT);};
    var s='';
    for(var g=0;g<=4;g++){ var val=accMax*g/4, y=yA(val);
      s+='<line x1="'+ML+'" y1="'+y+'" x2="'+(W-MR)+'" y2="'+y+'" stroke="#eef1f6"/>';
      s+='<text x="'+(ML-8)+'" y="'+(y+5)+'" text-anchor="end" font-size="15" fill="#2f6bff">'+fmtAxis(val)+'</text>'; }
    [-nMax,0,nMax].forEach(function(val){ var y=yB(val); s+='<text x="'+(W-MR+8)+'" y="'+(y+5)+'" text-anchor="start" font-size="15" fill="#c0392b">'+fmtAxis(val)+'</text>'; });
    var bw=Math.min(20,(W-ML-MR)/Math.max(n,1)*0.5), zeroY=yB(0);
    for(var i=0;i<n;i++){ if(v.net[i]==null) continue; var cx=xf(i), top=yB(v.net[i]), h=Math.abs(top-zeroY), col=v.net[i]>=0?'#c0392b':'#2f9e44';
      s+='<rect x="'+(cx-bw/2)+'" y="'+Math.min(top,zeroY)+'" width="'+bw+'" height="'+h+'" fill="'+col+'" opacity="0.82"/>'; }
    var pts=[]; for(var i=0;i<n;i++){ if(v.acc[i]==null) continue; pts.push(xf(i)+','+yA(v.acc[i])); }
    if(pts.length){ s+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="#2f6bff" stroke-width="2.4"/>';
      for(var i=0;i<pts.length;i++){ var p=pts[i].split(','); s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2.6" fill="#2f6bff"/>'; } }
    var step=Math.max(1,Math.ceil(n/10));
    for(var i=0;i<n;i+=step){ var cx=xf(i); var lab=v.dates[i].slice(2,7); if(STATE.gran!=='d') lab=v.dates[i].slice(0,7);
      s+='<text x="'+cx+'" y="'+(PB+18)+'" text-anchor="middle" font-size="15" fill="#64748b" transform="rotate(-30 '+cx+' '+(PB+18)+')">'+lab+'</text>'; }
    svg.innerHTML=s;
  }

  function renderTable(v){
    var rows=[];
    for(var i=v.dates.length-1;i>=0;i--){
      rows.push('<tr class="daterow" data-i="'+i+'"><td>'+v.dates[i]+'</td>'
        +'<td>'+fmtAxis(v.acc[i])+'</td>'
        +'<td class="'+cls2(v.net[i])+'">'+sign2(v.net[i])+'</td>'
        +'<td>'+(v.sh[i]==null?'—':v.sh[i].toFixed(1))+'</td>'
        +'<td>'+(v.nidx[i]==null?'—':v.nidx[i])+'</td></tr>');
    }
    tbody.innerHTML=rows.join('');
  }

  function render(){
    if(!DATA) return;
    var v=view();
    renderChart(v);
    renderTable(v);
  }

  function ensure(){
    if(DATA){ render(); return; }
    tbody.innerHTML='<tr><td colspan="5" class="etf-msg">宽基 ETF 资金流数据加载中…</td></tr>';
    RZQ.load('_etf_flow.json').then(function(d){ DATA=d; var cov=panel.querySelector('#etfCov'); if(cov&&d.meta&&d.meta.coverage) cov.textContent='⚠ '+d.meta.coverage; render(); }).catch(function(e){
      tbody.innerHTML='<tr><td colspan="5" class="etf-msg">数据暂未就绪（真实全历史回溯管线构建中）。'+(e&&e.message?('<br>'+e.message):'')+'</td></tr>';
    });
  }

  panel.querySelectorAll('.erng').forEach(function(b){ b.addEventListener('click',function(){
    panel.querySelectorAll('.erng').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); STATE.range=b.dataset.r; render(); }); });
  panel.querySelectorAll('.eg').forEach(function(b){ b.addEventListener('click',function(){
    panel.querySelectorAll('.eg').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); STATE.gran=b.dataset.g; render(); }); });

  /* 下钻：日期行 → 12 指数表；指数行 → 逐只 ETF 表 */
  tbody.addEventListener('click', function(e){
    var tr=e.target.closest('tr.daterow'); if(!tr) return;
    var i=+tr.dataset.i;
    var next=tr.nextElementSibling;
    if(next && next.classList.contains('etf-sub') && next.dataset.level==='idx'){ next.remove(); return; }
    if(next && next.classList.contains('etf-sub')) next.remove();
    var start=DATA.dates.length-rangeCount(); var gi=start+i;
    var d=DATA.dates[gi];
    var html='<tr class="etf-sub" data-level="idx"><td colspan="5"><div style="padding:2px 4px">';
    html+='<div style="font-size:12px;color:#66708a;margin:4px 2px">'+d+' · 12 宽基指数净申购（当日 / 累计）</div>';
    html+='<table><thead><tr><th>宽基指数</th><th>当日净申购(亿)</th><th>累计净申购(亿)</th><th>ETF数</th></tr></thead><tbody>';
    var idm=DATA.idx;
    IDX.forEach(function(name){
      var id=idm[name]; if(!id) return;
      var net=id.net[gi], acc=id.acc[gi];
      var nec=(id.etf&&id.etf.length)||0;
      html+='<tr class="idxrow" data-name="'+name+'"><td>'+name+'</td><td class="'+cls2(net)+'">'+sign2(net)+'</td><td>'+fmtAxis(acc)+'</td><td>'+nec+'</td></tr>';
    });
    html+='</tbody></table></div></td></tr>';
    tr.insertAdjacentHTML('afterend', html);
  });

  tbody.addEventListener('click', function(e){
    var ir=e.target.closest('tr.idxrow'); if(!ir) return;
    var subTr=ir.closest('tr.etf-sub'); if(!subTr) return;
    var name=ir.dataset.name;
    var next=ir.nextElementSibling;
    if(next && next.classList.contains('etf-sub') && next.dataset.level==='etf'){ next.remove(); return; }
    if(next && next.classList.contains('etf-sub')) next.remove();
    var dtr=ir.closest('tr.daterow'); var gi=DATA.dates.length-rangeCount()+(+dtr.dataset.i);
    var etfs=DATA.etf.filter(function(x){return x.idx===name;});
    var html='<tr class="etf-sub" data-level="etf"><td colspan="5"><div style="padding:2px 16px"><table><thead><tr><th>ETF代码</th><th>简称</th><th>当日净申购(亿)</th><th>累计净申购(亿)</th></tr></thead><tbody>';
    etfs.forEach(function(x){
      var net=x.net[gi], acc=x.acc[gi];
      html+='<tr><td class="code">'+x.code+'</td><td>'+x.name+'</td><td class="'+cls2(net)+'">'+sign2(net)+'</td><td>'+fmtAxis(acc)+'</td></tr>';
    });
    html+='</tbody></table></div></td></tr>';
    ir.insertAdjacentHTML('afterend', html);
  });

  eBtn.addEventListener('click', function(){ ensure(); });
})();
