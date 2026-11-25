/* ===== 宽基ETF净资金流 图表（复用主图双轴样式；蓝线=累计净申购余额 左轴，红绿柱=当日净申购 右轴） ===== */
/* 语义（11-20 定稿）：蓝线=全市场累计净申购（恒不变）；当日红绿柱=12指数分段堆叠，选中对标指数时只堆叠所选指数分段；
   「对标指数」多选=叠加所选指数的点位线；「对标ETF」多选=叠加所选ETF的前复权净值线（固定归一化）；
   两类对标线共用最右第三轴（含ETF时强制归一化基期=100，量纲才可同轴比较）；默认均不选=无对标线；勾选立即生效。 */
(function(){
  var box=document.getElementById('ebox'); if(!box) return;
  var svg=document.getElementById('esvg'), plot=document.getElementById('eplot'),
      vline=document.getElementById('evline'), ov=document.getElementById('eoverlay'),
      tip=document.getElementById('etip'), legend=document.getElementById('elg');
  if(!svg||!plot) return;
  /* 图例 hover → 对应线高亮、其它线淡化（11-20新增）：图例项与线共用 data-lg 标识；事件委托绑在稳定容器上 */
  if(legend){
    function lgFocus(key){
      if(!plot) return;
      var els=plot.querySelectorAll('[data-lg]');
      for(var i=0;i<els.length;i++){
        var k=els[i].getAttribute('data-lg');
        els[i].style.opacity=key?(k===key?'1':'0.16'):'';
      }
    }
    legend.addEventListener('mouseover',function(e){
      var s=(e.target&&e.target.closest)?e.target.closest('[data-lg]'):null;
      if(!s||s===legend)return;
      lgFocus(s.getAttribute('data-lg')); s.style.fontWeight='700';
    });
    legend.addEventListener('mouseout',function(e){
      var s=(e.target&&e.target.closest)?e.target.closest('[data-lg]'):null;
      if(!s||s===legend)return;
      lgFocus(null); s.style.fontWeight='';
    });
  }
  var W=1000, MT=46, PB=402;
  var ML=70, MR=112, pw=W-ML-MR, plotH=PB-MT;
  var G='d', def='m3';
  var ER=(typeof ETF_RANGES!=='undefined')?ETF_RANGES:{m3:0,all:0};
  var cur=ER[def]||0;   /* 默认3个月：显示区间与按钮高亮一致 */
  var curEnd=-1;        /* 结束索引：-1=到末尾；指定时间段时设为结束日索引（两图同步） */
  var ED=(typeof ETF_D!=='undefined')?ETF_D:[];
  var EA=(typeof ETF_ACC!=='undefined')?ETF_ACC:[];
  var EN=(typeof ETF_NET!=='undefined')?ETF_NET:[];
  var IDXN=(typeof ETF_IDX_NAMES!=='undefined')?ETF_IDX_NAMES:[];
  var IDXC=(typeof ETF_IDX_CLOSE!=='undefined')?ETF_IDX_CLOSE:{};
  var IDXNET=(typeof ETF_IDX_NET!=='undefined')?ETF_IDX_NET:{};   /* 堆叠柱按12指数分段所需 */
  var EC=(typeof ETF_CLOSES!=='undefined')?ETF_CLOSES:{};          /* 30只ETF前复权净值 {code:[净值|null]} */
  var EM=(typeof ETF_META!=='undefined')?ETF_META:[];              /* [{code,name,idx}] */
  /* ETF净值线调色板（区别于指数色：橙/青/洋红/黄绿等，避免与蓝线红绿柱混淆） */
  var ETPAL=['#ea580c','#0891b2','#c026d3','#65a30d','#f59e0b','#6366f1','#db2777','#14b8a6','#a16207','#8b5cf6','#dc2626','#0e7490'];
  var emeta={};EM.forEach(function(m){emeta[m.code]=m;});
  function eCol(code,order){return ETPAL[order%ETPAL.length];}
  function eLabel(code){var m=emeta[code];return m?(m.name.replace(/ETF.*/,'')+'·'+code.slice(-4)):code;}  /* 线尾短标签：主体+代码后4位 */
  var ALLKEY='__ALL__';
  /* 柱色铁律：正=红 #e24b4a、负=绿 #16a34a（涨红跌绿），恒不随指数变色 */
  var UP='#e24b4a', DOWN='#16a34a';
  /* 12 指数点位线专属色（互异、避开蓝线#2f6bff/红绿柱/紫汇金#7c3aed/事件竖线#8b5cf6） */
  var IDXCOLOR={'沪深300':'#0d9488','中证A500':'#be123c','上证50':'#7c3aed','中证500':'#c2410c',
    '中证1000':'#059669','科创50':'#db2777','创业板指':'#4f46e5','中证2000':'#b45309',
    '科创100':'#0284c7','创业板50':'#9333ea','上证指数':'#a16207','深证成指':'#334155'};
  function iCol(n){return IDXCOLOR[n]||'#0f766e';}
  function REDSHADES(){return ['#f4c7c5','#eeb0ad','#e89995','#e2807c','#d96763','#d14e4a','#c43b37','#b52f2b','#a32622','#8f1e1b','#771714','#5c100e'];}
  function GREENSHADES(){return ['#bfe6cf','#a6d9bb','#8ccba7','#71bd93','#56ae7f','#3f9d6c','#2f8c5c','#247a4e','#1c6942','#155737','#0f452c','#0a3321'];}
  /* pointSel=画点位线的指数数组；空=「全部」默认视图（无点位线） */
  var pointSel=[];
  /* etfSel=画净值线的ETF代码数组（选中即画归一化净值线，空=无ETF线） */
  var etfSel=[];
  /* normMode=true(默认)=点位线归一化(基期=100)；false=真实点位(点) */
  var normMode=true;
  /* 有效归一化：含ETF线时强制归一化（净值/点位不同量纲，只有归一化才能同轴比较） */
  function effNorm(){return normMode||etfSel.length>0;}
  var N=ED.length;
  var EVS=(typeof ETF_EVENTS!=='undefined')?ETF_EVENTS:[];
  var HJS=(typeof ETF_HJ!=='undefined')?ETF_HJ:[];
  function fmt(v){return (v==null)?'—':v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function metrics(){var rw=(svg.clientWidth&&svg.clientWidth>0)?svg.clientWidth:1000;return {F:9*W/rw,nl:Math.max(3,Math.min(9,Math.floor(rw/118)))};}
  var yloL=0,yhiL=1,yloR=-1,yhiR=1;
  /* 日/周/月：累计取周期末快照，当日净申购取周期内累加；点位取周期内最后一个有值日 */
  function buildView(){
    /* 当日净申购分段：pointSel 非空时只保留所选指数的分段（未选置0）→ 柱只显示所选；
       色深索引仍按 IDXN 固定位，保证同一指数颜色恒定；全部(默认)时 12 指数全显示 */
    function partsAt(i){return IDXN.map(function(nm){return ((pointSel.length&&pointSel.indexOf(nm)<0)?0:((IDXNET[nm]&&IDXNET[nm][i])||0));});}
    if(G==='d'){
      var idx=[],acc=[],net=[],dd=[],parts=[],sh={},ec={};
      pointSel.forEach(function(nm){sh[nm]=[];});
      etfSel.forEach(function(c){ec[c]=[];});
      var iEnd=(curEnd>=cur)?Math.min(curEnd,N-1):N-1;
      for(var i=cur;i<=iEnd;i++){
        idx.push(i);acc.push(EA[i]);net.push(EN[i]);dd.push(ED[i]);parts.push(partsAt(i));
        pointSel.forEach(function(nm){var s=IDXC[nm];sh[nm].push(s? s[i]:null);});
        etfSel.forEach(function(c){var a=EC[c];ec[c].push(a? a[i]:null);});
      }
      return {idx:idx,acc:acc,net:net,dd:dd,parts:parts,sh:sh,ec:ec};
    }
    var map={},order=[];
    var iEnd=(curEnd>=cur)?Math.min(curEnd,N-1):N-1;
    for(var i=cur;i<=iEnd;i++){
      var key=G==='w'?weekKey(ED[i]):ED[i].slice(0,7);
      if(!map[key]){map[key]={idx:[],acc:[],net:0,dd:[],parts:IDXN.map(function(){return 0;}),sh:{},ec:{}};
        pointSel.forEach(function(nm){map[key].sh[nm]=null;});
        etfSel.forEach(function(c){map[key].ec[c]=null;});order.push(key);}
      var b=map[key];b.idx.push(i);b.acc.push(EA[i]);b.net+=(EN[i]||0);b.dd.push(ED[i]);
      var pa=partsAt(i);for(var j=0;j<IDXN.length;j++) b.parts[j]+=(pa[j]||0);
      pointSel.forEach(function(nm){var s=IDXC[nm];var v2=s? s[i]:null;if(v2!=null)b.sh[nm]=v2;});
      etfSel.forEach(function(c){var a=EC[c];var v3=a? a[i]:null;if(v3!=null)b.ec[c]=v3;});
    }
    var vo={idx:[],acc:[],net:[],dd:[],parts:[],sh:{},ec:{}};
    pointSel.forEach(function(nm){vo.sh[nm]=[];});
    etfSel.forEach(function(c){vo.ec[c]=[];});
    order.forEach(function(k){var b=map[k],jj=b.idx[b.idx.length-1];
      vo.idx.push(jj);vo.acc.push(b.acc[b.acc.length-1]);vo.net.push(Math.round(b.net*100)/100);vo.dd.push(b.dd[b.dd.length-1]);
      vo.parts.push(b.parts.map(function(x){return Math.round(x*100)/100;}));
      pointSel.forEach(function(nm){vo.sh[nm].push(b.sh[nm]);});
      etfSel.forEach(function(c){vo.ec[c].push(b.ec[c]);});
    });
    return vo;
  }
  function weekKey(ds){var dt=new Date(ds+'T00:00:00');var jan=new Date(dt.getFullYear(),0,1);var wk=Math.ceil((((dt-jan)/86400000)+jan.getDay()+1)/7);return dt.getFullYear()+'-W'+(wk<10?'0':'')+wk;}
  function drawE(s){
    cur=s;
    if(N===0) return;
    var m=metrics(),F=m.F,nl=m.nl;
    /* 有点位/净值线时右边距放宽（第三轴刻度+线尾标签），无则收窄让绘图区向右扩展 */
    var hasLines=pointSel.length+etfSel.length>0;
    ML=Math.round(F*3.8+12);MR=hasLines?Math.round(F*6.8+28):Math.round(F*3.6+14);pw=W-ML-MR;
    MT=Math.round(F*1.35+26);PB=402;
    if(hasLines)MT+=Math.round(F*2.6);   /* 对标轴标题独占一行：预留两行标题空间（F 自适应，横竖屏都不叠） */
    plotH=PB-MT;
    svg.setAttribute('viewBox','0 0 1000 '+Math.round(PB+9+F*1.8));
    var v=buildView();if(!v.idx.length)return;
    var accArr=v.acc.filter(function(x){return x!=null;});if(!accArr.length)return;
    /* 左轴量程=全市场累计；汇金线为全市场存量口径，不参与量程且不画到图外 */
    function dIdx(ddArr,ds){for(var k=0;k<ddArr.length;k++){if(ddArr[k]>=ds)return k;}return -1;}
    var mn=Math.min.apply(null,accArr),mx=Math.max.apply(null,accArr);
    var pad=(mx-mn)*0.12;if(pad<=0)pad=Math.max(1,Math.abs(mx)*0.02);
    yloL=mn-pad;yhiL=mx+pad;
    /* 右轴量程恒按12指数分段各自正负累加的峰值（堆叠后整柱可能高于单日净额） */
    var nmax=0;
    v.parts.forEach(function(ps){var p=0,n=0;if(ps)ps.forEach(function(x){if(x>0)p+=x;else n+=x;});nmax=Math.max(nmax,Math.abs(p),Math.abs(n));});
    if(!isFinite(nmax)||nmax<=0)nmax=1;
    yloR=-nmax*1.1;yhiR=nmax*1.1;
    /* 第三轴显示序列：指数点位(归一化/真实) + ETF净值(固定归一化)，由面板开关与含ETF强制决定 */
    function normSeries(arr){var base=null,out=[];for(var q=0;q<arr.length;q++){var x=arr[q];if(x==null){out.push(null);continue;}if(base==null)base=x;out.push(base?x/base*100:null);}return out;}
    var en=effNorm();
    var shN={};pointSel.forEach(function(nm){shN[nm]=normSeries(v.sh[nm]||[]);});
    v.shN=shN;
    var shD=en?shN:(function(){var o={};pointSel.forEach(function(nm){o[nm]=(v.sh[nm]||[]).slice();});return o;})();
    v.shD=shD;
    /* ETF净值线：始终归一化（基期=视窗首个有值日=100），与指数同轴可比 */
    var ecN={};etfSel.forEach(function(c){ecN[c]=normSeries(v.ec[c]||[]);});
    v.ecN=ecN;
    var allSh=[];
    pointSel.forEach(function(nm){shD[nm].forEach(function(x){if(x!=null)allSh.push(x);});});
    etfSel.forEach(function(c){ecN[c].forEach(function(x){if(x!=null)allSh.push(x);});});
    var slo=0,shi=1;
    if(allSh.length){
      var smn=Math.min.apply(null,allSh),smx=Math.max.apply(null,allSh);
      var sp=(smx-smn)*0.12;if(sp<=0)sp=Math.max(1,smx*0.02);
      slo=smn-sp;shi=smx+sp;
    }
    function YS(val){return MT+plotH*((shi-val)/(shi-slo));}
    var cnt=v.idx.length;
    function Xi2(k){return ML+pw*(cnt<=1?0:k/(cnt-1));}
    function YL2(val){return MT+plotH*((yhiL-val)/(yhiL-yloL));}
    function YR2(val){return MT+plotH*((yhiR-val)/(yhiR-yloR));}
    var g='';
    for(var k=0;k<=4;k++){
      var t=yloL+(yhiL-yloL)*k/4,yy=YL2(t);
      g+='<line x1="'+ML+'" y1="'+yy.toFixed(1)+'" x2="'+(W-MR)+'" y2="'+yy.toFixed(1)+'" stroke="#eef1f6"/>';
      g+='<text x="'+(ML-8)+'" y="'+(yy+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#2f6bff">'+Math.round(t).toLocaleString('zh-CN')+'</text>';
      var t2=yhiR-(yhiR-yloR)*k/4,y2=MT+plotH*k/4;
      g+='<text x="'+(W-MR+8)+'" y="'+(y2+F*0.35).toFixed(1)+'" font-size="'+F.toFixed(1)+'" fill="#94a3b8">'+Math.round(t2).toLocaleString('zh-CN')+'</text>';
      if(hasLines){
        var t3=shi-(shi-slo)*k/4;
        g+='<text x="'+(W-6)+'" y="'+(y2+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#64748b">'+Math.round(t3).toLocaleString('zh-CN')+'</text>';
      }
    }
    for(var j=0;j<nl;j++){
      var kk=Math.round(j*(cnt-1)/((nl-1)||1)),xx=Xi2(kk);
      g+='<line x1="'+xx.toFixed(1)+'" y1="'+MT+'" x2="'+xx.toFixed(1)+'" y2="'+PB+'" stroke="#f4f6fa"/>';
      var lab=v.dd[kk];if(G!=='d')lab=lab.slice(0,7);
      g+='<text x="'+xx.toFixed(1)+'" y="'+(PB+9+F*1.2).toFixed(1)+'" text-anchor="middle" font-size="'+F.toFixed(1)+'" fill="#8b95a7">'+lab.slice(2)+'</text>';
    }
    /* 标题两行制：主标题行(左+右)；有对标线时轴标题独占更上一行，行距随 F 缩放防重叠 */
    var tMainY=hasLines?(MT-F*1.5):(MT-22);
    g+='<text x="14" y="'+tMainY.toFixed(1)+'" font-size="'+(F*1.05).toFixed(1)+'" font-weight="700" fill="#2f6bff">累计净申购（亿元）</text>';
    var scopeTxt=pointSel.length?(pointSel.length+'个所选指数'):'12指数';
    g+='<text x="'+(W-14)+'" y="'+tMainY.toFixed(1)+'" text-anchor="end" font-size="'+(F*1.05).toFixed(1)+'" font-weight="700" fill="#94a3b8">当日净申购·'+scopeTxt+'构成（亿元）</text>';
    if(hasLines){
      var tIdxY=MT-F*2.85;
      var axisName=en?'对标（归一化·基期=100）':'指数点位（真实·点）';
      g+='<text x="'+(W-4)+'" y="'+tIdxY.toFixed(1)+'" text-anchor="end" font-size="'+(F*1.05).toFixed(1)+'" font-weight="700" fill="#64748b">'+axisName+'</text>';
    }
    g+='<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+PB+'" stroke="#bcd0f7" stroke-width="1.4"/>';
    g+='<line x1="'+(W-MR)+'" y1="'+MT+'" x2="'+(W-MR)+'" y2="'+PB+'" stroke="#eec9c9" stroke-width="1.4"/>';
    g+='<line x1="'+ML+'" y1="'+PB+'" x2="'+(W-MR)+'" y2="'+PB+'" stroke="#c7cdda" stroke-width="1.2"/>';
    /* 红绿堆叠柱：12指数当日净申购分段堆叠。正段自零轴向上叠红，负段向下叠绿；色深=指数，方向=正负 */
    var zero=YR2(0);
    var bw=Math.max(2,Math.min(16,pw/Math.max(cnt,1)*0.55));
    var RS=REDSHADES(),GS=GREENSHADES();
    for(var k=0;k<cnt;k++){
      var cx=Xi2(k),ps=v.parts[k]||[],posAcc=0,negAcc=0;
      for(var j=0;j<ps.length;j++){
        var pv=ps[j]||0;if(Math.abs(pv)<0.005)continue;
        var base=pv>=0?posAcc:negAcc, yb=YR2(base), yt=YR2(base+pv);
        g+='<rect data-lg="bars" x="'+(cx-bw/2).toFixed(1)+'" y="'+Math.min(yb,yt).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(0.6,Math.abs(yt-yb)).toFixed(1)+'" fill="'+(pv>=0?RS[j%RS.length]:GS[j%GS.length])+'"/>';
        if(pv>=0)posAcc+=pv;else negAcc+=pv;
      }
    }
    /* 蓝线：全市场累计净申购 */
    var poly='';
    for(var k=0;k<cnt;k++) if(v.acc[k]!=null) poly+=(poly?' ':'')+Xi2(k).toFixed(1)+','+YL2(v.acc[k]).toFixed(1);
    if(poly){
      var fp=poly.split(' ')[0].split(','),lp=poly.split(' ')[poly.split(' ').length-1].split(',');
      g+='<polygon data-lg="acc" points="'+poly+' '+lp[0]+','+PB+' '+fp[0]+','+PB+'" fill="rgba(47,107,255,.08)"/>';
      g+='<polyline data-lg="acc" points="'+poly+'" fill="none" stroke="#2f6bff" stroke-width="2.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
      if(cnt<=130){var pp=poly.split(' ');for(var q=0;q<pp.length;q++){var xy=pp[q].split(',');g+='<circle data-lg="acc" cx="'+xy[0]+'" cy="'+xy[1]+'" r="3.2" fill="#2f6bff" stroke="#fff" stroke-width="1.2"/>';}}
      g+='<circle data-lg="acc" cx="'+lp[0]+'" cy="'+lp[1]+'" r="4.5" fill="#2f6bff" stroke="#fff" stroke-width="1.5"/>';
    }
    /* 对标线（指数点位 / ETF净值，统一第三轴）：线尾标签防重叠；恒不改资金口径 */
    var tags=[];
    pointSel.forEach(function(nm){
      var arr=shD[nm]||[],shp='';
      for(var k=0;k<cnt;k++) if(arr[k]!=null) shp+=(shp?' ':'')+Xi2(k).toFixed(1)+','+YS(arr[k]).toFixed(1);
      if(shp){
        var col=iCol(nm), lk='idx:'+nm;
        g+='<polyline data-lg="'+lk+'" points="'+shp+'" fill="none" stroke="'+col+'" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" opacity=".92" vector-effect="non-scaling-stroke"/>';
        var last=shp.split(' ')[shp.split(' ').length-1].split(',');
        g+='<circle data-lg="'+lk+'" cx="'+last[0]+'" cy="'+last[1]+'" r="4" fill="'+col+'" stroke="#fff" stroke-width="1.4"/>';
        tags.push({nm:nm,col:col,x:parseFloat(last[0]),y:parseFloat(last[1]),dash:false,lk:lk});
      }
    });
    etfSel.forEach(function(c,oi){
      var arr=ecN[c]||[],shp='';
      for(var k=0;k<cnt;k++) if(arr[k]!=null) shp+=(shp?' ':'')+Xi2(k).toFixed(1)+','+YS(arr[k]).toFixed(1);
      if(shp){
        var col=eCol(c,oi), lk='etf:'+c;
        g+='<polyline data-lg="'+lk+'" points="'+shp+'" fill="none" stroke="'+col+'" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" opacity=".92" stroke-dasharray="6 3" vector-effect="non-scaling-stroke"/>';
        var last=shp.split(' ')[shp.split(' ').length-1].split(',');
        g+='<circle data-lg="'+lk+'" cx="'+last[0]+'" cy="'+last[1]+'" r="3.8" fill="'+col+'" stroke="#fff" stroke-width="1.4"/>';
        tags.push({nm:eLabel(c),col:col,x:parseFloat(last[0]),y:parseFloat(last[1]),dash:true,lk:lk});
      }
    });
    /* 线尾标签：右端内侧右对齐；可用高度内受限重排（间距不够自动压缩+字号缩小），双向推挤不溢出不重叠 */
    var nT=tags.length;
    if(nT){
      tags.sort(function(a,b){return a.y-b.y;});
      var tagLo=MT+F*0.6, tagHi=PB-F*1.2;
      var tagGap=F*1.4;
      if((nT-1)*tagGap>tagHi-tagLo) tagGap=(tagHi-tagLo)/Math.max(1,nT-1);
      var tagFs=Math.min(F*0.95,tagGap*0.78);
      tags[0].y=Math.max(tags[0].y,tagLo);
      for(var ti=1;ti<nT;ti++){ if(tags[ti].y<tags[ti-1].y+tagGap) tags[ti].y=tags[ti-1].y+tagGap; }
      if(tags[nT-1].y>tagHi){   /* 底部溢出：锚定底边倒序上推（gap 已压缩，数学上保证落在 [lo,hi] 内且无重叠） */
        tags[nT-1].y=tagHi;
        for(var tj=nT-2;tj>=0;tj--){ if(tags[tj].y>tags[tj+1].y-tagGap) tags[tj].y=tags[tj+1].y-tagGap; }
      }
      tags.forEach(function(t){
        g+='<text data-lg="'+t.lk+'" x="'+(t.x-6).toFixed(1)+'" y="'+(t.y+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+tagFs.toFixed(1)+'" font-weight="600" fill="'+t.col+'" stroke="#fcfdff" stroke-width="3" paint-order="stroke">'+t.nm+'</text>';
      });
    }
    /* 事件竖线标注（中央汇金关键操作时点）—— 仅画落在当前视窗内的事件 */
    var vFirst=v.dd[0], vLast=v.dd[v.dd.length-1];
    var evs=[];
    EVS.forEach(function(ev){
      if(ev[0]<vFirst||ev[0]>vLast) return;
      var k=dIdx(v.dd,ev[0]);if(k>=0)evs.push({x:Xi2(k),d:ev[0],t:ev[1]});
    });
    evs.forEach(function(e,ei){
      var tx=e.x,anch='start';
      if(tx>W*0.60){tx=e.x-4;anch='end';}
      var ty=MT+10+ei*14;
      g+='<line x1="'+e.x.toFixed(1)+'" y1="'+MT+'" x2="'+e.x.toFixed(1)+'" y2="'+PB+'" stroke="#8b5cf6" stroke-width="1" stroke-dasharray="3 3" opacity=".45"/>';
      g+='<text x="'+tx.toFixed(1)+'" y="'+ty.toFixed(1)+'" text-anchor="'+anch+'" font-size="'+(F*1.0).toFixed(1)+'" font-weight="500" fill="#7c3aed" stroke="#fcfdff" stroke-width="3" paint-order="stroke">'+e.d+' '+e.t+'</text>';
    });
    /* 汇金持股票ETF市值阶梯线（全市场存量口径·第三方估算）；仅画落在视窗且未超出左轴量程的节点 */
    var hjDrawn=false;
    if(HJS.length){
      var hp=[];
      HJS.forEach(function(h){if(h[0]>=vFirst&&h[0]<=vLast){
        var k=dIdx(v.dd,h[0]);if(k>=0){var yy=YL2(h[1]);if(yy>=MT-1&&yy<=PB+1)hp.push({x:Xi2(k),y:yy,v:h[1],d:h[0]});}
      }});
      if(hp.length>=2){
        hjDrawn=true;
        var sp='';
        for(var i=0;i<hp.length;i++){
          if(i===0) sp+=hp[i].x.toFixed(1)+','+hp[i].y.toFixed(1);
          else{ sp+=' '+hp[i].x.toFixed(1)+','+hp[i-1].y.toFixed(1); sp+=' '+hp[i].x.toFixed(1)+','+hp[i].y.toFixed(1); }
        }
        g+='<polyline data-lg="hj" points="'+sp+'" fill="none" stroke="#7c3aed" stroke-width="2.8" stroke-dasharray="7 4" opacity=".9" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
        hp.forEach(function(p){g+='<circle data-lg="hj" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.6" fill="#7c3aed" stroke="#fff" stroke-width="1.3"/>';});
      }
    }
    plot.innerHTML=g;
    ov.setAttribute('x',ML);ov.setAttribute('width',pw);ov.setAttribute('y',MT);ov.setAttribute('height',PB-MT);
    vline.setAttribute('y1',MT);vline.setAttribute('y2',PB);
    if(legend){
      var lg='<span class="lrow"><span class="lg blue" data-lg="acc" title="悬停高亮该线">■ 全市场累计净申购（左轴·亿元）</span>'
        +'<span class="lg" data-lg="bars" style="color:#94a3b8" title="悬停高亮该柱">■ 当日净申购·'+scopeTxt+'构成（右轴·红涨绿跌·深浅=指数，悬停看明细）</span>';
      if(hjDrawn) lg+='<span class="lg" data-lg="hj" style="color:#7c3aed" title="悬停高亮该线">┄ 汇金持股票ETF市值（第三方估算·存量口径）</span>';
      /* 对标线收益率=所选时间段首末有效值涨跌%；图例按收益率降序（高在前），颜色仍按原始选择序取以保证与线一致；
         「归一化基期=100」这类共性说明从每条图例拎出，统一写一次 */
      function segRet(arr){var base=null,last=null;for(var z=0;z<arr.length;z++){if(arr[z]!=null){if(base==null)base=arr[z];last=arr[z];}}return (base!=null&&last!=null)?((last/base-1)*100):null;}
      function retTxt(r){return r==null?'':(' '+(r>=0?'+':'')+r.toFixed(2)+'%');}
      var ir={},er2={},items=[];
      pointSel.forEach(function(nm){ir[nm]=segRet(v.sh[nm]||[]);items.push({ret:ir[nm],html:'<span class="lg" data-lg="idx:'+nm+'" style="color:'+iCol(nm)+'" title="悬停高亮该线">— '+nm+retTxt(ir[nm])+'</span>'});});
      etfSel.forEach(function(c){er2[c]=segRet(v.ec[c]||[]);items.push({ret:er2[c],html:'<span class="lg" data-lg="etf:'+c+'" style="color:'+eCol(c,etfSel.indexOf(c))+'" title="悬停高亮该线">┄ '+eLabel(c)+retTxt(er2[c])+'</span>'});});
      items.sort(function(a,b){return (b.ret==null?-Infinity:b.ret)-(a.ret==null?-Infinity:a.ret);});  /* 指数+ETF统一按所选时间段收益率降序 */
      items.forEach(function(it){lg+=it.html;});
      if(items.length){
        var note=en?'（对标线归一化·基期=100；右侧%为所选时间段收益率）':'（指数真实点位·点；右侧%为所选时间段收益率）';
        lg+='<span class="lg" style="color:#94a3b8">'+note+'</span>';
      }
      legend.innerHTML=lg+'</span>';
    }
    v.start=cur; window._etfView=v;
  }
  function pick(clientX,clientY){
    var lsMode=(typeof lsPoint==='function'&&lsActive());
    var r=svg.getBoundingClientRect(),rw,mx;
    if(lsMode){var lp=lsPoint(clientX,clientY),lr=lsRect(svg);rw=lr.w;mx=lp.x-lr.l;}
    else{if(!r.width)return;rw=r.width;mx=clientX-r.left;}
    var sx=W/rw;
    var v=window._etfView;if(!v||!v.idx.length)return;
    var cnt=v.idx.length;
    var k=Math.round((mx-ML)/pw*(cnt-1));k=Math.max(0,Math.min(cnt-1,k));
    var xx=ML+pw*(cnt<=1?0:k/(cnt-1));
    vline.setAttribute('x1',xx);vline.setAttribute('x2',xx);vline.style.opacity=1;
    var accV=v.acc[k],dd=v.dd[k];
    /* 当日净申购：所选时=所选指数分段之和(与柱一致)；全部时=全市场EN */
    var ps0=(v.parts&&v.parts[k])||[];
    var netV=pointSel.length?(ps0.reduce(function(s,x){return s+(x||0);},0)):(v.net[k]||0);
    var ncol=netV>=0?UP:DOWN;
    var scopeTip=pointSel.length?(pointSel.length+'个所选指数'):'全市场12指数';
    var html='<div class="t-d">'+dd+' · 累计=全市场 / 当日='+scopeTip+'</div>'
      +'<div class="t-r"><span style="color:#2f6bff">● 累计净申购（全市场）</span><b style="color:#2f6bff">'+fmt(accV)+' 亿元</b></div>'
      +'<div class="t-r"><span style="color:'+ncol+'">● 当日净申购（'+scopeTip+'）</span><b style="color:'+ncol+'">'+(netV>=0?'+':'')+fmt(netV)+' 亿元</b></div>';
    var ps=(v.parts&&v.parts[k])||[];
    var pairs=IDXN.map(function(nm,j){return {n:nm,v:ps[j]||0};}).filter(function(o){return Math.abs(o.v)>=0.005;})
      .sort(function(a,b){return Math.abs(b.v)-Math.abs(a.v);});
    if(pairs.length){
      html+='<div class="t-sep" style="border-top:1px solid #e8edf5;margin-top:5px;padding-top:4px;font-size:11px;color:#64748b">当日构成（按贡献排序）</div>';
      var RS=REDSHADES(),GS=GREENSHADES();
      pairs.forEach(function(o,j){var oc=o.v>=0?RS[j%RS.length]:GS[j%GS.length];
        html+='<div class="t-r" style="font-size:11px"><span style="color:'+oc+'">■ '+o.n+'</span><b style="color:'+oc+'">'+(o.v>=0?'+':'')+fmt(o.v)+' 亿</b></div>';});
    }
    var enTip=effNorm();
    pointSel.forEach(function(nm){
      var arr=(v.shD&&v.shD[nm])||[],dv=arr[k];
      var dBase=null;for(var q=0;q<arr.length;q++){if(arr[q]!=null){dBase=arr[q];break;}}
      var dPct=(dv!=null&&dBase)?((dv/dBase-1)*100):null;
      html+='<div class="t-r" style="font-size:11px"><span style="color:'+iCol(nm)+'">— '+nm+'</span><b style="color:'+iCol(nm)+'">'+(dv!=null?(enTip?dv.toFixed(1):dv.toFixed(2)):'—')+(dPct!=null?'（'+(dPct>=0?'+':'')+dPct.toFixed(2)+'%）':'')+'</b></div>';
    });
    etfSel.forEach(function(c,oi){
      var arr=(v.ecN&&v.ecN[c])||[],dv=arr[k];
      var dBase=null;for(var q=0;q<arr.length;q++){if(arr[q]!=null){dBase=arr[q];break;}}
      var dPct=(dv!=null&&dBase)?(dv-dBase):null;  /* 归一化序列基期=100，涨跌%=归一值-100 */
      var raw=(v.ec&&v.ec[c]&&v.ec[c][k]!=null)?v.ec[c][k].toFixed(3):'—';
      var col=eCol(c,oi);
      html+='<div class="t-r" style="font-size:11px"><span style="color:'+col+'">┄ '+(emeta[c]?emeta[c].name:c)+'</span><b style="color:'+col+'">'+(dv!=null?dv.toFixed(1):'—')+(dPct!=null?'（'+(dPct>=0?'+':'')+dPct.toFixed(2)+'%）':'')+' · 净值'+raw+'</b></div>';
    });
    tip.innerHTML=html;
    var tx,ty;
    if(lsMode){
      var lp2=lsPoint(clientX,clientY),bxr=lsRect(box);
      tx=lp2.x-bxr.l+14;ty=lp2.y-bxr.t-10;
      if(tx+200>bxr.w)tx=lp2.x-bxr.l-200;
    }else{
      var bx=box.getBoundingClientRect();
      tx=clientX-bx.left+14;ty=clientY-bx.top-10;
      if(tx+200>bx.width)tx=clientX-bx.left-200;
    }
    if(ty<0)ty=0;
    tip.style.left=tx+'px';tip.style.top=ty+'px';tip.style.opacity=1;
  }
  function hideTips(){vline.style.opacity=0;tip.style.opacity=0;}
  ov.addEventListener('mousemove',function(e){pick(e.clientX,e.clientY);});
  ov.addEventListener('mouseleave',hideTips);
  ov.addEventListener('touchstart',function(e){if(e.touches[0])pick(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
  ov.addEventListener('touchmove',function(e){if(e.touches[0])pick(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
  ov.addEventListener('touchend',hideTips);
  var rt=null;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){drawE(cur);},180);});
  /* 对标指数多选面板：首项「全部」=默认视图(无点位线)；勾任一指数自动取消「全部」，勾「全部」自动清指数。
     全选=勾12指数；清空=回到「全部」。无「完成」按钮：勾选立即应用。
     兼容层：隐藏 #eIdxSel（value=__ALL__|逗号列表）+ change 事件，供测试脚本使用 */
  var compat=document.getElementById('eIdxSel'),btn=document.getElementById('eIdxBtn'),
      panel=document.getElementById('eIdxPanel'),list=document.getElementById('eIdxList');
  var eBtn=document.getElementById('eEtfBtn'),ePanel=document.getElementById('eEtfPanel'),
      eList=document.getElementById('eEtfList'),eCompat=document.getElementById('eEtfSel');
  function btnLabel(){return pointSel.length===0?'全部(12指数)':(pointSel.length===1?pointSel[0]:pointSel.length+'个指数点位');}
  function eBtnLabel(){return etfSel.length===0?'无':(etfSel.length===1?(emeta[etfSel[0]]?emeta[etfSel[0]].name:etfSel[0]):etfSel.length+'只ETF净值');}
  function syncCompat(){if(compat)compat.value=pointSel.length===0?ALLKEY:pointSel.join(',');if(eCompat)eCompat.value=etfSel.length===0?ALLKEY:etfSel.join(',');}
  function buildPanel(){if(list){
    var items='<label class="idx-item"><input type="checkbox" value="'+ALLKEY+'"'+(pointSel.length===0?' checked':'')+'><span>全部（仅合计·默认）</span></label>'
      +IDXN.map(function(n){return '<label class="idx-item"><input type="checkbox" value="'+n+'"'+(pointSel.indexOf(n)>=0?' checked':'')+'><span>'+n+'</span></label>';}).join('');
    list.innerHTML=items;
    list.querySelectorAll('input').forEach(function(c){
      c.addEventListener('change',function(){
        if(c.value===ALLKEY){ if(c.checked) list.querySelectorAll('input').forEach(function(x){if(x.value!==ALLKEY)x.checked=false;}); }
        else if(c.checked){ var a=list.querySelector('input[value="'+ALLKEY+'"]'); if(a)a.checked=false; }
        /* 选即应用：勾选立即生效，无「完成」按钮 */
        syncSel();applySel();
      });
    });
  }}
  function applySel(){hideTips();syncCompat();buildPanel();buildEtfPanel();if(btn)btn.textContent=btnLabel();if(eBtn)eBtn.textContent=eBtnLabel();drawE(cur);}
  /* 从面板勾选状态同步 pointSel（选即应用的关键：先同步再 applySel，否则重建面板会覆盖勾选） */
  function syncSel(){var sel=list.querySelectorAll('input:checked');pointSel=[];sel.forEach(function(c){if(c.value!==ALLKEY&&IDXN.indexOf(c.value)>=0)pointSel.push(c.value);});}
  /* 对标ETF面板：首项「无」=无净值线；勾任一ETF即画其归一化净值线；全选=30只；清空=回到「无」 */
  function buildEtfPanel(){if(eList){
    var items='<label class="idx-item"><input type="checkbox" value="'+ALLKEY+'"'+(etfSel.length===0?' checked':'')+'><span>无（默认）</span></label>'
      +EM.map(function(m){return '<label class="idx-item"><input type="checkbox" value="'+m.code+'"'+(etfSel.indexOf(m.code)>=0?' checked':'')+'><span>'+m.name+'</span></label>';}).join('');
    eList.innerHTML=items;
    eList.querySelectorAll('input').forEach(function(c){
      c.addEventListener('change',function(){
        if(c.value===ALLKEY){ if(c.checked) eList.querySelectorAll('input').forEach(function(x){if(x.value!==ALLKEY)x.checked=false;}); }
        else if(c.checked){ var a=eList.querySelector('input[value="'+ALLKEY+'"]'); if(a)a.checked=false; }
        syncEtfSel();applySel();
      });
    });
  }}
  function syncEtfSel(){if(!eList)return;var sel=eList.querySelectorAll('input:checked');etfSel=[];sel.forEach(function(c){if(c.value!==ALLKEY&&emeta[c.value])etfSel.push(c.value);});}
  function setEtfSel(v){
    if(v==null||v===ALLKEY||v==='') etfSel=[];
    else if(typeof v==='string') etfSel=emeta[v]?[v]:[];
    else if(typeof v.length==='number'){ etfSel=EM.map(function(m){return m.code;}).filter(function(c){return v.indexOf(c)>=0||v.indexOf(emeta[c].name)>=0;}); }
    else etfSel=[];
    applySel();
  }
  window._etfSetEtfSel=setEtfSel;
  window._etfEtfGet=function(){return eCompat?eCompat.value:'';};
  function setSel(v){
    if(v==null||v===ALLKEY||v==='') pointSel=[];
    else if(typeof v==='string') pointSel=(IDXN.indexOf(v)>=0)?[v]:[];
    else if(typeof v.length==='number'){ pointSel=IDXN.filter(function(n){return v.indexOf(n)>=0;}); }
    else pointSel=[];
    applySel();
  }
  window._etfSetSel=setSel;
  window._etfSelGet=function(){return compat?compat.value:'';};
  /* 归一化开关（测试钩子） */
  var normChk=document.getElementById('eNormChk');
  window._etfNormGet=function(){return normMode;};
  window._etfNormSet=function(x){normMode=!!x;if(normChk)normChk.checked=normMode;hideTips();drawE(cur);};
  if(normChk) normChk.addEventListener('change',function(){normMode=normChk.checked;hideTips();drawE(cur);});
  if(compat) compat.addEventListener('change',function(){setSel(compat.value);});
  if(btn&&panel&&list){
    btn.addEventListener('click',function(e){e.stopPropagation();panel.classList.toggle('open');});
    panel.addEventListener('click',function(e){e.stopPropagation();});
    document.addEventListener('click',function(){panel.classList.remove('open');});
    panel.querySelectorAll('.idx-pact button').forEach(function(b){b.addEventListener('click',function(){
      var act=b.dataset.act,all=list.querySelector('input[value="'+ALLKEY+'"]');
      if(act==='all'){ list.querySelectorAll('input').forEach(function(c){c.checked=(c.value!==ALLKEY);}); if(all)all.checked=false; syncSel();applySel(); }
      else if(act==='none'){ list.querySelectorAll('input').forEach(function(c){c.checked=(c.value===ALLKEY);}); syncSel();applySel(); }
    });});
  }
  if(eBtn&&ePanel&&eList){
    eBtn.addEventListener('click',function(e){e.stopPropagation();ePanel.classList.toggle('open');});
    ePanel.addEventListener('click',function(e){e.stopPropagation();});
    document.addEventListener('click',function(){ePanel.classList.remove('open');});
    ePanel.querySelectorAll('.idx-pact button').forEach(function(b){b.addEventListener('click',function(){
      var act=b.dataset.act,all=eList.querySelector('input[value="'+ALLKEY+'"]');
      if(act==='all'){ eList.querySelectorAll('input').forEach(function(c){c.checked=(c.value!==ALLKEY);}); if(all)all.checked=false; syncEtfSel();applySel(); }
      else if(act==='none'){ eList.querySelectorAll('input').forEach(function(c){c.checked=(c.value===ALLKEY);}); syncEtfSel();applySel(); }
    });});
  }
  if(eCompat) eCompat.addEventListener('change',function(){setEtfSel(eCompat.value);});
  syncCompat();buildPanel();buildEtfPanel();if(btn)btn.textContent=btnLabel();if(eBtn)eBtn.textContent=eBtnLabel();
  /* 只绑时间段按钮(.rng-btn)——面板的 全选/清空 按钮也在 #eRng 内,若绑 #eRng button 会把 cur 误置 0 */
  document.querySelectorAll('#eRng .rng-btn').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('#eRng .rng-btn').forEach(function(x){x.classList.remove('active');});b.classList.add('active');
    document.querySelectorAll('#eRng .cr-btn').forEach(function(x){x.classList.remove('active');});
    curEnd=-1;cur=ER[b.dataset.range]||0;hideTips();drawE(cur);
  });});
  /* 指定时间段联动 API（主图面板调用）：日期串→ED 交易日索引[cur,curEnd]。日期 YYYY-MM-DD 字典序可比 */
  function edFind(ds,first){for(var i=first?0:N-1;first?i<N:i>=0;first?i++:i--){if(first?ED[i]>=ds:ED[i]<=ds)return i;}return first?N-1:0;}
  window._etfApplyRange=function(sd,ed){
    var cs=edFind(sd,true),ce=edFind(ed,false);if(cs>ce)ce=cs;
    cur=cs;curEnd=ce;hideTips();drawE(cur);
    document.querySelectorAll('#eRng .rng-btn').forEach(function(x){x.classList.remove('active');});
    document.querySelectorAll('#eRng .cr-btn').forEach(function(x){x.classList.add('active');});
    return {start:ED[cs],end:ED[ce]};
  };
  window._etfResetRange=function(){curEnd=-1;cur=ER[def]||0;hideTips();drawE(cur);};
  /* 统计粒度已统一：跟随图表下方唯一 #segG（.on 高亮由主图脚本切换，此处只更新自身 G 并重绘） */
  document.querySelectorAll('#segG button').forEach(function(b){b.addEventListener('click',function(){
    G=b.dataset.g;hideTips();drawE(cur);
  });});
  drawE(cur);
})();
