// 28 个跨行业题材分类总览（取代 504 东财概念版）
// 用法: node _gen_themes_28.mjs
// 产出: themes_table.html  +  themes_classified.csv
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('_themes_28.json', 'utf8'));
const d = data.themes;

// 赛道分类顺序与配色（单一层级，28 个题材均为业务与赛道）
const CAT_ORDER = [
  'AI与算力基础设施', '半导体与电子', '科技主题/国产替代', '机器人与高端制造',
  '医药生物', '新能源与电池', '军工与航天', '资源材料', '传媒消费',
];
const CAT_COLOR = {
  'AI与算力基础设施': '#1565c0',
  '半导体与电子': '#0277bd',
  '科技主题/国产替代': '#6a1b9a',
  '机器人与高端制造': '#00838f',
  '医药生物': '#ad1457',
  '新能源与电池': '#2e7d32',
  '军工与航天': '#4a148c',
  '资源材料': '#e65100',
  '传媒消费': '#00695c',
};
const CAT_DESC = {
  'AI与算力基础设施': 'AI 大模型训练/推理相关的算力、互联、散热与数据底座',
  '半导体与电子': '芯片设计制造设备及电子终端产业链',
  '科技主题/国产替代': '以龙头厂商链（华为/苹果）与自主可控（信创）为代表',
  '机器人与高端制造': '机器人、低空飞行器等高端制造新方向',
  '医药生物': '创新药、器械、研发外包与减重药物',
  '新能源与电池': '光伏、储能、动力电池及下一代电池技术',
  '军工与航天': '国防装备、军工电子与商业航天',
  '资源材料': '稀土永磁、黄金等战略资源与材料',
  '传媒消费': '网络游戏等文化消费',
};

// 统计 + 排序（按 CAT_ORDER，组内按 kw 拼音）
const stat = {};
for (const b of d) stat[b.cat] = (stat[b.cat] || 0) + 1;
const rows = d.slice().sort((a, b) => {
  const ia = CAT_ORDER.indexOf(a.cat), ib = CAT_ORDER.indexOf(b.cat);
  if (ia !== ib) return ia - ib;
  return a.kw.localeCompare(b.kw, 'zh');
});

const catChips = CAT_ORDER.map((c) =>
  `<button class="chip cat-chip" data-cat="${c}" style="--c:${CAT_COLOR[c]}">${c} <b>${stat[c] || 0}</b></button>`
).join('');

const trs = rows.map((b, i) => {
  const col = CAT_COLOR[b.cat] || '#666';
  return `<tr data-cat="${b.cat}" data-kw="${b.kw}" data-name="${b.name}" data-note="${b.note}">
    <td class="idx">${i + 1}</td>
    <td class="kw">${b.kw}</td>
    <td><span class="tag" style="background:${col}">${b.cat}</span></td>
    <td class="board">${b.code}　${b.name}</td>
    <td class="note">${b.note}</td>
  </tr>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>概念/题材分类总览（28个）</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#f5f6f8;color:#222}
.wrap{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:8px 0 4px}
.sub{color:#777;font-size:13px;margin-bottom:12px;line-height:1.7}
.sub b{color:#1565c0}
.chip{border:1px solid var(--c);color:var(--c);background:#fff;border-radius:20px;padding:5px 12px;font-size:13px;cursor:pointer;transition:.15s}
.chip b{margin-left:4px}
.chip.active{background:var(--c);color:#fff}
.chip.dim{opacity:.32}
.hint{color:#666;font-size:12px;line-height:1.7;margin:8px 2px;min-height:17px}
.hint:empty{margin:0}
.tbl-scroll{overflow-x:auto;background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee;white-space:nowrap}
th{background:#fafafa;position:sticky;top:0;cursor:pointer;user-select:none;font-weight:600}
th .ar{color:#bbb;font-size:11px}
th.sorted .ar{color:#1565c0}
td.idx{color:#999;width:48px}
td.kw{font-weight:600;white-space:nowrap}
td.board{font-variant-numeric:tabular-nums;color:#333;white-space:nowrap}
td.note{white-space:normal;min-width:200px;color:#555;line-height:1.5}
.tag{color:#fff;border-radius:6px;padding:2px 8px;font-size:12px}
.count-info{color:#777;font-size:12px;margin:6px 2px}
@media(max-width:600px){body{font-size:12px}h1{font-size:17px}th,td{padding:7px 8px}td.note{min-width:140px}}
</style></head><body>
<div class="wrap">
  <h1>概念 / 题材分类总览（28 个）</h1>
  <div class="sub">共 <b>${d.length}</b> 个跨行业题材（来源：主线分析 <code>_ml_concept.js</code> 的 THEMES 清单，数据截至 ${data.date}）。<br>
  说明：这 28 个题材均为<b>业务与赛道</b>性质，直接服务于「5-20日概念/题材主线分析」，比东方财富 504 个细分概念更聚焦。点击上方彩色标签可按<b>赛道分类</b>筛选，表头可点击排序。</div>
  <div class="filt-block">
    <div class="filt-label" style="font-size:13px;color:#666;margin-bottom:6px">赛道分类（共 ${CAT_ORDER.length} 类，点击标签查看说明）</div>
    <div class="stat-top" style="display:flex;flex-wrap:wrap;gap:8px">${catChips}</div>
  </div>
  <div class="hint" id="hint"></div>
  <div class="count-info" id="ci"></div>
  <div class="tbl-scroll">
    <table id="t">
      <thead><tr>
        <th data-k="idx" style="width:48px">序号<span class="ar">▲</span></th>
        <th data-k="kw">题材名称<span class="ar"></span></th>
        <th data-k="cat">赛道分类<span class="ar"></span></th>
        <th data-k="board">对应东财板块（代码 / 名称）<span class="ar"></span></th>
        <th data-k="note">覆盖说明<span class="ar"></span></th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
  </div>
</div>
<script>
const t=document.getElementById('t'),tbody=t.querySelector('tbody'),ci=document.getElementById('ci'),hint=document.getElementById('hint');
const CAT_DESC=${JSON.stringify(CAT_DESC)};
const CAT_COLOR=${JSON.stringify(CAT_COLOR)};
const all=[...tbody.querySelectorAll('tr')];
let curCat='',curKey='idx',curAsc=true;
function render(){
  let list=all.filter(r=>{
    const okCat=!curCat||r.dataset.cat===curCat;
    return okCat;
  });
  const k=curKey;
  list.sort((a,b)=>{
    let va,vb;
    if(k==='idx'){va=+a.children[0].textContent;vb=+b.children[0].textContent;}
    else if(k==='kw'){va=a.dataset.kw;vb=b.dataset.kw;return curAsc?va.localeCompare(vb,'zh'):vb.localeCompare(va,'zh');}
    else if(k==='cat'){va=a.dataset.cat;vb=b.dataset.cat;return curAsc?va.localeCompare(vb,'zh'):vb.localeCompare(va,'zh');}
    else if(k==='board'){va=a.dataset.name;vb=b.dataset.name;return curAsc?va.localeCompare(vb,'zh'):vb.localeCompare(va,'zh');}
    else {va=a.dataset.note;vb=b.dataset.note;return curAsc?va.localeCompare(vb,'zh'):vb.localeCompare(va,'zh');}
    return curAsc?va-vb:vb-va;
  });
  tbody.innerHTML='';
  if(list.length===0){
    const tr=document.createElement('tr');
    tr.innerHTML='<td colspan="5" style="text-align:center;color:#999;padding:26px">当前赛道下暂无题材'+(curCat?('（赛道「'+curCat+'」）'):'')+'</td>';
    tbody.appendChild(tr);
  } else { list.forEach(r=>tbody.appendChild(r)); }
  ci.textContent='当前显示 '+list.length+' / '+all.length+' 个题材'+(curCat?'（赛道：'+curCat+'）':'');
  hint.innerHTML = curCat ? ('▸ <b style="color:'+(CAT_COLOR[curCat]||'#666')+'">'+curCat+'</b>：'+(CAT_DESC[curCat]||'')) : '';
  t.querySelectorAll('th').forEach(th=>{th.classList.toggle('sorted',th.dataset.k===k);const ar=th.querySelector('.ar');ar.textContent=th.dataset.k===k?(curAsc?'▲':'▼'):'';});
  document.querySelectorAll('.cat-chip').forEach(c=>{c.classList.remove('active','dim');if(c.dataset.cat===curCat)c.classList.add('active');});
}
document.querySelectorAll('.chip[data-cat]').forEach(el=>el.onclick=()=>{curCat=(curCat===el.dataset.cat)?'':el.dataset.cat;render();});
t.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(curKey===k)curAsc=!curAsc;else{curKey=k;curAsc=true;}render();});
render();
</script>
</body></html>`;

fs.writeFileSync('themes_table.html', html);

// CSV（UTF-8 BOM）
const esc = (v) => { v = String(v); return /[,"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const csvRows = rows.map((b, i) => [i + 1, b.kw, b.cat, b.code, b.name, b.note].map(esc).join(','));
const csv = '﻿序号,题材名称,赛道分类,东财板块代码,东财板块名称,覆盖说明\n' + csvRows.join('\n');
fs.writeFileSync('themes_classified.csv', csv, 'utf8');

console.log('已生成 themes_table.html，题材', d.length, '个，赛道分类', CAT_ORDER.length, '类');
console.log('已生成 themes_classified.csv，行数(不含表头):', rows.length);
