
(function(){
  const upColor = '#d63031', downColor = '#00b894';
  const idxData = [{"name":"上证指数","value":0.57},{"name":"深证成指","value":-0.24},{"name":"创业板指","value":-0.55},{"name":"沪深300","value":-0.15},{"name":"科创50","value":0.45},{"name":"中证1000","value":0.50},{"name":"中证500","value":0.26},{"name":"北证50","value":0.31},{"name":"中证全指","value":0.25}];

  const chartIndex = echarts.init(document.getElementById('chart-index'));
  chartIndex.setOption({
    title: { text: '主要指数涨跌幅', left: 'center', textStyle: { fontSize: 14, color: '#2d3436' } },
    tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '12%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: idxData.map(i => i.name).reverse(), axisLabel: { fontSize: 12 } },
    series: [{
      type: 'bar',
      data: idxData.map(i => ({ value: i.value, itemStyle: { color: i.value >= 0 ? upColor : downColor } })).reverse(),
      label: { show: true, position: 'right', formatter: '{c}%', color: '#2d3436' }
    }]
  });

  const sectorData = [
    {"name":"靶材","chg":7.71},{"name":"昨日连板","chg":5.93},{"name":"电子特气","chg":5.78},
    {"name":"煤炭开采","chg":4.56},{"name":"电子化学品Ⅱ","chg":4.73},{"name":"氦气","chg":5.50},
    {"name":"工业气体","chg":4.21},{"name":"玻璃玻纤","chg":3.85},{"name":"锗镓概念","chg":4.01},
    {"name":"小金属","chg":3.13},{"name":"贵金属","chg":2.78},{"name":"非金属材料Ⅱ","chg":3.19}
  ];
  const upSectors = sectorData.filter(s => s.chg >= 0).sort((a, b) => a.chg - b.chg);
  const chartSector = echarts.init(document.getElementById('chart-sector'));
  chartSector.setOption({
    title: { text: '重点板块涨跌幅（行业+概念领涨）', left: 'center', textStyle: { fontSize: 14, color: '#2d3436' } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c}%' },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '12%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: upSectors.map(s => s.name).reverse(), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar',
      data: upSectors.map(s => ({ value: s.chg, itemStyle: { color: upColor } })).reverse(),
      label: { show: true, position: 'right', formatter: '{c}%', color: '#2d3436', fontSize: 11 }
    }]
  });

  window.addEventListener('resize', () => { chartIndex.resize(); chartSector.resize(); });
})();
