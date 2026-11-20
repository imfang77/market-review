/* 情绪看板：融资余额 / 涨跌家数 / 宽基ETF资金流
 * 数据源 _sentiment_brief.json（约 4KB），不加载 3MB 的 _etf_flow.json。
 * 容器 <div id="sentiment-board" data-mode="full|mini"></div>
 */
(function () {
  'use strict';
  var STYLE = [
    '.sb-wrap{width:100%}',
    '.sb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
    '.sb-card{display:block;background:#fff;border:1px solid #e9ecef;border-radius:10px;padding:14px 16px;text-decoration:none;color:inherit;transition:box-shadow .15s,border-color .15s;min-width:0}',
    '.sb-card:hover{border-color:#4263eb;box-shadow:0 4px 12px rgba(66,99,235,.12)}',
    '.sb-h{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#343a40}',
    '.sb-h .sb-arrow{margin-left:auto;color:#ced4da;font-size:15px}',
    '.sb-main{font-size:21px;font-weight:800;line-height:1.25;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sb-sub{font-size:12px;color:#868e96;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sb-svg{display:block;width:100%;height:42px;margin-top:8px}',
    '.sb-foot{font-size:11px;color:#adb5bd;margin-top:6px;line-height:1.5}',
    '.sb-up{color:#e5484d!important}.sb-dn{color:#2f9e44!important}',
    '.sb-rz .sb-h i{width:8px;height:8px;border-radius:50%;background:#4263eb;display:inline-block}',
    '.sb-ud .sb-h i{width:8px;height:8px;border-radius:50%;background:#e5484d;display:inline-block}',
    '.sb-etf .sb-h i{width:8px;height:8px;border-radius:50%;background:#1c7ed6;display:inline-block}',
    '@media(max-width:700px){.sb-grid{grid-template-columns:1fr;gap:10px}.sb-card{padding:12px 14px}.sb-main{font-size:19px}.sb-svg{height:36px}}',
    '.sb-mini .sb-card{padding:11px 13px}.sb-mini .sb-main{font-size:18px}.sb-mini .sb-svg{height:32px}',
    '.sb-title{font-size:13px;color:#868e96;letter-spacing:1.5px;font-weight:600;margin:0 0 12px 4px;text-transform:uppercase}',
    '.reddot{display:none;width:9px;height:9px;border-radius:50%;background:#e03131;margin-left:8px;vertical-align:middle;box-shadow:0 0 0 3px rgba(224,49,49,.18)}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('sb-style')) return;
    var st = document.createElement('style');
    st.id = 'sb-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function signed(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (v > 0 ? '+' : '') + fmt(v, d);
  }
  function cls(v) { return v > 0 ? 'sb-up' : (v < 0 ? 'sb-dn' : ''); }

  function spark(vals, color) {
    var a = (vals || []).filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
    if (a.length < 2) return '';
    var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a), sp = (hi - lo) || 1;
    var w = 200, h = 42, pad = 3;
    var pts = a.map(function (v, i) {
      var x = pad + (w - 2 * pad) * i / (a.length - 1);
      var y = h - pad - (h - 2 * pad) * (v - lo) / sp;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = pts[pts.length - 1].split(',');
    return '<svg class="sb-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.5" fill="' + color + '"/></svg>';
  }

  function card(opt) {
    return '<a class="sb-card ' + opt.klass + '" href="' + opt.href + '">' +
      '<div class="sb-h"' + (opt.id ? ' id="' + opt.id + '"' : '') + '><i></i><span>' + opt.title + '</span>' +
      (opt.dot ? '<span class="reddot" id="rzrq-reddot" title="数据有更新，未查看"></span>' : '') +
      '<span class="sb-arrow">&#8599;</span></div>' +
      '<div class="sb-main ' + (opt.mainCls || '') + '">' + opt.main + '</div>' +
      '<div class="sb-sub">' + opt.sub + '</div>' +
      spark(opt.series, opt.color) +
      '<div class="sb-foot">' + opt.foot + '</div></a>';
  }

  function render(board, d) {
    var mini = board.getAttribute('data-mode') === 'mini';
    var rz = d.rz, ud = d.ud, etf = d.etf;
    var bal = rz.bal[rz.bal.length - 1], jme = rz.jme[rz.jme.length - 1];
    var bal30 = bal - rz.bal[0];
    var up = ud.up[ud.up.length - 1], dn = ud.down[ud.down.length - 1];
    var ratio = ud.ratio[ud.ratio.length - 1];
    var net = etf.net[etf.net.length - 1], acc = etf.acc[etf.acc.length - 1];
    var hasRz = !!document.getElementById('rzrq-reddot') || !mini;

    var html = '';
    if (!mini) html += '<div class="sb-title">情绪看板</div>';
    html += '<div class="sb-grid' + (mini ? ' sb-mini' : '') + '">';

    html += card({
      klass: 'sb-rz', href: 'rzrq_updown_detail.html',
      id: hasRz ? 'rzrq-card-link' : '', dot: hasRz,
      title: '融资余额',
      main: fmt(bal, 0) + ' <span style="font-size:12px;font-weight:600">亿</span>',
      sub: '当日净买入 <span class="' + cls(jme) + '">' + signed(jme, 1) + ' 亿</span> · ' + rz.dates[rz.dates.length - 1],
      series: rz.bal, color: '#4263eb',
      foot: '近' + rz.bal.length + '交易日余额变动 <span class="' + cls(bal30) + '">' + signed(bal30, 0) + ' 亿</span> · T+1 披露'
    });

    html += card({
      klass: 'sb-ud', href: 'rzrq_updown_detail.html#updown',
      title: '涨跌家数',
      main: '<span class="sb-up">' + fmt(up) + '</span> <span style="color:#adb5bd;font-size:14px">/</span> <span class="sb-dn">' + fmt(dn) + '</span>',
      sub: '上涨占比 ' + (ratio === null || ratio === undefined ? '—' : fmt(ratio * 100, 1) + '%') + ' · ' + ud.dates[ud.dates.length - 1],
      series: ud.up, color: '#e5484d',
      foot: '红=上涨家数 · 绿=下跌家数 · 全市场口径'
    });

    html += card({
      klass: 'sb-etf', href: 'rzrq_updown_detail.html#etf',
      title: '宽基 ETF 资金流',
      main: '<span class="' + cls(net) + '">' + signed(net, 1) + '</span> <span style="font-size:12px;font-weight:600">亿</span>',
      sub: '当日净申购 · ' + etf.dates[etf.dates.length - 1],
      series: etf.acc, color: '#1c7ed6',
      foot: '累计净申购 ' + fmt(acc, 0) + ' 亿 · 份额法一级申赎，非二级买入资金'
    });
    html += '</div>';
    board.innerHTML = html;

    // 与原有红点逻辑兼容：meta 变化时更新链接戳 / 显示红点
    if (!mini) {
      try {
        fetch('_rzrq_meta.json?v=' + Date.now()).then(function (r) { return r.json(); }).then(function (m) {
          if (!m || !m.builtAt) return;
          var a = document.getElementById('rzrq-card-link');
          if (a) a.href = 'rzrq_updown_detail.html?v=' + encodeURIComponent(m.builtAt);
          if (localStorage.getItem('rzrq_card_lastviewed') !== m.builtAt) {
            var dot = document.getElementById('rzrq-reddot');
            if (dot) dot.style.display = 'inline-block';
          }
        }).catch(function () {});
      } catch (e) {}
    }
  }

  function boot() {
    injectStyle();
    var boards = document.querySelectorAll('#sentiment-board');
    if (!boards.length) return;
    fetch('_sentiment_brief.json?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('brief http ' + r.status);
      return r.json();
    }).then(function (d) {
      for (var i = 0; i < boards.length; i++) render(boards[i], d);
    }).catch(function (e) {
      // 数据缺失时保留 HTML 中的 fallback 入口，不让页面空白
      console.warn('sentiment brief load fail', e);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
