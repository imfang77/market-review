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
    RZQ.load('_etf_flow.json').then(function(d){ DATA=d; render(); }).catch(function(e){
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
