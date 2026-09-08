import fs from 'fs';

const dir = 'C:/Users/15921/WorkBuddy/2026-08-03-21-11-02/market-review';
const byFile = dir + '/mainline-20260807.html';
const conFile = dir + '/mainline_concept-20260807.html';

const byHtml = fs.readFileSync(byFile, 'utf8');
const conHtml = fs.readFileSync(conFile, 'utf8');

// ---- 1) Extract the SW appendix region from the by-industry report ----
// From the 申万一级行业概览 title, up to (but not including) the 主力资金净流入TOP20 title.
const re = /<div class="data-basis-title"[^>]*>申万一级行业概览[\s\S]*?(?=<div class="data-basis-title"[^>]*>主力资金净流入TOP20)/;
const m = byHtml.match(re);
if (!m) { console.error('ERROR: SW appendix region not found in by-industry report'); process.exit(1); }
const swRegion = m[0];

// ---- 2) Build the new appendix section for the concept report ----
const section = `  <div class="section sw-appendix">
    <div class="section-title">附录：申万行业概览（一级 / 二级）</div>
    ${swRegion}
  </div>
`;

// ---- 3) Inject the missing .hier-* CSS into the concept report <style> ----
const hierCss = `
    .sw-appendix .hier-row { font-size: 13px; line-height: 1.9; padding: 6px 0; border-bottom: 1px dashed #e9ecef; }
    .sw-appendix .hier-row:last-child { border-bottom: none; }
    .sw-appendix .hier-l1 { font-weight: 700; color: #1a1a2e; }
    .sw-appendix .hier-l1c { font-size: 12px; color: #c62828; font-weight: 600; }
    .sw-appendix .hier-l2 { display: inline-block; background: #f1f3f5; border-radius: 4px; padding: 1px 8px; margin: 2px 4px 2px 0; font-size: 12px; color: #495057; }
`;
let newCon = conHtml.replace('</style>', hierCss + '</style>');
if (newCon === conHtml) { console.error('ERROR: </style> not found in concept report'); process.exit(1); }

// ---- 4) Insert the appendix section BEFORE the footer, i.e. right after the
//         数据依据 block (which is the last element of partsHtml, immediately before footer).
//         Result order: [5/10/20 主线分析 sections][数据依据][附录][footer]. ----
const dbAnchor = '<div class="data-basis-title">数据依据：概念/题材板块涨跌排行（5日/10日/20日）</div>';
if (!newCon.includes(dbAnchor)) { console.error('ERROR: 数据依据 block not found'); process.exit(1); }
const footerAnchor = '<div class="footer">数据仅供参考，不构成投资建议 · 概念/题材板块由聚源产业概念清单解析</div>';
if (!newCon.includes(footerAnchor)) { console.error('ERROR: footer anchor not found'); process.exit(1); }
newCon = newCon.replace(footerAnchor, section + '    ' + footerAnchor);

// ---- 5) Attach sorting to the moved SW tables ----
const sortHook = "document.querySelectorAll('table.etf-table').forEach(makeSortable);";
if (!newCon.includes(sortHook)) { console.error('ERROR: sort hook not found in concept report'); process.exit(1); }
newCon = newCon.replace(sortHook,
  sortHook + "\n    makeSortable(document.getElementById('sw1-table'));\n    makeSortable(document.getElementById('sw2-table'));");

fs.writeFileSync(conFile, newCon, 'utf8');
console.log('OK: SW appendix moved to concept report. swRegion length =', swRegion.length);
