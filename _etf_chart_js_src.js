/* ===== 宽基ETF净资金流 图表（主图资金 + 副图指数走势 + 图3 ETF走势） =====
   语义（11-26 晚定稿）：
   主图 = 蓝线全市场份额存量（左轴·亿份·前复权）+ 红绿柱当日净申购（右轴·亿元）。
       默认不显示任何指数；选中指数后才叠加该指数累计净申购曲线（右侧第二轴·亿元·同指数同色）。
   副图 = 默认隐藏；选中1个或多个指数后显示中证全指（全市场行情基准，灰色虚线）+ 所选指数走势线。
       全市场份额线与中证全指基准做图例联动高亮 + 同步竖线。
   图3  = 所选 ETF 时显示对应指数成分 ETF 净值走势线（固定归一化·基期=100）；ETF选择框放在副图标题行。
         图3已开(有选中ETF)时切换单选指数→自动换成该指数的成分ETF；数值只在悬浮窗显示，图例不写数字。
   图例 = 固定5列网格左对齐（手机3列），口径说明独占整行。
   图例联动（三图互通）：
     · 主图「全市场份额存量」↔ 副图「中证全指」互为联动组；
     · 副图/主图选中某指数 → 图3 中属于该指数的全部 ETF 线一起高亮（idx:名 ↔ etf:码 由 ETF_META.idx 映射）；
     · 图3 选中某只 ETF → 其所属指数在图2、主图的对应线一起高亮。
     命中线同时加粗（polyline stroke-width 提到 4），其余淡出到 .16；支持点击锁定、再点取消。 */
(function(){
  var box=document.getElementById('ebox'); if(!box) return;
  var svg=document.getElementById('esvg'), plot=document.getElementById('eplot'),
      vline=document.getElementById('evline'), ov=document.getElementById('eoverlay'),
      tip=document.getElementById('etip'), legend=document.getElementById('elg');
  if(!svg||!plot) return;
  var box2=document.getElementById('e2box'), svg2=document.getElementById('e2svg'),
      plot2=document.getElementById('e2plot'), vline2=document.getElementById('e2vline'),
      ov2=document.getElementById('e2overlay'), tip2=document.getElementById('e2tip'),
      legend2=document.getElementById('e2lg'), subHd=document.getElementById('e2hd');
  var box3=document.getElementById('e3box'), svg3=document.getElementById('e3svg'),
      plot3=document.getElementById('e3plot'), vline3=document.getElementById('e3vline'),
      ov3=document.getElementById('e3overlay'), tip3=document.getElementById('e3tip'),
      legend3=document.getElementById('e3lg'), subHd3=document.getElementById('e3hd');
  var hasSub=!!(svg2&&plot2), hasSub3=!!(svg3&&plot3), crossOwner=0;
  function syncSubVisible(){
    var subOn=pointSel.length>0;
    var d2=subOn?'':'none',d3=(subOn&&etfSel.length>0)?'':'none';
    if(subHd)subHd.style.display=d2; if(box2)box2.style.display=d2; if(legend2)legend2.style.display=d2;
    if(subHd3)subHd3.style.display=d3; if(box3)box3.style.display=d3; if(legend3)legend3.style.display=d3;
  }
  // 图例联动：三图互通
  //    acc(全市场份额) ↔ csi(中证全指)
  //    idx:名 → 再加上该指数的全部成分 ETF 的 etf:码（跨到图3）
  //    etf:码 → 再加上该 ETF 所属指数的 idx:名（跨到主图/副图）
  function focusKeys(key){
    if(!key)return [];
    if(key==='acc'||key==='csi')return ['acc','csi'];
    var set=[key],i,m;
    if(key.indexOf('idx:')===0){
      var nm=key.slice(4);
      for(i=0;i<EM.length;i++){m=EM[i];if(m&&m.idx===nm&&set.indexOf('etf:'+m.code)<0)set.push('etf:'+m.code);}
    }else if(key.indexOf('etf:')===0){
      var cm=emeta[key.slice(4)];
      if(cm&&cm.idx&&set.indexOf('idx:'+cm.idx)<0)set.push('idx:'+cm.idx);
    }
    return set;
  }
  function lgFocusAll(key){
    var keys=focusKeys(key);
    [plot,plot2,plot3].forEach(function(pl){
      if(!pl)return;
      var els=pl.querySelectorAll('[data-lg]');
      for(var i=0;i<els.length;i++){
        var k=els[i].getAttribute('data-lg'),hit=keys.indexOf(k)>=0;
        els[i].style.opacity=key?(hit?'1':'0.16'):'';
        if(els[i].tagName==='polyline')els[i].style.strokeWidth=(key&&hit)?'4':'';  // 命中线加粗，更醒目
        if(k==='bars'){
          if(key&&key==='bars'){els[i].setAttribute('stroke','#334155');els[i].setAttribute('stroke-width','0.6');}
          else{els[i].removeAttribute('stroke');els[i].removeAttribute('stroke-width');}
        }
      }
    });
    [legend,legend2,legend3].forEach(function(lg){
      if(!lg)return;
      var its=lg.querySelectorAll('[data-lg]');
      for(var j=0;j<its.length;j++)its[j].style.fontWeight=(keys.indexOf(its[j].getAttribute('data-lg'))>=0)?'500':'';
    });
  }
  var lgLock=null;   // 点击锁定的图例项（三图共用），再点同一项取消
  function bindLg(lg){
    if(!lg)return;
    lg.addEventListener('mouseover',function(e){
      var s=(e.target&&e.target.closest)?e.target.closest('[data-lg]'):null;
      if(!s||s===lg)return;lgFocusAll(s.getAttribute('data-lg'));
    });
    lg.addEventListener('mouseout',function(e){
      var s=(e.target&&e.target.closest)?e.target.closest('[data-lg]'):null;
      if(!s||s===lg)return;lgFocusAll(lgLock);
    });
    lg.addEventListener('click',function(e){
      var s=(e.target&&e.target.closest)?e.target.closest('[data-lg]'):null;
      if(!s||s===lg)return;
      var k=s.getAttribute('data-lg');
      if(lgLock===k){lgLock=null;lgFocusAll(null);}   // 再点同一项 → 取消锁定、全部复位
      else{lgLock=k;lgFocusAll(k);}                   // 点其它项 → 改锁到该项
    });
  }
  bindLg(legend);bindLg(legend2);bindLg(legend3);
  // 主图与副图日期竖线同步；owner=1 主图触发，owner=2 副图触发
  function syncCross(k,owner){
    var v=window._etfView;if(!v||!hasSub||!pointSel.length||!v.idx.length)return;
    var cnt=v.idx.length,off=cnt<=1?0:k/(cnt-1);
    if(owner!==2&&vline2){var x2=ML2+pw2*off;vline2.setAttribute('x1',x2);vline2.setAttribute('x2',x2);vline2.style.opacity=1;}
    if(owner!==1&&vline){var x1=ML+pw*off;vline.setAttribute('x1',x1);vline.setAttribute('x2',x1);vline.style.opacity=1;}
    crossOwner=owner;
  }
  function clearSubCross(){if(vline2)vline2.style.opacity=0;if(crossOwner===2&&vline){vline.style.opacity=0;crossOwner=0;}}
  var W=1000,MT=46,PB=402,ML=70,MR=160,pw=W-ML-MR,plotH=PB-MT;
  var G='d',def='m3';
  var ER=(typeof ETF_RANGES!=='undefined')?ETF_RANGES:{m3:0,all:0};
  var cur=ER[def]||0,curEnd=-1;
  var ED=(typeof ETF_D!=='undefined')?ETF_D:[];
  var ESA=(typeof ETF_SHA!=='undefined')?ETF_SHA:[];
  var EN=(typeof ETF_NET!=='undefined')?ETF_NET:[];
  var IDXN=(typeof ETF_IDX_NAMES!=='undefined')?ETF_IDX_NAMES:[];
  var IDXC=(typeof ETF_IDX_CLOSE!=='undefined')?ETF_IDX_CLOSE:{};
  var IDXNET=(typeof ETF_IDX_NET!=='undefined')?ETF_IDX_NET:{};
  var IACC=(typeof ETF_IDX_ACC!=='undefined')?ETF_IDX_ACC:{};
  var CSI=(typeof ETF_CSI_CLOSE!=='undefined')?ETF_CSI_CLOSE:[];
  var ISHA=(typeof ETF_IDX_SHA!=='undefined')?ETF_IDX_SHA:{};
  var EC=(typeof ETF_CLOSES!=='undefined')?ETF_CLOSES:{};
  var EM=(typeof ETF_META!=='undefined')?ETF_META:[];
  var ETPAL=['#ea580c','#0891b2','#c026d3','#65a30d','#f59e0b','#6366f1','#db2777','#14b8a6','#a16207','#8b5cf6','#dc2626','#0e7490'];
  var emeta={};EM.forEach(function(m){emeta[m.code]=m;});
  function eCol(code,order){return ETPAL[order%ETPAL.length];}
  function eLabel(code){var m=emeta[code];return m?(m.name.replace(/ETF.*/,'')+'·'+code.slice(-4)):code;}
  var ALLKEY='__ALL__';
  var UP='#e24b4a',DOWN='#16a34a';
  var IDXCOLOR={'沪深300':'#0d9488','中证A500':'#be123c','上证50':'#7c3aed','中证500':'#c2410c',
    '中证1000':'#059669','科创50':'#db2777','创业板指':'#4f46e5','中证2000':'#b45309',
    '科创100':'#0284c7','创业板50':'#9333ea','上证指数':'#a16207','深证成指':'#334155'};
  function iCol(n){return IDXCOLOR[n]||'#0f766e';}
  function REDSHADES(){return ['#f4c7c5','#eeb0ad','#e89995','#e2807c','#d96763','#d14e4a','#c43b37','#b52f2b','#a32622','#8f1e1b','#771714','#5c100e'];}
  function GREENSHADES(){return ['#bfe6cf','#a6d9bb','#8ccba7','#71bd93','#56ae7f','#3f9d6c','#2f8c5c','#247a4e','#1c6942','#155737','#0f452c','#0a3321'];}
  var pointSel=[],etfSel=[],normMode=true;
  function activeIdx(){return pointSel.slice();} // 默认不选＝无指数曲线，柱仍为全市场12指数汇总
  function effNorm(){return normMode;}
  var N=ED.length;
  var EVS=(typeof ETF_EVENTS!=='undefined')?ETF_EVENTS:[];
  function fmt(v){return (v==null)?'—':v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function metrics(){var rw=(svg.clientWidth&&svg.clientWidth>0)?svg.clientWidth:1000;return {F:9*W/rw,nl:Math.max(3,Math.min(9,Math.floor(rw/118)))};}
  function normSeries(arr){var base=null,out=[];for(var q=0;q<arr.length;q++){var x=arr[q];if(x==null){out.push(null);continue;}if(base==null)base=x;out.push(base?x/base*100:null);}return out;}
  function lastVal(a){for(var i=a.length-1;i>=0;i--)if(a[i]!=null)return a[i];return null;}
  function firstVal(a){for(var i=0;i<a.length;i++)if(a[i]!=null)return a[i];return null;}
  var yloL=0,yhiL=1,yloR=-1,yhiR=1,yloA=-1,yhiA=1;
  function buildView(){
    var names=activeIdx();
    function partsAt(i){return IDXN.map(function(nm){return (pointSel.length&&pointSel.indexOf(nm)<0)?0:((IDXNET[nm]&&IDXNET[nm][i])||0);});}
    if(G==='d'){
      var idx=[],shm=[],net=[],dd=[],parts=[],sh={},iac={},ec={},csi=[];
      names.forEach(function(nm){sh[nm]=[];iac[nm]=[];});
      etfSel.forEach(function(c){ec[c]=[];});
      var iEnd=(curEnd>=cur)?Math.min(curEnd,N-1):N-1;
      for(var i=cur;i<=iEnd;i++){
        idx.push(i);shm.push(ESA[i]);net.push(EN[i]);dd.push(ED[i]);parts.push(partsAt(i));csi.push(CSI[i]);
        names.forEach(function(nm){var s=IDXC[nm];sh[nm].push(s?s[i]:null);var a=IACC[nm];iac[nm].push(a?a[i]:null);});
        etfSel.forEach(function(c){var a=EC[c];ec[c].push(a?a[i]:null);});
      }
      var vo={idx:idx,shm:shm,acc:shm,net:net,dd:dd,parts:parts,names:names,sh:sh,iac:iac,csi:csi,ec:ec};
      vo.ecN={};etfSel.forEach(function(c){vo.ecN[c]=normSeries(ec[c]);});
      vo.shN={};names.forEach(function(nm){vo.shN[nm]=normSeries(sh[nm]);});
      vo.csiN=normSeries(csi);return vo;
    }
    var map={},order=[],iEnd=(curEnd>=cur)?Math.min(curEnd,N-1):N-1;
    for(var i=cur;i<=iEnd;i++){
      var key=G==='w'?weekKey(ED[i]):ED[i].slice(0,7);
      if(!map[key]){
        map[key]={idx:[],shm:[],net:0,dd:[],parts:IDXN.map(function(){return 0;}),sh:{},iac:{},ec:{},csi:null};
        names.forEach(function(nm){map[key].sh[nm]=null;map[key].iac[nm]=null;});
        etfSel.forEach(function(c){map[key].ec[c]=null;});order.push(key);
      }
      var b=map[key];b.idx.push(i);b.shm.push(ESA[i]);b.net+=(EN[i]||0);b.dd.push(ED[i]);
      var pa=partsAt(i);for(var j=0;j<IDXN.length;j++)b.parts[j]+=(pa[j]||0);
      names.forEach(function(nm){var s=IDXC[nm],v2=s?s[i]:null;if(v2!=null)b.sh[nm]=v2;var a=IACC[nm],v3=a?a[i]:null;if(v3!=null)b.iac[nm]=v3;});
      etfSel.forEach(function(c){var a=EC[c],v4=a?a[i]:null;if(v4!=null)b.ec[c]=v4;});
      if(CSI[i]!=null)b.csi=CSI[i];
    }
    var out={idx:[],shm:[],acc:[],net:[],dd:[],parts:[],names:names,sh:{},iac:{},csi:[],ec:{}};
    names.forEach(function(nm){out.sh[nm]=[];out.iac[nm]=[];});
    etfSel.forEach(function(c){out.ec[c]=[];});
    order.forEach(function(k){var b=map[k],jj=b.idx[b.idx.length-1];
      out.idx.push(jj);out.shm.push(b.shm[b.shm.length-1]);out.net.push(Math.round(b.net*100)/100);out.dd.push(b.dd[b.dd.length-1]);
      out.parts.push(b.parts.map(function(x){return Math.round(x*100)/100;}));
      names.forEach(function(nm){out.sh[nm].push(b.sh[nm]);out.iac[nm].push(b.iac[nm]);});
      out.csi.push(b.csi);etfSel.forEach(function(c){out.ec[c].push(b.ec[c]);});
    });
    out.acc=out.shm;
    out.ecN={};etfSel.forEach(function(c){out.ecN[c]=normSeries(out.ec[c]);});
    out.shN={};names.forEach(function(nm){out.shN[nm]=normSeries(out.sh[nm]);});
    out.csiN=normSeries(out.csi);return out;
  }
  function weekKey(ds){var dt=new Date(ds+'T00:00:00');var jan=new Date(dt.getFullYear(),0,1);var wk=Math.ceil((((dt-jan)/86400000)+jan.getDay()+1)/7);return dt.getFullYear()+'-W'+(wk<10?'0':'')+wk;}
  function drawE(s){
    cur=s;if(N===0)return;
    var m=metrics(),F=m.F,nl=m.nl,names=activeIdx();
    var v=buildView();if(!v.idx.length)return;
    var accArr=v.shm.filter(function(x){return x!=null;});if(!accArr.length)return;
    var mn=Math.min.apply(null,accArr),mx=Math.max.apply(null,accArr),pad=(mx-mn)*0.12;
    if(pad<=0)pad=Math.max(1,Math.abs(mx)*0.02);yloL=mn-pad;yhiL=mx+pad;
    var nmax=0;v.parts.forEach(function(ps){var p=0,n=0;if(ps)ps.forEach(function(x){if(x>0)p+=x;else n+=x;});nmax=Math.max(nmax,Math.abs(p),Math.abs(n));});
    if(!isFinite(nmax)||nmax<=0)nmax=1;yloR=-nmax*1.1;yhiR=nmax*1.1;
    var accVals=[];names.forEach(function(nm){(v.iac[nm]||[]).forEach(function(x){if(x!=null)accVals.push(x);});});
    if(!accVals.length)accVals=[0,1];
    var amn=Math.min.apply(null,accVals),amx=Math.max.apply(null,accVals),apad=(amx-amn)*0.1;
    if(apad<=0)apad=Math.max(1,Math.abs(amx)*0.02);yloA=amn-apad;yhiA=amx+apad;
    // 右轴宽度按数字位数动态计算：默认只留1列；选中指数才开第2列，避免手机端绘图区被压扁
    var hasI=names.length>0;
    function digits(v){var n=Math.round(Math.abs(v)||0);return Math.min(6,Math.max(3,String(n).length));}
    var dR=digits(Math.max(Math.abs(yloR),Math.abs(yhiR))),dA=hasI?digits(Math.max(Math.abs(yloA),Math.abs(yhiA))):0;
    var unitW=F*0.58;
    ML=Math.round(F*3.8+12);
    MR=hasI?Math.round(14+(dR+dA)*unitW+34):Math.round(12+dR*unitW+12);
    pw=W-ML-MR;
    MT=Math.round(F*1.35+(hasI?40:26));PB=402;plotH=PB-MT;
    svg.setAttribute('viewBox','0 0 1000 '+Math.round(PB+9+F*1.8));
    var cnt=v.idx.length;
    function Xi2(k){return ML+pw*(cnt<=1?0:k/(cnt-1));}
    function YL2(val){return MT+plotH*((yhiL-val)/(yhiL-yloL));}
    function YR2(val){return MT+plotH*((yhiR-val)/(yhiR-yloR));}
    function YA2(val){return MT+plotH*((yhiA-val)/(yhiA-yloA));}
    var g='';
    for(var k=0;k<=4;k++){
      var t=yloL+(yhiL-yloL)*k/4,yy=YL2(t);
      g+='<line x1="'+ML+'" y1="'+yy.toFixed(1)+'" x2="'+(W-MR)+'" y2="'+yy.toFixed(1)+'" stroke="#eef1f6"/>';
      g+='<text x="'+(ML-8)+'" y="'+(yy+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#2f6bff">'+Math.round(t).toLocaleString('zh-CN')+'</text>';
      var t2=yhiR-(yhiR-yloR)*k/4,y2=MT+plotH*k/4;
      g+='<text x="'+(W-MR+8)+'" y="'+(y2+F*0.35).toFixed(1)+'" font-size="'+F.toFixed(1)+'" fill="#94a3b8">'+Math.round(t2)+'</text>';
      if(hasI){var t3=yhiA-(yhiA-yloA)*k/4;
        g+='<text x="'+(W-6)+'" y="'+(y2+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#94a3b8">'+Math.round(t3)+'</text>';
      }
    }
    for(var j=0;j<nl;j++){
      var kk=Math.round(j*(cnt-1)/((nl-1)||1)),xx=Xi2(kk);
      g+='<line x1="'+xx.toFixed(1)+'" y1="'+MT+'" x2="'+xx.toFixed(1)+'" y2="'+PB+'" stroke="#f4f6fa"/>';
      var lab=v.dd[kk];if(G!=='d')lab=lab.slice(0,7);
      g+='<text x="'+xx.toFixed(1)+'" y="'+(PB+9+F*1.2).toFixed(1)+'" text-anchor="middle" font-size="'+F.toFixed(1)+'" fill="#8b95a7">'+lab.slice(2)+'</text>';
    }
    var tMainY=MT-(hasI?F*2.4:22),tSubY=MT-F*1.1;
    g+='<text x="14" y="'+tMainY.toFixed(1)+'" font-size="'+(F*1.05).toFixed(1)+'" font-weight="500" fill="#2f6bff">份额存量（亿份·前复权）</text>';
    g+='<text x="'+(W-6)+'" y="'+tMainY.toFixed(1)+'" text-anchor="end" font-size="'+(F*1.05).toFixed(1)+'" font-weight="500" fill="#94a3b8">净申购（亿元）</text>';
    if(hasI){
      g+='<text x="'+(W-MR+8)+'" y="'+tSubY.toFixed(1)+'" font-size="'+(F*0.82).toFixed(1)+'" fill="#94a3b8">当日</text>';
      g+='<text x="'+(W-6)+'" y="'+tSubY.toFixed(1)+'" text-anchor="end" font-size="'+(F*0.82).toFixed(1)+'" fill="#94a3b8">累计</text>';
    }
    g+='<line x1="'+ML+'" y1="'+MT+'" x2="'+ML+'" y2="'+PB+'" stroke="#bcd0f7" stroke-width="1.4"/>';
    g+='<line x1="'+(W-MR)+'" y1="'+MT+'" x2="'+(W-MR)+'" y2="'+PB+'" stroke="#eec9c9" stroke-width="1.4"/>';
    if(hasI)g+='<line x1="'+(W-6)+'" y1="'+MT+'" x2="'+(W-6)+'" y2="'+PB+'" stroke="#e2e8f0" stroke-width="1.2"/>';
    g+='<line x1="'+ML+'" y1="'+PB+'" x2="'+(hasI?W-6:W-MR)+'" y2="'+PB+'" stroke="#c7cdda" stroke-width="1.2"/>';
    var zero=YR2(0),bw=Math.max(2,Math.min(16,pw/Math.max(cnt,1)*0.55)),RS=REDSHADES(),GS=GREENSHADES();
    for(var k=0;k<cnt;k++){
      var cx=Xi2(k),ps=v.parts[k]||[],posAcc=0,negAcc=0;
      for(var j=0;j<ps.length;j++){
        var pv=ps[j]||0;if(Math.abs(pv)<0.005)continue;
        var base=pv>=0?posAcc:negAcc,yb=YR2(base),yt=YR2(base+pv);
        g+='<rect data-lg="bars" x="'+(cx-bw/2).toFixed(1)+'" y="'+Math.min(yb,yt).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(0.6,Math.abs(yt-yb)).toFixed(1)+'" fill="'+(pv>=0?RS[j%RS.length]:GS[j%GS.length])+'"/>';
        if(pv>=0)posAcc+=pv;else negAcc+=pv;
      }
    }
    var poly='';for(var k=0;k<cnt;k++)if(v.shm[k]!=null)poly+=(poly?' ':'')+Xi2(k).toFixed(1)+','+YL2(v.shm[k]).toFixed(1);
    if(poly){
      var fp=poly.split(' ')[0].split(','),lp=poly.split(' ')[poly.split(' ').length-1].split(',');
      g+='<polygon data-lg="acc" points="'+poly+' '+lp[0]+','+PB+' '+fp[0]+','+PB+'" fill="rgba(47,107,255,.08)"/>';
      g+='<polyline data-lg="acc" points="'+poly+'" fill="none" stroke="#2f6bff" stroke-width="2.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
      if(cnt<=130){var pp=poly.split(' ');for(var q=0;q<pp.length;q++){var xy=pp[q].split(',');g+='<circle data-lg="acc" cx="'+xy[0]+'" cy="'+xy[1]+'" r="3.2" fill="#2f6bff" stroke="#fff" stroke-width="1.2"/>';}}
      g+='<circle data-lg="acc" cx="'+lp[0]+'" cy="'+lp[1]+'" r="4.5" fill="#2f6bff" stroke="#fff" stroke-width="1.5"/>';
    }
    var tags=[];
    names.forEach(function(nm){
      var arr=v.iac[nm]||[],shp='';
      for(var k=0;k<cnt;k++)if(arr[k]!=null)shp+=(shp?' ':'')+Xi2(k).toFixed(1)+','+YA2(arr[k]).toFixed(1);
      if(shp){
        var col=iCol(nm),lk='idx:'+nm;
        g+='<polyline data-lg="'+lk+'" points="'+shp+'" fill="none" stroke="'+col+'" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" opacity=".92" vector-effect="non-scaling-stroke"/>';
        var last=shp.split(' ')[shp.split(' ').length-1].split(',');
        g+='<circle data-lg="'+lk+'" cx="'+last[0]+'" cy="'+last[1]+'" r="3.8" fill="'+col+'" stroke="#fff" stroke-width="1.4"/>';
        tags.push({nm:nm,col:col,x:parseFloat(last[0]),y:parseFloat(last[1]),lk:lk});
      }
    });
    if(tags.length&&tags.length<=6){
      tags.sort(function(a,b){return a.y-b.y;});
      var tagLo=MT+F*0.6,tagHi=PB-F*1.2,tagGap=F*1.4;
      if((tags.length-1)*tagGap>tagHi-tagLo)tagGap=(tagHi-tagLo)/Math.max(1,tags.length-1);
      var tagFs=Math.min(F*0.95,tagGap*0.78);
      tags[0].y=Math.max(tags[0].y,tagLo);
      for(var ti=1;ti<tags.length;ti++)if(tags[ti].y<tags[ti-1].y+tagGap)tags[ti].y=tags[ti-1].y+tagGap;
      if(tags[tags.length-1].y>tagHi){tags[tags.length-1].y=tagHi;for(var tj=tags.length-2;tj>=0;tj--)if(tags[tj].y>tags[tj+1].y-tagGap)tags[tj].y=tags[tj+1].y-tagGap;}
      tags.forEach(function(t){g+='<text data-lg="'+t.lk+'" x="'+(t.x-6).toFixed(1)+'" y="'+(t.y+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+tagFs.toFixed(1)+'" font-weight="500" fill="'+t.col+'" stroke="#fcfdff" stroke-width="3" paint-order="stroke">'+t.nm+'</text>';});
    }
    function dIdx(ddArr,ds){for(var k=0;k<ddArr.length;k++)if(ddArr[k]>=ds)return k;return -1;}
    var vFirst=v.dd[0],vLast=v.dd[v.dd.length-1],evs=[];
    EVS.forEach(function(ev){if(ev[0]<vFirst||ev[0]>vLast)return;var k=dIdx(v.dd,ev[0]);if(k>=0)evs.push({x:Xi2(k),d:ev[0],t:ev[1]});});
    evs.forEach(function(e,ei){var tx=e.x,anch='start';if(tx>W*0.60){tx=e.x-4;anch='end';}var ty=MT+10+ei*14;
      g+='<line x1="'+e.x.toFixed(1)+'" y1="'+MT+'" x2="'+e.x.toFixed(1)+'" y2="'+PB+'" stroke="#8b5cf6" stroke-width="1" stroke-dasharray="3 3" opacity=".45"/>';
      g+='<text x="'+tx.toFixed(1)+'" y="'+ty+'" text-anchor="'+anch+'" font-size="'+F.toFixed(1)+'" fill="#7c3aed" stroke="#fcfdff" stroke-width="3" paint-order="stroke">'+e.d+' '+e.t+'</text>';});
    plot.innerHTML=g;
    ov.setAttribute('x',ML);ov.setAttribute('width',pw);ov.setAttribute('y',MT);ov.setAttribute('height',PB-MT);
    vline.setAttribute('y1',MT);vline.setAttribute('y2',PB);
    if(legend){
      var sw='<span style="display:inline-block;width:18px;height:0;border-top:3px solid currentColor;vertical-align:middle;margin-right:6px"></span>';
      var lg='<span class="lrow">'
        +'<span class="lg blue" data-lg="acc" title="悬停高亮该线，并联动副图中证全指"><span class="lgsw"></span>全市场份额存量（左轴·亿份）</span>'
        +'<span class="lg" data-lg="bars" style="color:#94a3b8" title="悬停高亮该柱">■ 当日净申购（右轴·亿元·'+(names.length?'所选指数':'全市场12指数')+'·红涨绿跌）</span>';
      var items=[];
      names.forEach(function(nm){var a=v.iac[nm]||[],last=lastVal(a);items.push({v:last,html:'<span class="lg" data-lg="idx:'+nm+'" style="color:'+iCol(nm)+'">'+sw+nm+' '+fmt(last)+'亿</span>'});});
      items.sort(function(a,b){return (b.v==null?-Infinity:b.v)-(a.v==null?-Infinity:a.v);});
      items.forEach(function(it){lg+=it.html;});
      lg+='<span class="lgnote">口径：蓝线=份额存量（亿份，左轴）；红绿柱=当日净申购（亿元，右轴）。'+(names.length?'彩色曲线=所选指数累计净申购（亿元，右侧第二轴，2012年起累计，周期末取当日快照）；右轴两列分别为当日/累计，单位均为亿元。':'当前为全市场汇总，默认不显示指数曲线；选中「对标指数」后才在其右侧第二轴叠加累计净申购曲线。')+'</span>';
      legend.innerHTML=lg+'</span>';
    }
    v.start=cur;window._etfView=v;drawE2();drawE3();
    if(lgLock)lgFocusAll(lgLock);   // 重绘后恢复点击锁定的高亮
  }
  function pick(clientX,clientY){
    var lsMode=(typeof lsPoint==='function'&&lsActive());
    var r=svg.getBoundingClientRect(),rw,mx;
    if(lsMode){var lp=lsPoint(clientX,clientY),lr=lsRect(svg);rw=lr.w;mx=lp.x-lr.l;}
    else{if(!r.width)return;rw=r.width;mx=(clientX-r.left)*(W/rw);}
    var v=window._etfView;if(!v||!v.idx.length)return;
    var cnt=v.idx.length,k=Math.round((mx-ML)/pw*(cnt-1));k=Math.max(0,Math.min(cnt-1,k));
    var xx=ML+pw*(cnt<=1?0:k/(cnt-1));vline.setAttribute('x1',xx);vline.setAttribute('x2',xx);vline.style.opacity=1;
    syncCross(k,1);
    var ps0=(v.parts&&v.parts[k])||[];
    var netV=pointSel.length?ps0.reduce(function(s,x){return s+(x||0);},0):(v.net[k]||0);
    var ncol=netV>=0?UP:DOWN,scopeTip=pointSel.length?(pointSel.length+'个所选指数'):'全市场12指数';
    var html='<div class="t-d">'+v.dd[k]+' · 存量=全市场 / 当日净申购='+scopeTip+'</div>'
      +'<div class="t-r"><span style="color:#2f6bff">● 份额存量（全市场）</span><b style="color:#2f6bff">'+fmt(v.shm[k])+' 亿份</b></div>'
      +'<div class="t-r"><span style="color:'+ncol+'">● 当日净申购（'+scopeTip+'）</span><b style="color:'+ncol+'">'+(netV>=0?'+':'')+fmt(netV)+' 亿元</b></div>';
    var pairs=IDXN.map(function(nm,j){return {n:nm,v:ps0[j]||0};}).filter(function(o){return Math.abs(o.v)>=0.005;}).sort(function(a,b){return Math.abs(b.v)-Math.abs(a.v);});
    if(pairs.length){
      html+='<div class="t-sep" style="border-top:1px solid #e8edf5;margin-top:5px;padding-top:4px;font-size:11px;color:#64748b">当日构成（按贡献排序）</div>';
      var RS=REDSHADES(),GS=GREENSHADES();
      pairs.forEach(function(o,j){var oc=o.v>=0?RS[j%RS.length]:GS[j%GS.length];
        html+='<div class="t-r" style="font-size:11px"><span style="color:'+oc+'">■ '+o.n+'</span><b style="color:'+oc+'">'+(o.v>=0?'+':'')+fmt(o.v)+' 亿</b></div>';});
    }
    html+='<div class="t-sep" style="border-top:1px solid #e8edf5;margin-top:5px;padding-top:4px;font-size:11px;color:#64748b">累计净申购（亿元）</div>';
    v.names.forEach(function(nm){
      var arr=v.iac[nm]||[],dv=arr[k],base=firstVal(arr),delta=(dv!=null&&base!=null)?(dv-base):null;
      html+='<div class="t-r" style="font-size:11px"><span style="color:'+iCol(nm)+'">— '+nm+'</span><b style="color:'+iCol(nm)+'">'+(dv!=null?fmt(dv):'—')+(delta!=null?'（区间'+(delta>=0?'+':'')+fmt(delta)+'）':'')+'</b></div>';
    });
    tip.innerHTML=html;
    var tx,ty;
    if(lsMode){var lp2=lsPoint(clientX,clientY),bxr=lsRect(box);tx=lp2.x-bxr.l+14;ty=lp2.y-bxr.t-10;if(tx+200>bxr.w)tx=lp2.x-bxr.l-200;}
    else{var bx=box.getBoundingClientRect();tx=clientX-bx.left+14;ty=clientY-bx.top-10;if(tx+200>bx.width)tx=clientX-bx.left-200;}
    if(ty<0)ty=0;tip.style.left=tx+'px';tip.style.top=ty+'px';tip.style.opacity=1;
  }
  var W2=1000,MT2=34,PB2=262,ML2=70,MR2=118,pw2=W2-ML2-MR2,plotH2=PB2-MT2;
  function drawE2(){
    if(!hasSub)return;syncSubVisible();
    var v=window._etfView;if(!v||!v.idx.length){plot2.innerHTML='';if(legend2)legend2.innerHTML='';return;}
    var m=metrics(),F=m.F,nl=m.nl,cnt=v.idx.length,en=effNorm();
    var csiD=en?(v.csiN||[]):(v.csi||[]);
    var shD=v.shD||{};
    pointSel.forEach(function(nm){shD[nm]=en?normSeries(v.sh[nm]||[]):(v.sh[nm]||[]).slice();});
    v.shD=shD;
    var all=[];csiD.forEach(function(x){if(x!=null)all.push(x);});
    pointSel.forEach(function(nm){(shD[nm]||[]).forEach(function(x){if(x!=null)all.push(x);});});
    var slo=0,shi=1;
    if(all.length){var smn=Math.min.apply(null,all),smx=Math.max.apply(null,all),sp=(smx-smn)*0.12;if(sp<=0)sp=Math.max(1,smx*0.02);slo=smn-sp;shi=smx+sp;}
    function X2(k){return ML2+pw2*(cnt<=1?0:k/(cnt-1));}
    function Y2(val){return MT2+plotH2*((shi-val)/(shi-slo));}
    var g='';
    for(var k=0;k<=4;k++){
      var yy=MT2+plotH2*k/4,val=shi-(shi-slo)*k/4;
      g+='<line x1="'+ML2+'" y1="'+yy.toFixed(1)+'" x2="'+(W2-MR2)+'" y2="'+yy.toFixed(1)+'" stroke="#eef1f6"/>';
      g+='<text x="'+(ML2-8)+'" y="'+(yy+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#64748b">'+Math.round(val).toLocaleString('zh-CN')+'</text>';
      g+='<text x="'+(W2-4)+'" y="'+(yy+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#94a3b8">'+(k===0?(en?'100':'点位'):'')+'</text>';
    }
    for(var j=0;j<nl;j++){
      var kk=Math.round(j*(cnt-1)/((nl-1)||1)),xx=X2(kk);
      g+='<line x1="'+xx.toFixed(1)+'" y1="'+MT2+'" x2="'+xx.toFixed(1)+'" y2="'+PB2+'" stroke="#f4f6fa"/>';
      var lab=v.dd[kk];if(G!=='d')lab=lab.slice(0,7);
      g+='<text x="'+xx.toFixed(1)+'" y="'+(PB2+9+F*1.2).toFixed(1)+'" text-anchor="middle" font-size="'+F.toFixed(1)+'" fill="#8b95a7">'+lab.slice(2)+'</text>';
    }
    g+='<text x="14" y="'+(MT2-12)+'" font-size="'+(F*1.05).toFixed(1)+'" font-weight="500" fill="#64748b">'+(en?'指数走势（归一化·基期=100）':'指数走势（真实·点）')+'</text>';
    g+='<line x1="'+ML2+'" y1="'+MT2+'" x2="'+ML2+'" y2="'+PB2+'" stroke="#cbd5e1" stroke-width="1.2"/>';
    g+='<line x1="'+ML2+'" y1="'+PB2+'" x2="'+(W2-MR2)+'" y2="'+PB2+'" stroke="#c7cdda" stroke-width="1.2"/>';
    var tags=[];
    function addLine(arr,key,col,dash){
      var shp='';for(var k2=0;k2<cnt;k2++)if(arr[k2]!=null)shp+=(shp?' ':'')+X2(k2).toFixed(1)+','+Y2(arr[k2]).toFixed(1);
      if(!shp)return;
      g+='<polyline data-lg="'+key+'" points="'+shp+'" fill="none" stroke="'+col+'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" opacity=".9" '+(dash?'stroke-dasharray="6 4" ':'')+'vector-effect="non-scaling-stroke"/>';
      var last=shp.split(' ')[shp.split(' ').length-1].split(',');
      g+='<circle data-lg="'+key+'" cx="'+last[0]+'" cy="'+last[1]+'" r="3.6" fill="'+col+'" stroke="#fff" stroke-width="1.3"/>';
      tags.push({nm:key==='csi'?'中证全指':key.slice(4),col:col,x:parseFloat(last[0]),y:parseFloat(last[1]),lk:key});
    }
    addLine(csiD,'csi','#94a3b8',true);
    pointSel.forEach(function(nm){addLine(shD[nm]||[],'idx:'+nm,iCol(nm),false);});
    if(tags.length){
      tags.sort(function(a,b){return a.y-b.y;});
      var tLo=MT2+F*0.6,tHi=PB2-F*1.2,tGap=F*1.4;
      if((tags.length-1)*tGap>tHi-tLo)tGap=(tHi-tLo)/Math.max(1,tags.length-1);
      var tFs=Math.min(F*0.95,tGap*0.78);
      tags[0].y=Math.max(tags[0].y,tLo);
      for(var ti=1;ti<tags.length;ti++)if(tags[ti].y<tags[ti-1].y+tGap)tags[ti].y=tags[ti-1].y+tGap;
      if(tags[tags.length-1].y>tHi){tags[tags.length-1].y=tHi;for(var tj=tags.length-2;tj>=0;tj--)if(tags[tj].y>tags[tj+1].y-tGap)tags[tj].y=tags[tj+1].y-tGap;}
      tags.forEach(function(t){g+='<text data-lg="'+t.lk+'" x="'+(t.x-6).toFixed(1)+'" y="'+(t.y+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+tFs.toFixed(1)+'" font-weight="500" fill="'+t.col+'" stroke="#fcfdff" stroke-width="3" paint-order="stroke">'+t.nm+'</text>';});
    }
    plot2.innerHTML=g;
    ov2.setAttribute('x',ML2);ov2.setAttribute('width',pw2);ov2.setAttribute('y',MT2);ov2.setAttribute('height',plotH2);
    vline2.setAttribute('y1',MT2);vline2.setAttribute('y2',PB2);
    if(legend2){
      function sRet(a){var f=firstVal(a),l=lastVal(a);return (f!=null&&l!=null&&f!==0)?((l/f-1)*100):null;}
      function rTxt(r){return r==null?'':(' '+(r>=0?'+':'')+r.toFixed(2)+'%');}
      var sw='<span style="display:inline-block;width:18px;height:0;border-top:3px solid currentColor;vertical-align:middle;margin-right:6px"></span>';
      var l2='<span class="lrow"><span class="lg" data-lg="csi" style="color:#64748b"><span class="lgsw dash"></span>中证全指（全市场基准）'+rTxt(sRet(csiD))+'</span>';
      pointSel.forEach(function(nm){l2+='<span class="lg" data-lg="idx:'+nm+'" style="color:'+iCol(nm)+'">'+sw+nm+rTxt(sRet(shD[nm]||[]))+'</span>';});
      l2+='<span class="lgnote">'+(en?'归一化·基期=100；右侧%为区间涨跌':'真实收盘点位；右侧%为区间涨跌')+'；中证全指对应主图全市场份额，走势线仅作行情参照，不代表资金流向。</span></span>';
      legend2.innerHTML=l2;
    }
    v.start2=cur;
  }
  function pick2(clientX,clientY){
    var v=window._etfView;if(!v||!v.idx.length)return;
    var r=svg2.getBoundingClientRect();if(!r.width)return;
    var mx=(clientX-r.left)*(W2/r.width),cnt=v.idx.length,k=Math.round((mx-ML2)/pw2*(cnt-1));k=Math.max(0,Math.min(cnt-1,k));
    var xx=ML2+pw2*(cnt<=1?0:k/(cnt-1));vline2.setAttribute('x1',xx);vline2.setAttribute('x2',xx);vline2.style.opacity=1;
    syncCross(k,2);
    var en=effNorm(),csiD=en?(v.csiN||[]):(v.csi||[]),html='<div class="t-d">'+v.dd[k]+' · 指数走势</div>';
    function row(nm,arr,col,raw){
      var dv=arr[k],base=firstVal(arr),pct=(dv!=null&&base)?((dv/base-1)*100):null;
      html+='<div class="t-r"><span style="color:'+col+'">— '+nm+'</span><b style="color:'+col+'">'+(dv!=null?dv.toFixed(2):'—')+(pct!=null?'（'+(pct>=0?'+':'')+pct.toFixed(2)+'%）':'')+(raw!=null?' · 点位'+raw.toFixed(2):'')+'</b></div>';
    }
    row('中证全指',csiD,'#64748b',(v.csi&&v.csi[k]!=null)?v.csi[k]:null);
    pointSel.forEach(function(nm){row(nm,v.shD[nm]||[],iCol(nm),(v.sh&&v.sh[nm]&&v.sh[nm][k]!=null)?v.sh[nm][k]:null);});
    tip2.innerHTML=html;
    var b2=box2.getBoundingClientRect(),tx=clientX-b2.left+14;if(tx+200>b2.width)tx=clientX-b2.left-200;
    var ty=clientY-b2.top-10;if(ty<0)ty=0;tip2.style.left=tx+'px';tip2.style.top=ty+'px';tip2.style.opacity=1;
  }
  var W3=1000,MT3=34,PB3=262,ML3=70,MR3=118,pw3=W3-ML3-MR3,plotH3=PB3-MT3;
  function drawE3(){
    if(!hasSub3)return;syncSubVisible();
    var v=window._etfView;
    if(!v||!v.idx.length||!etfSel.length){plot3.innerHTML='';if(legend3)legend3.innerHTML='';return;}
    var m=metrics(),F=m.F,nl=m.nl,cnt=v.idx.length,ecN=v.ecN||{},all=[];
    etfSel.forEach(function(c){(ecN[c]||[]).forEach(function(x){if(x!=null)all.push(x);});});
    var slo=0,shi=1;
    if(all.length){var smn=Math.min.apply(null,all),smx=Math.max.apply(null,all),sp=(smx-smn)*0.12;if(sp<=0)sp=Math.max(1,smx*0.02);slo=smn-sp;shi=smx+sp;}
    function X3(k){return ML3+pw3*(cnt<=1?0:k/(cnt-1));}
    function Y3(val){return MT3+plotH3*((shi-val)/(shi-slo));}
    var g='';
    for(var k=0;k<=4;k++){
      var yy=MT3+plotH3*k/4,val=shi-(shi-slo)*k/4;
      g+='<line x1="'+ML3+'" y1="'+yy.toFixed(1)+'" x2="'+(W3-MR3)+'" y2="'+yy.toFixed(1)+'" stroke="#eef1f6"/>';
      g+='<text x="'+(ML3-8)+'" y="'+(yy+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#64748b">'+Math.round(val)+'</text>';
      g+='<text x="'+(W3-4)+'" y="'+(yy+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+F.toFixed(1)+'" fill="#94a3b8">'+(k===0?'100':'')+'</text>';
    }
    for(var j=0;j<nl;j++){
      var kk=Math.round(j*(cnt-1)/((nl-1)||1)),xx=X3(kk);
      g+='<line x1="'+xx.toFixed(1)+'" y1="'+MT3+'" x2="'+xx.toFixed(1)+'" y2="'+PB3+'" stroke="#f4f6fa"/>';
      var lab=v.dd[kk];if(G!=='d')lab=lab.slice(0,7);
      g+='<text x="'+xx.toFixed(1)+'" y="'+(PB3+9+F*1.2).toFixed(1)+'" text-anchor="middle" font-size="'+F.toFixed(1)+'" fill="#8b95a7">'+lab.slice(2)+'</text>';
    }
    g+='<text x="14" y="'+(MT3-12)+'" font-size="'+(F*1.05).toFixed(1)+'" font-weight="500" fill="#64748b">ETF净值走势（归一化·基期=100）</text>';
    g+='<line x1="'+ML3+'" y1="'+MT3+'" x2="'+ML3+'" y2="'+PB3+'" stroke="#cbd5e1" stroke-width="1.2"/>';
    g+='<line x1="'+ML3+'" y1="'+PB3+'" x2="'+(W3-MR3)+'" y2="'+PB3+'" stroke="#c7cdda" stroke-width="1.2"/>';
    var tags=[];
    etfSel.forEach(function(c,oi){
      var arr=ecN[c]||[],shp='';
      for(var k2=0;k2<cnt;k2++)if(arr[k2]!=null)shp+=(shp?' ':'')+X3(k2).toFixed(1)+','+Y3(arr[k2]).toFixed(1);
      if(!shp)return;
      var col=eCol(c,oi),lk='etf:'+c;
      g+='<polyline data-lg="'+lk+'" points="'+shp+'" fill="none" stroke="'+col+'" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" opacity=".92" stroke-dasharray="6 3" vector-effect="non-scaling-stroke"/>';
      var last=shp.split(' ')[shp.split(' ').length-1].split(',');
      g+='<circle data-lg="'+lk+'" cx="'+last[0]+'" cy="'+last[1]+'" r="3.8" fill="'+col+'" stroke="#fff" stroke-width="1.4"/>';
      tags.push({nm:eLabel(c),col:col,x:parseFloat(last[0]),y:parseFloat(last[1]),lk:lk});
    });
    if(tags.length){
      tags.sort(function(a,b){return a.y-b.y;});
      var tLo=MT3+F*0.6,tHi=PB3-F*1.2,tGap=F*1.4;
      if((tags.length-1)*tGap>tHi-tLo)tGap=(tHi-tLo)/Math.max(1,tags.length-1);
      var tFs=Math.min(F*0.95,tGap*0.78);
      tags[0].y=Math.max(tags[0].y,tLo);
      for(var ti=1;ti<tags.length;ti++)if(tags[ti].y<tags[ti-1].y+tGap)tags[ti].y=tags[ti-1].y+tGap;
      if(tags[tags.length-1].y>tHi){tags[tags.length-1].y=tHi;for(var tj=tags.length-2;tj>=0;tj--)if(tags[tj].y>tags[tj+1].y-tGap)tags[tj].y=tags[tj+1].y-tGap;}
      tags.forEach(function(t){g+='<text data-lg="'+t.lk+'" x="'+(t.x-6).toFixed(1)+'" y="'+(t.y+F*0.35).toFixed(1)+'" text-anchor="end" font-size="'+tFs.toFixed(1)+'" font-weight="500" fill="'+t.col+'" stroke="#fcfdff" stroke-width="3" paint-order="stroke">'+t.nm+'</text>';});
    }
    plot3.innerHTML=g;
    ov3.setAttribute('x',ML3);ov3.setAttribute('width',pw3);ov3.setAttribute('y',MT3);ov3.setAttribute('height',plotH3);
    vline3.setAttribute('y1',MT3);vline3.setAttribute('y2',PB3);
    if(legend3){
      function sRet3(a){var f=firstVal(a),l=lastVal(a);return (f!=null&&l!=null&&f!==0)?((l/f-1)*100):null;}
      var its=[];
      etfSel.forEach(function(c){var r=sRet3(ecN[c]||[]);its.push({r:r,html:'<span class="lg" data-lg="etf:'+c+'" style="color:'+eCol(c,etfSel.indexOf(c))+'">┄ '+eLabel(c)+'</span>'});});
      its.sort(function(a,b){return (b.r==null?-Infinity:b.r)-(a.r==null?-Infinity:a.r);});
      legend3.innerHTML='<span class="lrow">'+its.map(function(x){return x.html;}).join('')+'<span class="lgnote">前复权净值归一化（基期=100）；鼠标悬停查看当日数值；ETF列表按当前所选指数过滤。</span></span>';
    }
    v.start3=cur;
  }
  function pick3(clientX,clientY){
    var v=window._etfView;if(!v||!v.idx.length)return;
    var r=svg3.getBoundingClientRect();if(!r.width)return;
    var mx=(clientX-r.left)*(W3/r.width),cnt=v.idx.length,k=Math.round((mx-ML3)/pw3*(cnt-1));k=Math.max(0,Math.min(cnt-1,k));
    var xx=ML3+pw3*(cnt<=1?0:k/(cnt-1));vline3.setAttribute('x1',xx);vline3.setAttribute('x2',xx);vline3.style.opacity=1;
    var html='<div class="t-d">'+v.dd[k]+' · ETF净值走势</div>';
    etfSel.forEach(function(c,oi){
      var a=(v.ecN&&v.ecN[c])||[],dv=a[k],base=firstVal(a),pct=(dv!=null&&base)?(dv-base):null;
      var raw=(v.ec&&v.ec[c]&&v.ec[c][k]!=null)?v.ec[c][k].toFixed(3):'—';
      html+='<div class="t-r"><span style="color:'+eCol(c,oi)+'">┄ '+(emeta[c]?emeta[c].name:c)+'</span><b style="color:'+eCol(c,oi)+'">'+(dv!=null?dv.toFixed(2):'—')+(pct!=null?'（'+(pct>=0?'+':'')+pct.toFixed(2)+'）':'')+' · 净值'+raw+'</b></div>';
    });
    tip3.innerHTML=html;
    var b3=box3.getBoundingClientRect(),tx=clientX-b3.left+14;if(tx+200>b3.width)tx=clientX-b3.left-200;
    var ty=clientY-b3.top-10;if(ty<0)ty=0;tip3.style.left=tx+'px';tip3.style.top=ty+'px';tip3.style.opacity=1;
  }
  function hideTips2(){clearSubCross();tip2.style.opacity=0;}
  function hideTips3(){if(!hasSub3)return;vline3.style.opacity=0;tip3.style.opacity=0;}
  if(hasSub){
    ov2.addEventListener('mousemove',function(e){pick2(e.clientX,e.clientY);});
    ov2.addEventListener('mouseleave',hideTips2);
    ov2.addEventListener('touchstart',function(e){if(e.touches[0])pick2(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
    ov2.addEventListener('touchmove',function(e){if(e.touches[0])pick2(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
    ov2.addEventListener('touchend',hideTips2);
  }
  if(hasSub3){
    ov3.addEventListener('mousemove',function(e){pick3(e.clientX,e.clientY);});
    ov3.addEventListener('mouseleave',hideTips3);
    ov3.addEventListener('touchstart',function(e){if(e.touches[0])pick3(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
    ov3.addEventListener('touchmove',function(e){if(e.touches[0])pick3(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
    ov3.addEventListener('touchend',hideTips3);
  }
  function hideTips(){vline.style.opacity=0;tip.style.opacity=0;if(hasSub)hideTips2();hideTips3();}
  ov.addEventListener('mousemove',function(e){pick(e.clientX,e.clientY);});
  ov.addEventListener('mouseleave',hideTips);
  ov.addEventListener('touchstart',function(e){if(e.touches[0])pick(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
  ov.addEventListener('touchmove',function(e){if(e.touches[0])pick(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
  ov.addEventListener('touchend',hideTips);
  var rt=null;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){drawE(cur);},180);});
  var compat=document.getElementById('eIdxSel'),btn=document.getElementById('eIdxBtn'),
      panel=document.getElementById('eIdxPanel'),list=document.getElementById('eIdxList');
  var eBtn=document.getElementById('eEtfBtn'),ePanel=document.getElementById('eEtfPanel'),
      eList=document.getElementById('eEtfList'),eCompat=document.getElementById('eEtfSel');
  function btnLabel(){return pointSel.length===0?'全部汇总':(pointSel.length===1?pointSel[0]:pointSel.length+'个指数');}
  function eBtnLabel(){return etfSel.length===0?'无':(etfSel.length===1?(emeta[etfSel[0]]?emeta[etfSel[0]].name:etfSel[0]):etfSel.length+'只ETF');}
  function syncCompat(){if(compat)compat.value=pointSel.length===0?ALLKEY:pointSel.join(',');if(eCompat)eCompat.value=etfSel.length===0?ALLKEY:etfSel.join(',');}
  // ETF池：单选=该指数成分；多选=所选各指数成分的并集（不再返回全部，避免选2个指数就列出30只）
  function etfPool(){
    if(pointSel.length===1)return EM.filter(function(m){return m.idx===pointSel[0];});
    if(pointSel.length>1)return EM.filter(function(m){return pointSel.indexOf(m.idx)>=0;});
    return EM;
  }
  function buildPanel(){if(list){
    list.innerHTML='<label class="idx-item"><input type="checkbox" value="'+ALLKEY+'"'+(pointSel.length===0?' checked':'')+'><span>全部（12指数）</span></label>'
      +IDXN.map(function(n){return '<label class="idx-item"><input type="checkbox" value="'+n+'"'+(pointSel.indexOf(n)>=0?' checked':'')+'><span>'+n+'</span></label>';}).join('');
    list.querySelectorAll('input').forEach(function(c){c.addEventListener('change',function(){
      if(c.value===ALLKEY){if(c.checked)list.querySelectorAll('input').forEach(function(x){if(x.value!==ALLKEY)x.checked=false;});}
      else if(c.checked){var a=list.querySelector('input[value="'+ALLKEY+'"]');if(a)a.checked=false;}
      syncSel();applySel(true);
    });});
  }}
  function buildEtfPanel(){if(eList){
    var pool=etfPool();
    eList.innerHTML='<label class="idx-item"><input type="checkbox" value="'+ALLKEY+'"'+(etfSel.length===0?' checked':'')+'><span>无（默认）</span></label>'
      +pool.map(function(m){return '<label class="idx-item"><input type="checkbox" value="'+m.code+'"'+(etfSel.indexOf(m.code)>=0?' checked':'')+'><span>'+m.name+'</span></label>';}).join('');
    eList.querySelectorAll('input').forEach(function(c){c.addEventListener('change',function(){
      if(c.value===ALLKEY){if(c.checked)eList.querySelectorAll('input').forEach(function(x){if(x.value!==ALLKEY)x.checked=false;});}
      else if(c.checked){var a=eList.querySelector('input[value="'+ALLKEY+'"]');if(a)a.checked=false;}
      syncEtfSel();applySel();
    });});
  }}
  // idxChanged=指数勾选变化触发。图3已开(etfSel非空)时切单选指数→自动换成该指数全部成分ETF；
  // 图3未开(etfSel空)时不自动打开；外部 setSel/setEtfSel 传默认false，不触发自动切换。
  function applySel(idxChanged){
    hideTips();
    if(pointSel.length>0){
      var pool=etfPool(),ok={};pool.forEach(function(m){ok[m.code]=1;});
      if(idxChanged&&etfSel.length>0){etfSel=pool.map(function(m){return m.code;});}
      else etfSel=etfSel.filter(function(c){return ok[c];});
    }
    syncCompat();buildPanel();buildEtfPanel();
    if(btn)btn.textContent=btnLabel();if(eBtn)eBtn.textContent=eBtnLabel();drawE(cur);
  }
  function syncSel(){var sel=list.querySelectorAll('input:checked');pointSel=[];sel.forEach(function(c){if(c.value!==ALLKEY&&IDXN.indexOf(c.value)>=0)pointSel.push(c.value);});}
  function syncEtfSel(){if(!eList)return;var sel=eList.querySelectorAll('input:checked');etfSel=[];sel.forEach(function(c){if(c.value!==ALLKEY&&emeta[c.value])etfSel.push(c.value);});}
  function setEtfSel(v){
    if(v==null||v===ALLKEY||v==='')etfSel=[];
    else if(typeof v==='string')etfSel=emeta[v]?[v]:[];
    else if(typeof v.length==='number'){etfSel=EM.map(function(m){return m.code;}).filter(function(c){return v.indexOf(c)>=0||v.indexOf(emeta[c].name)>=0;});}
    else etfSel=[];applySel();
  }
  window._etfSetEtfSel=setEtfSel;
  window._etfEtfGet=function(){return eCompat?eCompat.value:'';};
  function setSel(v){
    if(v==null||v===ALLKEY||v==='')pointSel=[];
    else if(typeof v==='string')pointSel=(IDXN.indexOf(v)>=0)?[v]:[];
    else if(typeof v.length==='number')pointSel=IDXN.filter(function(n){return v.indexOf(n)>=0;});
    else pointSel=[];applySel();
  }
  window._etfSetSel=setSel;
  window._etfSelGet=function(){return compat?compat.value:'';};
  var normChk=document.getElementById('eNormChk');
  window._etfNormGet=function(){return normMode;};
  window._etfNormSet=function(x){normMode=!!x;if(normChk)normChk.checked=normMode;hideTips();drawE(cur);};
  if(normChk)normChk.addEventListener('change',function(){normMode=normChk.checked;hideTips();drawE(cur);});
  if(compat)compat.addEventListener('change',function(){setSel(compat.value);});
  if(btn&&panel&&list){
    btn.addEventListener('click',function(e){e.stopPropagation();panel.classList.toggle('open');});
    panel.addEventListener('click',function(e){e.stopPropagation();});
    document.addEventListener('click',function(){panel.classList.remove('open');});
    panel.querySelectorAll('.idx-pact button').forEach(function(b){b.addEventListener('click',function(){
      var act=b.dataset.act,all=list.querySelector('input[value="'+ALLKEY+'"]');
      if(act==='all'){list.querySelectorAll('input').forEach(function(c){c.checked=(c.value!==ALLKEY);});if(all)all.checked=false;syncSel();applySel(true);}
      else if(act==='none'){list.querySelectorAll('input').forEach(function(c){c.checked=(c.value===ALLKEY);});syncSel();applySel(true);}
    });});
  }
  if(eBtn&&ePanel&&eList){
    eBtn.addEventListener('click',function(e){e.stopPropagation();ePanel.classList.toggle('open');});
    ePanel.addEventListener('click',function(e){e.stopPropagation();});
    document.addEventListener('click',function(){ePanel.classList.remove('open');});
    ePanel.querySelectorAll('.idx-pact button').forEach(function(b){b.addEventListener('click',function(){
      var act=b.dataset.act,all=eList.querySelector('input[value="'+ALLKEY+'"]');
      if(act==='all'){eList.querySelectorAll('input').forEach(function(c){c.checked=(c.value!==ALLKEY);});if(all)all.checked=false;syncEtfSel();applySel();}
      else if(act==='none'){eList.querySelectorAll('input').forEach(function(c){c.checked=(c.value===ALLKEY);});syncEtfSel();applySel();}
    });});
  }
  if(eCompat)eCompat.addEventListener('change',function(){setEtfSel(eCompat.value);});
  syncCompat();buildPanel();buildEtfPanel();if(btn)btn.textContent=btnLabel();if(eBtn)eBtn.textContent=eBtnLabel();
  document.querySelectorAll('#eRng .rng-btn').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('#eRng .rng-btn').forEach(function(x){x.classList.remove('active');});b.classList.add('active');
    document.querySelectorAll('#eRng .cr-btn').forEach(function(x){x.classList.remove('active');});
    curEnd=-1;cur=ER[b.dataset.range]||0;hideTips();drawE(cur);
  });});
  function edFind(ds,first){for(var i=first?0:N-1;first?i<N:i>=0;first?i++:i--){if(first?ED[i]>=ds:ED[i]<=ds)return i;}return first?N-1:0;}
  window._etfApplyRange=function(sd,ed){
    var cs=edFind(sd,true),ce=edFind(ed,false);if(cs>ce)ce=cs;
    cur=cs;curEnd=ce;hideTips();drawE(cur);
    document.querySelectorAll('#eRng .rng-btn').forEach(function(x){x.classList.remove('active');});
    document.querySelectorAll('#eRng .cr-btn').forEach(function(x){x.classList.add('active');});
    return {start:ED[cs],end:ED[ce]};
  };
  window._etfResetRange=function(){curEnd=-1;cur=ER[def]||0;hideTips();drawE(cur);};
  document.querySelectorAll('#segG button').forEach(function(b){b.addEventListener('click',function(){G=b.dataset.g;hideTips();drawE(cur);});});
  drawE(cur);
})();
